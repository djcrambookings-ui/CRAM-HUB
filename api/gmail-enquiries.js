// Fetch recent enquiry-style emails from Gmail via IMAP.
// Env vars needed (same as send-email.js):
//   GMAIL_USER          = djc.ram.bookings@gmail.com
//   GMAIL_APP_PASSWORD  = 16-char App Password

import Imap from "imap";
import { simpleParser } from "mailparser";
import { promisify } from "util";

const ENQUIRY_KEYWORDS = [
  "enquiry","enquire","booking","book","event","dj","wedding","birthday",
  "corporate","party","hire","available","quote","price","package","function",
];
function isLikelyEnquiry(subject = "", snippet = "") {
  const txt = (subject + " " + snippet).toLowerCase();
  return ENQUIRY_KEYWORDS.some((k) => txt.includes(k));
}

function parseAddress(addr) {
  if (!addr) return { email: "", name: "" };
  const m = String(addr).match(/^(.+?)\s*<(.+?)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() };
  return { email: String(addr).trim(), name: "" };
}

async function fetchEnquiries(user, password) {
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
      imap.openBox("INBOX", true, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        // Search last 30 days
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceFmt = since.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(",","");

        imap.search(["UNSEEN", ["SINCE", sinceFmt]], (err2, uids) => {
          // Also search all mail from last 30 days if unseen is empty
          imap.search([["SINCE", sinceFmt]], (err3, allUids) => {
            const ids = (allUids || []).slice(-60); // last 60 messages
            if (!ids.length) { imap.end(); return resolve([]); }

            const threads = [];
            const fetch = imap.fetch(ids, { bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE)", struct: true });
            fetch.on("message", (msg, seqno) => {
              let header = "";
              let uid = null;
              const info = {};
              msg.on("attributes", (attrs) => { uid = attrs.uid; info.flags = attrs.flags || []; });
              msg.on("body", (stream) => {
                stream.on("data", (chunk) => (header += chunk.toString()));
              });
              msg.once("end", () => {
                // Parse header manually (lightweight)
                const lines = header.split(/\r?\n/);
                const get = (name) => {
                  const l = lines.find((x) => x.toLowerCase().startsWith(name.toLowerCase() + ":"));
                  return l ? l.slice(name.length + 1).trim() : "";
                };
                const subject = get("Subject");
                const from = get("From");
                const date = get("Date");
                const { email, name } = parseAddress(from);
                const unread = !info.flags.includes("\\Seen");
                threads.push({ uid, subject, from: email, fromName: name, date: new Date(date).toISOString(), unread, snippet: "" });
              });
            });
            fetch.once("error", (e) => { imap.end(); reject(e); });
            fetch.once("end", () => {
              imap.end();
              // Filter likely enquiries, sort newest first
              const filtered = threads
                .filter((t) => isLikelyEnquiry(t.subject))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 40)
                .map((t, i) => ({ ...t, id: String(t.uid || i) }));
              resolve(filtered);
            });
          });
        });
      });
    });

    imap.once("error", (err) => reject(err));
    imap.once("end", () => {});
    imap.connect();
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    res.status(500).json({ error: "GMAIL_USER and GMAIL_APP_PASSWORD are not set in Vercel environment variables." });
    return;
  }
  try {
    const threads = await fetchEnquiries(user, pass);
    res.status(200).json({ threads });
  } catch (e) {
    console.error("gmail-enquiries error:", e);
    res.status(500).json({ error: e.message || "Failed to fetch emails" });
  }
}
