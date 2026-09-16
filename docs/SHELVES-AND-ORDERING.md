# Shelves, ordering and drag & drop

Storage Room App V8 uses normalized shelf records. Every storage location has between **1 and 32 shelves**. Shelf names and order are persistent data; they are no longer inferred from a visual count.

## Manage shelves

As an administrator, open **Settings → Locations → Edit** for a storage location. The shelf manager allows you to:

- add shelves up to the limit of 32;
- rename a shelf directly in its input field;
- drag the `⋮⋮` handle to reorder shelves;
- delete an empty shelf;
- see how many items are assigned to each shelf.

At least one shelf must remain. A shelf containing items cannot be deleted. Move the items to another shelf first.

The saved shelf order is used everywhere: the shelf front view and item shelf dropdowns use the same order.

## Reorder storage locations

Open the **Locations** visual mode. Administrators see a `⋮⋮` handle on every storage-location card. Drag cards into the desired order. The new order is persisted for the room and is reused by:

- the Locations overview;
- the left navigation;
- item location dropdowns;
- the Shelves location dropdown;
- other views that iterate the room's locations.

## Quick preview and full shelf view

A normal click/tap on a location card expands a compact shelf preview in the same page. Use **Open full view** for the detailed front view.

This explicit button is intentional: long-press interactions are harder to discover and behave inconsistently across touch devices, browsers and accessibility tools.

## Move items between shelves

Writable users can drag an item card from one shelf onto another shelf in the **same storage location**. The target shelf is highlighted while dragging and the move is persisted immediately.

Moving an item between different storage locations still uses the normal item editor, because changing the location is a more significant operation. Read-only users and kiosk mode cannot move items.

## Upgrade from V7

On first V8 startup, the database migration creates normalized shelves for existing locations and links recognizable legacy values such as `Shelf 2`, `Level 2`, `Fach 2` or `2` to the corresponding shelf. Custom legacy shelf text that cannot be mapped remains unassigned rather than being discarded.

Back up `data/storage-room.db` before starting the new version.
