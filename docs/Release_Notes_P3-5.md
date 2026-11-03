# Release Notes: P3-5 — Navigation tidy-up

**Phase:** 3 — Accounts and entry
**Date:** 3 Nov 2026
**Result:** No code changes needed — audit confirmed everything is already correct from P3-2b.

---

## What was checked

| Area | Finding |
|------|---------|
| "Back" button | Gone. The logo in the sidebar signs out (same as "Sign out"). Its tooltip says "Back to main page" but that's just a hover hint, not a visible button |
| "Sign out" | Shown for everyone, in every mode (business and console-only) |
| "Switch business" | Shown only for Owners and people who work in more than one business. Hidden for everyone else |
| Console-only mode | Shows only: Select business, Organization Settings, Password. No business pages leak through |
| In-page "← Back" links | Found in the Business Wizard, Expansion Picker and Customers page. These are navigation within a page (e.g. back to the list from a detail view), not session exits — correct |
| Nav item visibility | Each module item respects the business's enabled modules and the person's access level. Disabled items show a lock icon |

## Conclusion

P3-2b already handled the navigation tidy-up completely. No further changes required.
