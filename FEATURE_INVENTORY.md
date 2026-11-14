# VYUE — Feature Inventory

> Prepared for competitive benchmarking against other industry CRM platforms (Salesforce, HubSpot, Zoho, Pipedrive, etc.)

**Stack:** React 18 + Express 4 + Sequelize 6 + MySQL 8
**Scale:** 18 database models · 53 migrations · 17 API route groups · 15 frontend pages · 25+ components

---

## 1. Lead / Deal Management

| Capability | Detail |
|---|---|
| Lead fields | 40+ core fields, plus 18 service rate/qty columns, 9 service include-toggles, and admin-defined custom fields (JSON) |
| Pipeline stages | 9 stages: New → Qualified → Demo → Proposal → Negotiation → PO Expected → PO Received, plus Lost and On Hold side-exits |
| Win-probability weighting | Each stage carries a weight (5% → 100%) that feeds weighted pipeline value and confidence scoring |
| Views | Table view (sortable, configurable columns) and Kanban view (drag-and-drop across stage columns) |
| Column customization | Per-user column picker + per-column filters, persisted across sessions |
| Bulk operations | Bulk import (Excel template, dry-run validation before commit), bulk update (phase/owner/temperature), bulk export |
| Auto-generated codes | Customer code, location code, and lead reference number generated automatically per business unit |
| Stage history | Every phase transition logged (from, to, who, when) — powers funnel analytics and stage-aging |
| Business-unit-specific forms | Schema-driven form rendering — each business unit can show a different field set without code changes |
| Pricing automation | Auto-calculated TCV from service rate × quantity × contract period (OPEX) or flat (CAPEX), with manual override |
| Renewal linkage | New / Renewal / Expansion classification with a link back to the original PO lead |
| Contacts | Multiple contacts per lead (name, phone, email, designation) |
| Document upload | PO document upload (PDF/PNG/JPEG, up to 20MB) |

---

## 2. Dashboard & Analytics

| Capability | Detail |
|---|---|
| KPI cards | Total leads, total TCV, weighted pipeline, conversion rate, average deal size, hot leads, won deals, lost deals |
| Charts | Pipeline funnel, revenue by stage, lead source breakdown, monthly trend, BD/owner performance, temperature distribution, win/loss analysis |
| Geographic heatmap | Interactive India SVG map with state-level lead count and TCV rollup, hover tooltips, click drill-down |
| Filters | Date range, owner, stage, source, temperature — all business-unit scoped automatically |

---

## 3. Reporting

| Capability | Detail |
|---|---|
| Report types | BD Performance, Source Analysis, Monthly Trend, Campaign ROI (4 dedicated report engines) |
| Visualization | Interactive charts (bar/line/pie) alongside data tables |
| Export | Excel (formatted, styled) and PDF (table layout with pagination) on every report |
| Filters | Date range, business unit, owner, stage, source |

---

## 4. Notifications & Alerting

| Capability | Detail |
|---|---|
| Rule engine | 20+ distinct rule keys across 4 categories — Lead, Forecast, Renewal, Team |
| Example triggers | Lead created/won/lost/stale, follow-up due/overdue, SLA breach, confidence drop, renewal upcoming (30/60/90-day windows) and overdue, device requested, permission changes |
| Severity levels | 4 tiers — Critical, Warning, Info, Low — each color-coded |
| Delivery | In-app bell with unread badge, dropdown list, mark-read/mark-all-read, click-through deep link to the source record |
| Preferences | Per-user, per-rule enable/disable toggle |
| Scheduling | Background scheduler runs periodic sweeps (SLA breaches, follow-up reminders, renewal windows) independent of user activity |
| Deduplication | Dedupe keys prevent duplicate alerts for the same event |

---

## 5. Role-Based Access Control (RBAC)

| Capability | Detail |
|---|---|
| Roles | 5 — Global Admin (Super Admin), Business Admin, Manager (PMO), Team Member (BD), Forecast-only |
| Gatable modules | 8 — Leads, Dashboard, Inventory Pipeline, Reports, Task Board, VOC, Campaigns, Customers |
| Permission levels | 4 — None, Read-only, Edit, Full Access |
| Granularity | Per-user, per-module — not just per-role |
| Enforcement | Server-side middleware on every route (not UI-only) |
| Per-BU module toggles | Each business unit independently enables/disables optional modules (VOC, Campaigns, Customers, Task Board) |
| Cross-platform Super Admin | A grant (not a role) that spans every business unit automatically, in Read-only or Read+Write mode |
| Safety rails | Self-change prevention, last-admin protection (can't revoke the only Read+Write admin), full audit trail on every grant change |
| Live permission updates | Permission changes apply immediately — no re-login required (poll on focus + 60s interval) |

---

## 6. Task Board (Internal Kanban)

| Capability | Detail |
|---|---|
| Board structure | Multi-tab boards, 4 columns (To Do, In Progress, Review, Done) |
| Card fields | Title, rich-text description, previous steps, recent updates, next steps, priority (4 levels), owner, dates, optional linked lead |
| Scoping | Per-business-unit, opt-in enablement |
| Global activity feed | Separate cross-user, platform-wide chronological feed (lead/chain/permission/SLA events), role-gated visibility |

---

## 7. Voice of Customer (VOC)

| Capability | Detail |
|---|---|
| Entry fields | 18+ fields — customer segment, product/solution (multi-select), VOC type (7 categories), business impact (4 levels), revenue impact, priority, target release |
| Workflow | 8-stage status pipeline: New → Under Review → Accepted → Planned → In Development → Released / Rejected → Closed |
| Reviewer workflow | Comment/activity thread per entry, status transition audit trail, field-level change tracking |
| Reporting | Summary statistics dashboard, status/priority filtering |

---

## 8. Campaign Management

| Capability | Detail |
|---|---|
| Campaign fields | Name, description, start/end date, budget, status |
| Attribution | Leads link directly to the campaign that generated them |
| ROI tracking | Dedicated Campaign ROI report — leads generated, conversion rate, revenue attributed vs. budget |

---

## 9. Customer & Contact Management

| Capability | Detail |
|---|---|
| Hierarchy | Customer → Location drill-down, derived automatically from lead data |
| Contact directory | Multiple named contacts per customer (name, role, designation, phone, email, notes) |
| Renewal tracking | Service start/end dates, renewal linkage, renewal-specific notification rules |
| Service catalogue | Per-business-unit catalogue of sellable services (software / hardware / services categories, OPEX/CAPEX nature) |

---

## 10. Global POS / Chain Management

| Capability | Detail |
|---|---|
| Chain records | Device pool definitions with total allocation, device type, price, expected start/end dates |
| Pool logic | Live tracking of consumed vs. remaining vs. exceeded devices, derived from linked individual POs |
| Safe unlinking | Deleting a chain sets linked leads to standalone rather than cascading deletes |

---

## 11. Inventory / Delivery Pipeline

| Capability | Detail |
|---|---|
| Purpose | Post-sale hardware/device handoff tracking between sales and supply chain (SCM) |
| Sent-to-SCM workflow | Per-lead, per-service-line marker with timestamp and responsible user |
| Module gating | Requires explicit forecast/inventory permission level |

---

## 12. Administration & Configuration

| Capability | Detail |
|---|---|
| User management | Add/edit/disable users, role assignment, module permission assignment, password reset |
| Weekly targets | Global and per-BD target configuration |
| Dropdown management | Admin-configurable option lists per field, per business unit (lead source, channel partner, device SKU, etc.) |
| SLA/TAT configuration | Per-stage turnaround-time targets, per business unit — feeds directly into confidence scoring and breach alerts |
| Multi-business architecture | Unlimited business units on one instance; each gets its own pipeline config, field schema, service catalogue, and module set |
| BU creation wizard | Guided setup: basics → modules → services → field schema |
| BU template editor | Edit an existing business unit's configuration after creation — toggle modules, fields, and services |
| BU cloning | Clone an existing business unit's full configuration to bootstrap a new one |

---

## 13. Authentication & Identity

| Capability | Detail |
|---|---|
| Login modes | Email+password, legacy BD login, and SSO handoff from an external portal |
| SSO account chooser | Handles a single email holding accounts across multiple business units — presents a picker rather than guessing |
| Cross-platform switching | A Global Admin can switch between business units mid-session without re-entering credentials |
| Token handling | JWT-based sessions, namespaced local storage, auto-redirect to login on expiry |
| Password security | bcrypt hashing throughout — no plaintext storage anywhere, including seed scripts |

---

## 14. Lead Scoring Engine

| Capability | Detail |
|---|---|
| Confidence score | 0–100 computed score per lead, factoring stage weight, SLA compliance, activity recency, and temperature |
| Trend tracking | Compares current score against a ~1-week-old baseline to show direction (rising/falling) |
| Scheduled recompute | Full batch recomputation runs automatically (on boot + hourly) in addition to per-save updates |
| On-Hold handling | Freezes confidence score when a lead is put on hold; restores cleanly on resume |

---

## 15. Collaboration Features

| Capability | Detail |
|---|---|
| @Mentions | Tag any teammate by name in notes/descriptions; mentioned user gets an actionable notification |
| Rich text editing | Formatted notes (bold/italic/lists/links) on leads, activities, and VOC entries |
| Audit trail | Field-level change history (old value → new value, who, when) on leads and other entities, rendered as a visual timeline |
| Global search | Single search bar covering leads, chains, contacts, and campaigns simultaneously, with grouped results |

---

## 16. Export & Data Portability

| Capability | Detail |
|---|---|
| Excel export | Formatted, styled workbooks with auto-sized columns — available on Leads, Dashboard, Reports, Inventory Pipeline |
| PDF export | Table-based layout with pagination — available on Reports and lead detail |
| Bulk import template | Downloadable Excel template with pre-filled dropdown validation for mass lead upload |

---

## 17. Geographic Intelligence

| Capability | Detail |
|---|---|
| Coverage | All 28 Indian states + 8 union territories (36 regions) |
| Visualization | Interactive choropleth map on the dashboard |
| Rollup | Aggregated lead count, TCV, and conversion rate per state, consumed by both Dashboard and Reports |

---

## Benchmarking Summary Table

| Dimension | VYUE |
|---|---|
| Deployment model | Self-hosted, zero external cloud dependencies |
| Multi-tenancy | Unlimited business units per instance, independently configurable |
| Pipeline stages | 9, fully customizable win-probability weighting |
| RBAC granularity | Per-user × per-module × 4 access levels, server-enforced |
| Notification rules | 20+ automated triggers, 4 severity tiers |
| Lead scoring | Automated confidence engine with SLA-aware decay and trend |
| Reporting | 4 dedicated report types + ad-hoc dashboard filters, Excel/PDF export everywhere |
| Collaboration | @mentions, audit trail, global cross-module search |
| Vertical modules | VOC, Campaigns, Task Board, Inventory/Delivery Pipeline, Chain/Device Pool management |
| Customization | No-code business unit wizard — field schema, service catalogue, and modules, no engineering required |
| Identity | SSO-ready with multi-account chooser and cross-platform session switching |

---

*Compiled from direct source inspection of the VYUE codebase — every item above maps to a specific model, route, or component in the repository.*
