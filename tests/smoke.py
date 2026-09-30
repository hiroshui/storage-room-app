#!/usr/bin/env python3
"""Dependency-free API smoke test for Storage Room App.

Starts an isolated server and verifies authentication, room permissions, read-only
behaviour, role changes, normalized shelves, ordering and item assignments.
"""
from __future__ import annotations

import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Client:
    def __init__(self, base: str):
        self.base = base
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = ""

    def request(self, method: str, path: str, payload=None, expected=200):
        body = None if payload is None else json.dumps(payload).encode()
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if self.csrf:
            headers["X-CSRF-Token"] = self.csrf
        req = urllib.request.Request(self.base + path, data=body, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=4) as response:
                status = response.status
                raw = response.read()
        except urllib.error.HTTPError as error:
            status = error.code
            raw = error.read()
        if status != expected:
            raise AssertionError(f"{method} {path}: expected {expected}, got {status}: {raw.decode(errors='replace')}")
        return json.loads(raw or b"{}")

    def login(self, username: str, password: str):
        self.request("POST", "/api/login", {"username": username, "password": password})
        me = self.request("GET", "/api/me")
        self.csrf = me["csrf"]
        return me


def main() -> int:
    port = free_port()
    with tempfile.TemporaryDirectory(prefix="storage-room-test-") as temp:
        env = os.environ.copy()
        env.update({
            "HOST": "127.0.0.1",
            "PORT": str(port),
            "STORAGE_ROOM_DB": str(Path(temp) / "test.db"),
            "ADMIN_USERNAME": "admin",
            "ADMIN_PASSWORD": "admin-test-password",
        })
        process = subprocess.Popen(
            [sys.executable, str(ROOT / "app.py")],
            cwd=ROOT,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        base = f"http://127.0.0.1:{port}"
        try:
            deadline = time.time() + 8
            while time.time() < deadline:
                try:
                    urllib.request.urlopen(base + "/api/health", timeout=.5).read()
                    break
                except Exception:
                    time.sleep(.1)
            else:
                raise RuntimeError("server did not start")

            admin = Client(base)
            admin_me = admin.login("admin", "admin-test-password")
            assert admin_me["role"] == "admin" and admin_me["avatar"] == "robot"
            ai_status = admin.request("GET", "/api/ai/status")
            assert ai_status["provider"] == "OpenAI" and ai_status["configured"] is False
            profile = admin.request("PUT", "/api/me", {"display_name": "Storage Admin", "avatar": "woman"})
            assert profile["avatar"] == "woman" and profile["display_name"] == "Storage Admin"
            assert admin.request("GET", "/api/me")["avatar"] == "woman"

            initial_rooms = admin.request("GET", "/api/rooms")
            assert len(initial_rooms) == 1
            room1 = initial_rooms[0]["id"]
            room2 = admin.request("POST", "/api/rooms", {"name": "Garage", "description": "Tools"}, 201)["id"]

            editor = admin.request("POST", "/api/users", {
                "username": "editor",
                "display_name": "Editor",
                "password": "editor-password",
                "role": "user",
            }, 201)
            assert set(editor["room_ids"]) == {room1, room2}, "normal users must default to all existing rooms"

            admin.request("POST", "/api/users", {
                "username": "viewer-without-room",
                "display_name": "Invalid viewer",
                "password": "viewer-password",
                "role": "readonly",
                "room_ids": [],
            }, 400)

            viewer = admin.request("POST", "/api/users", {
                "username": "viewer",
                "display_name": "Kiosk Viewer",
                "password": "viewer-password",
                "avatar": "man",
                "role": "readonly",
                "room_ids": [room1],
            }, 201)
            assert viewer["room_ids"] == [room1] and viewer["avatar"] == "man"

            loc = admin.request("POST", "/api/locations", {
                "room_id": room1,
                "code": "A1",
                "name": "Main shelf",
                "side": "Left",
                "shelf_count": 4,
            }, 201)
            assert loc["shelf_count"] == 4
            shelves = admin.request("GET", f"/api/shelves?location_id={loc['id']}")
            assert [s["name"] for s in shelves] == ["Shelf 1", "Shelf 2", "Shelf 3", "Shelf 4"]
            saved_layout = admin.request("PUT", f"/api/layout/{room1}", {
                "width": 4.0,
                "height": 3.0,
                "layout": {
                    "ceiling_height": 2.5,
                    "locations": {str(loc["id"]): {
                        "x": 0.2, "y": 0.2, "w": 0.8, "h": 0.4,
                        "rotation": 0, "height": 2.1, "shelves": 4,
                    }},
                    "fixtures": [],
                },
            })
            assert saved_layout["layout"]["locations"][str(loc["id"])]["shelves"] == 4
            drill = admin.request("POST", "/api/items", {
                "name": "Drill",
                "category": "Tools",
                "location_id": loc["id"],
                "shelf_id": shelves[1]["id"],
                "quantity": "1",
            }, 201)
            assert drill["shelf_name"] == "Shelf 2"

            # Shelves are real records: rename, reorder, add and delete work independently.
            renamed = admin.request("PUT", f"/api/shelves/{shelves[1]['id']}", {"name": "Power tools"})
            assert renamed["name"] == "Power tools"
            shelf_ids = [s["id"] for s in shelves]
            admin.request("POST", "/api/shelves/reorder", {
                "location_id": loc["id"],
                "shelf_ids": list(reversed(shelf_ids)),
            })
            reordered = admin.request("GET", f"/api/shelves?location_id={loc['id']}")
            assert [s["id"] for s in reordered] == list(reversed(shelf_ids))
            extra = admin.request("POST", "/api/shelves", {"location_id": loc["id"], "name": "Overflow"}, 201)
            admin.request("DELETE", f"/api/shelves/{extra['id']}")
            admin.request("DELETE", f"/api/shelves/{shelves[1]['id']}", expected=409)

            items_after_shelf_edit = admin.request("GET", f"/api/items?room_id={room1}")
            drill_after = next(item for item in items_after_shelf_edit if item["name"] == "Drill")
            assert drill_after["shelf_name"] == "Power tools"

            loc2 = admin.request("POST", "/api/locations", {
                "room_id": room1, "code": "A2", "name": "Second rack", "shelf_count": 2, "sort_order": 1,
            }, 201)
            admin.request("POST", "/api/locations/reorder", {
                "room_id": room1, "location_ids": [loc2["id"], loc["id"]],
            })
            ordered_locations = admin.request("GET", f"/api/locations?room_id={room1}")
            assert [entry["id"] for entry in ordered_locations] == [loc2["id"], loc["id"]]

            viewer_client = Client(base)
            me = viewer_client.login("viewer", "viewer-password")
            assert me["role"] == "readonly" and not me["can_write"]
            assert [r["id"] for r in viewer_client.request("GET", "/api/rooms")] == [room1]
            viewer_client.request("GET", f"/api/items?room_id={room1}")
            viewer_client.request("GET", f"/api/items?room_id={room2}", expected=404)
            viewer_client.request("POST", "/api/items", {
                "name": "Forbidden",
                "location_id": loc["id"],
            }, expected=403)

            editor_client = Client(base)
            assert editor_client.login("editor", "editor-password")["can_write"]
            assert set(r["id"] for r in editor_client.request("GET", "/api/rooms")) == {room1, room2}

            # Admin can opt a normal user out of individual existing rooms.
            users = admin.request("GET", "/api/users")
            editor_row = next(user for user in users if user["username"] == "editor")
            admin.request("PUT", f"/api/users/{editor_row['id']}", {
                "display_name": "Editor",
                "role": "user",
                "active": True,
                "room_ids": [room1],
            })
            assert [r["id"] for r in editor_client.request("GET", "/api/rooms")] == [room1]

            # New rooms are auto-granted to normal editors (opt-out model), but
            # not to explicit read-only viewers. Existing opt-outs stay intact.
            room3 = admin.request("POST", "/api/rooms", {"name": "Attic"}, 201)["id"]
            assert set(r["id"] for r in editor_client.request("GET", "/api/rooms")) == {room1, room3}
            assert room2 not in {r["id"] for r in editor_client.request("GET", "/api/rooms")}
            assert room3 not in {r["id"] for r in viewer_client.request("GET", "/api/rooms")}

            # Admin can also change roles and replace the room selection.
            admin.request("PUT", f"/api/users/{editor_row['id']}", {
                "display_name": "Editor",
                "role": "readonly",
                "active": True,
                "room_ids": [room2],
            })
            editor_after = Client(base)
            me = editor_after.login("editor", "editor-password")
            assert me["role"] == "readonly" and not me["can_write"]
            assert [r["id"] for r in editor_after.request("GET", "/api/rooms")] == [room2]

            print("storage-room-app smoke tests: OK")
            return 0
        finally:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
