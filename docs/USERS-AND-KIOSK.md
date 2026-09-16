# Users, room access and kiosk accounts

Storage Room App has three roles:

| Role | Room access | Inventory changes | Administration |
| --- | --- | --- | --- |
| Admin | Every room | Yes | Yes |
| User | Assigned rooms | Yes | No |
| Read-only | Assigned rooms | No | No |

## Normal users: opt-out room access

A newly created **User** starts with all rooms that exist at that moment selected. When an admin creates another room later, it is automatically granted to all normal users as well. The admin can opt a user out by opening **Settings → Users → Edit** and unchecking individual rooms.

This means a normal household/editor account follows an "all rooms unless excluded" model.

## Read-only users: explicit room access

A newly created **Read-only** account uses explicit room assignment. In **Settings → Users**, choose Read-only and then select every room the account may browse. If at least one room exists, the app requires at least one room to be selected before the account can be created or saved.

Read-only users can:

- switch between assigned rooms;
- search inventory;
- use the room plan and shelf view;
- filter inventory;
- use kiosk mode.

They cannot add, edit or delete items and cannot alter rooms, locations, users or room plans. API write requests are rejected server-side as well; the restriction is not only a hidden button in the browser.

This makes a read-only account the recommended account for a wall tablet or guest-access kiosk.

## Changing roles

Admins can change another account between **User**, **Read-only** and **Admin** in **Settings → Users → Edit user**. They can also enable/disable accounts, change room assignments and optionally set a new password. Each user card shows the rooms currently assigned, so missing access is visible without opening the edit dialog.

Safety rules:

- an admin cannot demote or disable their own currently active admin account;
- the application always keeps at least one active administrator;
- security-sensitive changes invalidate the target user's existing sessions.

When changing a Read-only/Admin account to a normal User in the UI, all current rooms are selected by default. The admin can then opt out individual rooms before saving.

## Kiosk recommendation

Create a dedicated account, for example `wall-tablet`, with role **Read-only** and grant only the rooms that should be visible on that device. Log the tablet in once, then enable **Settings → Kiosk** and choose the default room.

Kiosk mode is stored locally in that browser. It does not change the account permissions. Even after leaving kiosk mode, a read-only account still cannot modify inventory.

## Managing room access in the UI

Open **Settings → Users**. For both new and existing accounts the room-access block contains one checkbox per room plus **Select all** and **Clear** actions.

- **User:** all current rooms are preselected. Uncheck rooms to opt out. New rooms created later are granted automatically.
- **Read-only:** explicitly select the rooms that may be viewed.
- **Admin:** room selection is not needed because admins always see every room.

Click **Edit user** on an existing account to change its role, room selection, active state, display name or password.

## Profile identity

The currently signed-in username is shown in the application header. Each account also has one lightweight built-in profile icon: **Man**, **Woman** or **Robot**. The icons are rendered inline and do not depend on an external image service.

Users can change their own display name and icon under **Settings → Account**. Administrators can also choose or change an account icon while creating or editing users in **Settings → Users**.
