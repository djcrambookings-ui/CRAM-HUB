// Serverless send engine for the hub.
// Sends an email through your Gmail (via an App Password stored in Vercel
// env vars) and attaches a freshly-generated PDF of the invoice.
// Env vars required (Vercel -> Settings -> Environment Variables):
//   GMAIL_USER          = djc.ram.bookings@gmail.com
//   GMAIL_APP_PASSWORD  = the 16-char App Password from your Google account
import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LOGO_W_B64, LOGO_B_B64 } from "./_logo.js";

const money = (n) =>
  "$" + Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateStr = (d) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch (e) { return String(d); }
};

function wrapText(str, font, size, maxWidth) {
  const words = String(str || "").split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function buildInvoicePdf(inv, biz) {
  inv = inv || {}; biz = biz || {};
  const items = Array.isArray(inv.items) ? inv.items : [];
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) * Number(i.rate) || 0), 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const dark = rgb(0.04, 0.04, 0.06);
  const gold = rgb(0.96, 0.77, 0.1);
  const gray = rgb(0.4, 0.4, 0.42);
  const black = rgb(0.07, 0.07, 0.07);
  const white = rgb(1, 1, 1);
  const M = 48;

  const T = (t, x, y, o = {}) =>
    page.drawText(String(t == null ? "" : t), { x, y, size: o.size || 10, font: o.bold ? bold : font, color: o.color || black });
  const TR = (t, xr, y, o = {}) => {
    const f = o.bold ? bold : font, s = o.size || 10;
    const w = f.widthOfTextAtSize(String(t == null ? "" : t), s);
    page.drawText(String(t == null ? "" : t), { x: xr - w, y, size: s, font: f, color: o.color || black });
  };

  // Header band
  page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: dark });
  // Logo (white version) on the left, vertically centred in the band.
  let logoDrawn = false;
  try {
    const logo = await doc.embedPng(Buffer.from(LOGO_W_B64, "base64"));
    const lh = 42, lw = lh * (logo.width / logo.height);
    page.drawImage(logo, { x: M, y: height - 110 + (110 - lh) / 2, width: lw, height: lh });
    logoDrawn = true;
  } catch (e) { /* fall back to business name text */ }
  if (!logoDrawn) T(biz.name || "C-RAM Entertainment", M, height - 52, { size: 20, bold: true, color: white });
  TR("TAX INVOICE", width - M, height - 48, { size: 22, bold: true, color: gold });
  TR(inv.id || "", width - M, height - 72, { size: 12, bold: true, color: white });

  let y = height - 140;
  // ABN
  T("ABN", M, y, { size: 9, bold: true, color: gray });
  T(biz.abn || "[ADD YOUR ABN IN SETTINGS]", M + 40, y, { size: 12, bold: true });
  y -= 30;

  // From / Bill To
  const colR = width / 2 + 20;
  T("FROM", M, y, { size: 9, bold: true, color: gray });
  T("BILL TO", colR, y, { size: 9, bold: true, color: gray });
  y -= 16;
  T(biz.name || "", M, y, { size: 11, bold: true });
  T(inv.client || "", colR, y, { size: 11, bold: true });
  y -= 15;
  const fromLines = [biz.address, biz.phone, biz.email, biz.website].filter(Boolean);
  const billLines = [inv.clientEmail, inv.clientPhone, inv.clientABN ? "ABN: " + inv.clientABN : ""].filter(Boolean);
  const rows = Math.max(fromLines.length, billLines.length);
  for (let i = 0; i < rows; i++) {
    if (fromLines[i]) T(fromLines[i], M, y, { size: 9, color: gray });
    if (billLines[i]) T(billLines[i], colR, y, { size: 9, color: gray });
    y -= 13;
  }
  y -= 4;
  T("Date: " + dateStr(inv.date), colR, y, { size: 9, color: gray }); y -= 13;
  if (inv.due) { T("Due: " + dateStr(inv.due), colR, y, { size: 9, color: gray }); y -= 13; }
  T("Status: " + (inv.status || "Draft").toUpperCase(), colR, y, { size: 9, bold: true, color: gray });
  y -= 26;

  // Table header
  page.drawRectangle({ x: M, y: y - 5, width: width - 2 * M, height: 20, color: dark });
  T("DESCRIPTION", M + 8, y, { size: 8, bold: true, color: white });
  TR("QTY", M + 340, y, { size: 8, bold: true, color: white });
  TR("UNIT (ex GST)", M + 430, y, { size: 8, bold: true, color: white });
  TR("AMOUNT", width - M - 8, y, { size: 8, bold: true, color: white });
  y -= 24;

  items.forEach((it) => {
    const amt = Number(it.qty) * Number(it.rate) || 0;
    const lines = wrapText(it.desc || it.catalogueLabel || "", font, 9, 290);
    const startY = y;
    lines.forEach((ln, idx) => { T(ln, M + 8, y, { size: 9 }); if (idx < lines.length - 1) y -= 12; });
    TR(String(it.qty || 0), M + 340, startY, { size: 9 });
    TR(money(it.rate), M + 430, startY, { size: 9 });
    TR(money(amt), width - M - 8, startY, { size: 9, bold: true });
    y -= 16;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: width - M, y: y + 6 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    if (y < 180) { page = doc.addPage([595.28, 841.89]); y = height - M; }
  });

  // Totals
  y -= 8;
  const tx = width - M - 8;
  TR("Subtotal (ex GST)", tx - 95, y, { size: 9, color: gray }); TR(money(subtotal), tx, y, { size: 9 }); y -= 15;
  TR("GST (10%)", tx - 95, y, { size: 9, color: gray }); TR(money(gst), tx, y, { size: 9 }); y -= 8;
  page.drawLine({ start: { x: tx - 170, y }, end: { x: tx, y }, thickness: 1, color: dark }); y -= 16;
  TR("TOTAL (inc GST)", tx - 95, y, { size: 11, bold: true }); TR(money(total), tx, y, { size: 12, bold: true, color: gold });
  y -= 42;

  // Payment details band
  const bandH = 78;
  page.drawRectangle({ x: M, y: y - bandH + 14, width: width - 2 * M, height: bandH, color: dark });
  T("PAYMENT DETAILS", M + 12, y, { size: 9, bold: true, color: gold }); y -= 16;
  T("Bank: " + (biz.bank || "[Your Bank]"), M + 12, y, { size: 9, color: rgb(0.88, 0.88, 0.88) });
  T("Account Name: " + (biz.accountName || biz.name || ""), colR, y, { size: 9, color: rgb(0.88, 0.88, 0.88) }); y -= 14;
  T("BSB: " + (biz.bsb || "[Your BSB]"), M + 12, y, { size: 9, color: rgb(0.88, 0.88, 0.88) });
  T("Account No.: " + (biz.account || "[Your Account]"), colR, y, { size: 9, color: rgb(0.88, 0.88, 0.88) }); y -= 14;
  T("Reference: " + (inv.paymentRef || inv.id || ""), M + 12, y, { size: 9, color: rgb(0.88, 0.88, 0.88) });
  T("ABN: " + (biz.abn || ""), colR, y, { size: 9, bold: true, color: gold });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve, reject) => {
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
  if (!user || !pass) {
    res.status(500).json({ error: "Email isn't connected yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel -> Settings -> Environment Variables, then redeploy." });
    return;
  }
  try {
    const body = await readBody(req);
    const { to, subject, text, html, invoice, biz } = body || {};
    if (!to) { res.status(400).json({ error: "No recipient email." }); return; }

    const attachments = [];
    if (invoice) {
      try {
        const pdf = await buildInvoicePdf(invoice, biz);
        attachments.push({ filename: (invoice.id || "invoice") + ".pdf", content: pdf, contentType: "application/pdf" });
      } catch (e) { /* if PDF generation fails, still send the email */ }
    }

    // Append the C-RAM logo as a signature on any HTML email (inline via cid).
    let finalHtml = html;
    if (finalHtml) {
      attachments.push({ filename: "cram-logo.png", content: Buffer.from(LOGO_B_B64, "base64"), contentType: "image/png", cid: "cramlogo" });
      finalHtml += '<div style="margin-top:16px"><img src="cid:cramlogo" alt="C-RAM Entertainment" width="150" style="width:150px;max-width:60%;height:auto;display:block"/></div>';
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
    });
    await transporter.sendMail({
      from: ((biz && biz.name) || "C-RAM Entertainment") + " <" + user + ">",
      to, subject: subject || "Invoice", text: text || "", html: finalHtml || undefined,
      replyTo: user, attachments,
    });
    res.status(200).json({ ok: true, attached: attachments.length > 0 });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Send failed" });
  }
}
