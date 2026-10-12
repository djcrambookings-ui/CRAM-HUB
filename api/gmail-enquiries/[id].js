// Fetch a single Gmail thread's full messages by UID.
// Env: GMAIL_USER, GMAIL_APP_PASSWORD

import Imap from "imap";
import { simpleParser } from "mailparser";

function parseAddress(addr) {
  if (!addr) return { email: "", name: "" };
  const m = String(addr).match(/^(.+?)\s*<(.+?)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() };
  return { email: String(addr).trim(), name: "" };
}

async function fetchThread(user, password, uid) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user,
      password,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err) => {
        if (err) { imap.end(); return reject(err); }

        const fetch = imap.fetch([uid], { bodies: "" });
        const messages = [];
        fetch.on("message", (msg) => {
          let body = Buffer.alloc(0);
          msg.on("body", (stream) => {
            const chunks = [];
            stream.on("data", (c) => chunks.push(c));
            stream.once("end", () => { body = Buffer.concat(chunks); });
          });
          msg.once("end", async () => {
            try {
              const parsed = await simpleParser(body);
              const text = parsed.text || "";
              // strip quoted prior messages for cleaner display
              const cleaned = text.split(/\n>|\nOn .+ wrote:/)[0].trim();
              const from = parseAddress(parsed.from?.text || "");
              messages.push({
                from: from.name ? `${from.name} <${from.email}>` : from.email,
                date: parsed.date?.toISOString() || "",
                body: cleaned,
              });
            } catch (e) {
              messages.push({ from: "unknown", date: "", body: "(could not parse)" });
            }
          });
        });
        fetch.once("error", (e) => { imap.end(); reject(e); });
        fetch.once("end", () => {
          imap.end();
          resolve(messages.sort((a, b) => new Date(a.date) - new Date(b.date)));
        });
      });
    });

    imap.once("error", (err) => reject(err));
    imap.connect();
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) { res.status(500).json({ error: "Gmail credentials not configured." }); return; }
  const { id } = req.query;
  if (!id) { res.status(400).json({ error: "Missing id" }); return; }
  try {
    const messages = await fetchThread(user, pass, Number(id));
    res.status(200).json({ messages });
  } catch (e) {
    console.error("gmail-thread error:", e);
    res.status(500).json({ error: e.message });
  }
}
