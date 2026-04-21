# 🌴 The Curly Babus — Trip Dashboard

---

## 🔄 If you're just updating your code (most common)

Since your database and Cloudflare project are already set up, all you need to do is:

1. Go to your GitHub repo → delete all existing files (or just the ones that changed)
2. Click **"Add file" → "Upload files"**
3. Unzip `the-curly-babus-dashboard.zip` on your computer
4. **Drag everything inside the unzipped folder** (not the folder itself) into the GitHub upload window
5. Scroll down, click **"Commit changes"**

Cloudflare auto-redeploys within a minute. You'll see the live site update.

Your `wrangler.toml` already has your D1 database ID (`c749fa37-1cb8-4233-bd7d-7b8ed0cab1ff`) baked in, so nothing else to configure.

---

## 🆕 If you're starting completely fresh

### What you need
- A [GitHub account](https://github.com) (free)
- A [Cloudflare account](https://dash.cloudflare.com) (free)

### Step 1 — Upload files to GitHub
1. github.com → **"New repository"** → name it anything, set to Private → **Create**
2. On the new repo page, click **"uploading an existing file"**
3. Unzip the dashboard zip
4. **Drag everything inside the unzipped folder** into GitHub's upload window
5. Scroll down → **"Commit changes"**

### Step 2 — Create the Database in Cloudflare
1. dash.cloudflare.com → **"Workers & Pages"** → **"D1 SQL Database"**
2. **"Create database"** → name it anything → **Create**
3. Click the **"Console"** tab
4. Copy the contents of `schema.sql` (open in Notepad) into the console → **Execute**
5. **Important:** Copy your database's ID from the Cloudflare page and paste it into `wrangler.toml` replacing the one that's there
6. Re-upload the updated `wrangler.toml` to GitHub

### Step 3 — Deploy on Cloudflare Pages
1. **Workers & Pages** → **"Create"** → **"Pages"** → **"Connect to Git"**
2. Authorize GitHub → select your repo → **"Begin setup"**
3. Build settings:
   - Framework: **None**
   - Build command: *(blank)*
   - Build output directory: **`public`**
4. Expand **"Environment variables"** and add:
   - `ADMIN_PASSWORD` = `thecurlybabus`
   - `AVIATION_API_KEY` = *(leave blank for now)*
5. Click **"Save and Deploy"**

### Step 4 — Connect the Database
1. Click on your Pages project → **Settings** → **Functions**
2. Scroll to **"D1 database bindings"** → **"Add binding"**
   - Variable name: `DB`
   - D1 database: your database
3. Save → go to **Deployments** → **"Retry deployment"**

### Step 5 — Get Live Flight Data (Optional, do closer to trip)
1. [aviationstack.com](https://aviationstack.com) → free signup → copy API key
2. Cloudflare Pages project → Settings → Environment variables → edit `AVIATION_API_KEY` → paste key → Save
3. Redeploy from Deployments tab

The live flight status auto-activates within 48 hours of any flight.

---

## 🔐 Login
Password: `thecurlybabus`

---

## 🆘 If something breaks

**"Unauthorized" on login** → Settings → Environment variables → make sure `ADMIN_PASSWORD` = `thecurlybabus` → redeploy

**Data doesn't load** → Settings → Functions → D1 database bindings → confirm `DB` is bound to your database → retry deployment

**GitHub upload error** → Make sure you dragged the *contents* of the unzipped folder, not the folder itself. Files like `schema.sql` and `wrangler.toml` should be at the top level of your repo.

---

## 📍 How to use

- **Dashboard** — At a glance: guest counts, today's arrivals/departures, unpaid housing
- **Guests** — Add guests. Click a name to open their profile and add flights, update status, assign rooms, track payments
- **Flight Board** — FIDS-style view of all flights. **Click "+ Add Flight" to add one** (pick the guest from the dropdown)
- **Coordination** — Shows clusters of guests at the same airport within 30 min of each other — who shares a ride, who's at a different terminal
- **Attendance** — Nightly headcount bar chart
- **Itinerary** — Events calendar. Assign guests, auto-split costs
- **Housing** — Pool all Airbnb costs, auto-split per confirmed guest per night
- **Rooms** — Assign guests to specific rooms within properties
- **Payments** — Housing + events owed, quick pay updates, mark fully paid
- **Admin** — Manage transport types and event categories
