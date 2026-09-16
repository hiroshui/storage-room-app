# Changelog

## 10.0.0

- Add a dedicated **Planning room** switcher inside the Room Planner so admins can move between rooms without leaving the planner tab.
- Change planner position and size precision from 5 cm to **1 cm** (`0.01 m`) and add a subtle 10 cm / 50 cm SVG grid.
- Refactor door and window geometry to use a wall anchor point instead of rotating a bounding box around its centre; a vertical door at `X=0` now stays on the left wall.
- Automatically choose the door swing direction that remains inside the room where possible.
- Normalize rotated door/window movement against room bounds and improve their pointer hit areas.
- Add macOS Podman helper scripts that start the app + Cloudflare Tunnel stack and keep the Mac awake with `caffeinate` while allowing the display to turn off.
- Restore and retain the complete CRUD/UI handler block while keeping V9 profile-avatar support, including avatar-aware user creation/editing.

## 9.0.0

- Add a current-user identity chip to the header with `Logged in:` username and profile icon.
- Add three built-in profile icons: **Man**, **Woman** and **Robot** with no external assets.
- Add self-service profile editing for display name and icon under **Settings → Account**.
- Let administrators choose/change profile icons while creating or editing users.
- Persist profile icons in SQLite and migrate existing users to the Robot default.
- Refactor pointer sorting so wrapped location grids can reliably drop after the final card; one-column shelf lists continue to sort by vertical midpoint.
- Add profile persistence coverage to the dependency-free smoke test.

## 8.0.0

- Replace visual shelf counts with normalized shelf records linked to each storage location.
- Support 1–32 shelves per location with inline add, rename, delete and drag-and-drop reorder controls.
- Automatically migrate V7 shelf counts and legacy item shelf labels to real shelf IDs.
- Add drag-and-drop item moves between shelves in the same storage location.
- Add drag-and-drop location ordering; the saved order drives all location dropdowns and lists.
- Add one-tap inline shelf previews in the Locations overview plus an explicit full-view action.
- Replace native browser `prompt()` / `confirm()` flows with application dialogs and inline editors.
- Remove shelf-count editing from the room planner so physical layout and inventory structure are cleanly separated.
- Keep the Compose deployment on port `5432` and bind-mount `./data:/data` so an existing local SQLite database is used directly.

## 7.0.0

- Change the default application/origin port from `8080` to `5432` across local, systemd, container and Cloudflare examples.
- Add a dedicated **Shelves** visualization mode with an always-visible front view and location selector.
- Add direct **Shelves** actions from location lists and location management.
- Add shelf count to location creation and a proper location edit dialog; shelf count no longer requires opening the room planner.
- Replace the previous ambiguous user list with user cards that show role, account state and assigned rooms.
- Add visible room-access checkboxes plus **Select all** / **Clear** actions when creating or editing users.
- Require explicit room assignment for Read-only users when rooms exist.
- Fix the missing user-edit form submit binding, which prevented role/access changes from being saved through the UI.
- Fix admin Settings tab visibility so inactive admin panes are not accidentally unhidden at startup.

## 6.0.0

- Add `Read-only` role for browse/search-only accounts.
- Add per-user room access managed by administrators.
- Normal Users follow an opt-out model: all current rooms are selected by default and new rooms are automatically granted.
- Read-only users follow explicit room assignment and are intended for kiosk/guest devices.
- Add role, account status, password and room-access editing for administrators.
- Enforce room access and read-only restrictions server-side.
- Improve search-field handling to avoid browser/password-manager username autofill after refresh.
- Add lightweight 2D shelf/front view when a storage location is selected from the floor plan or location visualization.
- Add configurable shelf count per location in the room planner.
- Highlight the matching shelf and item when inventory search is active.
- Add shelf suggestions to the item editor.
- Improve Settings behaviour for non-admin users.
- Add container deployment files and Proxmox/Cloudflare hosting documentation.
- Add dependency-free API smoke tests.

## 5.x

- Interactive SVG floor plan and room planner.
- Search-aware location highlighting.
- Multiple rooms, local authentication and kiosk mode.
