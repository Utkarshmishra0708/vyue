# Release P3-4: Adding people with temporary passwords

**Phase:** 3 — Accounts and entry
**Branch:** `p3-accounts-and-entry`
**Date:** 3 Nov 2026

---

## Summary

Admins no longer choose or see anyone's real password. When a person is added, the system generates a random temporary password shown once. The new person must choose their own password at first sign-in. Password resets work the same way. An Owner can reset another Owner's password. The business picker nudges a lone Owner to add a second one.

---

## What the user sees

### Adding a person (Settings)

When an admin adds someone, the confirmation message now reads:

> Added Priya Nair. Username: Priya.Nair. Temporary password: Kx8mP2nQ — give this to them once. They'll be asked to set their own password at first sign-in.

The admin never types a password. The system generates an 8-character random one.

### First sign-in (new person)

The new person signs in with their email (or username) and the temporary password. Instead of going to the app, they land on a **Set Your Password** page:

- A yellow banner: "You're using a temporary password. Please choose your own before continuing."
- Fields: Temporary Password, New Password, Confirm New Password
- Button: **Set Password & Continue**

After setting their password, they go straight into the app. The temporary password stops working.

### Resetting a password (Settings)

An admin clicks **Reset Password** on any user. A confirmation dialog appears. After confirming, the system generates a new temporary password:

> Password reset for Priya Nair. Temporary password: mN4pQ7xR — give this to them once. They'll set their own at next sign-in.

The person is forced to set their own password at next sign-in, exactly like a first sign-in.

### Owner resets another Owner (Organization Settings)

In the Owners section, each Owner row now has a **Reset Password** button (visible to other Owners, not to yourself). Works the same way — generates a temporary password, forces a change at next sign-in.

### One-Owner warning (business picker)

When there is only one Owner, the business picker shows a yellow banner:

> You're the only Owner. Consider adding a second one from **Organization Settings** so you're never locked out.

---

## What changed

### Backend

| File | Change |
|------|--------|
| `migrations/065_must_change_password.sql` | Adds `must_change_password` boolean to users |
| `models/index.js` | `must_change_password` field on User model |
| `routes/users.js` | User creation: random temp password + `must_change_password: true`. Reset: works for all roles (not just BD), generates temp password, sets flag. Owner can reset another Owner |
| `routes/auth.js` | Change-password clears `must_change_password` flag |

### Frontend

| File | Change |
|------|--------|
| `pages/ChangePasswordPage.jsx` | Forced mode: yellow banner, different labels, redirects to app after change, no sidebar |
| `pages/SettingsPage.jsx` | Create: shows temp password. Reset: one-click (no admin-typed password), works for all roles |
| `pages/BusinessPickerPage.jsx` | One-Owner warning banner |
| `components/SuperAdminsPanel.jsx` | Reset Password button for each Owner (except self) |
| `components/PrivateRoute.jsx` | Redirects to change-password when `must_change_password` is true |
| `context/AuthContext.jsx` | Exposes `mustChangePassword` flag |
| `services/api.js` | `resetPassword(id)` replaces `resetBdPassword(id, newPassword)` |

---

## What stays the same

- Voluntary password change (Password page) still works as before
- The Owner registered in P3-3 is not affected (they chose their own password)
- Lockout (5 wrong attempts) still works; a reset also lifts the lock
