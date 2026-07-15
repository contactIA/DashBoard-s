# Graph Report - .  (2026-07-13)

## Corpus Check
- Corpus is ~29,398 words - fits in a single context window. You may not need a graph.

## Summary
- 322 nodes · 555 edges · 43 communities (19 shown, 24 thin omitted)
- Extraction: 98% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.66)
- Token cost: 56,456 input · 0 output

## Community Hubs (Navigation)
- Dashboard UI & KPI Parsing
- Dependencies & Build Config
- Admin Panel & Setup Entry
- Clinic Wizard & Metric Types
- Dashboard API & Field Extraction
- Clinicorp Sync Engine
- Architecture Docs & CI Workflow
- Vercel Functions Config
- Admin Clinics API (Token Masking)
- Admin Panels API (Helena Discovery)
- Upcoming Appointments Table
- Time Bucketing Utils
- Upcoming List (Legacy Component)
- Date Range Picker
- KPI Strip & Sparkline
- Vite Dev API Mock
- Cron Workaround Rationale
- Setup Page & Admin Secret
- Lost Opportunity KPI Doc
- Closed Revenue KPI Doc
- KPI Strip Doc Reference
- Trend Chart Doc Reference
- Env Example Doc
- Attendance KPI Doc
- Conversion KPI Doc
- No-show KPI Doc
- Admin App Doc Reference
- Metric Types Doc Reference
- Date Range Picker Doc Reference
- Lost Table Doc Reference
- Revenue Row Doc Reference
- Step Distribution Doc Reference
- Upcoming Table Doc Reference
- Cancelled Step Type Doc
- Missed Step Type Doc
- Scheduled Step Type Doc
- Vercel Config Doc Reference
- Vite Config Doc Reference

## God Nodes (most connected - your core abstractions)
1. `ClinicWizard()` - 21 edges
2. `fmtBRL()` - 19 edges
3. `App()` - 15 edges
4. `handler()` - 12 edges
5. `syncClinicClinicorp()` - 11 edges
6. `call()` - 9 edges
7. `extractWith()` - 9 edges
8. `groupCardsByTime()` - 9 edges
9. `inPeriod()` - 9 edges
10. `handler()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Rationale: per-clinic matrix job isolation to avoid maxDuration timeout` --semantically_similar_to--> `Dashboard Odontológico Multi-Clínica`  [INFERRED] [semantically similar]
  .github/workflows/sync-clinicorp.yml → README.md
- `Secret: SYNC_URL` --references--> `api/dashboard.js`  [AMBIGUOUS]
  .github/workflows/sync-clinicorp.yml → README.md
- `Dashboard Odontológico (page title)` --conceptually_related_to--> `Dashboard Odontológico Multi-Clínica`  [INFERRED]
  index.html → README.md
- `index.html script entry (/src/main.jsx)` --references--> `src/App.jsx`  [INFERRED]
  index.html → README.md
- `handler()` --calls--> `syncClinicClinicorp()`  [EXTRACTED]
  api/cron/sync-clinicorp.js → src/server/clinicorpSync.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Dashboard data flow: Supabase config + Helena CRM data feeding api/dashboard.js** — readme_supabase, readme_clinics_table, readme_helena_api, readme_api_dashboard_js [EXTRACTED 1.00]
- **GitHub Actions sync pipeline: list clinics then sync each in parallel** — github_workflows_sync_clinicorp_job_listarclinicas, github_workflows_sync_clinicorp_job_sincronizar, github_workflows_sync_clinicorp_secret_syncurl, github_workflows_sync_clinicorp_secret_cronsecret [EXTRACTED 1.00]
- **Admin setup wizard flow for onboarding a new clinic** — readme_setup_page, readme_admin_secret, readme_src_admin_adminapp_jsx, readme_src_admin_clinicwizard_jsx [INFERRED 0.85]

## Communities (43 total, 24 thin omitted)

### Community 0 - "Dashboard UI & KPI Parsing"
Cohesion: 0.08
Nodes (40): fetchDashboard(), App(), QUICK, BudgetTable(), fmtDate(), ContractsCard(), ConversionFunnel(), DimensionBreakdown() (+32 more)

### Community 1 - "Dependencies & Build Config"
Cohesion: 0.06
Nodes (32): autoprefixer, date-fns, dotenv, dependencies, date-fns, react, react-day-picker, react-dom (+24 more)

### Community 2 - "Admin Panel & Setup Entry"
Cohesion: 0.16
Nodes (21): call(), clearSecret(), createClinic(), deleteClinic(), getClinicorpDirectory(), getPanelSteps(), getSecret(), listClinics() (+13 more)

### Community 3 - "Clinic Wizard & Metric Types"
Cohesion: 0.15
Nodes (23): clinicorpToUnits(), ClinicWizard(), dimsToState(), emptyExtract(), EXTRACT_FIELDS, ExtractField(), FUNNEL_STAGE_DEFS, hasAnyRule() (+15 more)

### Community 4 - "Dashboard API & Field Extraction"
Cohesion: 0.17
Nodes (21): fetchContact(), fetchContactsByIds(), fetchPage(), fetchStepTitles(), getClinicConfig(), handler(), normalizeToken(), parseDescription() (+13 more)

### Community 5 - "Clinicorp Sync Engine"
Cohesion: 0.16
Nodes (18): handler(), isAuthorizedCronRequest(), logSyncRun(), sleep(), makeClinicorpClient(), findAgendadorTag(), fmtDateBR(), iso() (+10 more)

### Community 6 - "Architecture Docs & CI Workflow"
Cohesion: 0.12
Nodes (20): Job: listar-clinicas, Job: sincronizar, Rationale: per-clinic matrix job isolation to avoid maxDuration timeout, Secret: CRON_SECRET, Secret: SYNC_URL, index.html script entry (/src/main.jsx), Dashboard Odontológico (page title), api/admin/clinics.js (+12 more)

### Community 7 - "Vercel Functions Config"
Cohesion: 0.15
Nodes (12): maxDuration, maxDuration, maxDuration, maxDuration, maxDuration, functions, api/admin/clinicorp-directory.js, api/admin/clinics.js (+4 more)

### Community 8 - "Admin Clinics API (Token Masking)"
Cohesion: 0.44
Nodes (9): handler(), isMaskedToken(), maskClinicorpUnits(), maskToken(), normalizeToken(), restoreClinicorpTokens(), sb(), sbHeaders() (+1 more)

### Community 9 - "Admin Panels API (Helena Discovery)"
Cohesion: 0.44
Nodes (8): fetchContactSafe(), fetchCustomFieldsSafe(), handler(), helenaGet(), normalizeToken(), stripAccents(), suggestDimension(), tokenFromSupabase()

### Community 10 - "Upcoming Appointments Table"
Cohesion: 0.50
Nodes (6): fmtDate(), isToday(), isTomorrow(), UpcomingTable(), daysAgoBR(), todayBR()

### Community 11 - "Time Bucketing Utils"
Cohesion: 0.43
Nodes (7): addDays(), formatBucketLabel(), getGranularity(), getMonthStart(), getWeekStart(), groupCardsByTime(), MONTHS_PT

### Community 12 - "Upcoming List (Legacy Component)"
Cohesion: 0.60
Nodes (5): fmtDate(), getDayLabel(), isToday(), isTomorrow(), UpcomingList()

### Community 13 - "Date Range Picker"
Cohesion: 0.50
Nodes (3): buildGrid(), DateRangePicker(), WEEK_DAYS

## Ambiguous Edges - Review These
- `Secret: SYNC_URL` → `api/dashboard.js`  [AMBIGUOUS]
  .github/workflows/sync-clinicorp.yml · relation: references

## Knowledge Gaps
- **73 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+68 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Secret: SYNC_URL` and `api/dashboard.js`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `extractWith()` connect `Dashboard API & Field Extraction` to `Clinic Wizard & Metric Types`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `fmtBRL()` connect `Dashboard UI & KPI Parsing` to `Upcoming Appointments Table`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard UI & KPI Parsing` be split into smaller, more focused modules?**
  _Cohesion score 0.08248587570621468 - nodes in this community are weakly interconnected._
- **Should `Dependencies & Build Config` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `Clinic Wizard & Metric Types` be split into smaller, more focused modules?**
  _Cohesion score 0.14532019704433496 - nodes in this community are weakly interconnected._