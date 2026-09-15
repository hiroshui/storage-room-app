'use strict';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  roomSelect: $('#roomSelect'),
  settings: $('#settings'),
  logoutTop: $('#logoutTop'),
  add: $('#add'),
  fab: $('#fab'),
  q: $('#q'),
  roomTitle: $('#roomTitle'),
  roomDescription: $('#roomDescription'),
  clearFilter: $('#clearFilter'),
  showPlan: $('#showPlan'),
  showCabinets: $('#showCabinets'),
  planView: $('#planView'),
  roomPlan: $('#roomPlan'),
  cabinetView: $('#cabinetView'),
  locations: $('#locations'),
  heading: $('#heading'),
  stats: $('#stats'),
  items: $('#items'),
  toast: $('#toast'),
  itemDialog: $('#itemDialog'),
  itemForm: $('#itemForm'),
  formTitle: $('#formTitle'),
  name: $('#name'),
  location: $('#location'),
  shelf: $('#shelf'),
  category: $('#category'),
  quantity: $('#quantity'),
  notes: $('#notes'),
  deleteItem: $('#deleteItem'),
  settingsDialog: $('#settingsDialog'),
  roomEditor: $('#roomEditor'),
  locEditor: $('#locEditor'),
  userEditor: $('#userEditor'),
  addRoom: $('#addRoom'),
  newRoomName: $('#newRoomName'),
  newRoomDescription: $('#newRoomDescription'),
  addLoc: $('#addLoc'),
  newCode: $('#newCode'),
  newLocName: $('#newLocName'),
  newSide: $('#newSide'),
  addUser: $('#addUser'),
  newUsername: $('#newUsername'),
  newDisplayName: $('#newDisplayName'),
  newPassword: $('#newPassword'),
  newRole: $('#newRole'),
  accountInfo: $('#accountInfo'),
  logout: $('#logout'),
  kioskEnabled: $('#kioskEnabled'),
  kioskRoom: $('#kioskRoom'),
  saveKiosk: $('#saveKiosk'),
  kioskExit: $('#kioskExit'),
  kioskGate: $('#kioskGate'),
  kioskEnterFullscreen: $('#kioskEnterFullscreen'),
  kioskExitFromGate: $('#kioskExitFromGate'),
  viewportMeta: $('#viewportMeta'),
  plannerWidth: $('#plannerWidth'),
  plannerHeight: $('#plannerHeight'),
  plannerStage: $('#plannerStage'),
  savePlanner: $('#savePlanner'),
  autoArrange: $('#autoArrange'),
  addDoor: $('#addDoor'),
  addWindow: $('#addWindow'),
  addObstacle: $('#addObstacle'),
  plannerSelectionEmpty: $('#plannerSelectionEmpty'),
  plannerSelection: $('#plannerSelection'),
  plannerSelectionTitle: $('#plannerSelectionTitle'),
  plannerX: $('#plannerX'),
  plannerY: $('#plannerY'),
  plannerW: $('#plannerW'),
  plannerH: $('#plannerH'),
  plannerRotation: $('#plannerRotation'),
  removePlannerElement: $('#removePlannerElement'),
};

const state = {
  me: null,
  csrf: '',
  rooms: [],
  room: null,
  locations: [],
  allItems: [],
  items: [],
  layout: null,
  activeLocationCode: '',
  editingItem: null,
  kiosk: { enabled: false, roomId: null },
  visualMode: localStorage.getItem('storage-room-visual-mode') || 'plan',
  plannerSelected: null,
  plannerDrag: null,
};

const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';
const KIOSK_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
const KIOSK_STORAGE_KEY = 'storage-room-kiosk';
const LAST_ROOM_STORAGE_KEY = 'storage-room-last-room';
const SVG_NS = 'http://www.w3.org/2000/svg';
const SNAP = 0.05;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function snap(value) {
  return round(Math.round(Number(value) / SNAP) * SNAP, 2);
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

async function api(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Authentication required');
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  window.setTimeout(() => elements.toast.classList.remove('show'), 1800);
}

function getStoredKioskSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KIOSK_STORAGE_KEY) || '{}');
    return { enabled: Boolean(parsed.enabled), roomId: Number(parsed.roomId) || null };
  } catch {
    return { enabled: false, roomId: null };
  }
}

function storeKioskSettings(kiosk) {
  localStorage.setItem(KIOSK_STORAGE_KEY, JSON.stringify(kiosk));
}

function isKioskMode() {
  return state.kiosk.enabled;
}

function setKioskUi(enabled) {
  document.body.classList.toggle('kiosk', enabled);
  elements.kioskExit.hidden = !enabled;
  elements.viewportMeta.setAttribute('content', enabled ? KIOSK_VIEWPORT : DEFAULT_VIEWPORT);
  if (enabled && elements.settingsDialog.open) elements.settingsDialog.close();
  if (enabled && elements.itemDialog.open) elements.itemDialog.close();
}

function shouldShowKioskGate() {
  return isKioskMode() && document.fullscreenEnabled && !document.fullscreenElement;
}

function syncKioskGate() {
  elements.kioskGate.hidden = !shouldShowKioskGate();
}

function requestKioskFullscreen() {
  if (!isKioskMode() || !document.fullscreenEnabled || document.fullscreenElement) {
    syncKioskGate();
    return;
  }
  const request = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  if (request && typeof request.catch === 'function') {
    request.catch(() => {
      toast('Fullscreen was blocked by the browser');
      syncKioskGate();
    });
  }
}

async function exitKioskMode() {
  state.kiosk = { enabled: false, roomId: null };
  storeKioskSettings(state.kiosk);
  setKioskUi(false);
  elements.kioskGate.hidden = true;
  if (document.fullscreenElement && document.exitFullscreen) {
    try { await document.exitFullscreen(); } catch { /* browser may already be leaving */ }
  }
  renderItems();
  toast('Kiosk mode disabled');
}

function confirmExitKiosk() {
  if (window.confirm('Exit kiosk mode on this device?')) exitKioskMode();
}

function guardKioskAction(event) {
  if (!isKioskMode()) return false;
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  toast('Editing is locked in kiosk mode');
  return true;
}

async function boot() {
  state.me = await api('/api/me');
  state.csrf = state.me.csrf;
  $$('.admin-only').forEach((element) => { element.hidden = state.me.role !== 'admin'; });
  elements.accountInfo.textContent = `Signed in as ${state.me.display_name || state.me.username} (${state.me.role})`;

  state.rooms = await api('/api/rooms');
  renderRoomSelect();
  setVisualMode(state.visualMode);

  state.kiosk = getStoredKioskSettings();
  setKioskUi(state.kiosk.enabled);

  const lastRoomId = Number(localStorage.getItem(LAST_ROOM_STORAGE_KEY));
  const kioskRoomExists = state.kiosk.enabled && state.rooms.some((room) => room.id === state.kiosk.roomId);
  const wantedRoomId = kioskRoomExists ? state.kiosk.roomId : lastRoomId;
  const initialRoom = state.rooms.find((room) => room.id === wantedRoomId) || state.rooms[0];
  if (initialRoom) await selectRoom(initialRoom.id);
  else renderEmptyApp();
  syncKioskGate();
}

function renderEmptyApp() {
  elements.roomSelect.innerHTML = '';
  elements.roomTitle.textContent = 'No storage rooms';
  elements.roomDescription.textContent = 'Create a room in Settings to get started.';
  elements.roomPlan.innerHTML = '<div class="empty">No storage rooms yet.</div>';
  elements.cabinetView.innerHTML = '<p class="empty">No storage rooms yet.</p>';
  elements.locations.innerHTML = '';
  elements.items.innerHTML = '<div class="empty">No items found.</div>';
  elements.stats.textContent = '0 items';
}

function renderRoomSelect() {
  const options = state.rooms.map((room) => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join('');
  elements.roomSelect.innerHTML = options;
  elements.kioskRoom.innerHTML = options;
  renderRoomEditor();
}

function normalizeLayout(payload) {
  const layout = payload?.layout && typeof payload.layout === 'object' ? payload.layout : {};
  return {
    room_id: payload?.room_id || state.room?.id || null,
    width: clamp(Number(payload?.width) || 4, 1, 50),
    height: clamp(Number(payload?.height) || 3, 1, 50),
    layout: {
      locations: layout.locations && typeof layout.locations === 'object' ? layout.locations : {},
      fixtures: Array.isArray(layout.fixtures) ? layout.fixtures : [],
    },
  };
}

async function selectRoom(id) {
  const selected = state.rooms.find((room) => room.id === Number(id));
  if (!selected) return;

  state.room = selected;
  state.activeLocationCode = '';
  state.plannerSelected = null;
  elements.roomSelect.value = String(selected.id);
  elements.roomTitle.textContent = selected.name;
  elements.roomDescription.textContent = selected.description || '';
  elements.heading.textContent = 'All items';
  localStorage.setItem(LAST_ROOM_STORAGE_KEY, String(selected.id));

  const [locations, items, layout] = await Promise.all([
    api(`/api/locations?room_id=${selected.id}`),
    api(`/api/items?room_id=${selected.id}`),
    api(`/api/layout?room_id=${selected.id}`),
  ]);

  state.locations = locations;
  state.allItems = items;
  state.layout = normalizeLayout(layout);
  ensureLocationLayouts();
  fillLocationSelect();
  applyItemFilters();
  renderLocations();
  renderCabinets();
  renderRoomPlan();
  renderLocationEditor();
  renderPlanner();
}

function applyItemFilters() {
  const query = elements.q.value.trim().toLocaleLowerCase();
  state.items = state.allItems.filter((item) => {
    if (state.activeLocationCode && item.location_code !== state.activeLocationCode) return false;
    if (!query) return true;
    const haystack = [item.name, item.category, item.notes, item.shelf, item.quantity, item.location_code, item.location_name]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  });
  renderItems();
  renderCabinets();
  renderRoomPlan();
}

async function refreshInventory() {
  if (!state.room) return;
  state.allItems = await api(`/api/items?room_id=${state.room.id}`);
  applyItemFilters();
}

function fillLocationSelect() {
  elements.location.innerHTML = state.locations
    .map((location) => `<option value="${location.id}">${escapeHtml(location.code)} · ${escapeHtml(location.name)}</option>`)
    .join('');
}

function renderLocations() {
  const allLocations = `
    <div class="loc ${state.activeLocationCode ? '' : 'active'}" data-code="">
      <span class="code">ALL</span><div>All items</div>
    </div>`;
  const rows = state.locations.map((location) => `
    <div class="loc ${state.activeLocationCode === location.code ? 'active' : ''}" data-code="${escapeHtml(location.code)}">
      <span class="code">${escapeHtml(location.code)}</span><div>${escapeHtml(location.name)}</div>
    </div>`).join('');
  elements.locations.innerHTML = `<h2>Locations</h2>${allLocations}${rows}`;
  $$('.loc').forEach((row) => row.addEventListener('click', () => setActiveLocation(row.dataset.code)));
}

function renderCabinets() {
  const counts = itemCountsByLocation();
  const groups = new Map();
  state.locations.forEach((location) => {
    const groupName = location.side || 'Locations';
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(location);
  });
  const matching = matchingLocationIds();
  elements.cabinetView.innerHTML = [...groups].map(([groupName, locations]) => `
    <div class="cabinet-side">
      <div class="cabinet-side-title">${escapeHtml(groupName)}</div>
      <div class="cabinet-row">
        ${locations.map((location) => `
          <button class="cabinet ${state.activeLocationCode === location.code ? 'active' : ''} ${matching.has(location.id) ? 'search-match' : ''}"
            data-code="${escapeHtml(location.code)}" type="button">
            <span class="cabinet-code">${escapeHtml(location.code)}</span>
            <span class="cabinet-count">${counts[location.id] || 0} items</span>
          </button>`).join('')}
      </div>
    </div>`).join('') || '<p class="empty">No locations yet. Add one in Settings.</p>';
  $$('.cabinet').forEach((cabinet) => cabinet.addEventListener('click', () => setActiveLocation(cabinet.dataset.code)));
  elements.clearFilter.hidden = !state.activeLocationCode;
}

function setVisualMode(mode) {
  state.visualMode = mode === 'locations' ? 'locations' : 'plan';
  localStorage.setItem('storage-room-visual-mode', state.visualMode);
  elements.planView.hidden = state.visualMode !== 'plan';
  elements.cabinetView.hidden = state.visualMode !== 'locations';
  elements.showPlan.classList.toggle('active', state.visualMode === 'plan');
  elements.showCabinets.classList.toggle('active', state.visualMode === 'locations');
}

function setActiveLocation(code) {
  state.activeLocationCode = code;
  const location = state.locations.find((entry) => entry.code === code);
  elements.heading.textContent = code ? `${code} · ${location?.name || ''}` : 'All items';
  elements.clearFilter.hidden = !code;
  renderLocations();
  applyItemFilters();
}

function renderItems() {
  const count = state.items.length;
  elements.stats.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  if (!count) {
    elements.items.innerHTML = '<div class="empty">No items found.</div>';
    return;
  }
  elements.items.innerHTML = state.items.map((item) => `
    <article class="item ${isKioskMode() ? 'readonly' : ''}" data-id="${item.id}">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="meta">
        <span class="pill locpill">${escapeHtml(item.location_code)}${item.shelf ? ` · ${escapeHtml(item.shelf)}` : ''}</span>
        ${item.category ? `<span class="pill">${escapeHtml(item.category)}</span>` : ''}
        ${item.quantity ? `<span class="pill">${escapeHtml(item.quantity)}</span>` : ''}
      </div>
      ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ''}
    </article>`).join('');

  if (!isKioskMode()) {
    $$('.item').forEach((itemElement) => itemElement.addEventListener('click', () => {
      openItem(state.allItems.find((entry) => entry.id === Number(itemElement.dataset.id)));
    }));
  }
}

function itemCountsByLocation() {
  return state.allItems.reduce((counts, item) => {
    counts[item.location_id] = (counts[item.location_id] || 0) + 1;
    return counts;
  }, {});
}

function matchingLocationIds() {
  if (!elements.q.value.trim()) return new Set();
  return new Set(state.items.map((item) => Number(item.location_id)));
}

function autoLayoutForLocations(width, height) {
  const result = {};
  const buckets = { left: [], right: [], top: [], bottom: [], other: [] };
  state.locations.forEach((location) => {
    const side = String(location.side || '').toLocaleLowerCase();
    if (side.includes('left') || side.includes('links')) buckets.left.push(location);
    else if (side.includes('right') || side.includes('rechts')) buckets.right.push(location);
    else if (side.includes('top') || side.includes('back') || side.includes('oben') || side.includes('hinten')) buckets.top.push(location);
    else if (side.includes('bottom') || side.includes('front') || side.includes('unten') || side.includes('vorne')) buckets.bottom.push(location);
    else buckets.other.push(location);
  });

  const wallDepth = Math.max(0.32, Math.min(0.48, Math.min(width, height) * 0.11));
  const module = Math.max(0.45, Math.min(0.72, Math.min(width, height) * 0.18));
  const margin = 0.12;

  function distribute(list, side) {
    if (!list.length) return;
    const vertical = side === 'left' || side === 'right';
    const available = (vertical ? height : width) - 2 * margin;
    const span = Math.min(module, Math.max(0.32, available / list.length - 0.04));
    const gap = Math.max(0.04, (available - span * list.length) / Math.max(1, list.length));
    list.forEach((location, index) => {
      const offset = margin + index * (span + gap);
      if (vertical) {
        result[location.id] = {
          x: side === 'left' ? margin : Math.max(margin, width - wallDepth - margin),
          y: offset,
          w: wallDepth,
          h: span,
          rotation: 0,
        };
      } else {
        result[location.id] = {
          x: offset,
          y: side === 'top' ? margin : Math.max(margin, height - wallDepth - margin),
          w: span,
          h: wallDepth,
          rotation: 0,
        };
      }
    });
  }

  distribute(buckets.left, 'left');
  distribute(buckets.right, 'right');
  distribute(buckets.top, 'top');
  distribute(buckets.bottom, 'bottom');

  buckets.other.forEach((location, index) => {
    const columns = Math.max(1, Math.floor((width - 0.4) / (module + 0.15)));
    const col = index % columns;
    const row = Math.floor(index / columns);
    result[location.id] = {
      x: 0.2 + col * (module + 0.15),
      y: 0.2 + row * (wallDepth + 0.15),
      w: module,
      h: wallDepth,
      rotation: 0,
    };
  });
  return result;
}

function ensureLocationLayouts(force = false) {
  if (!state.layout) return;
  const defaults = autoLayoutForLocations(state.layout.width, state.layout.height);
  const validIds = new Set(state.locations.map((location) => String(location.id)));
  Object.keys(state.layout.layout.locations).forEach((id) => {
    if (!validIds.has(String(id))) delete state.layout.layout.locations[id];
  });
  state.locations.forEach((location) => {
    const id = String(location.id);
    if (force || !state.layout.layout.locations[id]) {
      state.layout.layout.locations[id] = defaults[location.id] || { x: 0.2, y: 0.2, w: 0.6, h: 0.4, rotation: 0 };
    }
    state.layout.layout.locations[id] = normalizePlanObject(state.layout.layout.locations[id], state.layout.width, state.layout.height);
  });
}

function normalizePlanObject(object, roomWidth, roomHeight) {
  const w = clamp(Number(object?.w) || 0.6, 0.1, roomWidth);
  const h = clamp(Number(object?.h) || 0.4, 0.1, roomHeight);
  return {
    x: clamp(Number(object?.x) || 0, 0, Math.max(0, roomWidth - w)),
    y: clamp(Number(object?.y) || 0, 0, Math.max(0, roomHeight - h)),
    w,
    h,
    rotation: [0, 90, 180, 270].includes(Number(object?.rotation)) ? Number(object.rotation) : 0,
  };
}

function renderRoomPlan() {
  if (!state.layout || !state.room) {
    elements.roomPlan.innerHTML = '<div class="empty">No plan available.</div>';
    return;
  }
  ensureLocationLayouts();
  const { width, height } = state.layout;
  const counts = itemCountsByLocation();
  const matches = matchingLocationIds();
  const queryActive = Boolean(elements.q.value.trim());
  const textSize = Math.max(0.11, Math.min(width, height) * 0.045);
  const subTextSize = textSize * 0.66;
  const gridSize = 0.5;

  const fixtures = state.layout.layout.fixtures.map((fixture) => renderFixtureSvg(fixture, false)).join('');
  const locations = state.locations.map((location) => {
    const object = state.layout.layout.locations[String(location.id)];
    if (!object) return '';
    const cx = object.x + object.w / 2;
    const cy = object.y + object.h / 2;
    const active = state.activeLocationCode === location.code;
    const match = queryActive && matches.has(location.id);
    const matchingItems = match ? state.items.filter((item) => Number(item.location_id) === location.id) : [];
    const shelves = [...new Set(matchingItems.map((item) => item.shelf).filter(Boolean))];
    const detail = match
      ? (shelves.length ? shelves.slice(0, 2).join(' · ') : `${matchingItems.length} match${matchingItems.length === 1 ? '' : 'es'}`)
      : `${counts[location.id] || 0} item${counts[location.id] === 1 ? '' : 's'}`;
    const title = `${location.code} · ${location.name}\n${counts[location.id] || 0} items`;
    return `
      <g class="plan-location${active ? ' active' : ''}${match ? ' search-match' : ''}" data-location-id="${location.id}" data-code="${escapeHtml(location.code)}"
         transform="rotate(${object.rotation} ${cx} ${cy})">
        <title>${escapeHtml(title)}</title>
        <rect x="${object.x}" y="${object.y}" width="${object.w}" height="${object.h}" rx="0.07"></rect>
        <text class="plan-location-code" x="${cx}" y="${cy - textSize * 0.08}" text-anchor="middle" dominant-baseline="middle" font-size="${textSize}">${escapeHtml(location.code)}</text>
        <text class="plan-location-detail" x="${cx}" y="${cy + textSize * 0.72}" text-anchor="middle" dominant-baseline="middle" font-size="${subTextSize}">${escapeHtml(detail)}</text>
      </g>`;
  }).join('');

  elements.roomPlan.innerHTML = `
    <div class="floorplan-shell">
      <svg class="floorplan" viewBox="${-0.18} ${-0.18} ${width + 0.36} ${height + 0.36}" role="img" aria-label="Top-down plan of ${escapeHtml(state.room.name)}">
        <defs>
          <pattern id="planGrid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
            <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" class="plan-grid-line" fill="none"></path>
          </pattern>
        </defs>
        <rect class="plan-floor" x="0" y="0" width="${width}" height="${height}" rx="0.05"></rect>
        <rect class="plan-grid" x="0" y="0" width="${width}" height="${height}" fill="url(#planGrid)"></rect>
        ${fixtures}
        ${locations}
        <text class="plan-dimension" x="${width / 2}" y="${height + 0.13}" text-anchor="middle">${round(width)} m</text>
        <text class="plan-dimension" x="${-0.12}" y="${height / 2}" text-anchor="middle" transform="rotate(-90 ${-0.12} ${height / 2})">${round(height)} m</text>
      </svg>
    </div>`;

  $$('#roomPlan .plan-location').forEach((element) => {
    element.addEventListener('click', () => setActiveLocation(element.dataset.code));
  });
}

function renderFixtureSvg(fixture, editable) {
  const f = normalizePlanObject(fixture, state.layout.width, state.layout.height);
  const kind = fixture.kind || 'obstacle';
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const classes = `plan-fixture fixture-${kind}${editable ? ' planner-element' : ''}${isPlannerSelected('fixture', fixture.id) ? ' selected' : ''}`;
  const data = editable ? `data-planner-type="fixture" data-planner-id="${escapeHtml(fixture.id)}"` : '';
  const transform = `rotate(${f.rotation} ${cx} ${cy})`;
  if (kind === 'door') {
    const radius = Math.max(f.w, 0.5);
    return `<g class="${classes}" ${data} transform="${transform}">
      <title>Door</title>
      <line x1="${f.x}" y1="${f.y}" x2="${f.x + f.w}" y2="${f.y}" class="fixture-door-leaf"></line>
      <path d="M ${f.x} ${f.y} A ${radius} ${radius} 0 0 1 ${f.x + f.w} ${f.y + f.w}" class="fixture-door-arc"></path>
    </g>`;
  }
  if (kind === 'window') {
    return `<g class="${classes}" ${data} transform="${transform}">
      <title>Window</title>
      <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${Math.max(f.h, 0.08)}" rx="0.025"></rect>
      <line x1="${f.x + 0.04}" y1="${f.y + Math.max(f.h, 0.08) / 2}" x2="${f.x + f.w - 0.04}" y2="${f.y + Math.max(f.h, 0.08) / 2}"></line>
    </g>`;
  }
  return `<g class="${classes}" ${data} transform="${transform}">
    <title>Obstacle</title>
    <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="0.05"></rect>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(0.09, Math.min(f.w, f.h) * 0.24)}">${escapeHtml(fixture.label || 'Obstacle')}</text>
  </g>`;
}

function openItem(item = null) {
  if (guardKioskAction()) return;
  if (!state.locations.length) { toast('Add a location first'); return; }
  state.editingItem = item;
  elements.formTitle.textContent = item ? 'Edit item' : 'Add item';
  elements.name.value = item?.name || '';
  elements.category.value = item?.category || '';
  elements.shelf.value = item?.shelf || '';
  elements.quantity.value = item?.quantity || '';
  elements.notes.value = item?.notes || '';
  const activeLocation = state.locations.find((location) => location.code === state.activeLocationCode);
  const locationId = item?.location_id || activeLocation?.id;
  if (locationId) elements.location.value = String(locationId);
  elements.deleteItem.hidden = !item;
  elements.itemDialog.showModal();
}

async function saveItem(event) {
  event.preventDefault();
  if (guardKioskAction(event)) return;
  const payload = {
    name: elements.name.value,
    category: elements.category.value,
    location_id: Number(elements.location.value),
    shelf: elements.shelf.value,
    quantity: elements.quantity.value,
    notes: elements.notes.value,
  };
  try {
    const path = state.editingItem ? `/api/items/${state.editingItem.id}` : '/api/items';
    await api(path, { method: state.editingItem ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    elements.itemDialog.close();
    toast('Saved');
    await refreshInventory();
  } catch (error) { toast(error.message); }
}

async function deleteCurrentItem() {
  if (guardKioskAction() || !state.editingItem) return;
  if (!window.confirm(`Delete “${state.editingItem.name}”?`)) return;
  await api(`/api/items/${state.editingItem.id}`, { method: 'DELETE' });
  elements.itemDialog.close();
  await refreshInventory();
  toast('Deleted');
}

function renderRoomEditor() {
  elements.roomEditor.innerHTML = state.rooms.map((room) => `
    <div class="editor-row"><b>${room.id}</b><span>${escapeHtml(room.name)}</span>
      <button class="btn secondary mini edit-room" data-id="${room.id}" type="button">Edit</button>
      <button class="btn danger mini del-room" data-id="${room.id}" type="button">Delete</button>
    </div>`).join('');
  $$('.edit-room').forEach((button) => button.addEventListener('click', () => editRoom(Number(button.dataset.id))));
  $$('.del-room').forEach((button) => button.addEventListener('click', () => deleteRoom(Number(button.dataset.id))));
}

async function editRoom(id) {
  if (guardKioskAction()) return;
  const room = state.rooms.find((entry) => entry.id === id);
  const name = window.prompt('Room name', room.name);
  if (!name) return;
  const description = window.prompt('Description', room.description || '');
  await api(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify({ name, description: description ?? room.description, sort_order: room.sort_order }) });
  await refreshRooms();
  toast('Room saved');
}

async function deleteRoom(id) {
  if (guardKioskAction()) return;
  const room = state.rooms.find((entry) => entry.id === id);
  if (!window.confirm(`Delete room “${room.name}”? Empty locations will also be removed.`)) return;
  try {
    await api(`/api/rooms/${id}`, { method: 'DELETE' });
    await refreshRooms();
    toast('Room deleted');
  } catch (error) { toast(error.message); }
}

async function refreshRooms() {
  state.rooms = await api('/api/rooms');
  renderRoomSelect();
  if (!state.rooms.length) { state.room = null; renderEmptyApp(); return; }
  const selectedId = state.rooms.some((entry) => entry.id === state.room?.id) ? state.room.id : state.rooms[0].id;
  await selectRoom(selectedId);
}

async function addRoom() {
  if (guardKioskAction()) return;
  try {
    const room = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name: elements.newRoomName.value, description: elements.newRoomDescription.value }) });
    elements.newRoomName.value = '';
    elements.newRoomDescription.value = '';
    state.rooms = await api('/api/rooms');
    renderRoomSelect();
    await selectRoom(room.id);
    toast('Room added');
  } catch (error) { toast(error.message); }
}

function renderLocationEditor() {
  elements.locEditor.innerHTML = state.locations.map((location) => `
    <div class="editor-row"><b>${escapeHtml(location.code)}</b><span>${escapeHtml(location.name)}</span>
      <button class="btn secondary mini edit-loc" data-id="${location.id}" type="button">Edit</button>
      <button class="btn danger mini del-loc" data-id="${location.id}" type="button">Delete</button>
    </div>`).join('');
  $$('.edit-loc').forEach((button) => button.addEventListener('click', () => editLocation(Number(button.dataset.id))));
  $$('.del-loc').forEach((button) => button.addEventListener('click', () => deleteLocation(Number(button.dataset.id))));
}

async function editLocation(id) {
  if (guardKioskAction()) return;
  const location = state.locations.find((entry) => entry.id === id);
  const code = window.prompt('Code', location.code); if (!code) return;
  const name = window.prompt('Name', location.name); if (!name) return;
  const side = window.prompt('Group / side', location.side || '') ?? location.side;
  await api(`/api/locations/${id}`, { method: 'PUT', body: JSON.stringify({ code, name, side, sort_order: location.sort_order, notes: location.notes }) });
  await selectRoom(state.room.id);
  toast('Location saved');
}

async function deleteLocation(id) {
  if (guardKioskAction()) return;
  const location = state.locations.find((entry) => entry.id === id);
  if (!window.confirm(`Delete location “${location.code}”?`)) return;
  try {
    await api(`/api/locations/${id}`, { method: 'DELETE' });
    await selectRoom(state.room.id);
    toast('Location deleted');
  } catch (error) { toast(error.message); }
}

async function addLocation() {
  if (guardKioskAction()) return;
  if (!state.room) { toast('Create a room first'); return; }
  try {
    await api('/api/locations', { method: 'POST', body: JSON.stringify({ room_id: state.room.id, code: elements.newCode.value, name: elements.newLocName.value, side: elements.newSide.value, sort_order: 999 }) });
    elements.newCode.value = ''; elements.newLocName.value = ''; elements.newSide.value = '';
    await selectRoom(state.room.id);
    toast('Location added');
  } catch (error) { toast(error.message); }
}

async function renderUsers() {
  if (state.me.role !== 'admin') return;
  const users = await api('/api/users');
  elements.userEditor.innerHTML = users.map((user) => `
    <div class="editor-row"><b>${escapeHtml(user.role)}</b><span>${escapeHtml(user.display_name || user.username)} · @${escapeHtml(user.username)}${user.active ? '' : ' · disabled'}</span>
      <button class="btn secondary mini user-edit" data-id="${user.id}" type="button">Edit</button>
    </div>`).join('');
  $$('.user-edit').forEach((button) => button.addEventListener('click', () => editUser(users.find((user) => user.id === Number(button.dataset.id)))));
}

async function editUser(user) {
  if (guardKioskAction()) return;
  const displayName = window.prompt('Display name', user.display_name || ''); if (displayName === null) return;
  const password = window.prompt('New password (leave empty to keep current)', ''); if (password === null) return;
  try {
    await api(`/api/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ display_name: displayName, role: user.role, active: Boolean(user.active), password }) });
    await renderUsers(); toast('User saved');
  } catch (error) { toast(error.message); }
}

async function addUser() {
  if (guardKioskAction()) return;
  try {
    await api('/api/users', { method: 'POST', body: JSON.stringify({ username: elements.newUsername.value, display_name: elements.newDisplayName.value, password: elements.newPassword.value, role: elements.newRole.value }) });
    elements.newUsername.value = ''; elements.newDisplayName.value = ''; elements.newPassword.value = '';
    await renderUsers(); toast('User added');
  } catch (error) { toast(error.message); }
}

function getPlannerObject(selection = state.plannerSelected) {
  if (!selection || !state.layout) return null;
  if (selection.type === 'location') return state.layout.layout.locations[String(selection.id)] || null;
  return state.layout.layout.fixtures.find((fixture) => String(fixture.id) === String(selection.id)) || null;
}

function isPlannerSelected(type, id) {
  return state.plannerSelected?.type === type && String(state.plannerSelected.id) === String(id);
}

function renderPlanner() {
  if (!state.layout || !state.room || !elements.plannerStage) return;
  ensureLocationLayouts();
  elements.plannerWidth.value = round(state.layout.width);
  elements.plannerHeight.value = round(state.layout.height);
  renderPlannerCanvas();
  renderPlannerInspector();
}

function renderPlannerCanvas() {
  if (!state.layout) return;
  const { width, height } = state.layout;
  const grid = 0.5;
  const locationSvg = state.locations.map((location) => {
    const object = state.layout.layout.locations[String(location.id)];
    const cx = object.x + object.w / 2;
    const cy = object.y + object.h / 2;
    const selected = isPlannerSelected('location', location.id);
    return `
      <g class="planner-location planner-element${selected ? ' selected' : ''}" data-planner-type="location" data-planner-id="${location.id}"
         transform="rotate(${object.rotation} ${cx} ${cy})">
        <rect x="${object.x}" y="${object.y}" width="${object.w}" height="${object.h}" rx="0.06"></rect>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(0.1, Math.min(object.w, object.h) * 0.27)}">${escapeHtml(location.code)}</text>
      </g>`;
  }).join('');
  const fixtures = state.layout.layout.fixtures.map((fixture) => renderFixtureSvg(fixture, true)).join('');

  elements.plannerStage.innerHTML = `
    <svg id="plannerSvg" class="planner-svg" viewBox="${-0.2} ${-0.2} ${width + 0.4} ${height + 0.4}" role="img" aria-label="Room layout editor">
      <defs><pattern id="plannerGrid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse"><path d="M ${grid} 0 L 0 0 0 ${grid}" class="planner-grid-line" fill="none"></path></pattern></defs>
      <rect class="planner-floor" x="0" y="0" width="${width}" height="${height}" rx="0.05"></rect>
      <rect class="planner-grid" x="0" y="0" width="${width}" height="${height}" fill="url(#plannerGrid)"></rect>
      ${fixtures}${locationSvg}
    </svg>`;

  $$('#plannerStage .planner-element').forEach((element) => {
    element.addEventListener('pointerdown', startPlannerDrag);
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      selectPlannerElement(element.dataset.plannerType, element.dataset.plannerId);
    });
  });
  $('#plannerSvg')?.addEventListener('click', () => selectPlannerElement(null, null));
}

function selectPlannerElement(type, id) {
  state.plannerSelected = type ? { type, id } : null;
  renderPlannerCanvas();
  renderPlannerInspector();
}

function renderPlannerInspector() {
  const selection = state.plannerSelected;
  const object = getPlannerObject();
  const exists = Boolean(selection && object);
  elements.plannerSelectionEmpty.hidden = exists;
  elements.plannerSelection.hidden = !exists;
  if (!exists) return;

  if (selection.type === 'location') {
    const location = state.locations.find((entry) => String(entry.id) === String(selection.id));
    elements.plannerSelectionTitle.textContent = location ? `${location.code} · ${location.name}` : 'Storage location';
    elements.removePlannerElement.textContent = 'Reset position';
  } else {
    elements.plannerSelectionTitle.textContent = `${(object.kind || 'fixture').replace(/^./, (c) => c.toUpperCase())}`;
    elements.removePlannerElement.textContent = 'Delete element';
  }
  elements.plannerX.value = round(object.x);
  elements.plannerY.value = round(object.y);
  elements.plannerW.value = round(object.w);
  elements.plannerH.value = round(object.h);
  elements.plannerRotation.value = String(object.rotation || 0);
}

function plannerPoint(event) {
  const svg = $('#plannerSvg');
  if (!svg) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX; point.y = event.clientY;
  const matrix = svg.getScreenCTM();
  return matrix ? point.matrixTransform(matrix.inverse()) : null;
}

function startPlannerDrag(event) {
  if (state.me.role !== 'admin') return;
  event.preventDefault();
  event.stopPropagation();
  const type = event.currentTarget.dataset.plannerType;
  const id = event.currentTarget.dataset.plannerId;
  selectPlannerElement(type, id);
  const object = getPlannerObject({ type, id });
  const point = plannerPoint(event);
  if (!object || !point) return;
  state.plannerDrag = { type, id, offsetX: point.x - object.x, offsetY: point.y - object.y };
}

function plannerPointerMove(event) {
  if (!state.plannerDrag || !state.layout) return;
  const point = plannerPoint(event);
  const object = getPlannerObject(state.plannerDrag);
  if (!point || !object) return;
  object.x = snap(clamp(point.x - state.plannerDrag.offsetX, 0, Math.max(0, state.layout.width - object.w)));
  object.y = snap(clamp(point.y - state.plannerDrag.offsetY, 0, Math.max(0, state.layout.height - object.h)));
  renderPlannerCanvas();
  renderPlannerInspector();
}

function plannerPointerUp() {
  state.plannerDrag = null;
}

function updatePlannerSelectionFromInputs() {
  const object = getPlannerObject();
  if (!object || !state.layout) return;
  object.w = clamp(Number(elements.plannerW.value) || object.w, 0.1, state.layout.width);
  object.h = clamp(Number(elements.plannerH.value) || object.h, 0.1, state.layout.height);
  object.x = snap(clamp(Number(elements.plannerX.value) || 0, 0, Math.max(0, state.layout.width - object.w)));
  object.y = snap(clamp(Number(elements.plannerY.value) || 0, 0, Math.max(0, state.layout.height - object.h)));
  object.rotation = Number(elements.plannerRotation.value) || 0;
  renderPlannerCanvas();
  renderPlannerInspector();
}

function updatePlannerDimensions() {
  if (!state.layout) return;
  state.layout.width = clamp(Number(elements.plannerWidth.value) || state.layout.width, 1, 50);
  state.layout.height = clamp(Number(elements.plannerHeight.value) || state.layout.height, 1, 50);
  Object.keys(state.layout.layout.locations).forEach((id) => {
    state.layout.layout.locations[id] = normalizePlanObject(state.layout.layout.locations[id], state.layout.width, state.layout.height);
  });
  state.layout.layout.fixtures = state.layout.layout.fixtures.map((fixture) => ({ ...fixture, ...normalizePlanObject(fixture, state.layout.width, state.layout.height) }));
  renderPlanner();
  renderRoomPlan();
}

function autoArrangePlanner() {
  if (!state.layout) return;
  const defaults = autoLayoutForLocations(state.layout.width, state.layout.height);
  state.locations.forEach((location) => { state.layout.layout.locations[String(location.id)] = defaults[location.id]; });
  state.plannerSelected = null;
  renderPlanner();
  renderRoomPlan();
  toast('Locations auto-arranged');
}

function addPlannerFixture(kind) {
  if (!state.layout) return;
  const fixture = {
    id: `fx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label: kind === 'obstacle' ? 'Obstacle' : '',
    x: snap(Math.max(0.15, state.layout.width / 2 - 0.4)),
    y: snap(Math.max(0.15, state.layout.height / 2 - 0.2)),
    w: kind === 'door' ? 0.9 : kind === 'window' ? 1.0 : 0.8,
    h: kind === 'door' || kind === 'window' ? 0.1 : 0.55,
    rotation: 0,
  };
  fixture.w = Math.min(fixture.w, state.layout.width);
  fixture.h = Math.min(fixture.h, state.layout.height);
  state.layout.layout.fixtures.push(fixture);
  state.plannerSelected = { type: 'fixture', id: fixture.id };
  renderPlanner();
  renderRoomPlan();
}

function removePlannerSelection() {
  if (!state.plannerSelected || !state.layout) return;
  if (state.plannerSelected.type === 'fixture') {
    state.layout.layout.fixtures = state.layout.layout.fixtures.filter((fixture) => String(fixture.id) !== String(state.plannerSelected.id));
  } else {
    const location = state.locations.find((entry) => String(entry.id) === String(state.plannerSelected.id));
    const defaults = autoLayoutForLocations(state.layout.width, state.layout.height);
    if (location) state.layout.layout.locations[String(location.id)] = defaults[location.id] || { x: 0.2, y: 0.2, w: 0.6, h: 0.4, rotation: 0 };
  }
  state.plannerSelected = null;
  renderPlanner();
  renderRoomPlan();
}

function layoutPayload() {
  const locations = {};
  Object.entries(state.layout.layout.locations).forEach(([id, object]) => {
    locations[id] = {
      x: round(object.x), y: round(object.y), w: round(object.w), h: round(object.h), rotation: Number(object.rotation) || 0,
    };
  });
  const fixtures = state.layout.layout.fixtures.map((fixture) => ({
    id: String(fixture.id), kind: String(fixture.kind || 'obstacle'), label: String(fixture.label || ''),
    x: round(fixture.x), y: round(fixture.y), w: round(fixture.w), h: round(fixture.h), rotation: Number(fixture.rotation) || 0,
  }));
  return { width: round(state.layout.width), height: round(state.layout.height), layout: { locations, fixtures } };
}

async function savePlanner() {
  if (state.me.role !== 'admin' || !state.room || !state.layout) return;
  try {
    const saved = await api(`/api/layout/${state.room.id}`, { method: 'PUT', body: JSON.stringify(layoutPayload()) });
    state.layout = normalizeLayout(saved);
    ensureLocationLayouts();
    renderPlanner();
    renderRoomPlan();
    toast('Room plan saved');
  } catch (error) { toast(error.message); }
}

function openSettings() {
  if (guardKioskAction()) return;
  state.kiosk = getStoredKioskSettings();
  elements.kioskEnabled.checked = state.kiosk.enabled;
  elements.kioskRoom.value = String(state.kiosk.roomId || state.room?.id || '');
  renderPlanner();
  elements.settingsDialog.showModal();
}

function switchSettingsTab(tabButton) {
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab === tabButton));
  $$('.tabpane').forEach((pane) => { pane.hidden = pane.id !== `tab-${tabButton.dataset.tab}`; });
  if (tabButton.dataset.tab === 'users') renderUsers();
  if (tabButton.dataset.tab === 'planner') renderPlanner();
}

function saveKioskSettings() {
  const kiosk = { enabled: elements.kioskEnabled.checked, roomId: Number(elements.kioskRoom.value) || state.room?.id || null };
  state.kiosk = kiosk;
  storeKioskSettings(kiosk);
  setKioskUi(kiosk.enabled);
  elements.settingsDialog.close();
  if (kiosk.enabled) {
    setVisualMode('plan');
    requestKioskFullscreen();
    if (kiosk.roomId) selectRoom(kiosk.roomId);
    toast('Kiosk mode enabled');
  } else {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    elements.kioskGate.hidden = true;
    toast('Kiosk settings saved');
  }
}

async function logout() {
  if (isKioskMode()) { toast('Exit kiosk mode before signing out'); return; }
  try { await api('/api/logout', { method: 'POST', body: '{}' }); }
  finally { window.location.href = '/login'; }
}

function blockKioskBrowserInteractions(event) {
  if (!isKioskMode()) return;
  if (event.type === 'contextmenu' || event.type === 'dragstart') { event.preventDefault(); return; }
  if (event.type === 'wheel' && event.ctrlKey) { event.preventDefault(); return; }
  if (event.type !== 'keydown') return;
  const key = event.key.toLowerCase();
  const modified = event.ctrlKey || event.metaKey;
  const blockedModifiedKeys = new Set(['l', 'r', 't', 'n', 'w', 'o', 's', 'p', 'u', '+', '-', '=']);
  const blockedStandaloneKeys = new Set(['f5', 'f11']);
  if ((modified && blockedModifiedKeys.has(key)) || blockedStandaloneKeys.has(key)) {
    event.preventDefault(); event.stopPropagation();
  }
}

function warnBeforeLeaving(event) {
  if (!isKioskMode()) return;
  event.preventDefault(); event.returnValue = '';
}

function registerEvents() {
  elements.itemForm.addEventListener('submit', saveItem);
  elements.deleteItem.addEventListener('click', deleteCurrentItem);
  elements.addRoom.addEventListener('click', addRoom);
  elements.addLoc.addEventListener('click', addLocation);
  elements.addUser.addEventListener('click', addUser);
  elements.settings.addEventListener('click', openSettings);
  elements.saveKiosk.addEventListener('click', saveKioskSettings);
  elements.logout.addEventListener('click', logout);
  elements.logoutTop.addEventListener('click', logout);
  elements.kioskExit.addEventListener('click', confirmExitKiosk);
  elements.kioskExitFromGate.addEventListener('click', confirmExitKiosk);
  elements.kioskEnterFullscreen.addEventListener('click', requestKioskFullscreen);
  elements.showPlan.addEventListener('click', () => setVisualMode('plan'));
  elements.showCabinets.addEventListener('click', () => setVisualMode('locations'));

  elements.roomSelect.addEventListener('change', () => selectRoom(Number(elements.roomSelect.value)));
  elements.clearFilter.addEventListener('click', () => setActiveLocation(''));
  elements.add.addEventListener('click', (event) => guardKioskAction(event) || openItem());
  elements.fab.addEventListener('click', (event) => guardKioskAction(event) || openItem());
  elements.q.addEventListener('input', applyItemFilters);

  $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchSettingsTab(tab)));
  $$('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

  elements.savePlanner.addEventListener('click', savePlanner);
  elements.autoArrange.addEventListener('click', autoArrangePlanner);
  elements.addDoor.addEventListener('click', () => addPlannerFixture('door'));
  elements.addWindow.addEventListener('click', () => addPlannerFixture('window'));
  elements.addObstacle.addEventListener('click', () => addPlannerFixture('obstacle'));
  elements.removePlannerElement.addEventListener('click', removePlannerSelection);
  elements.plannerWidth.addEventListener('change', updatePlannerDimensions);
  elements.plannerHeight.addEventListener('change', updatePlannerDimensions);
  [elements.plannerX, elements.plannerY, elements.plannerW, elements.plannerH, elements.plannerRotation]
    .forEach((input) => input.addEventListener('change', updatePlannerSelectionFromInputs));
  document.addEventListener('pointermove', plannerPointerMove);
  document.addEventListener('pointerup', plannerPointerUp);

  document.addEventListener('fullscreenchange', syncKioskGate);
  document.addEventListener('contextmenu', blockKioskBrowserInteractions);
  document.addEventListener('dragstart', blockKioskBrowserInteractions);
  document.addEventListener('keydown', blockKioskBrowserInteractions, true);
  document.addEventListener('wheel', blockKioskBrowserInteractions, { passive: false, capture: true });
  window.addEventListener('beforeunload', warnBeforeLeaving);
}

registerEvents();
boot().catch((error) => {
  console.error(error);
  toast(error.message || 'Unable to start the application');
});
