# Sales CRM: Roadmap

**Goal:** turn the current Jio-specific CRM into a product any industry or company can use.

**How we work:** one phase at a time, and inside a phase one small piece at a time. Each piece gets its own Git branch. You test it, then we merge it into `main` or throw it away. `main` is never touched until a change is proven.

**Branch naming:** `p2-neutral-seed-data`, `p3-first-run-setup`, and so on (phase number, then what it does).

---

## Phase 0: Local setup (DONE)

Node, MySQL, Git and VS Code installed. App runs on the laptop. Safe branch created. Restart guide written.

---

## Phase 1: Decisions (no code) (DONE)

These choices shape every later phase. Nothing gets built until they're settled.

| Decision | Why it matters |
|----------|----------------|
| Product name (a placeholder is fine) | Replaces "Jio Sales CRM" everywhere |
| Vocabulary: what "Business Unit", "BD", "Global Admin", "PO", "Lead" become | Used in every screen and in the manual |
| Target customers: which industries first | Decides default stages, fields and sample data |
| Keep the multi-business model? (one company running several separate businesses) | It's the app's core structure today |
| Where it will be hosted, and the budget | Decides Phase 4 |
| Ownership check: confirm you have the right to turn this codebase into a product | It was built in an organization's context. Settle this with them before selling. This is not legal advice. |

**Done when:** all six are answered and written down.

### Decision log

| Decision | Status | Answer |
|----------|--------|--------|
| Product name | Working name | **Sales CRM** (placeholder, kept in one place so it's easy to change) |
| Vocabulary | **Approved** | See the vocabulary table below |
| Target customers | **Decided** | **MSMEs, B2B, all industries.** One vanilla product. We build an industry-specific version only when we find a clear gap in that industry. |
| Multi-business model | Kept | One owner can run several businesses, each with its own users and data |
| Hosting and budget | Open | Decided in Phase 4 |
| Ownership check | Open | Yours to settle with the organization before selling |

### Approved vocabulary

| Today | New |
|-------|-----|
| Business Unit / "Platform" | **Business** |
| Global Admin | **Owner** |
| Business Admin | **Business Admin** (unchanged) |
| BD | **Sales Rep** |
| PO Expected / PO Received | **Order Expected / Won** |
| Global POs | **Orders** |
| TCV | **Deal Value** |
| Potential TCV | **Potential Deal Value** |
| VOC | **Customer Feedback** |
| Admin Console | **Organization Settings** |
| Activity | **Activity Feed** |
| PO Number, PO Start/End Date, PO Type, PO Validity | **Order Number, Order Start/End Date, Order Type, Validity** |
| OPEX / CAPEX | **Recurring / One-time** |
| KAM Name | **Account Manager** |
| Lead Affiliate / Affiliate Name | **Referral Partner** |
| Chain / Chain Name / Chain Mapping | **Parent Account** |
| Property Category / Property Type | **Customer Category / Customer Type** |
| Number of Requirement | **Quantity Required** |
| Hardware Requested Date | **Delivery Requested Date** |
| Sent to SCM | **Sent to Supply Chain** |

**Staying as they are:** Inventory Pipeline, Task Board, Lead, Customer, Campaign, Team Member, Expansion, and the stage names.

**Notes:**
- *Inventory Pipeline* tracks hardware needs by month and state, so it becomes an **optional module** that each business switches on only if it sells hardware.
- Because the product is for MSMEs, design favors **fewer fields up front** and advanced ones tucked away.
- Because the product is **vanilla for all industries**, there is **one neutral default setup** (generic stages, fields and sample data), replacing the Jio-specific demo data. Each business can then customize its own fields, stages and dropdowns. Industry packs come later, only where we find a gap.
- Industry-specific parts (devices, service-based price calculation) become **optional modules**, not part of the default.

---

## Phase 2: Remove Jio (DONE)

**Backend**
- Replace the seeded demo people and data with neutral examples
- Replace the Jio product lists and service definitions (migration 030) with generic, editable ones
- Make the three businesses plain data, with no special code for "signage", "jhes" or "surveillance"
- Review the per-business price calculations, which are written for specific Jio products
- Clean Jio wording out of code comments and settings
- Apply the approved vocabulary to labels, messages and exports
- Make Inventory Pipeline an optional module per business
- ~~Make amounts (₹ Lakhs), the State / UT picker and the India map settings~~ **Parked** until the product goes beyond India

**Frontend**
- Remove the hardcoded business list, Jio product list and device list in `constants.js`
- Remove the Jio logo and Jio wording in the sidebar, login and page titles
- Replace the SSO select page with a neutral entry
- Use the new vocabulary from Phase 1

**Done when:** a search of the code finds no "Jio" in anything a user can see, and the app starts correctly on a brand-new empty database.

---

## Phase 3: Accounts and entry

**Decisions (agreed):** one company per install (each customer company gets its own copy of the app and database, so companies can never see each other's data); temporary passwords instead of invite emails for now; **sign in first, businesses after** (decided during P3-2b: one sign-in form with an email or username; the businesses come after, only for the Owner and for people in several businesses); OTP verification comes later, with hosting (Phase 4). Branch: `p3-accounts-and-entry`.

**Goal:** the product has never heard of Jioautify. Our own sign-in replaces the Jio portal completely, and a company can register itself and start.

| Release | What | Result |
|---------|------|--------|
| P3-1 | **Our own sign-in; the Jio portal code deleted.** The portal hand-off, the account-chooser page and the Jio user-system registration go. Password sign-in works everywhere. The app refuses to start without a proper secret key and a command (`npm run new-secret`) creates one; it only accepts requests from allowed sites; an account locks for 30 minutes after 5 wrong tries, and an admin can unlock it | No trace of Jioautify in the sign-in | **DONE.**
| P3-2a | **The Owner engine (backend).** One Owner account for the whole company, no copies. The business is named inside the sign-in pass, so the Owner can enter any business (including ones created later) from the sign-in page or with a switch. Old copies are disabled. Also built here: rescue commands (`npm run unlock`, `npm run set-password`) for a locked or forgotten Owner password, and **usernames** (sign in with email or username, never the full name; first Priya Nair is Priya.Nair, then Priya1.Nair; editable; the Owner can use one too) | **DONE.** Built, tested and committed (2 Nov 2026). Two optional tests stay open: the set-password rescue command, and bulk import by username (needs Excel) |
| P3-2b | **Sign in first, then the business picker.** One sign-in form (email or username, and password) with no business list. Someone in one business goes straight in. The Owner, and anyone in several businesses, picks from a plain picker; **Switch business** and **Sign out** are the only two exits. Usernames become unique across the whole company. **Settings** is the open business's own; **Organization Settings** (businesses and Owners) is a separate Owner-only page. The business list now needs a sign-in. "Back" becomes "Sign out" for everyone | **DONE** (tested by Mohit, all 18 checks)|
| P3-2c | **Fixes from testing.** People with the same name are mixed together on the Dashboard, the Leads Sales Rep filter, the weekly targets and the Reports (#39), and anything else found while testing P3-2b | **DONE** (3 Nov 2026). All BD matching switched from name to account ID across Dashboard, Leads, Kanban, Reports, Customers, and Inventory Pipeline. Username shown beside repeated names. Weekly targets converted from name-keyed to id-keyed. Shared disambiguation utility (`nameLabels.js`) |
| P3-3 | **Landing page and first-run registration.** On an empty install the landing page says **Register your company**: company name, the Owner's name, email and password, and the first business's name. After that, the landing page is the one sign-in form | **DONE** (3 Nov 2026). Fresh install shows registration form; after the first Owner registers, the page becomes the normal sign-in form forever |
| P3-4 | **Adding people.** A new person gets a one-time temporary password, shown to the admin once, and must choose their own at first sign-in. Resetting works the same way. **No admin ever chooses or sees anyone's password** (item 43). **An Owner can unlock and reset another Owner**, and the app gently reminds a one-Owner company to add a second Owner | No more "no way to set a password" |
| P3-5 | **Navigation tidy-up.** Largely done in P3-2b: "Back" is now "Sign out" for everyone and the Owner has "Switch business". What is left is checked then | Mostly done |

**The secret key:** a private random value that signs the "passes" given at sign-in. Changing it only signs everyone out (they sign in again with their normal passwords); no data or passwords are affected. Change it when someone with access leaves, if it may have leaked, and when moving to a real website (the website gets its own new key). `npm run new-secret` makes one.

**Account recovery for a locked or forgotten Owner password** (in order of use): (1) wait, a lock lifts after 30 minutes (built); (2) a second Owner unlocks or resets them from the screen (P3-4); (3) a "Forgot password" link that sends a reset email (Phase 4, needs the email service); (4) our support team runs the rescue commands `npm run unlock` and `npm run set-password` (built), after checking the person's identity. Layer 4 needs us to be able to reach the customer's copy of the app, which depends on who hosts it (open decision below).

**Open decision (Phase 4):** will we host each customer's copy, or will customers run it themselves? It decides how support is done: either we run the rescue commands for them (with an identity-check checklist), or we give their IT person a plain-language recovery guide.

**Later:** OTP verification (needs an email or SMS service): Phase 4. Many companies on one shared website: its own phase, if ever needed.

---

## Phase 4: Hosting that works online

**Frontend**
- ~~Remove the fixed `/sales_crm` path~~ done in P3-1: the app is served from the site root, and a sub-folder can be set with `REACT_APP_BASE_PATH`
- Point the app at the backend's address through a setting
- Add the routing setting Vercel needs for single-page apps

**Backend**
- Choose a host that supports an always-on Node server (Vercel's serverless style doesn't suit this backend), plus a hosted MySQL database
- Move file uploads off the local disk to cloud storage
- Run the hourly scoring and notification jobs properly on the host
- Run database updates (migrations) as a deployment step
- Production settings and a health check
- Email service, then **OTP verification** at registration and sign-in (a code sent to the email), and invite emails to replace temporary passwords
- A new secret key for the website (never reuse the laptop's)

**Done when:** the online version supports setup, login, creating a lead and uploading a file, with the same behaviour as your laptop. We'll ask for the real Vercel error logs when we start.

---

## Phase 5: Design foundation (UI and UX together)

**Design rule (from you):** minimal text. Users shouldn't have to read to use the tool: short labels, one-line hints at most, no instruction paragraphs.

**Who does the visual design (decided):** the look and feel is a job for Mohit's designers, with the assistant's help on request. **Until Phase 5, every screen is built functionally: correct behaviour and structure, reusing the existing look and components.** No new colours, fonts, icons, layouts or animations are invented in Phases 2 to 4. Design references to hand to the designers: (1) a "Select Workspace" picker (cards with an initials tile, a name, a short line and an arrow, and a Create card on top; the product says "Business", not "Workspace"); (2) a companies list with a left menu, search, filters and coloured status pills.

**UX**
- Map how people move through the app, and fix the navigation and layout
- Decide the page structure once, for all screens

**UI**
- Define colours, fonts and spacing once
- Build a small set of reusable parts: buttons, inputs, tables, modals, badges
- Replace the single global CSS string and scattered inline styles gradually
- Make it work on smaller screens

**Done when:** the reusable parts exist, and one screen (the login page) has been rebuilt with them as the proof.

---

## Phase 6: Screen by screen (bugs and improvements)

For each screen, in this order: fix its bugs, redesign it with the Phase 5 parts, and improve its features.

1. Leads (and the lead form)
2. Dashboard
3. Customers
4. Activities
5. Reports and Forecast
6. Campaigns and VOC
7. Settings and Business Units

The very large files (`DashboardPage` and `LeadForm` are each over 1,000 lines) get split into smaller parts along the way. We add tests for the critical parts, such as lead stages and value calculations, as we go.

**Done when (per screen):** it uses the new design, its known bugs are fixed, and you've tested it by hand.

---

## Phase 7: New features, then new modules

Your list goes here. We build on the clean base from Phases 2 to 6. For each idea we agree first what it does, then build it as one branch.

---

## Phase 8: Documentation

- Rewrite the user manual for the generic product
- Update the README, release notes and setup guide
- Add a first-run guide for new customers

---

## Running issue list

| # | Issue | Fixed in |
|---|-------|----------|
| 1 | Global Admin can't enter business logins | Phase 3 |
| 2 | Online version breaks on Vercel | Phase 4 |
| 3 | No landing page or first-run setup | Phase 3 |
| 4 | Jio wording, products and logos throughout | Phase 2 |
| 5 | Seeded admin has no Global Admin permission (fixed by hand during setup) | Phase 3 |
| 6 | README says the database is `jio_sales_crm`, but the code uses `sales_crm` | Phase 8 |
| 7 | API allows requests from any website | Phase 3 |
| 8 | About 60 reported dependency vulnerabilities in the frontend packages | Phase 6 |
| 9 | Only 2 automated tests | Phase 6 |
| 10 | Login page shows no form in production, only "open from the portal" | Phase 3 |
| 11 | Sign-in handoff and logout are built around Jio's portal | Phase 3 |
| 12 | Amounts, state list and map are fixed to India formats | Parked (P2-6) until going beyond India |
| 13 | An Owner signed in inside a business sees Organization Settings instead of that business's settings | Phase 3 |
| 14 | Kanban drag wiped City, State, Customer Type, Customer Category and Quantity (original code) | Fixed in P2-1b |
| 15 | Kanban drag to Won skipped the order document and Order Number | Fixed in P2-1b |
| 16 | Sales Rep Performance report always showed 0 won leads (original code) | Fixed in P2-1b |
| 17 | Lead history showed raw field names; Edit template kept old labels | Fixed in P2-1b |
| 18 | Changing a stage opens the whole lead form; users want a small dialog asking only for what that stage needs (date, order document and number, Lost reason) | Done in P2-3d |
| 19 | A Kanban drop only registers when the target column is fully in view | Phase 6 (Leads screen) |
| 20 | A newly added user has no way to set their password; an admin has to reset it | Phase 3 (own sign-in: invite or set-password link) |
| 21 | Customer Type still offered "Chain" (saved value) | Fixed in P2-3b-2 ("Part of a group") |
| 22 | Renew / Additional Order screen was hard to understand | Fixed in P2-8 (two-step dialog) |
| 23 | Act from the record: Renew and New order on a won lead, Reopen on a lost lead, and possibly separate Open / Won / Lost views | Phase 6, designed together with the Leads screens |
| 24 | Automatic renewal leads (for example 60 days before a won order ends), configurable per business | Phase 7 (new features) |
| 25 | Kanban: drags are flaky in a narrow window and the board loses its scroll position after each move | Phase 6 (Leads screen), with #19 |
| 26 | Deal Value ignores monthly fees until a contract period is set, while Annual Value assumes 12 months. Default the period to 12 or add a hint | Phase 6 (Leads screen) |
| 27 | While the business list loads, the switcher and "Owner · …" line briefly show the internal ID | Phase 5 (design foundation: loading states) |
| 28 | Bulk Import matches the Lead Owner only on the full saved name; accept a unique first name too | Phase 6 (Leads screen) |
| 29 | Sample data message said Sales Reps use "the default password from the seed"; sample reps use Test@1234 | Fixed in P3-2a |
| 30 | The list of people behind the dropdowns could be read without signing in, and included mobile numbers | Fixed in P3-2a (sign-in required, own business only, no mobiles) |
| 31 | Two people with the same name could be mixed up at sign-in | Fixed in P3-2a (usernames) |
| 32 | The Leads page's Sales Rep filter and the Reports show only the plain name for people who share one | Phase 6 (Leads screen) |
| 33 | An Owner could not save their own profile (the form refused the role super_admin) | Fixed in P3-2a |
| 34 | The Change Password page accepts 6 characters, while the rescue command asks for 8. Make it 8 everywhere | P3-4 (adding people and passwords) |
| 35 | Sign-in lockout counts wrong passwords against one account when the same email is on several accounts | Fine as is (rare); revisit with P3-4 |
| 36 | A person in several businesses who has a different password in each can hop between them without the other password (the existing switch rule: same email means same person) | Review in P3-4 |
| 37 | Fixed lists that still lean on the old businesses: **Customer Category** (Hospital, Hotels, BFSI, Retail…), and in Customer Feedback the **segments, feedback types, impacts, priorities and statuses**. Make them editable per business, like the other dropdown lists in Settings | Phase 6 (Customer Feedback and Leads screens) or Phase 7 |
| 38 | The Customer Feedback product list was a fixed surveillance list | Fixed in P3-2b (each business's own services) |
| 39 | **People with the same name are mixed together on the Dashboard.** It finds each Sales Rep's leads by their **name**, so two people called Riya Shah show as two identical cards with the combined numbers (seen by Mohit). The same name matching is behind the Dashboard's Sales Rep filter, the weekly target cards, the Won-units line per rep, the weekly targets themselves (saved under each rep's name), the Leads page's Sales Rep filter, and the Reports. Fix: match by the person's account number everywhere, show the person's **username** beside a repeated name (on the weekly target cards and the annual performance cards, as in Mohit's two screenshots, and in the filters), and move the saved weekly targets from names to account numbers with a one-time conversion that loses nothing | Fixed in P3-2c
| 40 | **Task Board is a shared board** (a Sales Rep sees every card in the business, because a card's owner is typed text, not a person). **Decided (Mohit): keep it shared** | Done: the Sales Rep description no longer says "own activity only" (P3-2b) |
| 41 | **"Chains"** wording on the Leads page button and **"CHAIN MAPPING"** on the lead form | Fixed in P3-2b ("Master Orders", "PARENT ACCOUNT") |
| 42 | The Leads table and the Kanban card showed a bare **₹** for a lead with no deal value | Fixed in P3-2b (a dash) |
| 43 | **Admins set other people's passwords**, and new people start with the fixed password 123456. An admin should never choose or know a person's password. **Plan agreed (Mohit):** a reset or a new person gets a random one-time password, shown once, which they must change at first sign-in (P3-4); a "Forgot password" email link comes with Phase 4, and the admin's reset button goes away then. Until email exists the admin reset stays, because a Sales Rep who forgets would otherwise have no way back in | P3-4, then Phase 4 |
| 44 | **Same email = same person.** One person with accounts in several businesses has one username in all of them (it was a new one per business). Two different people never share a username or an email | Fixed in P3-2b (database change 062) |
| 45 | Tabs and the picker: a tab on the picker did not follow another tab; the picker could remain on screen inside a business | Fixed in P3-2b |
| 46 | The Customer Feedback form said "Product / Solution" while the filter said "Product" (and "Type" vs "Feedback Type") | Fixed in P3-2b |

New issues get added here as you find them.
