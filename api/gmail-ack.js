// Send an auto-acknowledgement to a client who just submitted an enquiry.
// POST body: { to, name, bizName, subject }
// Env: GMAIL_USER, GMAIL_APP_PASSWORD

import nodemailer from "nodemailer";
import { LOGO_B_B64 } from "./_logo.js";

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
    const { to, name, bizName = "C-RAM Entertainment", subject = "Your Enquiry" } = await readBody(req);
    if (!to) { res.status(400).json({ error: "Missing recipient" }); return; }

    const firstName = (name || "").split(/\s+/)[0] || "there";
    // Strip "Re:", "Fwd:" etc from the original subject to get the clean topic
    const cleanSubject = subject.replace(/^(re|fwd?):\s*/i, "").trim();
    const subjectRef = cleanSubject ? `regarding "<em>${cleanSubject}</em>"` : "about your upcoming event";

    const textBody = `Hi ${firstName},

Thank you for reaching out to ${bizName}!

We've received your enquiry${cleanSubject ? ` regarding "${cleanSubject}"` : ""} and will be in touch shortly to discuss your event in more detail.

In the meantime, feel free to check out our packages and services on our website at c-rament.com.au.

We look forward to making your event an unforgettable experience! 🎶

Warm regards,
Marc
C-RAM Entertainment
📱 0432 775 402
🌐 c-rament.com.au`;

    const htmlBody = `
<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;max-width:560px">
  <p>Hi ${firstName},</p>
  <p>Thank you for reaching out to <strong>${bizName}</strong>!</p>
  <p>We've received your enquiry${cleanSubject ? ` regarding <em>"${cleanSubject}"</em>` : ""} and will be in touch shortly to discuss your event in more detail.</p>
  <p>In the meantime, feel free to check out our packages and services on our website at <a href="https://c-rament.com.au" style="color:#F5C518;text-decoration:none;font-weight:bold">c-rament.com.au</a>.</p>
  <p>We look forward to making your event an <strong>unforgettable experience</strong>! 🎶</p>
  <p style="margin-top:20px">Warm regards,<br><strong>Marc</strong><br>
  <span style="color:#888">C-RAM Entertainment</span><br>
  <span style="color:#888;font-size:13px">📱 0432 775 402 &nbsp;·&nbsp; 🌐 <a href="https://c-rament.com.au" style="color:#888">c-rament.com.au</a></span>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
  <img src="cid:cramlogo" alt="${bizName}" width="150" style="width:150px;max-width:60%;height:auto;display:block"/>
</div>`;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
    });

    await transporter.sendMail({
      from: `Marc @ C-RAM Entertainment <${user}>`,
      to,
      subject: `Thanks for your enquiry${cleanSubject ? ` — ${cleanSubject}` : ""} | ${bizName}`,
      text: textBody,
      html: htmlBody,
      replyTo: user,
      attachments: [
        { filename: "cram-logo.png", content: Buffer.from(LOGO_B_B64, "base64"), contentType: "image/png", cid: "cramlogo" },
      ],
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("gmail-ack error:", e);
    res.status(500).json({ error: e.message || "Send failed" });
  }
}
