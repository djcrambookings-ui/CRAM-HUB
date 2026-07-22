-- ============================================================
-- One small addition for the Business Hub.
-- Adds a number column to track how much a client has PAID
-- (so the hub can show deposits, balance owing, and totals for tax).
--
-- This is safe: it only ADDS a column. It doesn't change or delete
-- anything, and your website keeps working exactly as before.
--
-- Run it once: Supabase -> SQL Editor -> New query -> paste -> Run.
-- ============================================================

alter table public.clients
  add column if not exists amount_paid numeric default 0;

-- Track the date each invoice was actually paid (for which FY income falls in)
alter table public.invoices
  add column if not exists paid_date date;
