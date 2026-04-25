# 🛡️ CRISP — Cyber Risk Intelligence Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-crisp--bice.vercel.app-E95420?style=for-the-badge&logo=vercel&logoColor=white)](https://crisp-bice.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js%2014-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

> Enterprise-grade cyber risk intelligence platform. Tracks assets and CVEs, scores risk using real threat intelligence (CVSS · KEV · EPSS), models security ROI, and tracks remediation — all in a modern SaaS UI.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖥️ **Asset Inventory** | Register servers, workstations, cloud, databases with criticality and exposure tagging |
| 🐛 **Vulnerability Tracking** | Link CVEs to assets, search NVD live, auto-generate risk alerts on save |
| 🔄 **Remediation Workflow** | Triage CVEs through Open → In Progress → Resolved with filter pills |
| 🔍 **Asset Drill-down** | Per-asset detail page with charts, progress bar, and inline status management |
| 📊 **Risk Scoring** | `CVSS × criticality × exposure` engine enriched with KEV and EPSS bonuses |
| 💰 **ROSI Modeling** | ALE estimation, security control evaluation, projected savings vs cost |
| 📈 **Rich Visualizations** | Area, donut, horizontal bar, scatter (CVSS vs EPSS), and radar charts |
| 📄 **Executive Reports** | Download HTML report with KPIs, severity summary, top risks, and ROSI recommendation |
| 🔔 **Alert Management** | Acknowledge alerts from the dashboard feed — ALE recalculates live |
| 🤖 **Threat Intel Sync** | Daily Vercel cron jobs pull CISA KEV and FIRST EPSS scores automatically |

---

## 🧰 Stack

| Layer | Tech |
|---|---|
| 🖼️ Frontend | Next.js 14 (App Router, TypeScript) |
| 🗄️ Database | Supabase (Postgres + RLS) |
| ☁️ Hosting | Vercel |
| 🎨 UI | shadcn/ui · Tailwind CSS · Recharts |
| 🔤 Fonts | Ubuntu / Ubuntu Mono |
| 🛰️ Threat Intel | CISA KEV · FIRST EPSS · NVD API |

---

## 📐 Risk Scoring Model

```
risk_score = CVSS × criticality_multiplier × exposure_multiplier
           + 2.0        if CVE is in CISA KEV (actively exploited in the wild)
           + EPSS × 3   if EPSS score is available
```

| Severity | Threshold |
|---|---|
| 🔴 CRITICAL | ≥ 8.0 |
| 🟠 HIGH | ≥ 5.0 |
| 🟡 MEDIUM | ≥ 2.5 |
| 🟢 LOW | < 2.5 |

---

## 🚀 Local Development

```bash
# 1. Clone
git clone https://github.com/Laugerr/Cyber-Risk-Intelligence-Platform.git
cd Cyber-Risk-Intelligence-Platform

# 2. Install (Linux / WSL2 recommended)
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NVD_API_KEY

# 4. Run database schema
# Paste supabase-schema.sql into the Supabase SQL editor, then:
# ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
# ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT false;

# 5. Start dev server
npm run dev
```

Open `http://localhost:3000` and click **Load Demo Data** to seed 8 assets + 15 real CVEs.

---

## 🗂️ Project Structure

```
app/
  page.tsx                  # 📊 Dashboard — KPIs, charts, alert feed
  assets/
    page.tsx                # 🖥️  Asset inventory table
    [id]/page.tsx           # 🔍 Asset detail — drill-down with charts & remediation
  vulnerabilities/page.tsx  # 🐛 CVE tracking with status workflow
  risk/page.tsx             # 📈 Risk quantification & ROSI modeling
  reports/page.tsx          # 📄 Executive report preview & HTML export
  api/
    assets/                 # CRUD + single asset detail
    vulnerabilities/        # CRUD + status PATCH + alert generation
    alerts/                 # Feed + acknowledge PATCH
    controls/               # Security controls CRUD
    seed/                   # Demo data loader
    sync/kev/               # CISA KEV sync (GET for cron, POST for manual)
    sync/epss/              # FIRST EPSS sync (GET for cron, POST for manual)
    nvd/                    # NVD CVE search proxy
lib/
  scoring.ts                # ⚙️  Risk scoring engine
  rosi.ts                   # 💰 ROSI / ALE financial model
  types.ts                  # 📝 TypeScript interfaces
components/
  layout-client.tsx         # 📱 Responsive layout wrapper + sidebar state
  sidebar.tsx               # 🧭 Navigation sidebar (drawer on mobile)
  header.tsx                # 🔝 Page header bar with hamburger
```

---

## ⏰ Cron Jobs (Vercel)

Defined in `vercel.json` — runs automatically on Vercel's infrastructure:

| Schedule | Endpoint | Action |
|---|---|---|
| Daily 03:00 UTC | `/api/sync/kev` | 🔴 Pull CISA KEV feed, flag exploited CVEs |
| Daily 03:30 UTC | `/api/sync/epss` | 📊 Pull FIRST EPSS scores for all tracked CVEs |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `NVD_API_KEY` | ⚙️ Optional | NVD API key (higher rate limits) |
| `CRON_SECRET` | ⚙️ Optional | Secret to protect cron endpoints |

---

## 📸 Pages

| Page | Description |
|---|---|
| `/` | Dashboard with KPIs, risk charts, alert feed with acknowledgement |
| `/assets` | Asset inventory with type icons, criticality bars, click-to-drill |
| `/assets/[id]` | Asset detail — severity donut, CVSS chart, remediation progress, CVE table |
| `/vulnerabilities` | CVE table with CVSS/EPSS scatter, distribution chart, status filter |
| `/risk` | Risk by asset, control radar chart, ALE before/after, ROSI evaluation |
| `/reports` | Executive report preview + one-click HTML download |

---

## 🎓 About This Project

This platform was built as a portfolio project during my **MSc in Cybersecurity Management**. The goal was to go beyond academic theory and demonstrate practical, real-world skills that bridge the gap between security engineering and business risk management.

Rather than a simple CVE scanner, CRISP was designed to reflect how enterprise security teams actually operate — tracking assets, triaging vulnerabilities, modeling financial exposure through ALE/ROSI, and integrating live threat intelligence feeds (CISA KEV, FIRST EPSS, NVD). The remediation workflow, alert acknowledgement, and per-asset drill-down pages were built to mirror the day-to-day workflow of a SOC analyst or AppSec engineer.

The project also served as a hands-on way to learn a modern full-stack SaaS architecture (Next.js 14 App Router, Supabase, Vercel) while applying domain knowledge from the programme in a tangible, deployable product.

---

## 📄 License

MIT License — feel free to use, fork, or adapt this project.

Copyright (c) 2025 Laugerr
