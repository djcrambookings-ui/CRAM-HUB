// Vercel serverless function:  POST /api/send-email
// Sends an email through Resend (https://resend.com) so your API key stays server-side.
//
// Required env var:  RESEND_API_KEY   — from your Resend dashboard
// Optional env var:  FROM_EMAIL       — e.g. "C-RAM Entertainment <bookings@c-rament.com.au>"
//                    Must be a domain you've verified in Resend. If unset, it falls back to
//                    Resend's test address (onboarding@resend.dev), which can only email
//                    YOUR OWN Resend account — fine for first tests.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Email is not configured: RESEND_API_KEY is missing on the server." });
  }

  try {
    const { to, subject, html, text, replyTo, cc, bcc } = req.body || {};
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: "to", "subject", and a message body.' });
    }

    const from = process.env.FROM_EMAIL || "C-RAM Entertainment <onboarding@resend.dev>";

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text, reply_to: replyTo, cc, bcc }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({ error: data?.message || "The email provider rejected the request.", detail: data });
    }
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unexpected server error while sending." });
  }
}
