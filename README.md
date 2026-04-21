# 🌴 Bachelor HQ — Setup Guide
### No terminal required. Just clicks.

---

## What you need
- A [GitHub account](https://github.com) (free)
- A [Cloudflare account](https://dash.cloudflare.com) (free)
- The zip file you downloaded

---

## Step 1 — Upload the files to GitHub

1. Go to **github.com** and click **"New repository"** (the green button top right)
2. Name it anything — e.g. `bachelor-trip`
3. Set it to **Private**
4. Click **"Create repository"**
5. On the next screen, click **"uploading an existing file"**
6. Unzip the `bachelor-trip-dashboard.zip` file on your computer
7. Open the unzipped folder — you'll see folders like `public/`, `functions/`, and files like `schema.sql`, `wrangler.toml`, etc.
8. **Drag everything inside the unzipped folder** into the GitHub upload window
9. Scroll down, click **"Commit changes"**

✅ Your code is now on GitHub.

---

## Step 2 — Create the Database in Cloudflare

1. Go to **dash.cloudflare.com** and log in
2. In the left sidebar, click **"Workers & Pages"** → then **"D1 SQL Database"**
3. Click **"Create database"**
4. Name it: `bachelor-trip-db`
5. Click **"Create"**
6. You'll land on the database page — click the **"Console"** tab
7. Copy and paste the entire contents of `schema.sql` (open it in any text editor — Notepad works fine) into the console box
8. Click **"Execute"**

✅ Your database is set up with all the tables.

---

## Step 3 — Deploy the App on Cloudflare Pages

1. In the Cloudflare dashboard, go to **"Workers & Pages"**
2. Click **"Create"** → **"Pages"** → **"Connect to Git"**
3. Click **"Connect GitHub"** and authorize Cloudflare
4. Select your `bachelor-trip` repository
5. Click **"Begin setup"**
6. On the build settings page:
   - **Framework preset:** None
   - **Build command:** *(leave completely blank)*
   - **Build output directory:** `public`
7. Expand **"Environment variables (advanced)"** and add these two:
   - Variable: `ADMIN_PASSWORD` → Value: `thecurlybabus`
   - Variable: `AVIATION_API_KEY` → Value: *(leave blank for now — see Step 5)*
8. Click **"Save and Deploy"**

It'll take about 1 minute to deploy. ✅

---

## Step 4 — Connect the Database to Your App

The app needs permission to talk to the database you created.

1. In **Workers & Pages**, click on your new `bachelor-trip` pages project
2. Go to **Settings** → **Functions**
3. Scroll down to **"D1 database bindings"**
4. Click **"Add binding"**
   - Variable name: `DB`
   - D1 database: select `bachelor-trip-db`
5. Click **"Save"**
6. Go to **Deployments** tab → click **"Retry deployment"** (the binding doesn't activate until you redeploy)

✅ Your app can now read and write to the database.

---

## Step 5 — Get Live Flight Data (Optional)

This only matters closer to the trip. Skip it for now if you want.

When you're ready:
1. Go to [aviationstack.com](https://aviationstack.com) → click **"Get Free API Key"**
2. Sign up with email — free, no credit card
3. Copy your API key from the dashboard
4. Back in Cloudflare → your Pages project → **Settings** → **Environment variables**
5. Edit `AVIATION_API_KEY` → paste your key
6. Click **"Save"**
7. Redeploy from the Deployments tab

The live flight status automatically activates within 48 hours of any flight. Outside that window it just shows "Scheduled" — totally fine.

---

## Done ✅

Your app is live at the URL Cloudflare gave you (something like `bachelor-trip-abc.pages.dev`).

**Login password:** `thecurlybabus`

---

## If something breaks

**"Unauthorized" on login**
→ Go to Settings → Environment variables → make sure `ADMIN_PASSWORD` is set to `thecurlybabus` exactly → redeploy

**Page loads but data doesn't show up**
→ The D1 binding might not be connected. Go to Settings → Functions → D1 database bindings → confirm `DB` is bound to `bachelor-trip-db` → retry deployment

**Files uploaded but GitHub shows an error**
→ Make sure you dragged the *contents* of the unzipped folder, not the folder itself. GitHub should show files like `schema.sql` at the top level, not inside another folder.
