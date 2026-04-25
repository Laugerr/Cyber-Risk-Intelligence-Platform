# CRISP — Cyber Risk Intelligence Platform

**Live:** [crisp-bice.vercel.app](https://crisp-bice.vercel.app/)

Enterprise cyber risk intelligence platform built with **Next.js 14 + Supabase**. Tracks assets and CVEs, scores risk using CVSS/KEV/EPSS threat intelligence, and models security ROI.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Database | Supabase (Postgres) |
| Hosting | Vercel |
| UI | shadcn/ui · Tailwind CSS · Recharts |
| Fonts | Ubuntu / Ubuntu Mono |
| Threat Intel | CISA KEV · FIRST EPSS · NVD |

---

## Features

- **Asset inventory** — register servers, workstations, cloud, network, databases with criticality scoring and exposure tagging
- **Vulnerability tracking** — link CVEs to assets, search NVD live, auto-generate risk alerts on save
- **Risk scoring** — `risk = CVSS × criticality × exposure` with KEV (+2) and EPSS bonuses
- **ROSI modeling** — estimate ALE, evaluate security controls, see projected savings vs cost
- **Executive reports** — download HTML report with KPIs, severity summary, top 10 risks, and ROSI recommendation
- **Threat intel sync** — daily Vercel cron jobs pull CISA KEV and FIRST EPSS scores automatically

---

## Risk Scoring Model

```
base = CVSS × criticality_multiplier × exposure_multiplier
+ 2.0  if CVE is in CISA KEV (actively exploited)
+ EPSS × 3  if EPSS score available
```

Severity thresholds: **CRITICAL** ≥ 8 · **HIGH** ≥ 5 · **MEDIUM** ≥ 2.5 · **LOW** < 2.5

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/Laugerr/Cyber-Risk-Intelligence-Platform.git
cd Cyber-Risk-Intelligence-Platform

# 2. Install (Linux / WSL2 recommended)
npm install

# 3. Configure env
cp .env.local.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NVD_API_KEY

# 4. Run schema
# Paste supabase-schema.sql into Supabase SQL editor

# 5. Start
npm run dev
```

Visit `http://localhost:3000` and click **Load Demo Data** to seed 8 assets + 15 real CVEs.

---

## Project Structure

```
app/
  page.tsx              # Dashboard
  assets/page.tsx       # Asset inventory
  vulnerabilities/      # CVE tracking
  risk/page.tsx         # Risk & ROSI
  reports/page.tsx      # Executive reports
  api/
    assets/             # CRUD
    vulnerabilities/    # CRUD + alert generation
    alerts/             # Risk alert feed
    controls/           # Security controls
    seed/               # Demo data loader
    sync/kev/           # CISA KEV sync (cron)
    sync/epss/          # FIRST EPSS sync (cron)
    nvd/                # NVD CVE search proxy
lib/
  scoring.ts            # Risk scoring engine
  rosi.ts               # ROSI / ALE model
  types.ts              # TypeScript interfaces
components/
  sidebar.tsx           # Navigation sidebar
  header.tsx            # Page header bar
```

---

## Cron Jobs (Vercel)

Defined in `vercel.json`:

| Schedule | Endpoint | Action |
|---|---|---|
| Daily 03:00 UTC | `/api/sync/kev` | Pull CISA KEV feed, mark exploited CVEs |
| Daily 03:30 UTC | `/api/sync/epss` | Pull FIRST EPSS scores for all tracked CVEs |

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NVD_API_KEY` | NVD API key (optional, higher rate limits) |
| `CRON_SECRET` | Optional secret to protect cron endpoints |
