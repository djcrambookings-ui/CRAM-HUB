// Send a reply email via Gmail SMTP (same nodemailer setup as send-email.js).
// POST body: { to, subject, body, threadId }
// Env: GMAIL_USER, GMAIL_APP_PASSWORD

import nodemailer from "nodemailer";

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) { res.status(500).json({ error: "Gmail credentials not configured." }); return; }

  try {
    const { to, subject, body } = await readBody(req);
    if (!to || !body) { res.status(400).json({ error: "Missing to or body" }); return; }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
    });

    const htmlBody = body
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")
      .replace(/  /g, "&nbsp;&nbsp;");

    await transporter.sendMail({
      from: `C-RAM Entertainment <${user}>`,
      to,
      subject: subject || "Re: Your Enquiry",
      text: body,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222">${htmlBody}</div>`,
      replyTo: user,
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("gmail-reply error:", e);
    res.status(500).json({ error: e.message || "Send failed" });
  }
}
