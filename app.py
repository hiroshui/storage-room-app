#!/usr/bin/env python3
import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
import unicodedata
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BASE = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv('STORAGE_ROOM_DB', BASE / 'data' / 'storage-room.db'))
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '5432'))
SESSION_TTL = int(os.getenv('SESSION_TTL', str(60 * 60 * 24 * 14)))
COOKIE_SECURE = os.getenv('COOKIE_SECURE', '0').lower() in ('1', 'true', 'yes')
PBKDF2_ITERATIONS = 310_000
VALID_AVATARS = {'man', 'woman', 'robot'}

SCHEMA = '''
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL DEFAULT '',
 avatar TEXT NOT NULL DEFAULT 'robot',
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
 read_only INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 csrf_token TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rooms (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 slug TEXT NOT NULL UNIQUE,
 description TEXT NOT NULL DEFAULT '',
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_room_access (
 user_id INTEGER NOT NULL,
 room_id INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(user_id, room_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS locations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 room_id INTEGER NOT NULL,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 side TEXT NOT NULL DEFAULT '',
 sort_order INTEGER NOT NULL DEFAULT 0,
 notes TEXT NOT NULL DEFAULT '',
 FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
 UNIQUE(room_id, code)
);
CREATE TABLE IF NOT EXISTS shelves (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 location_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT '',
 location_id INTEGER NOT NULL,
 shelf_id INTEGER,
 shelf TEXT NOT NULL DEFAULT '',
 quantity TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL,
 FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE RESTRICT,
 FOREIGN KEY(shelf_id) REFERENCES shelves(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS room_layouts (
 room_id INTEGER PRIMARY KEY,
 width REAL NOT NULL DEFAULT 4.0,
 height REAL NOT NULL DEFAULT 3.0,
 layout_json TEXT NOT NULL DEFAULT '{"locations":{},"fixtures":[]}',
 updated_at TEXT NOT NULL,
 FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_locations_room ON locations(room_id);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(location_id);
CREATE INDEX IF NOT EXISTS idx_shelves_location ON shelves(location_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_room_access_room ON user_room_access(room_id);
'''


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def rowdict(row):
    return dict(row) if row else None


def slugify(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-') or 'storage'


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ITERATIONS)
    return f'pbkdf2_sha256${PBKDF2_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}'


def verify_password(password, encoded):
    try:
        algo, iterations, salt, digest = encoded.split('$')
        if algo != 'pbkdf2_sha256':
            return False
        test = hashlib.pbkdf2_hmac('sha256', password.encode(), base64.b64decode(salt), int(iterations))
        return hmac.compare_digest(test, base64.b64decode(digest))
    except Exception:
        return False


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def effective_role(row):
    if not row:
        return None
    if row['role'] == 'admin':
        return 'admin'
    return 'readonly' if int(row['read_only']) else 'user'


def db_role(role):
    if role == 'admin':
        return 'admin', 0
    return 'user', 1 if role == 'readonly' else 0


def valid_role(role):
    return role in ('admin', 'user', 'readonly')


def normalize_avatar(value, default='robot'):
    avatar = str(value or '').strip().lower()
    return avatar if avatar in VALID_AVATARS else default


def public_user(row):
    data = rowdict(row)
    data['role'] = effective_role(row)
    data.pop('read_only', None)
    data.pop('password_hash', None)
    return data


def room_ids_for_user(conn, user_id):
    return [row['room_id'] for row in conn.execute(
        'SELECT room_id FROM user_room_access WHERE user_id=? ORDER BY room_id',
        (user_id,),
    ).fetchall()]


def normalize_room_ids(conn, room_ids):
    valid = {row['id'] for row in conn.execute('SELECT id FROM rooms').fetchall()}
    result = set()
    for room_id in room_ids or []:
        try:
            parsed = int(room_id)
        except (TypeError, ValueError):
            continue
        if parsed in valid:
            result.add(parsed)
    return sorted(result)


def set_room_access(conn, user_id, room_ids):
    room_ids = normalize_room_ids(conn, room_ids)
    conn.execute('DELETE FROM user_room_access WHERE user_id=?', (user_id,))
    for room_id in room_ids:
        conn.execute(
            'INSERT INTO user_room_access(user_id,room_id,created_at) VALUES(?,?,?)',
            (user_id, room_id, now()),
        )


def all_room_ids(conn):
    return [row['id'] for row in conn.execute('SELECT id FROM rooms ORDER BY id').fetchall()]


def shelf_rows(conn, location_id):
    return conn.execute(
        'SELECT * FROM shelves WHERE location_id=? ORDER BY sort_order,id',
        (int(location_id),),
    ).fetchall()


def parse_legacy_shelf_number(value):
    text = str(value or '').strip()
    if not text:
        return None
    match = re.search(r'(?:shelf|level|fach|ebene)?\s*#?\s*(\d+)', text, re.I)
    if not match:
        return None
    value = int(match.group(1))
    return value if 1 <= value <= 32 else None


def resolve_shelf(conn, location_id, shelf_id=None, shelf_text=''):
    if shelf_id not in (None, '', 0, '0'):
        try:
            shelf_id = int(shelf_id)
        except (TypeError, ValueError):
            return None, None
        row = conn.execute(
            'SELECT * FROM shelves WHERE id=? AND location_id=?',
            (shelf_id, int(location_id)),
        ).fetchone()
        return (row['id'], row['name']) if row else (None, None)

    text = str(shelf_text or '').strip()
    if not text:
        return None, ''
    row = conn.execute(
        'SELECT * FROM shelves WHERE location_id=? AND lower(name)=lower(?) ORDER BY sort_order,id LIMIT 1',
        (int(location_id), text),
    ).fetchone()
    if row:
        return row['id'], row['name']
    number = parse_legacy_shelf_number(text)
    if number:
        rows = shelf_rows(conn, location_id)
        if number <= len(rows):
            row = rows[number - 1]
            return row['id'], row['name']
    return None, text


def migrate_shelves(conn):
    item_columns = {row['name'] for row in conn.execute('PRAGMA table_info(items)')}
    if 'shelf_id' not in item_columns:
        conn.execute('ALTER TABLE items ADD COLUMN shelf_id INTEGER REFERENCES shelves(id) ON DELETE SET NULL')

    layout_counts = {}
    for row in conn.execute('SELECT room_id,layout_json FROM room_layouts').fetchall():
        try:
            payload = json.loads(row['layout_json'] or '{}')
            locations = payload.get('locations', {}) if isinstance(payload, dict) else {}
            for location_id, obj in locations.items():
                try:
                    count = int(round(float((obj or {}).get('shelves', 0))))
                    if count:
                        layout_counts[int(location_id)] = max(1, min(count, 32))
                except (TypeError, ValueError):
                    pass
        except Exception:
            pass

    for location in conn.execute('SELECT id FROM locations ORDER BY id').fetchall():
        location_id = location['id']
        existing = conn.execute('SELECT COUNT(*) FROM shelves WHERE location_id=?', (location_id,)).fetchone()[0]
        if existing:
            continue
        max_legacy = 0
        for item in conn.execute('SELECT shelf FROM items WHERE location_id=?', (location_id,)).fetchall():
            number = parse_legacy_shelf_number(item['shelf'])
            if number:
                max_legacy = max(max_legacy, number)
        configured = layout_counts.get(location_id)
        count = max(configured, max_legacy) if configured else max(max_legacy, 5)
        count = max(1, min(count, 32))
        for index in range(count):
            conn.execute(
                'INSERT INTO shelves(location_id,name,sort_order,created_at) VALUES(?,?,?,?)',
                (location_id, f'Shelf {index + 1}', index, now()),
            )

    for item in conn.execute('SELECT id,location_id,shelf_id,shelf FROM items ORDER BY id').fetchall():
        if item['shelf_id']:
            continue
        shelf_id, shelf_name = resolve_shelf(conn, item['location_id'], None, item['shelf'])
        if shelf_id:
            conn.execute('UPDATE items SET shelf_id=?,shelf=? WHERE id=?', (shelf_id, shelf_name, item['id']))


def init_db():
    with connect() as conn:
        tables = {row['name'] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        access_table_was_missing = 'user_room_access' not in tables

        # V2 -> V3: locations/items existed before rooms were introduced.
        if 'locations' in tables:
            columns = {row['name'] for row in conn.execute('PRAGMA table_info(locations)')}
            if 'room_id' not in columns:
                conn.execute('ALTER TABLE locations RENAME TO legacy_locations')
                if 'items' in tables:
                    conn.execute('ALTER TABLE items RENAME TO legacy_items')

        conn.executescript(SCHEMA)

        # V5 -> V6: keep the historical DB-level role constraint while adding a
        # separate read_only flag. The public API exposes admin/user/readonly.
        user_columns = {row['name'] for row in conn.execute('PRAGMA table_info(users)')}
        if 'read_only' not in user_columns:
            conn.execute('ALTER TABLE users ADD COLUMN read_only INTEGER NOT NULL DEFAULT 0')
        if 'avatar' not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT 'robot'")

        legacy = {row['name'] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'legacy_locations' in legacy:
            cursor = conn.execute(
                'INSERT INTO rooms(name,slug,description,sort_order,created_at) VALUES(?,?,?,?,?)',
                ('Storage room', 'storage-room', 'Migrated from version 2', 0, now()),
            )
            room_id = cursor.lastrowid
            conn.execute(
                '''INSERT INTO locations(id,room_id,code,name,side,sort_order,notes)
                   SELECT id,?,code,name,side,sort_order,notes FROM legacy_locations''',
                (room_id,),
            )
            if 'legacy_items' in legacy:
                conn.execute(
                    '''INSERT INTO items(id,name,category,location_id,shelf,quantity,notes,updated_at)
                       SELECT id,name,category,location_id,shelf,quantity,notes,updated_at FROM legacy_items'''
                )
                conn.execute('DROP TABLE legacy_items')
            conn.execute('DROP TABLE legacy_locations')

        if conn.execute('SELECT COUNT(*) FROM rooms').fetchone()[0] == 0:
            conn.execute(
                'INSERT INTO rooms(name,slug,description,sort_order,created_at) VALUES(?,?,?,?,?)',
                ('Storage room', 'storage-room', '', 0, now()),
            )

        migrate_shelves(conn)

        if conn.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0:
            username = os.getenv('ADMIN_USERNAME', 'admin').strip() or 'admin'
            password = os.getenv('ADMIN_PASSWORD') or secrets.token_urlsafe(12)
            conn.execute(
                '''INSERT INTO users(username,display_name,avatar,password_hash,role,read_only,active,created_at)
                   VALUES(?,?,?,?,?,0,1,?)''',
                (username, 'Administrator', 'robot', hash_password(password), 'admin', now()),
            )
            print('\n' + '=' * 62)
            print('Initial admin created')
            print(f'Username: {username}')
            print(f'Password: {password}')
            print('Change this password after first login.')
            print('=' * 62 + '\n')

        # First V6 upgrade: preserve old behaviour by granting every existing
        # non-admin account all rooms. Afterwards the admin controls membership.
        if access_table_was_missing:
            rooms = all_room_ids(conn)
            for user in conn.execute("SELECT id FROM users WHERE role='user'").fetchall():
                set_room_access(conn, user['id'], rooms)

        conn.execute('DELETE FROM sessions WHERE expires_at < ?', (int(time.time()),))


class Handler(BaseHTTPRequestHandler):
    server_version = 'StorageRoomApp/9.0'

    def log_message(self, fmt, *args):
        print(f'{self.address_string()} - {fmt % args}')

    def security_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
        )

    def send_json(self, obj, status=200):
        payload = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.security_headers()
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def redirect(self, path):
        self.send_response(303)
        self.send_header('Location', path)
        self.security_headers()
        self.end_headers()

    def serve_file(self, path, content_type=None):
        if not path.exists() or not path.is_file():
            return self.send_error(404)
        data = path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type or mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
        self.security_headers()
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            return json.loads(self.rfile.read(size) or b'{}')
        except Exception:
            return None

    def session(self):
        cookie = SimpleCookie(self.headers.get('Cookie', ''))
        morsel = cookie.get('storage_session')
        if not morsel:
            return None
        with connect() as conn:
            row = conn.execute(
                '''SELECT s.*,u.username,u.display_name,u.avatar,u.role,u.read_only,u.active
                   FROM sessions s JOIN users u ON u.id=s.user_id
                   WHERE s.token_hash=? AND s.expires_at>?''',
                (token_hash(morsel.value), int(time.time())),
            ).fetchone()
        if not row or not row['active']:
            return None
        data = rowdict(row)
        data['role'] = effective_role(row)
        return data

    def require(self, admin=False, csrf=False):
        session = self.session()
        if not session:
            self.send_json({'error': 'Authentication required'}, 401)
            return None
        if admin and session['role'] != 'admin':
            self.send_json({'error': 'Administrator rights required'}, 403)
            return None
        if csrf and not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), session['csrf_token']):
            self.send_json({'error': 'Invalid CSRF token'}, 403)
            return None
        return session

    def require_write(self):
        session = self.require(csrf=True)
        if not session:
            return None
        if session['role'] == 'readonly':
            self.send_json({'error': 'This account has read-only access'}, 403)
            return None
        return session

    def can_access_room(self, session, room_id, conn=None):
        if session['role'] == 'admin':
            return True
        own_conn = conn is None
        conn = conn or connect()
        try:
            return conn.execute(
                'SELECT 1 FROM user_room_access WHERE user_id=? AND room_id=?',
                (session['user_id'], int(room_id)),
            ).fetchone() is not None
        finally:
            if own_conn:
                conn.close()

    def require_room(self, session, room_id, conn=None):
        try:
            room_id = int(room_id)
        except (TypeError, ValueError):
            self.send_json({'error': 'Invalid room_id'}, 400)
            return None
        if not self.can_access_room(session, room_id, conn):
            self.send_json({'error': 'Room not found or access denied'}, 404)
            return None
        return room_id

    def location_room(self, conn, location_id):
        row = conn.execute('SELECT room_id FROM locations WHERE id=?', (location_id,)).fetchone()
        return row['room_id'] if row else None

    def shelf_location(self, conn, shelf_id):
        row = conn.execute('SELECT location_id FROM shelves WHERE id=?', (shelf_id,)).fetchone()
        return row['location_id'] if row else None

    def item_room(self, conn, item_id):
        row = conn.execute(
            'SELECT l.room_id FROM items i JOIN locations l ON l.id=i.location_id WHERE i.id=?',
            (item_id,),
        ).fetchone()
        return row['room_id'] if row else None

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/login':
            return self.serve_file(BASE / 'templates' / 'login.html', 'text/html; charset=utf-8')
        if url.path == '/':
            if not self.session():
                return self.redirect('/login')
            return self.serve_file(BASE / 'templates' / 'app.html', 'text/html; charset=utf-8')
        if url.path.startswith('/static/'):
            path = (BASE / url.path.lstrip('/')).resolve()
            if BASE.resolve() not in path.parents:
                return self.send_error(403)
            return self.serve_file(path)
        if url.path == '/api/health':
            return self.send_json({'ok': True, 'time': now()})

        if url.path == '/api/me':
            session = self.require()
            if not session:
                return
            return self.send_json({
                'id': session['user_id'],
                'username': session['username'],
                'display_name': session['display_name'],
                'avatar': normalize_avatar(session['avatar']),
                'role': session['role'],
                'can_write': session['role'] != 'readonly',
                'csrf': session['csrf_token'],
            })

        if url.path == '/api/rooms':
            session = self.require()
            if not session:
                return
            with connect() as conn:
                if session['role'] == 'admin':
                    rows = conn.execute('SELECT * FROM rooms ORDER BY sort_order,lower(name)').fetchall()
                else:
                    rows = conn.execute(
                        '''SELECT r.* FROM rooms r
                           JOIN user_room_access a ON a.room_id=r.id
                           WHERE a.user_id=? ORDER BY r.sort_order,lower(r.name)''',
                        (session['user_id'],),
                    ).fetchall()
            return self.send_json([rowdict(row) for row in rows])

        if url.path == '/api/locations':
            session = self.require()
            if not session:
                return
            room_id = parse_qs(url.query).get('room_id', [''])[0]
            if not room_id:
                return self.send_json({'error': 'room_id required'}, 400)
            room_id = self.require_room(session, room_id)
            if room_id is None:
                return
            with connect() as conn:
                rows = conn.execute(
                    '''SELECT l.*,COUNT(s.id) AS shelf_count
                       FROM locations l LEFT JOIN shelves s ON s.location_id=l.id
                       WHERE l.room_id=? GROUP BY l.id
                       ORDER BY l.sort_order,l.id''',
                    (room_id,),
                ).fetchall()
            return self.send_json([rowdict(row) for row in rows])

        if url.path == '/api/shelves':
            session = self.require()
            if not session:
                return
            query = parse_qs(url.query)
            room_id = query.get('room_id', [''])[0]
            location_id = query.get('location_id', [''])[0]
            with connect() as conn:
                if location_id:
                    try:
                        location_id = int(location_id)
                    except (TypeError, ValueError):
                        return self.send_json({'error': 'Invalid location_id'}, 400)
                    resolved_room_id = self.location_room(conn, location_id)
                    if resolved_room_id is None or not self.can_access_room(session, resolved_room_id, conn):
                        return self.send_json({'error': 'Location not found or access denied'}, 404)
                    rows = conn.execute(
                        '''SELECT s.*,l.code location_code,l.name location_name,l.room_id
                           FROM shelves s JOIN locations l ON l.id=s.location_id
                           WHERE s.location_id=? ORDER BY s.sort_order,s.id''',
                        (location_id,),
                    ).fetchall()
                elif room_id:
                    room_id = self.require_room(session, room_id, conn)
                    if room_id is None:
                        return
                    rows = conn.execute(
                        '''SELECT s.*,l.code location_code,l.name location_name,l.room_id
                           FROM shelves s JOIN locations l ON l.id=s.location_id
                           WHERE l.room_id=? ORDER BY l.sort_order,l.id,s.sort_order,s.id''',
                        (room_id,),
                    ).fetchall()
                else:
                    return self.send_json({'error': 'room_id or location_id required'}, 400)
            return self.send_json([rowdict(row) for row in rows])

        if url.path == '/api/items':
            session = self.require()
            if not session:
                return
            query = parse_qs(url.query)
            room_id = query.get('room_id', [''])[0]
            term = query.get('q', [''])[0].strip()
            location_code = query.get('location', [''])[0].strip()
            if not room_id:
                return self.send_json({'error': 'room_id required'}, 400)
            room_id = self.require_room(session, room_id)
            if room_id is None:
                return
            sql = '''SELECT i.*,s.name shelf_name,s.sort_order shelf_sort_order,
                            l.code location_code,l.name location_name,l.room_id
                     FROM items i JOIN locations l ON l.id=i.location_id
                     LEFT JOIN shelves s ON s.id=i.shelf_id
                     WHERE l.room_id=?'''
            args = [room_id]
            if term:
                sql += ' AND (i.name LIKE ? OR i.category LIKE ? OR i.notes LIKE ? OR COALESCE(s.name,i.shelf) LIKE ? OR l.code LIKE ?)'
                args += [f'%{term}%'] * 5
            if location_code:
                sql += ' AND l.code=?'
                args.append(location_code)
            sql += ' ORDER BY lower(i.name)'
            with connect() as conn:
                rows = conn.execute(sql, args).fetchall()
            return self.send_json([rowdict(row) for row in rows])

        if url.path == '/api/layout':
            session = self.require()
            if not session:
                return
            room_id = parse_qs(url.query).get('room_id', [''])[0]
            if not room_id:
                return self.send_json({'error': 'room_id required'}, 400)
            room_id = self.require_room(session, room_id)
            if room_id is None:
                return
            with connect() as conn:
                row = conn.execute(
                    'SELECT room_id,width,height,layout_json,updated_at FROM room_layouts WHERE room_id=?',
                    (room_id,),
                ).fetchone()
            if not row:
                return self.send_json({
                    'room_id': room_id,
                    'width': 4.0,
                    'height': 3.0,
                    'layout': {'ceiling_height': 2.5, 'locations': {}, 'fixtures': []},
                    'updated_at': None,
                })
            try:
                layout = json.loads(row['layout_json'])
            except Exception:
                layout = {'ceiling_height': 2.5, 'locations': {}, 'fixtures': []}
            layout.setdefault('ceiling_height', 2.5)
            layout.setdefault('locations', {})
            layout.setdefault('fixtures', [])
            return self.send_json({
                'room_id': row['room_id'],
                'width': row['width'],
                'height': row['height'],
                'layout': layout,
                'updated_at': row['updated_at'],
            })

        if url.path == '/api/users':
            if not self.require(admin=True):
                return
            with connect() as conn:
                rows = conn.execute(
                    'SELECT id,username,display_name,avatar,password_hash,role,read_only,active,created_at FROM users ORDER BY lower(username)'
                ).fetchall()
                result = []
                for row in rows:
                    user = public_user(row)
                    user['room_ids'] = room_ids_for_user(conn, row['id']) if user['role'] != 'admin' else []
                    result.append(user)
            return self.send_json(result)

        return self.send_error(404)

    def do_POST(self):
        url = urlparse(self.path)
        data = self.body()
        if data is None:
            return self.send_json({'error': 'Invalid JSON'}, 400)

        if url.path == '/api/login':
            username = str(data.get('username', '')).strip()
            password = str(data.get('password', ''))
            with connect() as conn:
                user = conn.execute('SELECT * FROM users WHERE username=? COLLATE NOCASE', (username,)).fetchone()
            if not user or not user['active'] or not verify_password(password, user['password_hash']):
                time.sleep(.35)
                return self.send_json({'error': 'Invalid username or password'}, 401)
            token = secrets.token_urlsafe(32)
            csrf = secrets.token_urlsafe(24)
            expires = int(time.time()) + SESSION_TTL
            with connect() as conn:
                conn.execute(
                    'INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)',
                    (token_hash(token), user['id'], csrf, expires, now()),
                )
            payload = b'{"ok":true}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.security_headers()
            cookie = f'storage_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}'
            if COOKIE_SECURE:
                cookie += '; Secure'
            self.send_header('Set-Cookie', cookie)
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if url.path == '/api/logout':
            session = self.require(csrf=True)
            if not session:
                return
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            morsel = cookie.get('storage_session')
            if morsel:
                with connect() as conn:
                    conn.execute('DELETE FROM sessions WHERE token_hash=?', (token_hash(morsel.value),))
            payload = b'{"ok":true}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.security_headers()
            clear_cookie = 'storage_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
            if COOKIE_SECURE:
                clear_cookie += '; Secure'
            self.send_header('Set-Cookie', clear_cookie)
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if url.path == '/api/rooms':
            if not self.require(admin=True, csrf=True):
                return
            name = str(data.get('name', '')).strip()
            slug = slugify(str(data.get('slug') or name))
            if not name:
                return self.send_json({'error': 'Name is required'}, 400)
            try:
                with connect() as conn:
                    cursor = conn.execute(
                        'INSERT INTO rooms(name,slug,description,sort_order,created_at) VALUES(?,?,?,?,?)',
                        (name, slug, str(data.get('description', '')).strip(), int(data.get('sort_order', 0)), now()),
                    )
                    room_id = cursor.lastrowid
                    # Normal editors are opt-out: newly created rooms are granted
                    # automatically. Read-only accounts stay explicit opt-in.
                    editors = conn.execute("SELECT id FROM users WHERE role='user' AND read_only=0").fetchall()
                    for editor in editors:
                        conn.execute(
                            'INSERT OR IGNORE INTO user_room_access(user_id,room_id,created_at) VALUES(?,?,?)',
                            (editor['id'], room_id, now()),
                        )
                    room = conn.execute('SELECT * FROM rooms WHERE id=?', (room_id,)).fetchone()
                return self.send_json(rowdict(room), 201)
            except sqlite3.IntegrityError:
                return self.send_json({'error': 'This room slug already exists'}, 409)

        if url.path == '/api/locations':
            if not self.require(admin=True, csrf=True):
                return
            try:
                room_id = int(data['room_id'])
                code = str(data['code']).strip().upper()
                name = str(data['name']).strip()
            except (KeyError, TypeError, ValueError):
                return self.send_json({'error': 'Room, code and name are required'}, 400)
            if not code or not name:
                return self.send_json({'error': 'Room, code and name are required'}, 400)
            try:
                with connect() as conn:
                    if not conn.execute('SELECT 1 FROM rooms WHERE id=?', (room_id,)).fetchone():
                        return self.send_json({'error': 'Room not found'}, 404)
                    cursor = conn.execute(
                        'INSERT INTO locations(room_id,code,name,side,sort_order,notes) VALUES(?,?,?,?,?,?)',
                        (room_id, code, name, str(data.get('side', '')).strip(), int(data.get('sort_order', 0)), str(data.get('notes', '')).strip()),
                    )
                    location_id = cursor.lastrowid
                    try:
                        shelf_count = int(data.get('shelf_count', 5))
                    except (TypeError, ValueError):
                        shelf_count = 5
                    shelf_count = max(1, min(shelf_count, 32))
                    for index in range(shelf_count):
                        conn.execute(
                            'INSERT INTO shelves(location_id,name,sort_order,created_at) VALUES(?,?,?,?)',
                            (location_id, f'Shelf {index + 1}', index, now()),
                        )
                    row = conn.execute(
                        '''SELECT l.*,COUNT(s.id) AS shelf_count FROM locations l
                           LEFT JOIN shelves s ON s.location_id=l.id WHERE l.id=? GROUP BY l.id''',
                        (location_id,),
                    ).fetchone()
                return self.send_json(rowdict(row), 201)
            except sqlite3.IntegrityError:
                return self.send_json({'error': 'This code already exists in the room'}, 409)

        if url.path == '/api/shelves':
            if not self.require(admin=True, csrf=True):
                return
            try:
                location_id = int(data['location_id'])
            except (KeyError, TypeError, ValueError):
                return self.send_json({'error': 'location_id is required'}, 400)
            with connect() as conn:
                if not conn.execute('SELECT 1 FROM locations WHERE id=?', (location_id,)).fetchone():
                    return self.send_json({'error': 'Location not found'}, 404)
                count = conn.execute('SELECT COUNT(*) FROM shelves WHERE location_id=?', (location_id,)).fetchone()[0]
                if count >= 32:
                    return self.send_json({'error': 'A storage location can contain at most 32 shelves'}, 409)
                name = str(data.get('name', '')).strip()
                if not name:
                    existing_names = {row['name'].casefold() for row in shelf_rows(conn, location_id)}
                    next_number = next((number for number in range(1, 33) if f'Shelf {number}'.casefold() not in existing_names), count + 1)
                    name = f'Shelf {next_number}'
                sort_order = count
                cursor = conn.execute(
                    'INSERT INTO shelves(location_id,name,sort_order,created_at) VALUES(?,?,?,?)',
                    (location_id, name, sort_order, now()),
                )
                row = conn.execute('SELECT * FROM shelves WHERE id=?', (cursor.lastrowid,)).fetchone()
            return self.send_json(rowdict(row), 201)

        if url.path == '/api/locations/reorder':
            if not self.require(admin=True, csrf=True):
                return
            try:
                room_id = int(data['room_id'])
                location_ids = [int(value) for value in data.get('location_ids', [])]
            except (KeyError, TypeError, ValueError):
                return self.send_json({'error': 'Invalid location order'}, 400)
            with connect() as conn:
                expected = [row['id'] for row in conn.execute('SELECT id FROM locations WHERE room_id=? ORDER BY sort_order,id', (room_id,)).fetchall()]
                if len(location_ids) != len(expected) or set(location_ids) != set(expected):
                    return self.send_json({'error': 'Location order must include every location in the room exactly once'}, 400)
                for index, location_id in enumerate(location_ids):
                    conn.execute('UPDATE locations SET sort_order=? WHERE id=? AND room_id=?', (index, location_id, room_id))
            return self.send_json({'ok': True})

        if url.path == '/api/shelves/reorder':
            if not self.require(admin=True, csrf=True):
                return
            try:
                location_id = int(data['location_id'])
                shelf_ids = [int(value) for value in data.get('shelf_ids', [])]
            except (KeyError, TypeError, ValueError):
                return self.send_json({'error': 'Invalid shelf order'}, 400)
            with connect() as conn:
                expected = [row['id'] for row in shelf_rows(conn, location_id)]
                if len(shelf_ids) != len(expected) or set(shelf_ids) != set(expected):
                    return self.send_json({'error': 'Shelf order must include every shelf in the location exactly once'}, 400)
                for index, shelf_id in enumerate(shelf_ids):
                    conn.execute('UPDATE shelves SET sort_order=? WHERE id=? AND location_id=?', (index, shelf_id, location_id))
            return self.send_json({'ok': True})

        if url.path == '/api/items':
            session = self.require_write()
            if not session:
                return
            try:
                location_id = int(data['location_id'])
                name = str(data['name']).strip()
            except (KeyError, TypeError, ValueError):
                return self.send_json({'error': 'Name and location are required'}, 400)
            if not name:
                return self.send_json({'error': 'Name and location are required'}, 400)
            with connect() as conn:
                room_id = self.location_room(conn, location_id)
                if room_id is None:
                    return self.send_json({'error': 'Location not found'}, 404)
                if not self.can_access_room(session, room_id, conn):
                    return self.send_json({'error': 'Room not found or access denied'}, 404)
                shelf_id, shelf_name = resolve_shelf(conn, location_id, data.get('shelf_id'), data.get('shelf', ''))
                if data.get('shelf_id') not in (None, '', 0, '0') and shelf_id is None:
                    return self.send_json({'error': 'Shelf does not belong to this storage location'}, 400)
                cursor = conn.execute(
                    '''INSERT INTO items(name,category,location_id,shelf_id,shelf,quantity,notes,updated_at)
                       VALUES(?,?,?,?,?,?,?,?)''',
                    (name, str(data.get('category', '')).strip(), location_id, shelf_id, shelf_name or '', str(data.get('quantity', '')).strip(), str(data.get('notes', '')).strip(), now()),
                )
                row = conn.execute(
                    '''SELECT i.*,s.name shelf_name,s.sort_order shelf_sort_order,
                              l.code location_code,l.name location_name,l.room_id
                       FROM items i JOIN locations l ON l.id=i.location_id
                       LEFT JOIN shelves s ON s.id=i.shelf_id WHERE i.id=?''',
                    (cursor.lastrowid,),
                ).fetchone()
            return self.send_json(rowdict(row), 201)

        if url.path == '/api/users':
            if not self.require(admin=True, csrf=True):
                return
            username = str(data.get('username', '')).strip()
            password = str(data.get('password', ''))
            role = str(data.get('role', 'user')).strip().lower()
            avatar = normalize_avatar(data.get('avatar'))
            if len(username) < 2 or len(password) < 8 or not valid_role(role):
                return self.send_json({'error': 'Username must have 2+ characters, password 8+ characters, and role must be valid'}, 400)
            db_role_value, read_only = db_role(role)
            try:
                with connect() as conn:
                    requested_room_ids = normalize_room_ids(conn, data.get('room_ids')) if role != 'admin' else []
                    if role == 'readonly' and all_room_ids(conn) and not requested_room_ids:
                        return self.send_json({'error': 'Select at least one room for a read-only user'}, 400)
                    cursor = conn.execute(
                        '''INSERT INTO users(username,display_name,avatar,password_hash,role,read_only,active,created_at)
                           VALUES(?,?,?,?,?,?,1,?)''',
                        (username, str(data.get('display_name', '')).strip(), avatar, hash_password(password), db_role_value, read_only, now()),
                    )
                    user_id = cursor.lastrowid
                    if role != 'admin':
                        room_ids = data.get('room_ids')
                        if room_ids is None and role == 'user':
                            room_ids = all_room_ids(conn)
                        elif room_ids is not None:
                            room_ids = requested_room_ids
                        set_room_access(conn, user_id, room_ids or [])
                    row = conn.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
                    result = public_user(row)
                    result['room_ids'] = room_ids_for_user(conn, user_id) if role != 'admin' else []
                return self.send_json(result, 201)
            except sqlite3.IntegrityError:
                return self.send_json({'error': 'Username already exists'}, 409)

        return self.send_error(404)

    def do_PUT(self):
        url = urlparse(self.path)
        data = self.body()
        if data is None:
            return self.send_json({'error': 'Invalid JSON'}, 400)

        if url.path == '/api/me':
            session = self.require(csrf=True)
            if not session:
                return
            avatar = normalize_avatar(data.get('avatar'), normalize_avatar(session.get('avatar')))
            display_name = str(data.get('display_name', session.get('display_name', ''))).strip()
            with connect() as conn:
                conn.execute(
                    'UPDATE users SET display_name=?,avatar=? WHERE id=?',
                    (display_name, avatar, session['user_id']),
                )
                row = conn.execute('SELECT * FROM users WHERE id=?', (session['user_id'],)).fetchone()
                result = public_user(row)
                result['can_write'] = result['role'] != 'readonly'
            return self.send_json(result)

        parts = url.path.strip('/').split('/')
        if len(parts) != 3 or parts[0] != 'api':
            return self.send_error(404)
        try:
            object_id = int(parts[2])
        except ValueError:
            return self.send_error(400)

        if parts[1] == 'items':
            session = self.require_write()
            if not session:
                return
            try:
                new_location_id = int(data['location_id'])
            except (KeyError, TypeError, ValueError):
                return self.send_json({'error': 'Location is required'}, 400)
            with connect() as conn:
                current_room_id = self.item_room(conn, object_id)
                new_room_id = self.location_room(conn, new_location_id)
                if current_room_id is None:
                    return self.send_json({'error': 'Not found'}, 404)
                if new_room_id is None:
                    return self.send_json({'error': 'Location not found'}, 404)
                if not self.can_access_room(session, current_room_id, conn) or not self.can_access_room(session, new_room_id, conn):
                    return self.send_json({'error': 'Room not found or access denied'}, 404)
                shelf_id, shelf_name = resolve_shelf(conn, new_location_id, data.get('shelf_id'), data.get('shelf', ''))
                if data.get('shelf_id') not in (None, '', 0, '0') and shelf_id is None:
                    return self.send_json({'error': 'Shelf does not belong to this storage location'}, 400)
                conn.execute(
                    '''UPDATE items SET name=?,category=?,location_id=?,shelf_id=?,shelf=?,quantity=?,notes=?,updated_at=? WHERE id=?''',
                    (str(data.get('name', '')).strip(), str(data.get('category', '')).strip(), new_location_id, shelf_id, shelf_name or '', str(data.get('quantity', '')).strip(), str(data.get('notes', '')).strip(), now(), object_id),
                )
                row = conn.execute(
                    '''SELECT i.*,s.name shelf_name,s.sort_order shelf_sort_order,
                              l.code location_code,l.name location_name,l.room_id
                       FROM items i JOIN locations l ON l.id=i.location_id
                       LEFT JOIN shelves s ON s.id=i.shelf_id WHERE i.id=?''',
                    (object_id,),
                ).fetchone()
            return self.send_json(rowdict(row))

        if parts[1] == 'shelves':
            if not self.require(admin=True, csrf=True):
                return
            name = str(data.get('name', '')).strip()
            if not name:
                return self.send_json({'error': 'Shelf name is required'}, 400)
            with connect() as conn:
                shelf = conn.execute('SELECT * FROM shelves WHERE id=?', (object_id,)).fetchone()
                if not shelf:
                    return self.send_json({'error': 'Not found'}, 404)
                conn.execute('UPDATE shelves SET name=? WHERE id=?', (name, object_id))
                conn.execute('UPDATE items SET shelf=? WHERE shelf_id=?', (name, object_id))
                row = conn.execute('SELECT * FROM shelves WHERE id=?', (object_id,)).fetchone()
            return self.send_json(rowdict(row))

        if parts[1] == 'locations':
            if not self.require(admin=True, csrf=True):
                return
            try:
                with connect() as conn:
                    conn.execute(
                        'UPDATE locations SET code=?,name=?,side=?,sort_order=?,notes=? WHERE id=?',
                        (str(data['code']).strip().upper(), str(data['name']).strip(), str(data.get('side', '')).strip(), int(data.get('sort_order', 0)), str(data.get('notes', '')).strip(), object_id),
                    )
                    row = conn.execute('SELECT * FROM locations WHERE id=?', (object_id,)).fetchone()
                return self.send_json(rowdict(row) or {'error': 'Not found'}, 200 if row else 404)
            except sqlite3.IntegrityError:
                return self.send_json({'error': 'This code already exists in the room'}, 409)

        if parts[1] == 'rooms':
            if not self.require(admin=True, csrf=True):
                return
            try:
                with connect() as conn:
                    conn.execute(
                        'UPDATE rooms SET name=?,slug=?,description=?,sort_order=? WHERE id=?',
                        (str(data['name']).strip(), slugify(str(data.get('slug') or data['name'])), str(data.get('description', '')).strip(), int(data.get('sort_order', 0)), object_id),
                    )
                    row = conn.execute('SELECT * FROM rooms WHERE id=?', (object_id,)).fetchone()
                return self.send_json(rowdict(row) or {'error': 'Not found'}, 200 if row else 404)
            except sqlite3.IntegrityError:
                return self.send_json({'error': 'This room slug already exists'}, 409)

        if parts[1] == 'layout':
            if not self.require(admin=True, csrf=True):
                return
            try:
                width = float(data.get('width', 4.0))
                height = float(data.get('height', 3.0))
            except (TypeError, ValueError):
                return self.send_json({'error': 'Room dimensions must be numbers'}, 400)
            if not (1.0 <= width <= 50.0 and 1.0 <= height <= 50.0):
                return self.send_json({'error': 'Room dimensions must be between 1 and 50 metres'}, 400)
            layout = data.get('layout', {})
            if not isinstance(layout, dict):
                return self.send_json({'error': 'Invalid layout'}, 400)
            locations = layout.get('locations', {})
            fixtures = layout.get('fixtures', [])
            try:
                ceiling_height = float(layout.get('ceiling_height', 2.5))
            except (TypeError, ValueError):
                return self.send_json({'error': 'Ceiling height must be a number'}, 400)
            if not (1.8 <= ceiling_height <= 8.0):
                return self.send_json({'error': 'Ceiling height must be between 1.8 and 8 metres'}, 400)
            if not isinstance(locations, dict) or not isinstance(fixtures, list) or len(fixtures) > 100:
                return self.send_json({'error': 'Invalid layout data'}, 400)
            normalized_layout = {'ceiling_height': ceiling_height, 'locations': locations, 'fixtures': fixtures}
            try:
                encoded = json.dumps(normalized_layout, ensure_ascii=False, separators=(',', ':'))
            except (TypeError, ValueError):
                return self.send_json({'error': 'Invalid layout data'}, 400)
            if len(encoded.encode()) > 300_000:
                return self.send_json({'error': 'Layout is too large'}, 413)
            with connect() as conn:
                if not conn.execute('SELECT 1 FROM rooms WHERE id=?', (object_id,)).fetchone():
                    return self.send_json({'error': 'Room not found'}, 404)
                conn.execute(
                    '''INSERT INTO room_layouts(room_id,width,height,layout_json,updated_at) VALUES(?,?,?,?,?)
                       ON CONFLICT(room_id) DO UPDATE SET width=excluded.width,height=excluded.height,layout_json=excluded.layout_json,updated_at=excluded.updated_at''',
                    (object_id, width, height, encoded, now()),
                )
            return self.send_json({'room_id': object_id, 'width': width, 'height': height, 'layout': normalized_layout, 'updated_at': now()})

        if parts[1] == 'users':
            session = self.require(admin=True, csrf=True)
            if not session:
                return
            with connect() as conn:
                user = conn.execute('SELECT * FROM users WHERE id=?', (object_id,)).fetchone()
                if not user:
                    return self.send_json({'error': 'Not found'}, 404)

                current_role = effective_role(user)
                role = str(data.get('role', current_role)).strip().lower()
                if not valid_role(role):
                    return self.send_json({'error': 'Invalid role'}, 400)
                active = 1 if data.get('active', bool(user['active'])) else 0

                if object_id == session['user_id'] and (role != 'admin' or not active):
                    return self.send_json({'error': 'You cannot disable or demote your own active admin account'}, 409)

                if current_role == 'admin' and (role != 'admin' or not active):
                    active_admins = conn.execute(
                        "SELECT COUNT(*) FROM users WHERE role='admin' AND active=1"
                    ).fetchone()[0]
                    if active_admins <= 1:
                        return self.send_json({'error': 'At least one active administrator is required'}, 409)

                requested_room_ids = normalize_room_ids(conn, data.get('room_ids')) if role != 'admin' and 'room_ids' in data else None
                if role == 'readonly' and all_room_ids(conn) and requested_room_ids is not None and not requested_room_ids:
                    return self.send_json({'error': 'Select at least one room for a read-only user'}, 400)

                db_role_value, read_only = db_role(role)
                display_name = str(data.get('display_name', user['display_name'])).strip()
                avatar = normalize_avatar(data.get('avatar'), normalize_avatar(user['avatar']))
                fields = [display_name, avatar, db_role_value, read_only, active]
                sql = 'UPDATE users SET display_name=?,avatar=?,role=?,read_only=?,active=?'
                password_changed = False
                password = str(data.get('password', ''))
                if password:
                    if len(password) < 8:
                        return self.send_json({'error': 'Password must have at least 8 characters'}, 400)
                    sql += ',password_hash=?'
                    fields.append(hash_password(password))
                    password_changed = True
                sql += ' WHERE id=?'
                fields.append(object_id)
                conn.execute(sql, fields)

                if role == 'admin':
                    set_room_access(conn, object_id, [])
                elif 'room_ids' in data:
                    set_room_access(conn, object_id, requested_room_ids or [])
                elif role == 'user' and current_role != 'user':
                    # Moving into the normal editor role follows the opt-out
                    # model: all rooms are selected unless the admin provides
                    # an explicit list.
                    set_room_access(conn, object_id, all_room_ids(conn))
                elif current_role == 'admin' and role == 'readonly':
                    # Read-only is explicit opt-in, so a demoted admin starts
                    # without rooms unless the request supplies room_ids.
                    set_room_access(conn, object_id, [])

                # Security-sensitive changes invalidate the target user's other
                # sessions. Keep the current admin's session when only editing self.
                if object_id != session['user_id'] and (password_changed or current_role != role or int(user['active']) != active):
                    conn.execute('DELETE FROM sessions WHERE user_id=?', (object_id,))

                row = conn.execute('SELECT * FROM users WHERE id=?', (object_id,)).fetchone()
                result = public_user(row)
                result['room_ids'] = room_ids_for_user(conn, object_id) if role != 'admin' else []
            return self.send_json(result)

        return self.send_error(404)

    def do_DELETE(self):
        url = urlparse(self.path)
        parts = url.path.strip('/').split('/')
        if len(parts) != 3 or parts[0] != 'api':
            return self.send_error(404)
        try:
            object_id = int(parts[2])
        except ValueError:
            return self.send_error(400)

        if parts[1] == 'items':
            session = self.require_write()
            if not session:
                return
            with connect() as conn:
                room_id = self.item_room(conn, object_id)
                if room_id is None:
                    return self.send_json({'ok': False}, 404)
                if not self.can_access_room(session, room_id, conn):
                    return self.send_json({'error': 'Room not found or access denied'}, 404)
                cursor = conn.execute('DELETE FROM items WHERE id=?', (object_id,))
            return self.send_json({'ok': cursor.rowcount > 0})

        if parts[1] == 'shelves':
            if not self.require(admin=True, csrf=True):
                return
            with connect() as conn:
                shelf = conn.execute('SELECT * FROM shelves WHERE id=?', (object_id,)).fetchone()
                if not shelf:
                    return self.send_json({'ok': False}, 404)
                count = conn.execute('SELECT COUNT(*) FROM shelves WHERE location_id=?', (shelf['location_id'],)).fetchone()[0]
                if count <= 1:
                    return self.send_json({'error': 'A storage location must keep at least one shelf'}, 409)
                item_count = conn.execute('SELECT COUNT(*) FROM items WHERE shelf_id=?', (object_id,)).fetchone()[0]
                if item_count:
                    return self.send_json({'error': 'Move the items off this shelf before deleting it'}, 409)
                conn.execute('DELETE FROM shelves WHERE id=?', (object_id,))
            return self.send_json({'ok': True})

        if parts[1] == 'locations':
            if not self.require(admin=True, csrf=True):
                return
            try:
                with connect() as conn:
                    cursor = conn.execute('DELETE FROM locations WHERE id=?', (object_id,))
                return self.send_json({'ok': cursor.rowcount > 0})
            except sqlite3.IntegrityError:
                return self.send_json({'error': 'Location still contains items'}, 409)

        if parts[1] == 'rooms':
            if not self.require(admin=True, csrf=True):
                return
            with connect() as conn:
                count = conn.execute(
                    'SELECT COUNT(*) FROM items i JOIN locations l ON l.id=i.location_id WHERE l.room_id=?',
                    (object_id,),
                ).fetchone()[0]
                if count:
                    return self.send_json({'error': 'Room still contains items'}, 409)
                cursor = conn.execute('DELETE FROM rooms WHERE id=?', (object_id,))
            return self.send_json({'ok': cursor.rowcount > 0})

        return self.send_error(404)


if __name__ == '__main__':
    init_db()
    print(f'Storage Room App -> http://localhost:{PORT}  DB={DB_PATH}')
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
