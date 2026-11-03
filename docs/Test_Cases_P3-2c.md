# Test Cases: Release P3-2c — Same-name fix

**Phase:** 3 — Accounts and entry
**Date:** 3 Nov 2026
**Prerequisite:** Sample data with at least two Sales Reps who share a name (e.g. two "Riya Shah" accounts with different usernames)

---

## Test summary

| Release | Test cases | Pass | Retest | Open | Partial | Fail |
|---------|-----------|------|--------|------|---------|------|
| P3-2c   | 18        |      |        | 18   |         |      |

---

## A. Dashboard — Sales Rep cards and filters

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-2c-01 | Dashboard BD dropdown lists each Sales Rep separately by ID, not merged by name | Admin sign-in | Open |
| P3-2c-02 | Each Sales Rep gets their own Pipeline Target card even when names match | Admin sign-in, two same-name reps | Open |
| P3-2c-03 | Pipeline Target cards show `Name (username)` when names repeat | Admin sign-in, two same-name reps | Open |
| P3-2c-04 | Saving a weekly target for one rep does not affect another with the same name | Admin sign-in, two same-name reps | Open |
| P3-2c-05 | Weekly target persists after page refresh, under the correct rep | Admin sign-in | Open |
| P3-2c-06 | Annual performance cards show each rep separately with username disambiguation | Admin sign-in | Open |
| P3-2c-07 | Lead tickers show `FirstName (username)` when names repeat | Admin sign-in, two same-name reps | Open |
| P3-2c-08 | Renewal alerts show `FirstName (username)` when names repeat | Admin sign-in, leads near renewal | Open |

## B. Leads page

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-2c-09 | Sales Rep MultiSelect filter shows label with username disambiguation | Admin sign-in | Open |
| P3-2c-10 | Filtering by one rep shows only that rep's leads, not the other same-named rep's | Admin sign-in, two same-name reps with leads | Open |
| P3-2c-11 | Clicking a BD card on Dashboard navigates to Leads filtered by that rep's ID | Admin sign-in | Open |
| P3-2c-12 | Leads table "Sales Rep" column shows `FirstName (username)` when names repeat | Admin sign-in | Open |
| P3-2c-13 | Kanban card owner line shows `FirstName (username)` when names repeat | Admin sign-in, Kanban view | Open |
| P3-2c-14 | Excel and PDF exports include disambiguated Sales Rep names | Admin sign-in, export leads | Open |

## C. Reports, Customers, Inventory Pipeline

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-2c-15 | Reports page Sales Rep filter works by ID; table and exports show disambiguated names | Admin sign-in | Open |
| P3-2c-16 | Customers page Sales Rep filter works by ID; customer detail "Sales Rep" stat shows full name with username | Admin sign-in | Open |
| P3-2c-17 | Inventory Pipeline (Forecast) "Sales Rep" column shows disambiguated names | Admin sign-in, hardware service in catalog | Open |

## D. Must still work (no regressions)

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-2c-18 | When all Sales Rep names are unique, no usernames are shown anywhere — display stays clean | Admin sign-in, unique names | Open |

---

## Automated checks

| Check | Command | Expected |
|-------|---------|----------|
| Frontend compiles | `cd frontend && npx react-scripts build` | Compiled successfully |
| Backend starts | `cd backend && npm run dev` | "Sales CRM API listening on http://localhost:4000" |
| Migration applies | Check server boot log | "applied migration: 063_bd_targets_by_id.sql" (first boot only) |
| Target conversion | Check server boot log (if name-keyed targets existed) | "[bd_targets] converted name-keyed targets to id-keyed" |
