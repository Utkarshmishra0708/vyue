# Release P3-2c: Same-name fix and consistent disambiguation

**Phase:** 3 — Accounts and entry
**Branch:** `p3-accounts-and-entry`
**Date:** 3 Nov 2026
**Issue:** #39 — People with the same name are mixed together on the Dashboard, filters, targets and Reports

---

## Summary

All Sales Rep matching switched from **name** to **account ID** across the entire app. When two people share a name, their **username** is shown beside it so they stay distinguishable. Weekly targets converted from name-keyed to id-keyed with a one-time automatic migration.

---

## What changed

### Backend (3 files + 1 new migration)

| File | Change |
|------|--------|
| `routes/leads.js` | Owner association now includes `username` alongside `id`, `name`, `color`, `initials` |
| `routes/activities.js` | Same: `username` added to owner attributes (3 occurrences) |
| `routes/forecast.js` | Owner attributes changed from `['name']` to `['id', 'name', 'username']` |
| `server.js` | Post-migration hook: converts `bd_weekly_targets` from name-keyed (`{"Riya Shah": 5.3}`) to id-keyed (`{"4": 5.3}`). Runs once on boot, idempotent |
| `migrations/063_bd_targets_by_id.sql` | Marker migration for the target conversion (actual logic in JS because MySQL can't iterate dynamic JSON keys) |

### Frontend (8 files changed, 1 new utility)

| File | Change |
|------|--------|
| **`utils/nameLabels.js`** (new) | Shared disambiguation helpers: `buildNameCount(bds)`, `bdLabel(b, nameCount)` → full name + username when duplicated, `ownerLabel(owner, nameCount)` → first name + username when duplicated |
| `pages/DashboardPage.jsx` | BD filter, target cards, tickers, annual performance — all by ID. Inline helpers replaced with shared utility |
| `pages/LeadsPage.jsx` | Table column, Excel export, PDF export use `ownerLabel`/`bdLabel`. Passes `bds` to KanbanView |
| `components/KanbanView.jsx` | Accepts `bds` prop, card owner line uses `ownerLabel` |
| `pages/ReportsPage.jsx` | 6 spots fixed: 2 Excel columns, 2 PDF rows, 2 HTML table cells |
| `pages/CustomersPage.jsx` | Customer detail "Sales Rep" stat uses `bdLabel` |
| `utils/forecastColumns.js` | Owner column reads pre-stamped `_ownerFull` / `_ownerCompact` labels |
| `pages/ForecastPage.jsx` | Stamps disambiguated labels onto leads before rendering (Inventory Pipeline) |
| `components/MultiSelect.jsx` | Extended to accept `{value, label}` objects alongside plain strings (backward compatible) |

---

## What happens to existing data

- **Weekly targets** stored under a person's name (e.g. `{"Riya Shah": 5.3}`) are automatically converted to their account ID (e.g. `{"4": 5.3}`) on the first server boot after the migration. If a name matches no active user, that target is dropped with a console log.
- **No other data is changed.** Leads, activities, and settings are unaffected.

---

## Things to know

- The `username` field on `owner` is now returned by every lead and activity endpoint. It was already computed and stored by P3-2a.
- The backend's `GET /api/users` already computed a `label` field with username disambiguation (since P3-2a). This release makes the frontend use it consistently.
- When all names are unique, the display is unchanged — no usernames are shown unnecessarily.
- The disambiguation pattern: **full name contexts** (cards, exports, detail stats) show `Riya Shah (Riya.Shah)`; **compact contexts** (table cells, tickers, Kanban cards) show `Riya (Riya.Shah)`.
