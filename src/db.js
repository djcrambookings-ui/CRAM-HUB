import { supabase } from "./supabaseClient";

// ============================================================
// Data layer — everything the hub reads from / writes to Supabase.
// Each entity has mapper functions (DB row <-> the shape the app uses)
// plus list / save / delete helpers.
// Empty-string dates are turned into null so Postgres accepts them.
// ============================================================

function dateOrNull(v) {
  return v && String(v).trim() !== "" ? v : null;
}

function assertReady() {
  if (!supabase) {
    throw new Error(
      "Not connected to the database yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy."
    );
  }
}

// ---------------- CLIENTS ----------------
function rowToClient(r) {
  return {
    id: r.id,
    name: r.name || "",
    type: r.type || "",
    phone: r.phone || "",
    email: r.email || "",
    status: r.status || "Inquiry",
    eventDate: r.event_date || "",
    venue: r.venue || "",
    notes: r.notes || "",
    value: r.value ?? 0,
    paid: r.amount_paid ?? 0,
    abn: r.abn || "",
    source: r.source || "",
  };
}

function clientToRow(c) {
  return {
    name: c.name || "",
    type: c.type || "",
    phone: c.phone || "",
    email: c.email || "",
    status: c.status || "Inquiry",
    event_date: dateOrNull(c.eventDate),
    venue: c.venue || "",
    notes: c.notes || "",
    value: Number(c.value) || 0,
    amount_paid: Number(c.paid) || 0,
    abn: c.abn || "",
    source: c.source || "",
  };
}

export async function listClients() {
  assertReady();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToClient);
}

// A client is "existing" if its id is a real database id (uuid string).
// New clients from the form have a numeric id (Date.now()) or none.
function isExistingId(id) {
  return typeof id === "string" && id.includes("-");
}

export async function saveClient(c) {
  assertReady();
  const row = clientToRow(c);
  if (isExistingId(c.id)) {
    const { data, error } = await supabase
      .from("clients")
      .update(row)
      .eq("id", c.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToClient(data);
  }
  const { data, error } = await supabase
    .from("clients")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToClient(data);
}

export async function deleteClient(id) {
  assertReady();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- INVOICES ----------------
// The app uses the human number (e.g. "INV-00063") as invoice.id, and carries
// the real database id as invoice._dbid for updates/deletes.
function rowToInvoice(r, items) {
  return {
    id: r.invoice_no || r.id,
    _dbid: r.id,
    client: r.client || "",
    clientEmail: r.client_email || "",
    clientPhone: r.client_phone || "",
    clientABN: r.client_abn || "",
    date: r.date || "",
    due: r.due || "",
    status: r.status || "Draft",
    notes: r.notes || "",
    paymentRef: r.payment_ref || "",
    items: (items || []).map((it) => ({
      catalogueLabel: it.catalogue_label || "",
      desc: it.descr || "",
      qty: it.qty ?? 1,
      rate: it.rate ?? 0,
    })),
  };
}

function invoiceToRow(inv) {
  return {
    invoice_no: inv.id,
    client: inv.client || "",
    client_email: inv.clientEmail || "",
    client_phone: inv.clientPhone || "",
    client_abn: inv.clientABN || "",
    date: dateOrNull(inv.date),
    due: dateOrNull(inv.due),
    status: inv.status || "Draft",
    notes: inv.notes || "",
    payment_ref: inv.paymentRef || "",
  };
}

export async function listInvoices() {
  assertReady();
  const { data: invs, error: e1 } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: true });
  if (e1) throw e1;
  const { data: items, error: e2 } = await supabase
    .from("invoice_items")
    .select("*")
    .order("position", { ascending: true });
  if (e2) throw e2;
  return (invs || []).map((r) =>
    rowToInvoice(
      r,
      (items || []).filter((it) => it.invoice_id === r.id)
    )
  );
}

async function replaceItems(invoiceDbId, items) {
  // Clear then re-insert this invoice's line items.
  const { error: delErr } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceDbId);
  if (delErr) throw delErr;
  const rows = (items || []).map((it, i) => ({
    invoice_id: invoiceDbId,
    catalogue_label: it.catalogueLabel || "",
    descr: it.desc || "",
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    position: i,
  }));
  if (rows.length) {
    const { error: insErr } = await supabase.from("invoice_items").insert(rows);
    if (insErr) throw insErr;
  }
}

export async function saveInvoice(inv) {
  assertReady();
  const row = invoiceToRow(inv);
  let dbId = inv._dbid;
  if (dbId) {
    const { error } = await supabase.from("invoices").update(row).eq("id", dbId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("invoices")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    dbId = data.id;
  }
  await replaceItems(dbId, inv.items);
  return { ...inv, _dbid: dbId };
}

export async function deleteInvoice(inv) {
  assertReady();
  // invoice_items are removed automatically (ON DELETE CASCADE).
  if (inv._dbid) {
    const { error } = await supabase.from("invoices").delete().eq("id", inv._dbid);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("invoice_no", inv.id);
    if (error) throw error;
  }
}

// ---------------- DJ ROSTER ----------------
function rowToDj(r) {
  return {
    id: r.id,
    name: r.name || "",
    role: r.role || "",
    styles: Array.isArray(r.styles) ? r.styles : [],
    rate: r.rate || "",
    available: r.available !== false,
    bio: r.bio || "",
    instagram: r.instagram || "",
  };
}

function djToRow(d) {
  return {
    name: d.name || "",
    role: d.role || "",
    styles: Array.isArray(d.styles) ? d.styles : [],
    rate: d.rate != null ? String(d.rate) : "",
    available: d.available !== false,
    bio: d.bio || "",
    instagram: d.instagram || "",
  };
}

export async function listDjs() {
  assertReady();
  const { data, error } = await supabase
    .from("djs")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToDj);
}

export async function saveDj(d) {
  assertReady();
  const row = djToRow(d);
  if (isExistingId(d.id)) {
    const { data, error } = await supabase
      .from("djs")
      .update(row)
      .eq("id", d.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToDj(data);
  }
  const { data, error } = await supabase
    .from("djs")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToDj(data);
}

export async function deleteDj(id) {
  assertReady();
  const { error } = await supabase.from("djs").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- BUSINESS SETTINGS (single row id=1) ----------------
function rowToBiz(r) {
  return {
    name: r.name || "",
    abn: r.abn || "",
    address: r.address || "",
    phone: r.phone || "",
    email: r.email || "",
    website: r.website || "",
    bsb: r.bsb || "",
    account: r.account || "",
    accountName: r.account_name || "",
    bank: r.bank || "",
    instagram: r.instagram || "",
    mixcloud: r.mixcloud || "",
  };
}

function bizToRow(b) {
  return {
    id: 1,
    name: b.name || "",
    abn: b.abn || "",
    address: b.address || "",
    phone: b.phone || "",
    email: b.email || "",
    website: b.website || "",
    bsb: b.bsb || "",
    account: b.account || "",
    account_name: b.accountName || "",
    bank: b.bank || "",
    instagram: b.instagram || "",
    mixcloud: b.mixcloud || "",
  };
}

export async function getSettings() {
  assertReady();
  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBiz(data) : null;
}

export async function saveSettings(b) {
  assertReady();
  const { data, error } = await supabase
    .from("business_settings")
    .upsert(bizToRow(b))
    .select("*")
    .single();
  if (error) throw error;
  return rowToBiz(data);
}

// ---------------- PACKAGES ----------------
function rowToPackage(r) {
  return {
    id: r.id,
    position: r.position ?? 0,
    name: r.name || "",
    tagline: r.tagline || "",
    price: r.price ?? 0,
    hours: r.hours || "",
    tag: r.tag || "",
    color: r.color || "muted",
    cta: r.cta || "Book Now",
    includes: Array.isArray(r.includes) ? r.includes : [],
    excludes: Array.isArray(r.excludes) ? r.excludes : [],
    active: r.active !== false,
  };
}

function packageToRow(p) {
  return {
    position: Number(p.position) || 0,
    name: p.name || "",
    tagline: p.tagline || "",
    price: Number(p.price) || 0,
    hours: p.hours || "",
    tag: p.tag || "",
    color: p.color || "muted",
    cta: p.cta || "Book Now",
    includes: Array.isArray(p.includes) ? p.includes : [],
    excludes: Array.isArray(p.excludes) ? p.excludes : [],
    active: p.active !== false,
  };
}

export async function listPackages() {
  assertReady();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToPackage);
}

export async function savePackage(p) {
  assertReady();
  const row = packageToRow(p);
  if (isExistingId(p.id)) {
    const { data, error } = await supabase
      .from("packages")
      .update(row)
      .eq("id", p.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToPackage(data);
  }
  const { data, error } = await supabase
    .from("packages")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToPackage(data);
}

export async function deletePackage(id) {
  assertReady();
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- ADD-ONS ----------------
function rowToAddon(r) {
  return {
    id: r.id,
    position: r.position ?? 0,
    name: r.name || "",
    price: r.price || "",
    active: r.active !== false,
  };
}

function addonToRow(a) {
  return {
    position: Number(a.position) || 0,
    name: a.name || "",
    price: a.price || "",
    active: a.active !== false,
  };
}

export async function listAddons() {
  assertReady();
  const { data, error } = await supabase
    .from("addons")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToAddon);
}

export async function saveAddon(a) {
  assertReady();
  const row = addonToRow(a);
  if (isExistingId(a.id)) {
    const { data, error } = await supabase
      .from("addons")
      .update(row)
      .eq("id", a.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToAddon(data);
  }
  const { data, error } = await supabase
    .from("addons")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToAddon(data);
}

export async function deleteAddon(id) {
  assertReady();
  const { error } = await supabase.from("addons").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- REVIEWS ----------------
function rowToReview(r) {
  return {
    id: r.id,
    position: r.position ?? 0,
    author: r.author || "",
    source: r.source || "google",
    rating: r.rating ?? 5,
    review: r.review || "",
    eventType: r.event_type || "",
    active: r.active !== false,
  };
}

function reviewToRow(r) {
  return {
    position: Number(r.position) || 0,
    author: r.author || "",
    source: r.source || "google",
    rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
    review: r.review || "",
    event_type: r.eventType || "",
    active: r.active !== false,
  };
}

export async function listReviews() {
  assertReady();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToReview);
}

export async function saveReview(r) {
  assertReady();
  const row = reviewToRow(r);
  if (isExistingId(r.id)) {
    const { data, error } = await supabase
      .from("reviews")
      .update(row)
      .eq("id", r.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToReview(data);
  }
  const { data, error } = await supabase
    .from("reviews")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToReview(data);
}

export async function deleteReview(id) {
  assertReady();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw error;
}
