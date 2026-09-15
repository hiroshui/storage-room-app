#!/usr/bin/env python3
import base64, hashlib, hmac, json, mimetypes, os, secrets, sqlite3, time
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

BASE = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv('STORAGE_ROOM_DB', BASE / 'data' / 'storage-room.db'))
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '8080'))
SESSION_TTL = int(os.getenv('SESSION_TTL', str(60 * 60 * 24 * 14)))
COOKIE_SECURE = os.getenv('COOKIE_SECURE', '0').lower() in ('1','true','yes')
PBKDF2_ITERATIONS = 310_000

SCHEMA = '''
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL DEFAULT '',
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
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
CREATE TABLE IF NOT EXISTS items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT '',
 location_id INTEGER NOT NULL,
 shelf TEXT NOT NULL DEFAULT '',
 quantity TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL,
 FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE RESTRICT
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
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
'''

def now(): return datetime.now(timezone.utc).isoformat(timespec='seconds')
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c=sqlite3.connect(DB_PATH); c.row_factory=sqlite3.Row; c.execute('PRAGMA foreign_keys=ON'); return c
def rowdict(r): return dict(r) if r else None
def slugify(s):
    import re, unicodedata
    s=unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',s).strip('-') or 'storage'
def hash_password(password, salt=None):
    salt=salt or secrets.token_bytes(16)
    digest=hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ITERATIONS)
    return f'pbkdf2_sha256${PBKDF2_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}'
def verify_password(password, encoded):
    try:
        algo,it,salt,digest=encoded.split('$'); assert algo=='pbkdf2_sha256'
        test=hashlib.pbkdf2_hmac('sha256',password.encode(),base64.b64decode(salt),int(it))
        return hmac.compare_digest(test,base64.b64decode(digest))
    except Exception: return False
def token_hash(token): return hashlib.sha256(token.encode()).hexdigest()

def init_db():
    with connect() as c:
        # Migrate the V2 database in-place before applying the new schema.
        tables={r['name'] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'locations' in tables:
            cols={r['name'] for r in c.execute('PRAGMA table_info(locations)')}
            if 'room_id' not in cols:
                c.execute('ALTER TABLE locations RENAME TO legacy_locations')
                if 'items' in tables: c.execute('ALTER TABLE items RENAME TO legacy_items')
        c.executescript(SCHEMA)
        legacy={r['name'] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'legacy_locations' in legacy:
            cur=c.execute("INSERT INTO rooms(name,slug,description,sort_order,created_at) VALUES(?,?,?,?,?)",('Storage room','storage-room','Migrated from version 2',0,now()))
            rid=cur.lastrowid
            c.execute('''INSERT INTO locations(id,room_id,code,name,side,sort_order,notes)
                         SELECT id,?,code,name,side,sort_order,notes FROM legacy_locations''',(rid,))
            if 'legacy_items' in legacy:
                c.execute('''INSERT INTO items(id,name,category,location_id,shelf,quantity,notes,updated_at)
                             SELECT id,name,category,location_id,shelf,quantity,notes,updated_at FROM legacy_items''')
                c.execute('DROP TABLE legacy_items')
            c.execute('DROP TABLE legacy_locations')
        if c.execute('SELECT COUNT(*) FROM rooms').fetchone()[0] == 0:
            c.execute("INSERT INTO rooms(name,slug,description,sort_order,created_at) VALUES(?,?,?,?,?)",('Storage room','storage-room','',0,now()))
        if c.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0:
            username=os.getenv('ADMIN_USERNAME','admin').strip() or 'admin'
            password=os.getenv('ADMIN_PASSWORD') or secrets.token_urlsafe(12)
            c.execute('INSERT INTO users(username,display_name,password_hash,role,active,created_at) VALUES(?,?,?,?,1,?)',
                      (username,'Administrator',hash_password(password),'admin',now()))
            print('\n'+'='*62+f'\nInitial admin created\nUsername: {username}\nPassword: {password}\nChange this password after first login.\n'+'='*62+'\n')
        c.execute('DELETE FROM sessions WHERE expires_at < ?', (int(time.time()),))

class Handler(BaseHTTPRequestHandler):
    server_version='StorageRoomApp/5.0'
    def log_message(self,fmt,*args): print(f'{self.address_string()} - {fmt%args}')
    def security_headers(self):
        self.send_header('X-Content-Type-Options','nosniff'); self.send_header('X-Frame-Options','DENY')
        self.send_header('Referrer-Policy','same-origin'); self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'")
    def send_json(self,obj,status=200):
        data=json.dumps(obj,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.security_headers(); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def redirect(self,path): self.send_response(303); self.send_header('Location',path); self.security_headers(); self.end_headers()
    def serve_file(self,path,ctype=None):
        if not path.exists() or not path.is_file(): return self.send_error(404)
        data=path.read_bytes(); self.send_response(200); self.send_header('Content-Type',ctype or mimetypes.guess_type(str(path))[0] or 'application/octet-stream'); self.security_headers(); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def body(self):
        try: return json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
        except Exception: return None
    def session(self):
        cookie=SimpleCookie(self.headers.get('Cookie','')); morsel=cookie.get('storage_session')
        if not morsel: return None
        with connect() as c:
            r=c.execute('''SELECT s.*,u.username,u.display_name,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?''',(token_hash(morsel.value),int(time.time()))).fetchone()
        return rowdict(r) if r and r['active'] else None
    def require(self,admin=False,csrf=False):
        s=self.session()
        if not s: self.send_json({'error':'Authentication required'},401); return None
        if admin and s['role']!='admin': self.send_json({'error':'Administrator rights required'},403); return None
        if csrf and not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),s['csrf_token']): self.send_json({'error':'Invalid CSRF token'},403); return None
        return s
    def do_GET(self):
        u=urlparse(self.path)
        if u.path=='/login': return self.serve_file(BASE/'templates'/'login.html','text/html; charset=utf-8')
        if u.path=='/':
            if not self.session(): return self.redirect('/login')
            return self.serve_file(BASE/'templates'/'app.html','text/html; charset=utf-8')
        if u.path.startswith('/static/'):
            p=(BASE/u.path.lstrip('/')).resolve()
            if BASE.resolve() not in p.parents: return self.send_error(403)
            return self.serve_file(p)
        if u.path=='/api/health': return self.send_json({'ok':True,'time':now()})
        if u.path=='/api/me':
            s=self.require();
            if not s:return
            return self.send_json({'id':s['user_id'],'username':s['username'],'display_name':s['display_name'],'role':s['role'],'csrf':s['csrf_token']})
        if u.path=='/api/rooms':
            if not self.require(): return
            with connect() as c: rows=c.execute('SELECT * FROM rooms ORDER BY sort_order,lower(name)').fetchall()
            return self.send_json([rowdict(r) for r in rows])
        if u.path=='/api/locations':
            if not self.require(): return
            rid=parse_qs(u.query).get('room_id',[''])[0]
            if not rid:return self.send_json({'error':'room_id required'},400)
            with connect() as c: rows=c.execute('SELECT * FROM locations WHERE room_id=? ORDER BY sort_order,code',(int(rid),)).fetchall()
            return self.send_json([rowdict(r) for r in rows])
        if u.path=='/api/items':
            if not self.require(): return
            q=parse_qs(u.query); rid=q.get('room_id',[''])[0]; term=q.get('q',[''])[0].strip(); loc=q.get('location',[''])[0].strip()
            if not rid:return self.send_json({'error':'room_id required'},400)
            sql='''SELECT i.*,l.code location_code,l.name location_name,l.room_id FROM items i JOIN locations l ON l.id=i.location_id WHERE l.room_id=?'''; args=[int(rid)]
            if term: sql+=' AND (i.name LIKE ? OR i.category LIKE ? OR i.notes LIKE ? OR i.shelf LIKE ? OR l.code LIKE ?)'; args += [f'%{term}%']*5
            if loc: sql+=' AND l.code=?'; args.append(loc)
            sql+=' ORDER BY lower(i.name)'
            with connect() as c: rows=c.execute(sql,args).fetchall()
            return self.send_json([rowdict(r) for r in rows])
        if u.path=='/api/layout':
            if not self.require(): return
            rid=parse_qs(u.query).get('room_id',[''])[0]
            if not rid:return self.send_json({'error':'room_id required'},400)
            try: rid=int(rid)
            except ValueError:return self.send_json({'error':'Invalid room_id'},400)
            with connect() as c:
                room=c.execute('SELECT id FROM rooms WHERE id=?',(rid,)).fetchone()
                if not room:return self.send_json({'error':'Room not found'},404)
                r=c.execute('SELECT room_id,width,height,layout_json,updated_at FROM room_layouts WHERE room_id=?',(rid,)).fetchone()
            if not r:
                return self.send_json({'room_id':rid,'width':4.0,'height':3.0,'layout':{'locations':{},'fixtures':[]},'updated_at':None})
            try: layout=json.loads(r['layout_json'])
            except Exception: layout={'locations':{},'fixtures':[]}
            return self.send_json({'room_id':r['room_id'],'width':r['width'],'height':r['height'],'layout':layout,'updated_at':r['updated_at']})
        if u.path=='/api/users':
            if not self.require(admin=True):return
            with connect() as c: rows=c.execute('SELECT id,username,display_name,role,active,created_at FROM users ORDER BY lower(username)').fetchall()
            return self.send_json([rowdict(r) for r in rows])
        return self.send_error(404)
    def do_POST(self):
        u=urlparse(self.path); data=self.body()
        if data is None:return self.send_json({'error':'Invalid JSON'},400)
        if u.path=='/api/login':
            username=str(data.get('username','')).strip(); password=str(data.get('password',''))
            with connect() as c: user=c.execute('SELECT * FROM users WHERE username=? COLLATE NOCASE',(username,)).fetchone()
            if not user or not user['active'] or not verify_password(password,user['password_hash']): time.sleep(.35); return self.send_json({'error':'Invalid username or password'},401)
            token=secrets.token_urlsafe(32); csrf=secrets.token_urlsafe(24); exp=int(time.time())+SESSION_TTL
            with connect() as c: c.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)',(token_hash(token),user['id'],csrf,exp,now()))
            self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store'); self.security_headers(); cookie=f'storage_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}' + ('; Secure' if COOKIE_SECURE else ''); self.send_header('Set-Cookie',cookie); payload=b'{"ok":true}'; self.send_header('Content-Length',str(len(payload))); self.end_headers(); self.wfile.write(payload); return
        s=self.require(admin=u.path in ('/api/users',),csrf=True)
        if not s:return
        if u.path=='/api/logout':
            cookie=SimpleCookie(self.headers.get('Cookie','')); m=cookie.get('storage_session')
            if m:
                with connect() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(token_hash(m.value),))
            payload=b'{"ok":true}'
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.send_header('Cache-Control','no-store')
            self.security_headers()
            clear_cookie='storage_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + ('; Secure' if COOKIE_SECURE else '')
            self.send_header('Set-Cookie',clear_cookie)
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if u.path=='/api/rooms':
            name=str(data.get('name','')).strip(); slug=slugify(str(data.get('slug') or name));
            if not name:return self.send_json({'error':'Name is required'},400)
            try:
                with connect() as c:
                    cur=c.execute('INSERT INTO rooms(name,slug,description,sort_order,created_at) VALUES(?,?,?,?,?)',(name,slug,str(data.get('description','')).strip(),int(data.get('sort_order',0)),now())); r=c.execute('SELECT * FROM rooms WHERE id=?',(cur.lastrowid,)).fetchone()
                return self.send_json(rowdict(r),201)
            except sqlite3.IntegrityError:return self.send_json({'error':'This room slug already exists'},409)
        if u.path=='/api/locations':
            try:
                with connect() as c:
                    cur=c.execute('INSERT INTO locations(room_id,code,name,side,sort_order,notes) VALUES(?,?,?,?,?,?)',(int(data['room_id']),str(data['code']).strip().upper(),str(data['name']).strip(),str(data.get('side','')).strip(),int(data.get('sort_order',0)),str(data.get('notes','')).strip())); r=c.execute('SELECT * FROM locations WHERE id=?',(cur.lastrowid,)).fetchone()
                return self.send_json(rowdict(r),201)
            except (KeyError,ValueError):return self.send_json({'error':'Room, code and name are required'},400)
            except sqlite3.IntegrityError:return self.send_json({'error':'This code already exists in the room'},409)
        if u.path=='/api/items':
            try:
                with connect() as c:
                    cur=c.execute('INSERT INTO items(name,category,location_id,shelf,quantity,notes,updated_at) VALUES(?,?,?,?,?,?,?)',(str(data['name']).strip(),str(data.get('category','')).strip(),int(data['location_id']),str(data.get('shelf','')).strip(),str(data.get('quantity','')).strip(),str(data.get('notes','')).strip(),now())); r=c.execute('''SELECT i.*,l.code location_code,l.name location_name,l.room_id FROM items i JOIN locations l ON l.id=i.location_id WHERE i.id=?''',(cur.lastrowid,)).fetchone()
                return self.send_json(rowdict(r),201)
            except (KeyError,ValueError):return self.send_json({'error':'Name and location are required'},400)
        if u.path=='/api/users':
            username=str(data.get('username','')).strip(); password=str(data.get('password','')); role=str(data.get('role','user'))
            if len(username)<2 or len(password)<8 or role not in ('admin','user'):return self.send_json({'error':'Username must have 2+ characters and password 8+ characters'},400)
            try:
                with connect() as c:
                    cur=c.execute('INSERT INTO users(username,display_name,password_hash,role,active,created_at) VALUES(?,?,?,?,1,?)',(username,str(data.get('display_name','')).strip(),hash_password(password),role,now())); r=c.execute('SELECT id,username,display_name,role,active,created_at FROM users WHERE id=?',(cur.lastrowid,)).fetchone()
                return self.send_json(rowdict(r),201)
            except sqlite3.IntegrityError:return self.send_json({'error':'Username already exists'},409)
        return self.send_error(404)
    def do_PUT(self):
        u=urlparse(self.path); data=self.body(); s=self.require(csrf=True)
        if not s:return
        if data is None:return self.send_json({'error':'Invalid JSON'},400)
        p=u.path.strip('/').split('/')
        try: oid=int(p[2])
        except:return self.send_error(400)
        if p[:2]==['api','items']:
            with connect() as c:
                c.execute('UPDATE items SET name=?,category=?,location_id=?,shelf=?,quantity=?,notes=?,updated_at=? WHERE id=?',(str(data.get('name','')).strip(),str(data.get('category','')).strip(),int(data['location_id']),str(data.get('shelf','')).strip(),str(data.get('quantity','')).strip(),str(data.get('notes','')).strip(),now(),oid)); r=c.execute('''SELECT i.*,l.code location_code,l.name location_name,l.room_id FROM items i JOIN locations l ON l.id=i.location_id WHERE i.id=?''',(oid,)).fetchone()
            return self.send_json(rowdict(r) or {'error':'Not found'},200 if r else 404)
        if p[:2]==['api','locations']:
            try:
                with connect() as c:c.execute('UPDATE locations SET code=?,name=?,side=?,sort_order=?,notes=? WHERE id=?',(str(data['code']).strip().upper(),str(data['name']).strip(),str(data.get('side','')).strip(),int(data.get('sort_order',0)),str(data.get('notes','')).strip(),oid)); r=c.execute('SELECT * FROM locations WHERE id=?',(oid,)).fetchone()
                return self.send_json(rowdict(r) or {'error':'Not found'},200 if r else 404)
            except sqlite3.IntegrityError:return self.send_json({'error':'This code already exists in the room'},409)
        if p[:2]==['api','rooms']:
            try:
                with connect() as c:c.execute('UPDATE rooms SET name=?,slug=?,description=?,sort_order=? WHERE id=?',(str(data['name']).strip(),slugify(str(data.get('slug') or data['name'])),str(data.get('description','')).strip(),int(data.get('sort_order',0)),oid)); r=c.execute('SELECT * FROM rooms WHERE id=?',(oid,)).fetchone()
                return self.send_json(rowdict(r) or {'error':'Not found'},200 if r else 404)
            except sqlite3.IntegrityError:return self.send_json({'error':'This room slug already exists'},409)
        if p[:2]==['api','layout']:
            if s['role']!='admin':return self.send_json({'error':'Administrator rights required'},403)
            try:
                width=float(data.get('width',4.0)); height=float(data.get('height',3.0))
            except (TypeError,ValueError):return self.send_json({'error':'Room dimensions must be numbers'},400)
            if not (1.0 <= width <= 50.0 and 1.0 <= height <= 50.0):return self.send_json({'error':'Room dimensions must be between 1 and 50 metres'},400)
            layout=data.get('layout',{})
            if not isinstance(layout,dict):return self.send_json({'error':'Invalid layout'},400)
            locations=layout.get('locations',{})
            fixtures=layout.get('fixtures',[])
            if not isinstance(locations,dict) or not isinstance(fixtures,list) or len(fixtures)>100:return self.send_json({'error':'Invalid layout data'},400)
            try: encoded=json.dumps({'locations':locations,'fixtures':fixtures},ensure_ascii=False,separators=(',',':'))
            except (TypeError,ValueError):return self.send_json({'error':'Invalid layout data'},400)
            if len(encoded.encode())>200_000:return self.send_json({'error':'Layout is too large'},413)
            with connect() as c:
                room=c.execute('SELECT id FROM rooms WHERE id=?',(oid,)).fetchone()
                if not room:return self.send_json({'error':'Room not found'},404)
                c.execute('''INSERT INTO room_layouts(room_id,width,height,layout_json,updated_at) VALUES(?,?,?,?,?)
                             ON CONFLICT(room_id) DO UPDATE SET width=excluded.width,height=excluded.height,layout_json=excluded.layout_json,updated_at=excluded.updated_at''',
                          (oid,width,height,encoded,now()))
            return self.send_json({'room_id':oid,'width':width,'height':height,'layout':{'locations':locations,'fixtures':fixtures},'updated_at':now()})
        if p[:2]==['api','users']:
            if s['role']!='admin':return self.send_json({'error':'Administrator rights required'},403)
            with connect() as c:
                user=c.execute('SELECT * FROM users WHERE id=?',(oid,)).fetchone()
                if not user:return self.send_json({'error':'Not found'},404)
                role=str(data.get('role',user['role'])); active=1 if data.get('active',bool(user['active'])) else 0
                if oid==s['user_id'] and (role!='admin' or not active):return self.send_json({'error':'You cannot disable or demote your own active admin account'},409)
                fields=[str(data.get('display_name',user['display_name'])).strip(),role,active]; sql='UPDATE users SET display_name=?,role=?,active=?'
                if data.get('password'):
                    if len(str(data['password']))<8:return self.send_json({'error':'Password must have at least 8 characters'},400)
                    sql+=',password_hash=?'; fields.append(hash_password(str(data['password'])))
                sql+=' WHERE id=?'; fields.append(oid); c.execute(sql,fields); r=c.execute('SELECT id,username,display_name,role,active,created_at FROM users WHERE id=?',(oid,)).fetchone()
            return self.send_json(rowdict(r))
        return self.send_error(404)
    def do_DELETE(self):
        s=self.require(csrf=True)
        if not s:return
        p=urlparse(self.path).path.strip('/').split('/')
        try: oid=int(p[2])
        except:return self.send_error(400)
        if p[:2]==['api','items']:
            with connect() as c:cur=c.execute('DELETE FROM items WHERE id=?',(oid,))
            return self.send_json({'ok':cur.rowcount>0})
        if p[:2]==['api','locations']:
            try:
                with connect() as c:cur=c.execute('DELETE FROM locations WHERE id=?',(oid,))
                return self.send_json({'ok':cur.rowcount>0})
            except sqlite3.IntegrityError:return self.send_json({'error':'Location still contains items'},409)
        if p[:2]==['api','rooms']:
            with connect() as c:
                n=c.execute('SELECT COUNT(*) FROM items i JOIN locations l ON l.id=i.location_id WHERE l.room_id=?',(oid,)).fetchone()[0]
                if n:return self.send_json({'error':'Room still contains items'},409)
                cur=c.execute('DELETE FROM rooms WHERE id=?',(oid,))
            return self.send_json({'ok':cur.rowcount>0})
        return self.send_error(404)

if __name__=='__main__':
    init_db(); print(f'Storage Room App -> http://localhost:{PORT}  DB={DB_PATH}'); ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
