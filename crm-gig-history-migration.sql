-- ============================================================
-- CRM Gig History — link enquiries to CRM clients
--
-- Adds a client_id column to the enquiries table so you can
-- associate any enquiry (website form, Gmail) with a CRM client.
-- This lets the client profile show their full gig history.
--
-- Safe to run: only ADDS a column. Nothing changes or breaks.
--
-- Run it once: Supabase → SQL Editor → New query → paste → Run.
-- ============================================================

alter table public.enquiries
  add column if not exists client_id uuid references public.clients(id) on delete set null;

-- Index for fast lookups when loading a client's gigs
create index if not exists enquiries_client_id_idx on public.enquiries(client_id);
