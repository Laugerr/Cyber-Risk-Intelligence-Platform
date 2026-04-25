-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists assets (
  id bigserial primary key,
  name text not null,
  asset_type text not null default 'Other',
  owner text not null default 'IT',
  criticality integer not null default 3 check (criticality between 1 and 5),
  internet_exposed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists vulnerabilities (
  id bigserial primary key,
  asset_id bigint not null references assets(id) on delete cascade,
  cve text not null,
  title text not null,
  cvss real not null check (cvss between 0 and 10),
  known_exploited boolean not null default false,
  epss_score real check (epss_score between 0 and 1),
  detected_at timestamptz not null default now()
);

create table if not exists controls (
  id bigserial primary key,
  name text not null,
  annual_cost_eur real not null default 0,
  effectiveness_pct integer not null default 30 check (effectiveness_pct between 0 and 100),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id bigserial primary key,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title text not null,
  asset_id bigint not null references assets(id) on delete cascade,
  cve text,
  risk_score real not null default 0,
  evidence text not null default '',
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS) and allow public access for demo
alter table assets enable row level security;
alter table vulnerabilities enable row level security;
alter table controls enable row level security;
alter table alerts enable row level security;

create policy "public_all" on assets for all using (true) with check (true);
create policy "public_all" on vulnerabilities for all using (true) with check (true);
create policy "public_all" on controls for all using (true) with check (true);
create policy "public_all" on alerts for all using (true) with check (true);
