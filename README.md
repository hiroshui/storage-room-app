# Storage Room App

A lightweight, self-hosted inventory web app for storage rooms, cabinets and shelves. Designed for phones, tablets, wall-mounted kiosk displays and small Linux hosts such as a Raspberry Pi.

## Features

- Multiple storage rooms
- Interactive top-down **room plan** per storage room
- Lightweight admin room planner built with native SVG (no WebGL or frontend framework)
- Drag storage locations into position and configure room dimensions
- Optional doors, windows and obstacles in the floor plan
- Search-aware floor plan: locations containing matching inventory are highlighted automatically
- Tap a location in the plan to filter its inventory
- Alternative compact location/cabinet overview
- Searchable inventory with categories, shelves, quantities and notes
- Local authentication with admin and user accounts
- Admin-managed user creation
- Explicit sign-out from the main UI and account settings
- Per-device kiosk mode with a configurable default room
- Browser fullscreen kiosk mode where the Fullscreen API is available
- Read-only kiosk UI: room switching, search and location filtering remain available while editing/admin controls are locked
- Responsive phone/tablet/desktop UI
- SQLite persistence
- No Python packages required: Python standard library only
- In-place migration of previous databases

## Why SVG for the room planner?

The room plan intentionally uses plain SVG and small JSON geometry instead of Canvas/WebGL or a large JavaScript framework. The server only persists room dimensions and coordinates. Rendering, highlighting and drag interaction happen in the browser, so even a very small server only has to serve HTML/CSS/JS and SQLite data.

## Quick start

```bash
python3 app.py
```

Open `http://localhost:8080`. On a fresh database, the application prints a randomly generated initial admin password to stdout. You can explicitly bootstrap credentials with:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='use-a-long-password' python3 app.py
```

Do not commit credentials or the SQLite database.

## Room planner

Administrators can open **Settings → Room planner** for the currently selected storage room.

1. Set the room width and depth in metres.
2. Drag each storage location into place.
3. Adjust exact X/Y position, footprint and rotation in the inspector.
4. Optionally add doors, windows and neutral obstacles.
5. Use **Auto arrange** as a quick starting point. Location groups named e.g. `Left`, `Right`, `Front` or `Back` are placed against their corresponding wall when possible.
6. Save the plan.

The inventory and plan are linked by location ID. Renaming a cabinet/location therefore does not break the room plan.

When a user searches for an item, every location containing a match is highlighted in the floor plan. If matching items contain a shelf/level value, the highlighted location shows that shelf information directly in the plan.

## Configuration

- `HOST` — bind address, default `0.0.0.0`
- `PORT` — HTTP port, default `8080`
- `STORAGE_ROOM_DB` — SQLite path, default `data/storage-room.db`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — used only when the first user is created
- `SESSION_TTL` — login session lifetime in seconds, default 14 days
- `COOKIE_SECURE=1` — recommended when the app is exposed exclusively over HTTPS

## Authentication

Passwords are stored as salted PBKDF2-SHA256 hashes. Sessions use random opaque tokens stored as SHA-256 hashes in SQLite. Mutating API requests require a per-session CSRF token. Cookies are `HttpOnly` and `SameSite=Strict`. Signing out invalidates the server-side session and expires the browser cookie.

For an Internet-facing installation, put the app behind a TLS reverse proxy or a secure tunnel and set `COOKIE_SECURE=1`. Local accounts protect the application itself; an upstream access-control layer can be added as a second boundary.

## Kiosk mode

Kiosk settings are intentionally device-local (`localStorage`). In **Settings → Kiosk**, enable kiosk mode and choose the room this particular browser should open by default.

When kiosk mode is enabled:

- the app switches to the room-plan view;
- the app requests browser fullscreen immediately from the user's click;
- the configured default room is opened;
- the room selector, search and location filters remain available;
- adding/editing/deleting inventory and opening Settings are disabled;
- sign-out is hidden until kiosk mode is left;
- context menus, drag actions, browser zoom gestures and common browser keyboard shortcuts are blocked on a best-effort basis;
- if fullscreen is left with `Esc` or by the browser, the app displays a blocking screen that lets the user re-enter fullscreen or leave kiosk mode;
- a small **Exit kiosk** control remains available and requires confirmation.

Browsers intentionally do not allow a website to take over the device completely. For a truly locked wall tablet, combine this app mode with an OS/browser kiosk feature such as Android screen pinning/dedicated-device mode, iPad Guided Access, Chromium `--kiosk`, or a dedicated kiosk browser.

Kiosk mode does **not** bypass authentication. The device must sign in with a normal local account.

## Database upgrades

Existing V3/V4 databases are compatible. V5 adds a `room_layouts` table automatically when the application starts. Existing rooms and inventory are untouched. Rooms without a saved plan receive an automatic browser-side starter layout until an administrator saves a custom plan.

For a V2 database, point `STORAGE_ROOM_DB` to the old `inventory.db` and start the app once. The old locations/items are migrated into a room named `Storage room`.

Back up the database before upgrading.

## Project layout

```text
app.py
static/
  app.css
  app.js
  login.js
templates/
  app.html
  login.html
data/
deploy/
```

## Production notes

Run the service as an unprivileged user, keep `data/` writable only by that user, back up the SQLite database, and expose only the application port to your reverse proxy/tunnel. The included systemd unit is a starting point; adjust paths and user names to your host.
