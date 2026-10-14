# Jio Sales CRM — Release Notes

---

## v3.0.0 — 14 October 2026

**Release Type:** Major Feature Release
**Branch:** `jioautify`
**Commits:** `e066691`, `1b40bee`

### New Modules

| Module | Description |
|--------|-------------|
| **Audit Trail / Change History** | Field-level change tracking on every lead update. Records who changed what, old value, new value, and when. Rendered as a vertical timeline inside the lead form. Backend: `auditTrail.js` service + `change_log` table (migration 049). |
| **Global Search** | Cross-module search bar in the header. Searches leads, chains, VOC entries, and activities simultaneously. 300ms debounce, grouped dropdown results, click-to-navigate. Minimum 2 characters. |
| **Contact Management** | Multi-contact directory per customer in the Customers tab. Roles: Decision Maker, Technical POC, Procurement, Finance, Operations, Other. Full CRUD. Backend: `contacts` table (migration 050). |
| **Campaigns** | Full campaign lifecycle — create, edit, delete with budget tracking. Link leads to campaigns for attribution. Auto-calculated ROI: lead count, won count, revenue vs. budget. Backend: `campaigns` table (migration 051), `campaign_id` on leads (migration 052). |
| **Smart Reports (4 new types)** | BD Performance (bar chart), Source Analysis (pie chart), Monthly Trend (line chart), Campaign ROI (bar chart). All with recharts visualizations, date range filters, and Excel/PDF export. |

### RBAC Expansion

- **3 new modules added to permission matrix:** Voice of Customer (VOC), Campaigns, Customers
- Permission grid now shows **8 modules** (was 5): Leads, Dashboard, Inventory Pipeline, Reports, Task Board, VOC, Campaigns, Customers
- Each module supports 4 access levels: No Access, Read-only, Edit, Full Access
- New modules are **opt-in per Business Unit** — enable via Edit Template → Modules
- Backend enforcement via `requireModule()` middleware on all new routes
- Migration 053 seeds existing admin users with `full` access to new modules
- `levelFor()` fallback generalized — any module missing from a stored permission map inherits the role default (was hardcoded for Task Board only)
- BU Wizard updated: opt-in modules default to disabled for new business units

### Documentation

- **README completely rewritten** as a customer-facing product showcase for Jio Sales CRM
- Covers: MVP features (6), MSP features (15), full dependency tables, architecture diagram, quick start, production deployment, and industry use cases
- All internal references removed; positioned as a business-agnostic SaaS platform

### Migration Summary

| # | File | Change |
|---|------|--------|
| 049 | `change_log.sql` | Creates `change_log` table with entity tracking, indexes on (entity_type, entity_id) and (business_unit, created_at) |
| 050 | `contacts.sql` | Creates `contacts` table with customer-contact relationships, index on (customer_name, business_unit) |
| 051 | `campaigns.sql` | Creates `campaigns` table with budget/status tracking, index on (business_unit, status) |
| 052 | `lead_campaign_id.sql` | Adds `campaign_id` column to `leads` table |
| 053 | `module_permissions_new_modules.sql` | Seeds existing users' `module_permissions` JSON with voc, campaigns, customers keys |

### New Files

**Backend:**
- `backend/services/auditTrail.js` — Field-level diff engine
- `backend/routes/changeLog.js` — Audit trail API
- `backend/routes/contacts.js` — Customer contact CRUD
- `backend/routes/campaigns.js` — Campaign CRUD with ROI stats
- `backend/routes/search.js` — Cross-module global search
- `backend/routes/reports.js` — 4 smart report endpoints

**Frontend:**
- `frontend/src/components/GlobalSearch.jsx` — Search bar with debounced dropdown
- `frontend/src/components/AuditTimeline.jsx` — Change history timeline component
- `frontend/src/pages/CampaignsPage.jsx` — Campaign management page

### Modified Files (18)

`README.md`, `backend/models/index.js`, `backend/routes/leads.js`, `backend/server.js`, `backend/services/fieldCatalog.js`, `backend/services/permissions.js`, `frontend/src/App.jsx`, `frontend/src/components/BuTemplateEditor.jsx`, `frontend/src/components/BuWizard.jsx`, `frontend/src/components/CustomLeadForm.jsx`, `frontend/src/components/Layout.jsx`, `frontend/src/components/LeadForm.jsx`, `frontend/src/components/PrivateRoute.jsx`, `frontend/src/components/Sidebar.jsx`, `frontend/src/pages/CustomersPage.jsx`, `frontend/src/pages/ReportsPage.jsx`, `frontend/src/services/api.js`, `frontend/src/utils/permissions.js`

### Breaking Changes

- `/customers` route now requires `customers` module permission (was gated under `leads`)
- `/voc` route now requires `voc` module permission (was role-gated only)
- `/campaigns` route requires `campaigns` module permission
- Existing users with stored permissions receive automatic defaults via migration 053
- New BUs must explicitly enable Campaigns, Customers, and VOC modules via Edit Template

### Post-Deployment Steps

1. Migrations run automatically on server boot — no manual action required
2. Verify migration 053 applied: check that admin users' permissions include `voc`, `campaigns`, `customers`
3. For each Business Unit that needs the new modules: **Edit Template → Modules → enable Campaigns / Customers**
4. Existing users will see new modules in the sidebar once the BU enables them

---

## v2.5.0 — 14 October 2026

**Release Type:** Feature Release
**Branch:** `jioautify`
**Commit:** `e9988ba`

### Features

| Feature | Description |
|---------|-------------|
| **@Mention System** | Tag teammates with `@Name` in any notes field. Auto-creates actionable notification for the mentioned user. Optional follow-up date parsing. |
| **Notification Engine (16 Rules)** | Full notification system with dispatcher, scheduler, and 16 rule types across 4 categories: lead rules, team rules, pipeline rules, renewal rules. |
| **Notification Severity Levels** | 4 color-coded severity levels: Critical (red), Warning (amber), Info (blue), Low (green). Per-user notification preferences. |
| **Actionable Notifications** | Every notification is clickable — navigates directly to the relevant lead via deep-link (`?lead=<id>`). Fixed same-page navigation with `navTs` dependency. |
| **Notification Preferences** | Per-user toggle for each of the 16 notification rule types. Accessible from the notification bell dropdown. |

### Bug Fixes

- Fixed notification deep-linking when user is already on `/leads` — added `useLocation` + `navTs` to effect dependencies
- Fixed `closeForm` to clear `?lead=` URL param so re-clicking the same notification works
- Changed `task_assigned`, `lead_created`, `po_document_uploaded`, `renewal_created` severity from `info` to `low`

---

## v2.4.0 — 29 September 2026

**Release Type:** Feature Release
**Commit:** `52192fe`

### Features

- **Inventory Pipeline rename** — "Forecast" renamed to "Inventory Pipeline" across all UI, routes, and labels
- **Hardware flag for services** — Services categorized as Hardware, Software, or Hardware+Software; only hardware flows into Inventory Pipeline
- **Form fixes** — Lead form field ordering and validation improvements

---

## v2.3.0 — 28 September 2026

**Release Type:** Major Feature Release
**Commit:** `477295e`

### Features

| Feature | Description |
|---------|-------------|
| **Dynamic Business Unit Architecture** | Unlimited BUs on one instance. BU Creation Wizard with field schema, service catalog, module enablement, and SLA configuration. |
| **BU Template Editor** | Edit existing BU's lead form template — toggle sections/fields, add custom fields, manage services by category, enable/disable modules. |
| **Bulk Import** | Upload up to 500 leads per batch via XLSX template. Dry-run validation before committing. Auto-generated customer and location codes. |
| **Custom Lead Form** | Schema-driven lead form for wizard-built BUs. Renders fields from the BU's `formSchema` config. Custom fields stored in `leads.custom_fields` JSON. |
| **Role Rename** | PMO → Manager, BD → Team Member (display labels only; DB values unchanged for backward compatibility). |

---

## v2.2.0 — 26 September 2026

**Release Type:** Major Feature Release
**Commits:** `aff9248`, `22330c4`

### Features

| Feature | Description |
|---------|-------------|
| **RBAC Foundation** | Per-module access control: 6 modules × 4 levels (None, Read, Edit, Full). Permission matrix UI for admin users. Server-enforced via middleware. |
| **Unified Login (N1)** | Single sign-in flow. Cross-platform switching for users with accounts on multiple BUs. Platform switcher in sidebar. |
| **Activity Feed Gating** | Platform-wide activity feed visibility controlled per role: Business Admin (automatic), Manager (granted), Team Member (never). |
| **Global Admin (Super Admin)** | Cross-platform admin scope with read/write modes. Manages all BUs from one account. |
| **Forecast Role Removal (N3)** | Forecast role eliminated; replaced by module-level permission on the Inventory Pipeline module. |

---

## v2.1.0 — 8–13 August 2026

**Release Type:** Feature Release
**Commits:** `44b3f1a`, `897d524`, `c39f0e2`, `fe695c5`

### Features

- **Confidence Scoring Engine** — Formula-based lead scoring: stage weight + SLA decay + floor. Scheduled recomputation.
- **PO Mapping & Global POS** — Chain-level device pool management with consumed/remaining/exceeded tracking.
- **Voice of Customer (VOC)** — Capture feedback by category with reviewer workflow and impact scoring.
- **Role Hierarchy** — Super Admin, Business Admin, PMO, BD with cascading permissions.
- **Account Mix** made optional with manual "Other" entry support.
- Sidebar "Sign out" relabeled to "Back" for portal integration consistency.
- Removed redundant Forecast button from Leads header.

---

## v2.0.0 — 15–17 July 2026

**Release Type:** Major Release (Platform Rebuild)
**Commits:** `fdef06d`, `bbd8959`, `09f36bc`, `1e8b9c6`

### Features

- **Dashboard** — KPI cards, conversion funnel, BD leaderboard, geographic heatmap (India), PO trends, renewal alerts
- **Lead Scoring** — TCV/ACV auto-calculation, confidence scoring
- **Business Unit Scoping** — Multi-tenant data isolation
- **Export** — Excel (ExcelJS) and PDF (jsPDF) export on Leads, Reports, Forecast
- **Lead Services** — AMC/Installation service lines with auto-calculated TCV and device cost type
- **Sidebar home logo** linking to portal

---

## v1.0.0 — 3–10 July 2026

**Release Type:** Initial Release
**Commits:** `8a5355d`, `565fa17`, `5ca46d7`, `d093987`

### Features

- React 18 SPA (CRA) + Express 4 + MySQL 8 stack
- Lead CRUD with 40+ fields and 9-phase pipeline
- Table and Kanban views
- JWT authentication with bcrypt password hashing
- Jioautify portal SSO integration
- Basic reporting with filters
- Follow-up tracking with overdue alerts

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total releases | 8 |
| Development period | June 2026 — October 2026 |
| Database migrations | 53 |
| Database tables | 22 |
| API route files | 20 |
| API endpoints | 60+ |
| Frontend components | 25+ |
| Notification rule types | 16 |
| Report types | 6 |
| RBAC modules | 8 |

---

*Document generated: 14 October 2026*
*Maintained by: Jio Sales CRM Development Team*
