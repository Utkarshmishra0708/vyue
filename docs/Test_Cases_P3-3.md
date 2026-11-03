# Test Cases: Release P3-3 — Landing page and first-run registration

**Phase:** 3 — Accounts and entry
**Date:** 3 Nov 2026
**Prerequisite:** A fresh database (no users, no businesses). To simulate: rename or drop the existing database and let the backend create a new one on start.

---

## Test summary

| Release | Test cases | Pass | Retest | Open | Partial | Fail |
|---------|-----------|------|--------|------|---------|------|
| P3-3    | 10        |      |        | 10   |         |      |

---

## A. Fresh install — registration form

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-3-01 | On a fresh database, the sign-in page shows "Register your company" instead of "Sign in to continue" | Fresh DB | Open |
| P3-3-02 | The form has four fields: Your name, Email, Password, Company name | Fresh DB | Open |
| P3-3-03 | The "Get started" button is disabled until all four fields are filled | Fresh DB | Open |
| P3-3-04 | Submitting with a password shorter than 8 characters shows an error | Fresh DB | Open |
| P3-3-05 | Submitting with all valid fields creates the Owner account, signs in, and goes to the business picker showing "No businesses yet" and a "Create business" button | Fresh DB | Open |
| P3-3-06 | Clicking "Create business" opens the guided business wizard (template, fields, services, modules, etc.) | Completed P3-3-05 | Open |

## B. After registration — normal sign-in

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-3-07 | After registration, refreshing the page shows "Sign in to continue" (the normal sign-in form) | Completed P3-3-05 | Open |
| P3-3-08 | Signing in with the just-registered email and password works normally | Completed P3-3-05 | Open |

## C. Edge cases

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-3-09 | If a second person opens the registration page at the same time and submits after the first, they see "This app is already set up. Please sign in." | Two browsers, fresh DB | Open |
| P3-3-10 | On an existing install (database with users), the sign-in page shows the normal sign-in form — no registration form ever appears | Existing DB | Open |

---

## Automated checks

| Check | Command | Expected |
|-------|---------|----------|
| Frontend compiles | `cd frontend && npx react-scripts build` | Compiled successfully |
| Backend starts | `cd backend && npm run dev` | "Sales CRM API listening on http://localhost:4000" |
| Setup status (existing DB) | `curl http://localhost:4000/api/auth/setup-status` | `{"needsSetup":false}` |
| Setup status (fresh DB) | `curl http://localhost:4000/api/auth/setup-status` | `{"needsSetup":true}` |
