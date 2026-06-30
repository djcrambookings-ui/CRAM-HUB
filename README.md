# C-RAM Entertainment — Business Hub

Your DJ-business hub (CRM, invoices, roster, packages, content, settings) — now with
**real email sending** built in.

## What's new

The "Send invoice" flow now sends email **directly from the app**:

1. Click **Send** on an invoice → the Send window opens.
2. You see the **Subject** and **Message**, fully editable — review and tweak the wording
   before anything goes out.
3. Click **🚀 Send Now**. The email is delivered to the client, and the invoice is marked
   as sent.

Replies go to your business email (set in **Settings**), so client responses land in your
normal inbox.

> Sending runs through a tiny backend function, so your email key stays secret. That means
> the live **Send Now** button only works when the app is running **with the backend** —
> i.e. deployed (below) or via `vercel dev` locally. In a plain preview there's no backend,
> so it shows a friendly "couldn't reach the server" message instead.

## The pieces

- `src/App.jsx` — the app (React).
- `api/send-email.js` — a serverless function that sends the email via **Resend**.
- Your **Resend API key** lives only on the server (an environment variable), never in the
  app code.

---

## 1. Install

You'll need [Node.js](https://nodejs.org) (the LTS version). Then, in this folder:

```bash
npm install
```

## 2. Get a free Resend API key

1. Sign up at **https://resend.com** (free tier is 3,000 emails/month at the time of writing).
2. Go to **API Keys → Create API Key**, and copy the key (it starts with `re_`).

## 3. Run locally (with real sending)

Install the Vercel CLI once:

```bash
npm i -g vercel
```

Create a file named `.env` in this folder (copy `.env.example`) and paste your key:

```
RESEND_API_KEY=re_your_key_here
```

Then run:

```bash
vercel dev
```

Open the URL it prints (usually http://localhost:3000) — **Send Now** now works.

> `npm run dev` also runs the app, but **without** the backend, so sending won't work that
> way. Use `vercel dev` when you want to test sending.

For your first test, leave `FROM_EMAIL` unset. Resend will send from `onboarding@resend.dev`,
which can only email **your own** Resend account address — so put your own email on a test
client and send an invoice to yourself to confirm it works.

## 4. Deploy (so it works for real, anywhere)

Easiest path — **Vercel** (free):

1. Push this folder to a GitHub repo, **or** just run `vercel` in this folder and follow the prompts.
2. At **https://vercel.com**, import the project.
3. In the project's **Settings → Environment Variables**, add:
   - `RESEND_API_KEY` = your key
   - *(optional)* `FROM_EMAIL` = your send-from address (see step 5)
4. Deploy. You'll get a live URL you can bookmark and use on your phone.

Vercel automatically runs `api/send-email.js` as a serverless function — nothing else to configure.

## 5. Send from your own address (production)

So clients see the email coming from **you**, verify a domain in Resend:

1. Resend → **Domains → Add Domain** → enter `c-rament.com.au`.
2. Add the DNS records it shows you (in your domain registrar). Wait for status **Verified**.
3. Set the env var: `FROM_EMAIL=C-RAM Entertainment <bookings@c-rament.com.au>`
4. Redeploy.

Want to send from your **Gmail address** instead of the domain? Resend can't verify
`gmail.com` (you don't own that domain). For a Gmail "from", the function would instead send
via Gmail SMTP using an **App Password** — ask and I'll hand you that version.

---

## Your public website (runs from this app)

The app now serves your whole public site with client-side routing (once deployed):

- **Home** — `your-site.vercel.app/`
- **Our Services** — `/services`
- **Gallery** — `/gallery`
- **Get in touch** — `/get-in-touch`
- **Business Hub (admin)** — `/admin`

Visitors land on Home. You reach the admin hub at `/admin` or via the **Business Hub** link in the site footer; inside the hub, **🌐 View Site** takes you back to the public pages. The pages pull live from your app data, so your services, packages and prices stay in sync automatically. Videos and the about photo load straight from your existing c-rament.com.au media. When you're ready, point your real domain here or link to it.

## The enquiry form

Recreated from c-rament.com.au and wired into the app:

- **Public URL:** once deployed, `your-site.vercel.app/get-in-touch` shows the standalone enquiry
  form — Name, Email, Phone, Event Location, Number of People, Event Date, **Occasion** (dropdown),
  a **Service / Package** dropdown pulled straight from your app's packages, and a Message.
- **On submit** it emails the enquiry to your business address (reply-to set to the client, so you
  just hit Reply), and adds the person to your **CRM** as a new "Inquiry" lead.
- **Preview / manage** it anytime from the new **Get in Touch** tab inside the hub.
- Link your real website's menu to `your-site.vercel.app/get-in-touch` when you're ready.

> Heads-up: leads captured from the form live in memory for now (same as the rest of the CRM). The
> email always reaches you; persisting public leads across sessions needs the database step below.

---

## Troubleshooting

- **"Email is not configured: RESEND_API_KEY is missing"** — the env var isn't set. Add it in
  `.env` (local) or Vercel → Settings → Environment Variables, then restart / redeploy.
- **"can only send to your own email"** — you're still on the test address. Verify your domain
  (step 5) and set `FROM_EMAIL`.
- **Send Now does nothing in a preview** — expected; a preview has no backend. Use `vercel dev`
  or the deployed site.

## Not included yet (easy add-ons — just ask)

- **PDF invoice attachment.** The email currently includes the invoice details + payment info
  as text. Attaching a generated PDF is a straightforward next step.
- **Saving your data.** Clients and invoices currently reset on refresh (they live in memory).
  Connecting a database (e.g. Supabase) is the natural next move if you want the hub to remember
  everything between sessions.
