# Test Cases: Release P3-5 — Navigation tidy-up

**Phase:** 3 — Accounts and entry
**Date:** 3 Nov 2026

---

## Test summary

| Release | Test cases | Pass | Retest | Open | Partial | Fail |
|---------|-----------|------|--------|------|---------|------|
| P3-5    | 6         |      |        | 6    |         |      |

---

## A. Exits from the app

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-5-01 | "Sign out" is visible in the sidebar for every role (Owner, Business Admin, Sales Rep) | Any account | Open |
| P3-5-02 | Clicking "Sign out" ends the session and returns to the sign-in page | Any account | Open |
| P3-5-03 | "Switch business" appears only for the Owner and for people in more than one business | Owner + single-business user | Open |
| P3-5-04 | Clicking "Switch business" goes to the business picker without signing out | Owner account | Open |

## B. No stale "Back" button

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-5-05 | There is no visible "Back" button in the sidebar or header (the logo is just a logo, not a labelled button) | Any account | Open |
| P3-5-06 | "← Back" links inside pages (e.g. Customers detail → Customers list) navigate within the page, not out of the app | Any account with Customers access | Open |

---

## Automated checks

| Check | Command | Expected |
|-------|---------|----------|
| Frontend compiles | `cd frontend && npx react-scripts build` | Compiled successfully |
