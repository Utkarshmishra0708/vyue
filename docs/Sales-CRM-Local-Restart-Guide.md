# Sales CRM: Local Restart Guide

**Where the project is does not matter.** Every command in this guide (and in every chat and document) says `%SALESCRM%` for "the Sales-CRM project folder". Tell each computer where that is, once:

1. Open File Explorer and go into the **Sales-CRM** folder (the one that contains `backend`, `frontend` and `docs`).
2. Click the address bar at the top, type `cmd` and press Enter. A command window opens already inside that folder.
3. Type this, and press Enter:

```
setx SALESCRM "%CD%"
```

4. Close that window and every other command window. Open a **new** one and check: `echo %SALESCRM%` prints the folder's path. (A window opened before the `setx` does not know it yet.)

Do this once on each computer. If the project folder is ever moved or renamed, do it again.

The app has 3 parts. All 3 must be running for the app to work.

| Part | What it is | How it runs |
|------|-----------|-------------|
| MySQL database | Stores all the data | Starts by itself with Windows. Nothing to do. |
| Backend | The engine (port 4000) | Needs its own cmd window |
| Frontend | The screen you see (port 3000, or 3001 if 3000 is busy) | Needs its own cmd window |

---

## 1. Start the app (every time you restart the laptop)

You need **two separate cmd windows**. Open each one by pressing the Windows key, typing `cmd`, and pressing Enter.

If a window's prompt starts with `PS` (PowerShell), type `cmd` and press Enter first. Otherwise npm shows a "running scripts is disabled" error.

### Window 1: Backend

```
cd /d "%SALESCRM%\backend"
npm run dev
```

Wait for this line:
`Sales CRM API listening on http://localhost:4000`

### Window 2: Frontend

```
cd /d "%SALESCRM%\frontend"
npm start
```

Wait about a minute. The browser opens by itself. If it asks "Something is already running on port 3000… run on another port?", type `y`. If the browser doesn't open, go to the `Local:` address the window shows, normally:
`http://localhost:3000` (or `http://localhost:3001`). There is no `/sales_crm` at the end any more.

**Leave both windows open while you use the app. Closing a window stops that part.**

**Always stop the backend with Ctrl + C before closing its window.** Closing it with the X button can leave it running in the background, and a second backend then fails with "EADDRINUSE" (port 4000 already in use). To find and stop a hidden one: `netstat -ano | findstr :4000`, note the number at the end of the LISTENING line, then `taskkill /PID <that number> /F`.

---

## 2. Check that it is running

Open this in the browser:
`http://localhost:4000/api/health`

You should see `{"status":"ok", ...}`. If it says "site can't be reached", the backend is not running. Redo Window 1.

---

## 3. Log in

- **Everyone:** the sign-in page is one form. Type your **email or username** (never the full name) and your password. If you work in one business you go straight in. The **Owner**, and anyone who works in several businesses, then picks a business.
- Your username is shown in Settings → Users, for example `Riya.Shah`. Usernames are unique across the whole company.
- A newly added person starts with the password `123456`. People created by `npm run sample` use `Test@1234`.
- **First start after setup, or "The server was not started … JWT_SECRET":** run `npm run new-secret` in the backend folder, then start the backend again.

---

## 3b. Backups (do this before applying a release that changes data)

In the backend folder:

| Task | Command |
|------|---------|
| Copy the database | `npm run backup` |
| List the copies | `npm run backup -- --list` |
| Use a copy | Set `DB_NAME` in `backend\.env` to the copy's name, restart the backend |
| Start again as a brand-new install (a copy is saved first) | `npm run reset -- --yes`, **only** on a test database |

## 3c. Locked out, or forgot the Owner password

Run these on this computer, in the backend folder (the app can stay running):

| Task | Command |
|------|---------|
| See locked accounts | `npm run unlock -- --list` |
| Unlock one account | `npm run unlock -- --email you@company.com` |
| Set a new password | `npm run set-password -- --email you@company.com` (asks twice, at least 8 characters) |
| New secret key (signs everyone out) | `npm run new-secret`, then restart the backend |

## 3d. Moving to another computer

**What moves:** the project folder (the code, its history, all the documents and any unfinished work), the database (optional, yours holds test data only), and the settings file (**not copied**: it holds your passwords and secret key, so it is recreated). Everything except the database is in **one zip**.

**On the old computer**

1. Finish what is in progress, and save your work (`git add` and `git commit`) so the zip holds a finished state.
2. Make the move zip. It holds everything except the packages (`node_modules`, reinstalled later) and the settings file. The project folder must be called `Sales-CRM`:

```
tar -a -c -f "%USERPROFILE%\Desktop\Sales-CRM-move.zip" --exclude=node_modules --exclude=build --exclude=.env -C "%SALESCRM%\.." Sales-CRM
```

3. Optional, only if you want your test data on the new computer (if MySQL is installed somewhere else, change the path):

```
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump" -u root -p sales_crm > "%USERPROFILE%\Desktop\sales_crm.sql"
```

4. Copy `Sales-CRM-move.zip` (and `sales_crm.sql`) to the new computer, for example with a USB drive or a cloud folder.

**On the new computer**

1. Install **Node.js** (LTS, the same major version as before, 24), **MySQL 8.0** (the server and Workbench: choose a root password and remember it), **Git for Windows**, and optionally **VS Code**. Open a new command window and check: `node -v`, `npm -v`, `git --version`.
2. Tell Git who you are:

```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

3. Unpack the move zip wherever you like. This puts it in your Documents folder:

```
mkdir "%USERPROFILE%\Documents\Sales CRM"
tar -xf "<full path of the zip you copied>" -C "%USERPROFILE%\Documents\Sales CRM"
```

4. Tell this computer where the project is (the one-time step at the top of this guide). Open File Explorer, go into `Documents\Sales CRM\Sales-CRM`, type `cmd` in the address bar, then `setx SALESCRM "%CD%"`, then close every command window and open a new one.
5. Recreate the settings file: `cd /d "%SALESCRM%\backend"`, then `copy .env.example .env`, then `notepad .env`. Set `DB_PASSWORD` to the new MySQL root password, and set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_ADMIN_NAME` for the Owner. Save, then `npm run new-secret`.
6. Install the packages, once in `backend` and once in `frontend` (a few minutes each): `npm install`.
7. The database. **Fresh start (simplest):** in `backend`, `npm run reset -- --yes` creates the database, the tables, the Owner and a starter business (then, if you like, `npm run sample`). **Or bring your data:** create an empty database called `sales_crm` in Workbench, then `mysql -u root -p sales_crm < "<full path of sales_crm.sql>"`.
8. Start the backend (`npm run dev`) and the frontend (`npm start`), and open the address the frontend window shows, normally `http://localhost:3000`.
9. Check the history came across: `cd /d "%SALESCRM%"`, then `git branch` (the star should be on `p3-accounts-and-entry`), `git log --oneline -5`, and `git stash list`.

**Good to know**

- Never copy `.env` between computers. The new secret key simply signs everyone out.
- The link to the original company's server was removed on purpose, so there is nothing to reconnect.
- The documents are in the project's `docs` folder, so they move with the zip.

---

## 4. Stop the app

Click inside each cmd window and press **Ctrl + C**. If it asks "Terminate batch job?", type `Y` and press Enter.

---

## 5. Common problems

| What you see | What it means | Fix |
|--------------|---------------|-----|
| Login page loads but login fails | Backend is not running | Start Window 1 |
| `Access denied for user 'root'` | `DB_PASSWORD` in `backend\.env` is wrong | Run `notepad backend\.env`, fix the `DB_PASSWORD=` line (no spaces, no quotes), save, restart the backend |
| `npm : File ... npm.ps1 cannot be loaded` | You are in PowerShell | Type `cmd`, press Enter, then run the command again |
| `Cannot GET /` on port 4000 | Normal. The backend only serves data. | Use `http://localhost:3001` instead |
| `Port 4000 is already in use` | Backend is already running in another window | Close the extra window |
| `The system cannot find the path specified` | Typo in the `cd` line | Copy the line exactly, with the quotes. Type nothing extra before it. |
| Global Admin says "Invalid credentials" | The account is missing the Global Admin permission | In MySQL Workbench run: `UPDATE sales_crm.users SET super_admin_scope = 'write' WHERE email = 'YOUR_ADMIN_EMAIL';` |
| `'git' is not recognized` | cmd was opened before Git finished installing | Restart the laptop |

---

## 6. Git: your safety net

Run these inside the `Sales-CRM` folder.

| Task | Command |
|------|---------|
| See which branch you are on | `git branch` |
| See what changed | `git status` |
| Start a new change on its own branch | `git switch -c branch-name` |
| Save your work | `git add .` then `git commit -m "what you changed"` |
| Go back to the original code | `git switch main` |
| Merge a change that works | `git switch main` then `git merge branch-name` |
| Throw away a change that failed | `git switch main` then `git branch -D branch-name` |

**Rules:**
- `main` holds your original code. Make changes on other branches only.
- Do **not** run `git push`. That would send code to the organization's server.
- Never run `npm audit fix`. It can break the app.

---

## 7. Keep private

- `backend\.env` holds your database password. Don't share it or email it.
- The `.gitignore` file keeps `.env` out of Git. Leave it that way.
