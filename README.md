# Storage Room App

A lightweight, self-hosted inventory web app for storage rooms, cabinets and shelves. It is designed for phones, tablets, wall-mounted kiosk displays and small home servers.

The backend uses only the Python standard library and SQLite. The room plan and shelf visualizations are rendered in the browser with HTML/CSS/SVG, so the server remains lightweight.

## Features

- Multiple storage rooms
- Interactive top-down room plan per room
- Lightweight SVG room planner with draggable storage locations
- Doors, windows and neutral obstacles in the plan
- Search-aware room plan: matching locations are highlighted automatically
- **Dedicated Shelves view:** switch directly between front-facing shelf visualizations for every storage location
- Search results also highlight the matching shelf inside the front view
- Real shelf records per storage location (1–32), with add/delete/rename/reorder
- Drag-and-drop location ordering, shelf ordering and item moves between shelves
- Reliable pointer sorting for wrapped location grids, including dropping after the final card
- Inline shelf preview from the Locations overview
- Searchable inventory with categories, shelves, quantities and notes
- Local authentication with salted PBKDF2-SHA256 password hashes
- Three roles: **Admin**, **User**, **Read-only**
- Per-user room permissions
- Normal users use an opt-out model and start with access to all rooms
- Read-only users use explicit room assignment and are ideal for kiosk/guest accounts
- Admins can change roles, room assignments, account status and passwords
- Current account is visible in the header with a selectable Man/Woman/Robot profile icon
- Users can change their own display name and profile icon from **Settings → Account**
- Per-device kiosk mode with configurable default room
- Browser fullscreen kiosk mode where supported
- SQLite persistence and automatic in-place database migration
- No frontend framework, npm runtime or WebGL dependency
- Containerfile + Compose configuration for a small server/Proxmox deployment
- Dependency-free smoke tests

## Quick start

```bash
python3 app.py
```

Open `http://localhost:5432`.

On a fresh database the application creates an initial administrator. If no password is supplied, it prints a random password to stdout. For a predictable first local start:

```bash
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='use-a-long-password' \
python3 app.py
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` are only used when the database contains no users.

## Roles and room permissions

### Admin

Administrators always see all rooms and can manage rooms, locations, plans, users and inventory.

### User

Normal users can browse and edit inventory in assigned rooms. A new User is assigned all rooms that already exist. Newly created rooms are also automatically granted to normal users, making this an **opt-out** model. An administrator can uncheck individual rooms for a user.

### Read-only

Read-only accounts can browse/search only the rooms explicitly assigned by an administrator. They cannot modify inventory or administration data. The backend enforces this permission on API writes as well as the UI.

A dedicated Read-only account is recommended for a wall tablet or guest kiosk.

See [`docs/USERS-AND-KIOSK.md`](docs/USERS-AND-KIOSK.md) for details.

Shelf and drag/drop behaviour is documented in [`docs/SHELVES-AND-ORDERING.md`](docs/SHELVES-AND-ORDERING.md).

## Room plan, locations and shelves

Administrators can open **Settings → Room planner** and switch the **Planning room** directly inside the planner. Position and size fields use 1 cm precision, and door/window geometry is anchored to its wall position so rotated fixtures stay where their coordinates indicate. Room geometry is independent from shelf configuration.

Each storage location now owns **real shelf records** rather than a visual shelf count. A location always has between **1 and 32 shelves**. Open **Settings → Locations → Edit** to:

- add or delete empty shelves;
- rename shelves inline;
- drag shelves into a new order;
- edit the location name/code/group/notes.

The shelf order is the canonical order used by the front view and by item shelf dropdowns. Existing V7 databases are migrated automatically: the old configured shelf count becomes real `Shelf 1 … Shelf N` records and numeric legacy item assignments are linked to the matching shelf.

### Locations overview

The **Locations** view is optimized for everyday use:

- tap a location once to expand a compact shelf preview directly in the same page;
- use **Open full view** for the detailed shelf/front view;
- administrators can drag the `⋮⋮` handle to reorder locations.

Location order is global within the room and immediately affects the left-hand list, the item location dropdown and the shelf-location dropdown. An explicit Open button is used instead of a long press because it is discoverable and behaves consistently with mouse, touch and accessibility input.

### Moving inventory

In the full shelf view, writable users can drag an item directly onto another shelf **inside the same storage location**. The move is persisted immediately. Clicking/tapping an item without dragging still opens the normal item editor. Read-only and kiosk accounts cannot move items.

When search is active, matching locations, shelves and items remain highlighted.

## Browser credential autofill

Some browser/password-manager heuristics can mistake an inventory search box for a username field after a refresh. The search field now:

- uses a unique field name for every page load;
- declares autocomplete/password-manager ignore hints;
- clears unsolicited late autofill values until the user actually interacts with the search field.

Browsers and extensions ultimately control autofill, so no web application can guarantee behaviour for every third-party password manager, but this prevents the common Chrome/Safari/manager cases without disabling real login autofill on the sign-in page.

## Kiosk mode

Kiosk settings are stored locally in the browser. Open **Settings → Kiosk**, enable kiosk mode and select a default room.

When enabled:

- the room plan is the default visualization;
- the browser is asked to enter fullscreen;
- the selected room opens by default;
- room switching and inventory search remain available;
- editing/admin controls are locked;
- common browser context-menu/zoom/navigation interactions are blocked on a best-effort basis;
- leaving fullscreen displays a gate for returning to fullscreen or explicitly exiting kiosk mode.

A website cannot completely lock an operating system. For a wall tablet combine this with Android screen pinning/dedicated-device mode, iPad Guided Access, Chromium `--kiosk`, or another OS-level kiosk feature.

Use a **Read-only** account for kiosk devices so leaving the visual kiosk mode still does not grant write access.

## Configuration

- `HOST` — bind address, default `0.0.0.0`
- `PORT` — HTTP port, default `5432`
- `STORAGE_ROOM_DB` — SQLite path, default `data/storage-room.db`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — bootstrap credentials for an empty DB only
- `SESSION_TTL` — session lifetime in seconds, default 14 days
- `COOKIE_SECURE=1` — set when the public endpoint is HTTPS-only

## Temporary Cloudflare hosting from a Mac

For the current Podman + Cloudflare setup, put the named tunnel token in `.env` and run:

```bash
scripts/mac-stack-up.sh
```

This starts the app and `cloudflared` Compose services and uses macOS `caffeinate` so the **display may turn off while the Mac itself remains awake**. Check or stop the stack with:

```bash
scripts/mac-stack-status.sh
scripts/mac-stack-down.sh
```

A closed MacBook lid can still force sleep depending on the clamshell setup. For a one-off Quick Tunnel you can continue to use `cloudflared tunnel --url http://127.0.0.1:5432`. See [`docs/HOSTING.md`](docs/HOSTING.md) for details and the long-term Proxmox layout.

## Container deployment

```bash
cp .env.example .env
# edit .env before the first start
# use COOKIE_SECURE=1 behind HTTPS/Cloudflare; use 0 for plain local HTTP
docker compose up -d --build
# or
podman compose up -d --build
```

To run the optional Cloudflare Tunnel container too:

```bash
docker compose --profile tunnel up -d --build
# or
podman compose --profile tunnel up -d --build
```

The app listens on port 5432 and stores the database in `/data/storage-room.db` inside the container. `compose.yaml` bind-mounts the repository's `./data` directory to `/data`, so your existing `data/storage-room.db` is used directly and remains easy to back up.

## Database upgrades

Previous databases are migrated automatically on startup. **Back up `data/storage-room.db` before every upgrade.**

V8 adds normalized `shelves` records and an `items.shelf_id` link. During the first V8 start:

- each existing location receives 1–32 real shelves based on its previous V7 shelf configuration;
- existing values such as `Shelf 2`, `Level 2`, `Fach 2` or `2` are linked to the corresponding shelf where possible;
- custom legacy shelf text that cannot be mapped remains unassigned rather than being discarded.

Existing rooms, users, permissions, items and room-plan geometry are retained.

## Authentication and security

- Passwords: salted PBKDF2-SHA256 hashes
- Sessions: random opaque tokens, only SHA-256 hashes stored in SQLite
- Cookies: `HttpOnly`, `SameSite=Strict`, optionally `Secure`
- Mutating requests: per-session CSRF token required
- Read-only permissions: enforced server-side
- Room permissions: enforced on inventory/read APIs server-side
- Role/status/password changes invalidate affected sessions where appropriate
- The application prevents removal/demotion of the final active administrator

For Internet-facing use, run behind HTTPS (for example Cloudflare Tunnel) and set `COOKIE_SECURE=1`.

## Tests

Run the dependency-free API smoke suite and the planner geometry regression test:

```bash
python3 tests/smoke.py
node tests/planner-geometry.js
```

The suites cover authentication/permissions, room isolation, normalized shelves and ordering, plus the 1 cm planner snap and wall-anchored door geometry.

## Project layout

```text
app.py
Containerfile
compose.yaml
.env.example
static/
  app.css
  app.js
  login.js
templates/
  app.html
  login.html
data/
deploy/
docs/
tests/
```

## Suggested long-term home-server layout

A small Proxmox host is a good fit. Keep Home Assistant isolated in its own VM and run Storage Room App plus other lightweight services in a separate Debian VM/LXC/container environment:

```text
Proxmox
├── Home Assistant OS VM
└── Debian LXC / VM
    ├── storage-room-app
    ├── cloudflared
    └── other small services
```

This keeps the inventory app lightweight while making backups, upgrades and future services much easier to manage.
