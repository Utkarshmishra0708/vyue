# Test Cases: Release P3-4 — Adding people with temporary passwords

**Phase:** 3 — Accounts and entry
**Date:** 3 Nov 2026

---

## Test summary

| Release | Test cases | Pass | Retest | Open | Partial | Fail |
|---------|-----------|------|--------|------|---------|------|
| P3-4    | 14        |      |        | 14   |         |      |

---

## A. Adding a person — temporary password

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-4-01 | Adding a person from Settings shows a random 8-character temporary password (not "123456") | Admin account | Open |
| P3-4-02 | The message says to give the password to the person once and that they'll set their own at first sign-in | Admin account | Open |
| P3-4-03 | Each new person gets a different temporary password | Admin account, add 2 people | Open |

## B. First sign-in — forced password change

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-4-04 | Signing in with the temporary password goes to a "Set Your Password" page instead of the app | New user account | Open |
| P3-4-05 | The page shows a yellow banner about the temporary password | New user account | Open |
| P3-4-06 | The page asks for the temporary password, a new password, and confirmation | New user account | Open |
| P3-4-07 | After setting a new password, the person goes to the app normally | New user account | Open |
| P3-4-08 | Navigating to any other page redirects back to the password page until it's changed | New user account | Open |

## C. Resetting a password

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-4-09 | Clicking "Reset Password" on any user (not just Sales Reps) shows a confirmation, then a temporary password | Admin account | Open |
| P3-4-10 | After a reset, the person is forced to set their own password at next sign-in | Reset user account | Open |
| P3-4-11 | A reset also lifts a sign-in lock if the person was locked out | Locked user account | Open |

## D. Owner resets another Owner

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-4-12 | In Organization Settings (Owners section), each Owner except yourself has a "Reset Password" button | Two Owner accounts | Open |
| P3-4-13 | Resetting another Owner's password generates a temporary password and forces them to change it | Two Owner accounts | Open |

## E. One-Owner warning

| ID | Check | Needs | Result |
|----|-------|-------|--------|
| P3-4-14 | When there is only one Owner, the business picker shows a yellow warning to add a second Owner | One Owner only | Open |

---

## Automated checks

| Check | Command | Expected |
|-------|---------|----------|
| Frontend compiles | `cd frontend && npx react-scripts build` | Compiled successfully |
| Backend starts | `cd backend && npm run dev` | "Sales CRM API listening on http://localhost:4000" |
