-- ============================================================
-- Editable Packages + Add-ons for the Business Hub.
-- Creates two tables and fills them with your current packages
-- so nothing starts empty. Safe to run once.
--
-- Supabase -> SQL Editor -> New query -> paste all -> Run.
-- ============================================================

-- ---- PACKAGES TABLE ----
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  position int default 0,
  name text,
  tagline text,
  price numeric default 0,
  hours text,
  tag text,
  color text default 'muted',
  cta text default 'Book Now',
  includes jsonb default '[]'::jsonb,
  excludes text[] default '{}',
  active boolean default true
);

alter table public.packages enable row level security;
drop policy if exists "owner full access packages" on public.packages;
create policy "owner full access packages" on public.packages
  for all to authenticated using (true) with check (true);
drop policy if exists "public can read packages" on public.packages;
create policy "public can read packages" on public.packages
  for select to anon using (true);

-- ---- ADD-ONS TABLE ----
create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  position int default 0,
  name text,
  price text,
  active boolean default true
);

alter table public.addons enable row level security;
drop policy if exists "owner full access addons" on public.addons;
create policy "owner full access addons" on public.addons
  for all to authenticated using (true) with check (true);
drop policy if exists "public can read addons" on public.addons;
create policy "public can read addons" on public.addons
  for select to anon using (true);

-- ---- SEED PACKAGES (only if the table is empty) ----
do $$
begin
  if not exists (select 1 from public.packages) then
    insert into public.packages (position,name,tagline,price,hours,tag,color,cta,includes,excludes,active) values
    (0,'THE ESSENTIAL','Everything you need to fill the floor',2200,'5 Hours','','muted','Book Essential',
      '[{"name":"5-hour set","detail":"11pm cut-off"},{"name":"DJ podium booth","detail":"Clean, professional setup"},{"name":"DJ controller decks","detail":"Pro-grade gear"},{"name":"Speakers","detail":"Up to 150 indoor / 100 outdoor"},{"name":"4 party lights","detail":"To build the atmosphere"},{"name":"Wireless microphone","detail":"Speeches & announcements"}]'::jsonb,
      array['Extra lighting tubes','Haze machine','Cocktail set','Turntables & mixer','Moving heads'],true),
    (1,'THE SIGNATURE','Next-level lighting & atmosphere',3400,'5 Hours','MOST POPULAR','gold','Book Signature',
      '[{"name":"5-hour set","detail":"11pm cut-off"},{"name":"DJ podium booth","detail":"Clean, professional setup"},{"name":"DJ controller decks","detail":"Pro-grade gear"},{"name":"Speakers","detail":"Up to 150 indoor / 100 outdoor"},{"name":"4 party lights","detail":"To build the atmosphere"},{"name":"4 extra lighting tubes","detail":"All lighting synced to the music"},{"name":"Haze machine","detail":"Where the venue allows"},{"name":"Wireless microphone","detail":"Speeches & announcements"}]'::jsonb,
      array['Cocktail set','Turntables & mixer','Moving heads'],true),
    (2,'THE PREMIUM','The full show - turntables, cocktail set & moving heads',4800,'2hr cocktail + 5hr set','FULL PRODUCTION','coral','Book Premium',
      '[{"name":"2-hour cocktail set","detail":"Battery setup - plays anywhere"},{"name":"5-hour main set","detail":"11pm cut-off"},{"name":"DJ podium booth","detail":"Clean, professional setup"},{"name":"2 turntable controllers + DJ mixer","detail":"Authentic old-school look"},{"name":"Speakers","detail":"Up to 150 indoor / 100 outdoor"},{"name":"4 party lights + 4 light tubes","detail":"Synced to the music"},{"name":"2 moving heads","detail":"Adds dimension to the party"},{"name":"Haze machine","detail":"Where the venue allows"},{"name":"Wireless microphone","detail":"Speeches & announcements"}]'::jsonb,
      array[]::text[],true);
  end if;
end $$;

-- ---- SEED ADD-ONS (only if the table is empty) ----
do $$
begin
  if not exists (select 1 from public.addons) then
    insert into public.addons (position,name,price,active) values
    (0,'Extra Hour','$400/hr',true),
    (1,'Ceremony & Cocktail','$800',true),
    (2,'Lighting Upgrade','$600',true),
    (3,'Set Recording','$100',true),
    (4,'Live Musician','POA',true),
    (5,'Second DJ','POA',true);
  end if;
end $$;
