# C-RAM Entertainment — Business Hub (`cram-hub`)

Your **private back office**: log in, manage clients (with website enquiries flowing
in), create tax invoices, keep your DJ roster, and export everything for EOFY.
It's a separate app from your website, but it shares the same Supabase database.

You've done this deploy flow twice now — it's the same steps.

---

## Step 1 — One small database addition (required, ~1 min)

The hub tracks how much each client has **paid** (deposits, balances) as a number.
Add that column:

- Supabase → **SQL Editor** → **New query**.
- Open **`hub-migration.sql`**, copy it all, paste, **Run**.

It's safe — it only *adds* a column. Your website keeps working exactly as before.

## Step 2 — Make sure you have a login (required)

This is the email + password you'll sign in with.

- Supabase → **Authentication** → **Users**.
- If you already added yourself when we first set up the database, you're set.
- If not: **Add user → Create new user**, enter your email + a strong password,
  turn **Auto Confirm User** ON, create.

## Step 3 — Deploy it (same as the website)

1. **New GitHub repo** (e.g. `cram-hub`). Keep it separate from `cram-site`.
2. Unzip `cram-hub.zip` and upload **everything inside** (`index.html`, `package.json`,
   `src/`, etc.). Keep the `src` folder's files inside it.
3. **Import to Vercel** → Add New → Project → pick `cram-hub`.
4. Add the **same two Environment Variables** you used for the website
   (Vercel → the project → **Settings → Environment Variables**):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://tppwaeyrlkwzakiqijzg.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your `sb_publishable_…` key |

5. **Deploy** (or if you deployed first, add the two values then **Redeploy**).

## Step 4 — Log in

Open the hub's `.vercel.app` address. You'll see a **Sign In** screen — use the email
and password from Step 2. That's it.

---

## What you'll find inside

- **Dashboard** — a quick overview.
- **CRM** — every client, including enquiries sent from your website (they appear as
  "Inquiry", source Website). Add, edit, track value + amount paid.
- **Invoices** — create GST tax invoices, save them, mark Paid/Sent, download a PDF.
- **DJ Roster**, **Content**, **Packages** — as before.
- **Settings** — your ABN, bank details, etc. (these show on invoices). Set your ABN
  here first — it's required on Australian tax invoices.
- **⬇ Export Excel** (top right) — download everything as a spreadsheet for EOFY.
- **Log out** — top right.

Everything you change is saved to your database, so it's there next time you log in,
and it's shared with the website (new enquiries just appear).

---

## Notes
- **It's genuinely private.** The database rules mean only your logged-in account can
  read or change this data. Someone opening the address just sees the sign-in screen.
- The **anon key is safe** to use here (same as the website).
- If the hub ever shows a red message like "column amount_paid does not exist", it means
  Step 1 hasn't run yet — run `hub-migration.sql` and reload.
- If a Vercel build fails, your last working version stays live. Paste me the red error
  text and I'll sort it.
