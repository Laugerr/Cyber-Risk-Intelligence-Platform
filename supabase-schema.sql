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

-- Remediation timestamp (used for Mean-Time-To-Remediate)
alter table vulnerabilities add column if not exists status text not null default 'open';
alter table vulnerabilities add column if not exists resolved_at timestamptz;
alter table alerts add column if not exists acknowledged boolean not null default false;

-- Daily risk snapshots — powers the Trends page (history, burndown, MTTR)
create table if not exists risk_snapshots (
  id bigserial primary key,
  captured_on date not null unique,
  total_risk real not null default 0,
  ale real not null default 0,
  asset_count integer not null default 0,
  vuln_count integer not null default 0,
  open_count integer not null default 0,
  in_progress_count integer not null default 0,
  resolved_count integer not null default 0,
  exploited_count integer not null default 0,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  active_alerts integer not null default 0,
  mttr_days real,
  created_at timestamptz not null default now()
);

-- Compliance framework mapping — per-requirement status (NIST CSF / CIS / ISO 27001)
create table if not exists compliance_status (
  id bigserial primary key,
  framework text not null,
  requirement_id text not null,
  status text not null default 'gap' check (status in ('met', 'partial', 'gap', 'na')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (framework, requirement_id)
);

-- Software inventory per asset — powers automatic CVE→asset matching (CPE)
create table if not exists asset_software (
  id bigserial primary key,
  asset_id bigint not null references assets(id) on delete cascade,
  vendor text not null default '',
  product text not null,
  version text not null default '',
  cpe text not null default '',
  created_at timestamptz not null default now()
);

-- SLA / remediation policy — days-to-remediate per severity
create table if not exists sla_policy (
  severity text primary key check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  days integer not null default 30 check (days > 0)
);
insert into sla_policy (severity, days) values
  ('CRITICAL', 7), ('HIGH', 30), ('MEDIUM', 90), ('LOW', 180)
on conflict (severity) do nothing;

-- Enable Row Level Security (RLS) and allow public access for demo
alter table assets enable row level security;
alter table vulnerabilities enable row level security;
alter table controls enable row level security;
alter table alerts enable row level security;
alter table risk_snapshots enable row level security;
alter table compliance_status enable row level security;
alter table sla_policy enable row level security;
alter table asset_software enable row level security;

create policy "public_all" on assets for all using (true) with check (true);
create policy "public_all" on vulnerabilities for all using (true) with check (true);
create policy "public_all" on controls for all using (true) with check (true);
create policy "public_all" on alerts for all using (true) with check (true);
create policy "public_all" on risk_snapshots for all using (true) with check (true);
create policy "public_all" on compliance_status for all using (true) with check (true);
create policy "public_all" on sla_policy for all using (true) with check (true);
create policy "public_all" on asset_software for all using (true) with check (true);
