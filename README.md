# 🏗️ ConstructionIMS v2

**Offline Construction Inventory & Store Management** — runs 100% in your browser, no server, no internet, no installation required.

All data lives in your browser's IndexedDB, so it stays on this machine, in this browser. Use the **Backup** feature in Settings to export a JSON file you can move between machines.

---

## ✅ Default Login

```
Username:  admin
Password:  admin123
```
You can change the password in **Settings → Change Password** after logging in.

---

## 🚀 How to run

You have two options.

### Option A — One-click launchers (recommended)

These start a local web server on **http://localhost:8080** and open the app in your default browser.

| OS | Double-click |
|---|---|
| **Windows** | `start.bat` |
| **macOS / Linux** | `start.sh` (you may need to `chmod +x start.sh` once) |

Both require **Python 3** (already installed on macOS and most Linux; on Windows install from python.org and tick "Add to PATH" during setup).

To stop the server, press `Ctrl + C` in the terminal window that opens, or simply close it.

### Option B — Open the file directly

Just double-click `index.html`. It works in modern browsers (Chrome, Edge, Firefox, Safari) since IndexedDB is supported on `file://` URLs.

> ⚠️ For best stability and so multiple browsers/profiles on the same PC can see the same data, prefer **Option A** (localhost).

---

## 📋 Features

- **Dashboard** — Stock value, low-stock alerts, pending POs, tools out, recent movements
- **Company & Projects** — Configure your business and active projects
- **Sites & Locations** — Storage sites with racks/bins per site
- **Equipment Register** — Vehicles, machines, generators, serialized assets
- **Item Master** — Material catalog with SKU, category, unit, reorder level, cost
- **Stock IN / Stock OUT** — Record received deliveries and issued materials
- **Tool Tracker** — Issue tools to workers, mark them returned
- **PO Generator** — Auto-suggest purchase orders from items below reorder level, grouped by supplier
- **Purchase Orders** — Full PO lifecycle: Draft → Sent → Received (auto-creates Stock IN on receipt)
- **Reports** — Stock levels, low stock, all movements, tools out, PO summary, CSV export
- **Settings** — Backup (full DB → JSON), Restore, Change Password, Factory Reset

---

## 💾 Backup & Restore

Your data is stored in your browser's IndexedDB. **Clearing browser data will erase everything.** Always keep recent backups.

1. **Settings → Download Backup** → saves `cims-backup-YYYY-MM-DD.json`
2. **Settings → Restore Data** → choose a backup file to overwrite current data

Use this to move data between computers — e.g. take a backup from your office PC, restore it on your laptop.

---

## 🌐 Network access (optional)

If you want other devices on the same Wi-Fi (a tablet on the site, a colleague's laptop) to use this same instance, edit `start.bat` / `start.sh` and replace `localhost` with `0.0.0.0`, then connect from another device using your computer's local IP (e.g. `http://192.168.1.42:8080`).

> Note: each browser still keeps its own IndexedDB, so each device has its own independent data set. To sync, use the backup/restore feature.

---

## 🗂️ File structure

```
ConstructionIMS/
├── index.html         ← entry point
├── css/
│   └── style.css      ← all styling
├── js/
│   ├── db.js          ← IndexedDB wrapper
│   └── app.js         ← all application logic
├── start.bat          ← Windows launcher
├── start.sh           ← macOS / Linux launcher
└── README.md          ← this file
```

---

## 🛠️ Browser support

Tested on:
- Chrome / Edge / Brave / Opera (Chromium 90+)
- Firefox 88+
- Safari 14+

Requires JavaScript and IndexedDB enabled (default).
