const ADMIN_PASSWORD = "thecurlybabus";

function auth(request, env) {
  const pwd = request.headers.get("X-Password") || "";
  const envPwd = (env && env.ADMIN_PASSWORD) ? env.ADMIN_PASSWORD : ADMIN_PASSWORD;
  return pwd === envPwd;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Password"
    }
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const parts = path.split("/");
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Password"
      }
    });
  }

  if (!auth(request, env)) return err("Unauthorized", 401);

  const DB = env.DB;
  let body = {};
  if (["POST","PUT","PATCH"].includes(method)) {
    try { body = await request.json(); } catch(e) {}
  }

  // ─── DASHBOARD ───────────────────────────────────────
  if (path === "dashboard") {
    const guests = await DB.prepare("SELECT status FROM guests").all();
    const rows = guests.results || [];
    const confirmed = rows.filter(r => r.status === "confirmed").length;
    const maybe = rows.filter(r => r.status === "maybe").length;
    const cantMakeIt = rows.filter(r => r.status === "cant_make_it").length;
    const adi = rows.filter(r => r.status === "adi").length;
    const today = new Date().toISOString().split("T")[0];
    const arrivingToday = await DB.prepare(
      "SELECT COUNT(*) as c FROM guests WHERE arrival_date = ?"
    ).bind(today).first();
    const departingToday = await DB.prepare(
      "SELECT COUNT(*) as c FROM guests WHERE departure_date = ?"
    ).bind(today).first();
    const eventsToday = await DB.prepare(
      "SELECT COUNT(*) as c FROM events WHERE event_date = ?"
    ).bind(today).first();
    const unpaid = await DB.prepare(
      "SELECT COUNT(*) as c FROM guests WHERE housing_paid < 1 AND status = 'confirmed' AND arrival_date IS NOT NULL"
    ).first();
    return json({
      total: rows.length, confirmed, maybe, cantMakeIt, adi,
      arrivingToday: arrivingToday?.c || 0,
      departingToday: departingToday?.c || 0,
      eventsToday: eventsToday?.c || 0,
      unpaidCount: unpaid?.c || 0
    });
  }

  // ─── GUESTS ──────────────────────────────────────────
  if (parts[0] === "guests" && !parts[1]) {
    if (method === "GET") {
      const guests = await DB.prepare(`
        SELECT g.*, t.name as team_name, r.name as room_name, p.name as property_name
        FROM guests g
        LEFT JOIN teams t ON g.team_id = t.id
        LEFT JOIN rooms r ON g.room_id = r.id
        LEFT JOIN properties p ON r.property_id = p.id
        ORDER BY g.name
      `).all();
      const glist = guests.results || [];
      for (const g of glist) {
        const grps = await DB.prepare(
          "SELECT gr.id, gr.name, gr.color FROM groups gr JOIN guest_groups gg ON gg.group_id = gr.id WHERE gg.guest_id = ?"
        ).bind(g.id).all();
        g.groups = grps.results || [];
      }
      return json(glist);
    }
    if (method === "POST") {
      const { name, phone, email, status, team_id, arrival_date, departure_date, notes, group_ids } = body;
      if (!name) return err("Name required");
      const r = await DB.prepare(
        "INSERT INTO guests (name,phone,email,status,team_id,arrival_date,departure_date,notes) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(name, phone||null, email||null, status||"confirmed", team_id||null, arrival_date||null, departure_date||null, notes||null).run();
      const gid = r.meta.last_row_id;
      if (group_ids && group_ids.length) {
        for (const gid2 of group_ids) {
          await DB.prepare("INSERT OR IGNORE INTO guest_groups (guest_id,group_id) VALUES (?,?)").bind(gid, gid2).run();
        }
      }
      return json({ id: gid });
    }
  }

  if (parts[0] === "guests" && parts[1] && !parts[2]) {
    const gid = parseInt(parts[1]);
    if (method === "GET") {
      const g = await DB.prepare(`
        SELECT g.*, t.name as team_name, r.name as room_name, r.id as room_id_actual,
               p.name as property_name, p.id as property_id
        FROM guests g
        LEFT JOIN teams t ON g.team_id = t.id
        LEFT JOIN rooms r ON g.room_id = r.id
        LEFT JOIN properties p ON r.property_id = p.id
        WHERE g.id = ?
      `).bind(gid).first();
      if (!g) return err("Not found", 404);
      const grps = await DB.prepare(
        "SELECT gr.id, gr.name, gr.color FROM groups gr JOIN guest_groups gg ON gg.group_id = gr.id WHERE gg.guest_id = ?"
      ).bind(gid).all();
      g.groups = grps.results || [];
      const flights = await DB.prepare(
        "SELECT f.*, tt.name as transport_name FROM flights f LEFT JOIN transport_types tt ON f.transport_type_id = tt.id WHERE f.guest_id = ? ORDER BY f.departure_datetime"
      ).bind(gid).all();
      g.flights = flights.results || [];
      const evts = await DB.prepare(`
        SELECT e.*, ec.name as category_name,
               COALESCE(eg.cost_override, e.total_cost / NULLIF((SELECT COUNT(*) FROM event_guests WHERE event_id = e.id),0)) as my_cost
        FROM events e
        JOIN event_guests eg ON eg.event_id = e.id AND eg.guest_id = ?
        LEFT JOIN event_categories ec ON e.category_id = ec.id
        ORDER BY e.event_date, e.start_time
      `).bind(gid).all();
      g.events = evts.results || [];
      return json(g);
    }
    if (method === "PUT") {
      const { name, phone, email, status, team_id, arrival_date, departure_date, notes, room_id, housing_override, housing_paid, payment_notes, group_ids } = body;
      await DB.prepare(`
        UPDATE guests SET name=?,phone=?,email=?,status=?,team_id=?,arrival_date=?,departure_date=?,
        notes=?,room_id=?,housing_override=?,housing_paid=?,payment_notes=? WHERE id=?
      `).bind(name,phone||null,email||null,status||"confirmed",team_id||null,arrival_date||null,
        departure_date||null,notes||null,room_id||null,housing_override||null,housing_paid||0,payment_notes||null,gid).run();
      if (group_ids !== undefined) {
        await DB.prepare("DELETE FROM guest_groups WHERE guest_id=?").bind(gid).run();
        for (const gid2 of (group_ids||[])) {
          await DB.prepare("INSERT OR IGNORE INTO guest_groups (guest_id,group_id) VALUES (?,?)").bind(gid, gid2).run();
        }
      }
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM guests WHERE id=?").bind(gid).run();
      return json({ ok: true });
    }
  }

  // ─── GROUPS ──────────────────────────────────────────
  if (parts[0] === "groups" && !parts[1]) {
    if (method === "GET") {
      const r = await DB.prepare("SELECT * FROM groups ORDER BY name").all();
      return json(r.results || []);
    }
    if (method === "POST") {
      const { name, color } = body;
      if (!name) return err("Name required");
      const r = await DB.prepare("INSERT INTO groups (name,color) VALUES (?,?)").bind(name, color||"#3b82f6").run();
      return json({ id: r.meta.last_row_id });
    }
  }
  if (parts[0] === "groups" && parts[1]) {
    const id = parseInt(parts[1]);
    if (method === "PUT") {
      const { name, color } = body;
      await DB.prepare("UPDATE groups SET name=?,color=? WHERE id=?").bind(name, color, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM groups WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  // ─── TEAMS ───────────────────────────────────────────
  if (parts[0] === "teams" && !parts[1]) {
    if (method === "GET") {
      const r = await DB.prepare("SELECT * FROM teams ORDER BY name").all();
      return json(r.results || []);
    }
    if (method === "POST") {
      const { name } = body;
      if (!name) return err("Name required");
      const r = await DB.prepare("INSERT INTO teams (name) VALUES (?)").bind(name).run();
      return json({ id: r.meta.last_row_id });
    }
  }
  if (parts[0] === "teams" && parts[1]) {
    const id = parseInt(parts[1]);
    if (method === "PUT") {
      await DB.prepare("UPDATE teams SET name=? WHERE id=?").bind(body.name, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM teams WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  // ─── TRANSPORT TYPES ──────────────────────────────────
  if (parts[0] === "transport-types" && !parts[1]) {
    if (method === "GET") {
      const r = await DB.prepare("SELECT * FROM transport_types ORDER BY name").all();
      return json(r.results || []);
    }
    if (method === "POST") {
      const r = await DB.prepare("INSERT INTO transport_types (name) VALUES (?)").bind(body.name).run();
      return json({ id: r.meta.last_row_id });
    }
  }
  if (parts[0] === "transport-types" && parts[1]) {
    const id = parseInt(parts[1]);
    if (method === "PUT") {
      await DB.prepare("UPDATE transport_types SET name=? WHERE id=?").bind(body.name, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM transport_types WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  // ─── EVENT CATEGORIES ────────────────────────────────
  if (parts[0] === "event-categories" && !parts[1]) {
    if (method === "GET") {
      const r = await DB.prepare("SELECT * FROM event_categories ORDER BY name").all();
      return json(r.results || []);
    }
    if (method === "POST") {
      const r = await DB.prepare("INSERT INTO event_categories (name) VALUES (?)").bind(body.name).run();
      return json({ id: r.meta.last_row_id });
    }
  }
  if (parts[0] === "event-categories" && parts[1]) {
    const id = parseInt(parts[1]);
    if (method === "PUT") {
      await DB.prepare("UPDATE event_categories SET name=? WHERE id=?").bind(body.name, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM event_categories WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  // ─── PROPERTIES ──────────────────────────────────────
  if (parts[0] === "properties" && !parts[1]) {
    if (method === "GET") {
      const r = await DB.prepare("SELECT * FROM properties ORDER BY checkin_date").all();
      const props = r.results || [];
      for (const p of props) {
        const rooms = await DB.prepare("SELECT * FROM rooms WHERE property_id=? ORDER BY name").bind(p.id).all();
        p.rooms = rooms.results || [];
      }
      return json(props);
    }
    if (method === "POST") {
      const { name, total_cost, checkin_date, checkout_date, address, notes } = body;
      if (!name || !checkin_date || !checkout_date) return err("Name, checkin, checkout required");
      const r = await DB.prepare(
        "INSERT INTO properties (name,total_cost,checkin_date,checkout_date,address,notes) VALUES (?,?,?,?,?,?)"
      ).bind(name, total_cost||0, checkin_date, checkout_date, address||null, notes||null).run();
      return json({ id: r.meta.last_row_id });
    }
  }
  if (parts[0] === "properties" && parts[1]) {
    const id = parseInt(parts[1]);
    if (method === "PUT") {
      const { name, total_cost, checkin_date, checkout_date, address, notes } = body;
      await DB.prepare(
        "UPDATE properties SET name=?,total_cost=?,checkin_date=?,checkout_date=?,address=?,notes=? WHERE id=?"
      ).bind(name, total_cost||0, checkin_date, checkout_date, address||null, notes||null, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM properties WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  // ─── ROOMS ───────────────────────────────────────────
  if (parts[0] === "rooms" && !parts[1]) {
    if (method === "GET") {
      const r = await DB.prepare(`
        SELECT r.*, p.name as property_name FROM rooms r
        JOIN properties p ON r.property_id = p.id ORDER BY p.name, r.name
      `).all();
      return json(r.results || []);
    }
    if (method === "POST") {
      const { property_id, name } = body;
      if (!property_id || !name) return err("property_id and name required");
      const r = await DB.prepare("INSERT INTO rooms (property_id,name) VALUES (?,?)").bind(property_id, name).run();
      return json({ id: r.meta.last_row_id });
    }
  }
  if (parts[0] === "rooms" && parts[1]) {
    const id = parseInt(parts[1]);
    if (method === "PUT") {
      await DB.prepare("UPDATE rooms SET name=? WHERE id=?").bind(body.name, id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM rooms WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  // ─── FLIGHTS ─────────────────────────────────────────
  if (parts[0] === "flights" && !parts[1]) {
    if (method === "GET") {
      const guestId = url.searchParams.get("guest_id");
      let q = `SELECT f.*, g.name as guest_name, tt.name as transport_name
               FROM flights f JOIN guests g ON g.id = f.guest_id
               LEFT JOIN transport_types tt ON f.transport_type_id = tt.id`;
      if (guestId) {
        const r = await DB.prepare(q + " WHERE f.guest_id=? ORDER BY f.departure_datetime").bind(guestId).all();
        return json(r.results || []);
      }
      const r = await DB.prepare(q + " ORDER BY f.departure_datetime").all();
      return json(r.results || []);
    }
    if (method === "POST") {
      const { guest_id, type, airline, flight_number, origin_city, origin_code,
              destination_city, destination_code, departure_terminal, departure_terminal_2,
              arrival_terminal, arrival_terminal_2, departure_datetime, arrival_datetime,
              transport_type_id, transport_notes } = body;
      if (!guest_id || !type) return err("guest_id and type required");
      const r = await DB.prepare(`
        INSERT INTO flights (guest_id,type,airline,flight_number,origin_city,origin_code,
        destination_city,destination_code,departure_terminal,departure_terminal_2,
        arrival_terminal,arrival_terminal_2,departure_datetime,arrival_datetime,
        transport_type_id,transport_notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(guest_id,type,airline||null,flight_number||null,origin_city||null,origin_code||null,
        destination_city||null,destination_code||null,departure_terminal||null,departure_terminal_2||null,
        arrival_terminal||null,arrival_terminal_2||null,departure_datetime||null,arrival_datetime||null,
        transport_type_id||null,transport_notes||null).run();
      return json({ id: r.meta.last_row_id });
    }
  }
  if (parts[0] === "flights" && parts[1] === "board") {
    const allFlights = await DB.prepare(`
      SELECT f.*, g.name as guest_name, g.status as guest_status,
             tt.name as transport_name
      FROM flights f JOIN guests g ON g.id = f.guest_id
      LEFT JOIN transport_types tt ON f.transport_type_id = tt.id
      WHERE f.departure_datetime IS NOT NULL OR f.arrival_datetime IS NOT NULL
      ORDER BY COALESCE(f.departure_datetime, f.arrival_datetime)
    `).all();
    const flights = allFlights.results || [];
    // Group by same flight number
    const grouped = {};
    for (const f of flights) {
      const key = f.flight_number ? `${f.flight_number}|${f.type}|${(f.departure_datetime||'').split('T')[0]}` : `solo|${f.id}`;
      if (!grouped[key]) grouped[key] = { ...f, passengers: [] };
      grouped[key].passengers.push({ id: f.guest_id, name: f.guest_name, status: f.guest_status });
    }
    return json(Object.values(grouped));
  }
  if (parts[0] === "flights" && parts[1] === "coordination") {
    const allFlights = await DB.prepare(`
      SELECT f.*, g.name as guest_name, g.status as guest_status
      FROM flights f JOIN guests g ON g.id = f.guest_id
      WHERE f.arrival_datetime IS NOT NULL OR f.departure_datetime IS NOT NULL
      ORDER BY COALESCE(f.arrival_datetime, f.departure_datetime)
    `).all();
    const flights = allFlights.results || [];
    // Build coordination clusters
    const clusters = [];
    // Group by airport + date + type (inbound=arrivals at destination, outbound=departures from origin)
    const byAirportDate = {};
    for (const f of flights) {
      const airport = f.type === "inbound" ? f.destination_code : f.origin_code;
      const dt = f.type === "inbound" ? f.arrival_datetime : f.departure_datetime;
      if (!airport || !dt) continue;
      const date = dt.split("T")[0];
      const key = `${airport}|${date}|${f.type}`;
      if (!byAirportDate[key]) byAirportDate[key] = { airport, date, type: f.type, flights: [] };
      byAirportDate[key].flights.push(f);
    }
    for (const group of Object.values(byAirportDate)) {
      const sorted = group.flights.sort((a,b) => {
        const ta = (a.type==="inbound" ? a.arrival_datetime : a.departure_datetime) || "";
        const tb = (b.type==="inbound" ? b.arrival_datetime : b.departure_datetime) || "";
        return ta.localeCompare(tb);
      });
      // cluster within 30 minutes
      const used = new Set();
      for (let i = 0; i < sorted.length; i++) {
        if (used.has(i)) continue;
        const anchor = sorted[i];
        const anchorTime = new Date((anchor.type==="inbound" ? anchor.arrival_datetime : anchor.departure_datetime));
        const cluster = { airport: group.airport, date: group.date, type: group.type, members: [] };
        for (let j = i; j < sorted.length; j++) {
          const f = sorted[j];
          const ft = new Date((f.type==="inbound" ? f.arrival_datetime : f.departure_datetime));
          const diffMin = Math.abs(ft - anchorTime) / 60000;
          if (diffMin <= 30) {
            const terminal = f.type==="inbound" ? f.arrival_terminal : f.departure_terminal;
            cluster.members.push({
              id: f.id,
              guest_id: f.guest_id,
              name: f.guest_name,
              flight_number: f.flight_number,
              airline: f.airline,
              time: f.type==="inbound" ? f.arrival_datetime : f.departure_datetime,
              terminal: terminal || null,
              terminal_2: f.type==="inbound" ? f.arrival_terminal_2 : f.departure_terminal_2
            });
            used.add(j);
          }
        }
        if (cluster.members.length > 0) clusters.push(cluster);
      }
    }
    return json(clusters);
  }
  if (parts[0] === "flights" && parts[1] && !["board","coordination"].includes(parts[1])) {
    const id = parseInt(parts[1]);
    if (method === "PUT") {
      const { guest_id,type,airline,flight_number,origin_city,origin_code,
              destination_city,destination_code,departure_terminal,departure_terminal_2,
              arrival_terminal,arrival_terminal_2,departure_datetime,arrival_datetime,
              transport_type_id,transport_notes } = body;
      await DB.prepare(`
        UPDATE flights SET guest_id=?,type=?,airline=?,flight_number=?,origin_city=?,origin_code=?,
        destination_city=?,destination_code=?,departure_terminal=?,departure_terminal_2=?,
        arrival_terminal=?,arrival_terminal_2=?,departure_datetime=?,arrival_datetime=?,
        transport_type_id=?,transport_notes=? WHERE id=?
      `).bind(guest_id,type,airline||null,flight_number||null,origin_city||null,origin_code||null,
        destination_city||null,destination_code||null,departure_terminal||null,departure_terminal_2||null,
        arrival_terminal||null,arrival_terminal_2||null,departure_datetime||null,arrival_datetime||null,
        transport_type_id||null,transport_notes||null,id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM flights WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  // ─── LIVE FLIGHT STATUS ───────────────────────────────
  if (parts[0] === "flight-status" && parts[1]) {
    const flightNum = parts[1].toUpperCase();
    const flightDate = parts[2] || new Date().toISOString().split("T")[0];
    // Check cache (30 min)
    const cached = await DB.prepare(
      "SELECT * FROM flight_status_cache WHERE flight_number=? AND flight_date=?"
    ).bind(flightNum, flightDate).first();
    if (cached) {
      const age = (Date.now() - new Date(cached.cached_at).getTime()) / 1000 / 60;
      if (age < 30) return json({ cached: true, data: JSON.parse(cached.status_data) });
    }
    const apiKey = env.AVIATION_API_KEY || "";
    if (!apiKey || apiKey === "REPLACE_WITH_YOUR_AVIATIONSTACK_KEY") {
      return json({ error: "No API key configured", data: null });
    }
    try {
      const resp = await fetch(
        `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightNum}&flight_date=${flightDate}`
      );
      const data = await resp.json();
      const flight = data.data && data.data[0];
      if (flight) {
        const statusData = {
          status: flight.flight_status,
          departure: {
            scheduled: flight.departure?.scheduled,
            estimated: flight.departure?.estimated,
            actual: flight.departure?.actual,
            delay: flight.departure?.delay,
            terminal: flight.departure?.terminal,
            gate: flight.departure?.gate
          },
          arrival: {
            scheduled: flight.arrival?.scheduled,
            estimated: flight.arrival?.estimated,
            actual: flight.arrival?.actual,
            delay: flight.arrival?.delay,
            terminal: flight.arrival?.terminal,
            gate: flight.arrival?.gate,
            baggage: flight.arrival?.baggage
          },
          airline: flight.airline?.name,
          flight_iata: flight.flight?.iata
        };
        await DB.prepare(
          "INSERT OR REPLACE INTO flight_status_cache (flight_number,flight_date,status_data,cached_at) VALUES (?,?,?,CURRENT_TIMESTAMP)"
        ).bind(flightNum, flightDate, JSON.stringify(statusData)).run();
        return json({ cached: false, data: statusData });
      }
      return json({ data: null, error: "Flight not found" });
    } catch(e) {
      return json({ data: null, error: "API error: " + e.message });
    }
  }

  // ─── EVENTS ──────────────────────────────────────────
  if (parts[0] === "events" && !parts[1]) {
    if (method === "GET") {
      const r = await DB.prepare(`
        SELECT e.*, ec.name as category_name,
               COUNT(eg.guest_id) as guest_count
        FROM events e
        LEFT JOIN event_categories ec ON e.category_id = ec.id
        LEFT JOIN event_guests eg ON eg.event_id = e.id
        GROUP BY e.id ORDER BY e.event_date, e.start_time
      `).all();
      const evts = r.results || [];
      for (const evt of evts) {
        const gs = await DB.prepare(`
          SELECT g.id, g.name, eg.cost_override FROM guests g
          JOIN event_guests eg ON eg.guest_id = g.id WHERE eg.event_id=?
        `).bind(evt.id).all();
        evt.guests = gs.results || [];
      }
      return json(evts);
    }
    if (method === "POST") {
      const { title, event_date, start_time, end_time, location, description, category_id, total_cost, notes, guest_ids } = body;
      if (!title || !event_date) return err("title and event_date required");
      const r = await DB.prepare(`
        INSERT INTO events (title,event_date,start_time,end_time,location,description,category_id,total_cost,notes)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).bind(title, event_date, start_time||null, end_time||null, location||null,
        description||null, category_id||null, total_cost||null, notes||null).run();
      const eid = r.meta.last_row_id;
      for (const gid of (guest_ids||[])) {
        await DB.prepare("INSERT OR IGNORE INTO event_guests (event_id,guest_id) VALUES (?,?)").bind(eid, gid).run();
      }
      return json({ id: eid });
    }
  }
  if (parts[0] === "events" && parts[1]) {
    const eid = parseInt(parts[1]);
    if (method === "GET") {
      const evt = await DB.prepare(`
        SELECT e.*, ec.name as category_name FROM events e
        LEFT JOIN event_categories ec ON e.category_id = ec.id WHERE e.id=?
      `).bind(eid).first();
      if (!evt) return err("Not found", 404);
      const gs = await DB.prepare(`
        SELECT g.id, g.name, eg.cost_override FROM guests g
        JOIN event_guests eg ON eg.guest_id = g.id WHERE eg.event_id=?
      `).bind(eid).all();
      evt.guests = gs.results || [];
      return json(evt);
    }
    if (method === "PUT") {
      const { title, event_date, start_time, end_time, location, description, category_id, total_cost, notes, guest_ids } = body;
      await DB.prepare(`
        UPDATE events SET title=?,event_date=?,start_time=?,end_time=?,location=?,description=?,category_id=?,total_cost=?,notes=? WHERE id=?
      `).bind(title, event_date, start_time||null, end_time||null, location||null,
        description||null, category_id||null, total_cost||null, notes||null, eid).run();
      if (guest_ids !== undefined) {
        await DB.prepare("DELETE FROM event_guests WHERE event_id=?").bind(eid).run();
        for (const gid of (guest_ids||[])) {
          await DB.prepare("INSERT OR IGNORE INTO event_guests (event_id,guest_id) VALUES (?,?)").bind(eid, gid).run();
        }
      }
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await DB.prepare("DELETE FROM events WHERE id=?").bind(eid).run();
      return json({ ok: true });
    }
  }

  // ─── PAYMENTS ────────────────────────────────────────
  if (parts[0] === "payments" && parts[1]) {
    const gid = parseInt(parts[1]);
    if (method === "PUT") {
      const { housing_paid, payment_notes } = body;
      await DB.prepare("UPDATE guests SET housing_paid=?,payment_notes=? WHERE id=?")
        .bind(housing_paid||0, payment_notes||null, gid).run();
      return json({ ok: true });
    }
  }

  // ─── HOUSING CALCULATION ─────────────────────────────
  if (parts[0] === "housing" && parts[1] === "calculation") {
    const props = await DB.prepare("SELECT * FROM properties").all();
    const properties = props.results || [];
    const totalCost = properties.reduce((s, p) => s + (p.total_cost || 0), 0);
    if (!properties.length || !totalCost) return json({ totalCost: 0, nightly: [], guests: [] });

    let allNights = [];
    for (const p of properties) {
      const ci = new Date(p.checkin_date);
      const co = new Date(p.checkout_date);
      for (let d = new Date(ci); d < co; d.setDate(d.getDate()+1)) {
        allNights.push(d.toISOString().split("T")[0]);
      }
    }
    allNights = [...new Set(allNights)].sort();
    const totalNights = allNights.length;
    const nightlyCost = totalNights > 0 ? totalCost / totalNights : 0;

    const guests = await DB.prepare(
      "SELECT id,name,arrival_date,departure_date,status,housing_override,housing_paid FROM guests WHERE status='confirmed' AND arrival_date IS NOT NULL AND departure_date IS NOT NULL"
    ).all();
    const confirmedGuests = guests.results || [];

    const nightlyBreakdown = allNights.map(night => {
      const staying = confirmedGuests.filter(g => g.arrival_date <= night && g.departure_date > night);
      const perPerson = staying.length > 0 ? nightlyCost / staying.length : 0;
      return { night, staying: staying.length, perPerson };
    });

    const guestTotals = confirmedGuests.map(g => {
      if (g.housing_override !== null && g.housing_override !== undefined) {
        return { ...g, calculated: g.housing_override, override: true, nights_staying: 0 };
      }
      let total = 0;
      let nightsStaying = 0;
      for (const nb of nightlyBreakdown) {
        if (g.arrival_date <= nb.night && g.departure_date > nb.night) {
          total += nb.perPerson;
          nightsStaying++;
        }
      }
      return { ...g, calculated: total, override: false, nights_staying: nightsStaying };
    });

    return json({ totalCost, totalNights, nightlyCost, nightlyBreakdown, guests: guestTotals });
  }

  // ─── ATTENDANCE ──────────────────────────────────────
  if (parts[0] === "attendance") {
    const props = await DB.prepare("SELECT checkin_date, checkout_date FROM properties ORDER BY checkin_date").all();
    const propRows = props.results || [];
    let allDates = [];
    if (propRows.length) {
      const start = propRows[0].checkin_date;
      const end = propRows[propRows.length-1].checkout_date;
      const s = new Date(start), e = new Date(end);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split("T")[0]);
      }
    } else {
      // fallback - use guest dates
      const gDates = await DB.prepare("SELECT MIN(arrival_date) as mn, MAX(departure_date) as mx FROM guests").first();
      if (gDates && gDates.mn) {
        const s = new Date(gDates.mn), e = new Date(gDates.mx);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
          allDates.push(d.toISOString().split("T")[0]);
        }
      }
    }
    const guestsAll = await DB.prepare("SELECT id,name,status,arrival_date,departure_date FROM guests WHERE arrival_date IS NOT NULL AND departure_date IS NOT NULL").all();
    const allGuests = guestsAll.results || [];
    const result = allDates.map(date => {
      const present = allGuests.filter(g => g.arrival_date <= date && g.departure_date > date);
      return {
        date,
        confirmed: present.filter(g => g.status==="confirmed").length,
        maybe: present.filter(g => g.status==="maybe").length,
        adi: present.filter(g => g.status==="adi").length,
        guests: present
      };
    });
    return json(result);
  }

  return err("Not found", 404);
}
