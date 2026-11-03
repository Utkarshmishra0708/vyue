# Release P3-3: Landing page and first-run registration

**Phase:** 3 — Accounts and entry
**Branch:** `p3-accounts-and-entry`
**Date:** 3 Nov 2026

---

## Summary

On a fresh install (empty database), the sign-in page now shows a **Register your company** form instead of the normal sign-in. The first person to visit creates their company's Owner account and first business, then is signed in immediately. After that, the page is the normal sign-in form forever.

No `.env` seed settings or terminal commands are needed to start.

---

## What the user sees

### Fresh install — first visit

The sign-in page detects no company exists and shows:

- Title: **Sales CRM** (or whatever the product name is set to)
- Subtitle: **Register your company**
- Explanation: "You're the first person here. Set up your company and you'll be the Owner."
- Fields: Your name, Email, Password (minimum 8 characters), Company name
- Button: **Get started**

On submit, the company and Owner account are created. The user is signed in and taken to the **business picker**, which shows "No businesses yet" and a **Create business** button. Clicking it opens the full guided business wizard (template, sales fields, services, modules, dashboards, reports, workflow) — the same wizard used to add any business later.

### After registration

The sign-in page shows the normal "Sign in to continue" form, exactly as before. The registration form never appears again.

### Edge cases

- If someone tries the registration endpoint after an Owner already exists: "This app is already set up. Please sign in."
- If the business name or email is already taken: a clear error message
- While the page checks whether setup is needed (fraction of a second), it shows the product title with no form — no flash of the wrong form

---

## What changed

### Backend

| File | Change |
|------|--------|
| `routes/auth.js` | Two new public routes: `GET /setup-status` (returns whether setup is needed) and `POST /setup` (creates Owner + first business, signs in immediately). Both placed before the login route |

### Frontend

| File | Change |
|------|--------|
| `pages/LoginPage.jsx` | Checks setup status on load. Shows registration form when `needsSetup` is true, normal sign-in form otherwise |
| `services/api.js` | Two new API calls: `getSetupStatus` and `setupCompany` |

---

## What stays the same

- `npm run seed` still works as a developer shortcut
- Existing installs are unaffected — the registration form only appears on a truly empty database
- Everything after registration works exactly as today
