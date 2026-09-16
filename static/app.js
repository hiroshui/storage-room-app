'use strict';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  roomSelect: $('#roomSelect'),
  settings: $('#settings'),
  logoutTop: $('#logoutTop'),
  profileChip: $('#profileChip'),
  headerAvatar: $('#headerAvatar'),
  headerUsername: $('#headerUsername'),
  add: $('#add'),
  fab: $('#fab'),
  q: $('#q'),
  roomTitle: $('#roomTitle'),
  roomDescription: $('#roomDescription'),
  clearFilter: $('#clearFilter'),
  showPlan: $('#showPlan'),
  showCabinets: $('#showCabinets'),
  showShelves: $('#showShelves'),
  planView: $('#planView'),
  roomPlan: $('#roomPlan'),
  cabinetView: $('#cabinetView'),
  shelfBrowserView: $('#shelfBrowserView'),
  shelfLocationSelect: $('#shelfLocationSelect'),
  shelfBrowserTitle: $('#shelfBrowserTitle'),
  shelfBrowserMeta: $('#shelfBrowserMeta'),
  shelfBrowser: $('#shelfBrowser'),
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
  locationDialog: $('#locationDialog'),
  locationViewTitle: $('#locationViewTitle'),
  locationViewMeta: $('#locationViewMeta'),
  shelfView: $('#shelfView'),
  filterLocationFromView: $('#filterLocationFromView'),
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
  newLocShelves: $('#newLocShelves'),
  locationEditDialog: $('#locationEditDialog'),
  locationEditForm: $('#locationEditForm'),
  editLocCode: $('#editLocCode'),
  editLocName: $('#editLocName'),
  editLocSide: $('#editLocSide'),
  addShelf: $('#addShelf'),
  editShelfList: $('#editShelfList'),
  editLocNotes: $('#editLocNotes'),
  deleteLocationFromDialog: $('#deleteLocationFromDialog'),
  addUser: $('#addUser'),
  newUsername: $('#newUsername'),
  newDisplayName: $('#newDisplayName'),
  newPassword: $('#newPassword'),
  newAvatar: $('#newAvatar'),
  newRole: $('#newRole'),
  newUserRoomAccess: $('#newUserRoomAccess'),
  userDialog: $('#userDialog'),
  userForm: $('#userForm'),
  editUsername: $('#editUsername'),
  editDisplayName: $('#editDisplayName'),
  editPassword: $('#editPassword'),
  editAvatar: $('#editAvatar'),
  editRole: $('#editRole'),
  editActive: $('#editActive'),
  editUserRoomAccess: $('#editUserRoomAccess'),
  accountInfo: $('#accountInfo'),
  accountAvatarPreview: $('#accountAvatarPreview'),
  accountAvatarChoices: $('#accountAvatarChoices'),
  accountDisplayName: $('#accountDisplayName'),
  saveProfile: $('#saveProfile'),
  logout: $('#logout'),
  kioskEnabled: $('#kioskEnabled'),
  kioskRoom: $('#kioskRoom'),
  saveKiosk: $('#saveKiosk'),
  kioskExit: $('#kioskExit'),
  kioskGate: $('#kioskGate'),
  kioskEnterFullscreen: $('#kioskEnterFullscreen'),
  kioskExitFromGate: $('#kioskExitFromGate'),
  viewportMeta: $('#viewportMeta'),
  plannerRoomSelect: $('#plannerRoomSelect'),
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
  roomEditDialog: $('#roomEditDialog'),
  roomEditForm: $('#roomEditForm'),
  editRoomName: $('#editRoomName'),
  editRoomDescription: $('#editRoomDescription'),
  deleteRoomFromDialog: $('#deleteRoomFromDialog'),
  confirmDialog: $('#confirmDialog'),
  confirmTitle: $('#confirmTitle'),
  confirmMessage: $('#confirmMessage'),
  confirmClose: $('#confirmClose'),
  confirmCancel: $('#confirmCancel'),
  confirmAccept: $('#confirmAccept'),
};

const state = {
  me: null,
  csrf: '',
  rooms: [],
  room: null,
  locations: [],
  shelves: [],
  allItems: [],
  items: [],
  layout: null,
  activeLocationCode: '',
  editingItem: null,
  kiosk: { enabled: false, roomId: null },
  visualMode: localStorage.getItem('storage-room-visual-mode') || 'plan',
  plannerSelected: null,
  plannerDrag: null,
  users: [],
  editingUser: null,
  viewingLocation: null,
  shelfBrowserLocationId: null,
  editingLocation: null,
  editingRoom: null,
  previewLocationId: null,
  itemDrag: null,
  profileAvatarDraft: 'robot',
};

const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';
const KIOSK_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
const KIOSK_STORAGE_KEY = 'storage-room-kiosk';
const LAST_ROOM_STORAGE_KEY = 'storage-room-last-room';
const SVG_NS = 'http://www.w3.org/2000/svg';
const SNAP = 0.01;
const AVATAR_TYPES = ['man', 'woman', 'robot'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function normalizeAvatar(value) {
  return AVATAR_TYPES.includes(value) ? value : 'robot';
}

function avatarSvg(type = 'robot') {
  const avatar = normalizeAvatar(type);
  if (avatar === 'man') {
    return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="10" r="5.6" fill="currentColor"></circle>
      <path d="M6.5 28c.7-6.1 4.4-9.2 9.5-9.2s8.8 3.1 9.5 9.2H6.5Z" fill="currentColor"></path>
      <path d="M10.8 7.4c1.2-3.2 8.9-4.2 10.6.1-2.6-1.5-7.9-1.4-10.6-.1Z" fill="currentColor" opacity=".72"></path>
    </svg>`;
  }
  if (avatar === 'woman') {
    return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M9.3 10.3c0-5 3-7.8 6.7-7.8s6.7 2.8 6.7 7.8v5.2c0 1.5.6 3.1 1.8 4.4h-5.2c1.5-1.1 2.4-2.9 2.4-5.2V10c0-3.5-2.2-5.6-5.7-5.6S10.3 6.5 10.3 10v4.7c0 2.3.9 4.1 2.4 5.2H7.5c1.2-1.3 1.8-2.9 1.8-4.4v-5.2Z" fill="currentColor" opacity=".76"></path>
      <circle cx="16" cy="10.7" r="5.2" fill="currentColor"></circle>
      <path d="M6.5 28c.7-5.8 4.5-9 9.5-9s8.8 3.2 9.5 9H6.5Z" fill="currentColor"></path>
    </svg>`;
  }
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M16 3v3" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"></path>
    <circle cx="16" cy="3" r="1.8" fill="currentColor"></circle>
    <rect x="6" y="7" width="20" height="16" rx="5" fill="currentColor"></rect>
    <circle cx="12.5" cy="14" r="2" fill="white"></circle>
    <circle cx="19.5" cy="14" r="2" fill="white"></circle>
    <path d="M11.5 19h9" stroke="white" stroke-width="2" stroke-linecap="round"></path>
    <path d="M9 24v4M23 24v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
  </svg>`;
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

let confirmResolver = null;

function confirmAction({ title = 'Confirm', message = '', confirmLabel = 'Confirm', danger = true } = {}) {
  if (confirmResolver) confirmResolver(false);
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAccept.textContent = confirmLabel;
  elements.confirmAccept.classList.toggle('danger', danger);
  elements.confirmAccept.classList.toggle('secondary', !danger);
  elements.confirmDialog.showModal();
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function resolveConfirm(value) {
  if (elements.confirmDialog.open) elements.confirmDialog.close();
  const resolve = confirmResolver;
  confirmResolver = null;
  if (resolve) resolve(Boolean(value));
}

function installPointerSorter(container, itemSelector, handleSelector, onCommit) {
  if (!container) return;

  const insertionTarget = (dragged, clientX, clientY) => {
    const candidates = [...container.querySelectorAll(itemSelector)].filter((entry) => entry !== dragged);
    if (!candidates.length) return null;

    const rects = candidates.map((candidate) => ({ candidate, rect: candidate.getBoundingClientRect() }));
    const wrapsAcrossColumns = rects.some((entry, index) => index > 0
      && Math.abs(entry.rect.top - rects[index - 1].rect.top) < Math.min(entry.rect.height, rects[index - 1].rect.height) * 0.45);

    // Shelf editors and other one-column lists should be sorted strictly by
    // their vertical midpoint. Using X there makes a left-side drag handle
    // unintentionally bias every drop toward "before".
    if (!wrapsAcrossColumns) {
      for (const { candidate, rect } of rects) {
        if (clientY < rect.top + rect.height / 2) return candidate;
      }
      return null;
    }

    // Compare the pointer with the rendered card centres in DOM order. This works
    // for both a one-column list and a wrapping CSS grid, including the empty area
    // after the last card (where elementFromPoint() cannot return a drop target).
    for (const { candidate, rect } of rects) {
      const centerX = rect.left + rect.width / 2;

      if (clientY < rect.top) return candidate;
      if (clientY <= rect.bottom && clientX < centerX) return candidate;
    }
    return null; // Explicitly means "append after the last item".
  };

  container.querySelectorAll(handleSelector).forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      const item = handle.closest(itemSelector);
      if (!item) return;

      event.preventDefault();
      event.stopPropagation();
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let lastBefore = undefined;

      item.classList.add('sorting');
      document.body.classList.add('is-sorting');
      try { handle.setPointerCapture(pointerId); } catch { /* optional */ }

      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) moved = true;
        if (!moved) return;
        moveEvent.preventDefault();

        const before = insertionTarget(item, moveEvent.clientX, moveEvent.clientY);
        if (before === lastBefore) return;
        lastBefore = before;
        if (before) container.insertBefore(item, before);
        else container.appendChild(item);
      };

      const finish = async (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', onMove, { capture: true });
        window.removeEventListener('pointerup', finish, { capture: true });
        window.removeEventListener('pointercancel', finish, { capture: true });
        try { handle.releasePointerCapture(pointerId); } catch { /* optional */ }
        item.classList.remove('sorting');
        document.body.classList.remove('is-sorting');
        if (!moved) return;

        const ids = [...container.querySelectorAll(itemSelector)].map((entry) => Number(entry.dataset.id));
        try { await onCommit(ids); } catch (error) { toast(error.message); }
      };

      window.addEventListener('pointermove', onMove, { capture: true, passive: false });
      window.addEventListener('pointerup', finish, { capture: true });
      window.addEventListener('pointercancel', finish, { capture: true });
    });
  });
}

function getShelvesForLocation(locationId) {
  return state.shelves
    .filter((shelf) => Number(shelf.location_id) === Number(locationId))
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id));
}

function itemCountOnShelf(shelfId) {
  return state.allItems.filter((item) => Number(item.shelf_id) === Number(shelfId)).length;
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

async function confirmExitKiosk() {
  const ok = await confirmAction({
    title: 'Exit kiosk mode?',
    message: 'Editing controls and normal browser interaction will be restored on this device.',
    confirmLabel: 'Exit kiosk',
    danger: false,
  });
  if (ok) exitKioskMode();
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

function canWriteItems() {
  return Boolean(state.me?.can_write) && !isKioskMode();
}

function guardWriteAction(event) {
  if (guardKioskAction(event)) return true;
  if (state.me?.can_write) return false;
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  toast('This account has read-only access');
  return true;
}

function hardenSearchAgainstCredentialAutofill() {
  // Password managers occasionally mistake the first text field on the app page
  // for a login username. Give the search field a per-load identity and clear only
  // unsolicited values while the user has not interacted with it.
  let touched = false;
  const uniqueName = `inventory_search_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  elements.q.name = uniqueName;
  elements.q.setAttribute('autocomplete', 'off');
  const markTouched = () => { touched = true; };
  elements.q.addEventListener('beforeinput', markTouched, { once: true });
  elements.q.addEventListener('pointerdown', markTouched, { once: true });
  elements.q.addEventListener('keydown', markTouched, { once: true });

  const clearUnexpectedAutofill = () => {
    if (touched || !elements.q.value) return;
    elements.q.value = '';
    applyItemFilters();
  };
  [0, 80, 250, 800, 1800, 3500].forEach((delay) => window.setTimeout(clearUnexpectedAutofill, delay));
  window.addEventListener('pageshow', () => window.setTimeout(clearUnexpectedAutofill, 50));
}

function renderAvatarPicker(selectedAvatar = state.me?.avatar || 'robot') {
  if (!elements.accountAvatarChoices) return;
  state.profileAvatarDraft = normalizeAvatar(selectedAvatar);
  const labels = { man: 'Man', woman: 'Woman', robot: 'Robot' };
  elements.accountAvatarChoices.innerHTML = AVATAR_TYPES.map((avatar) => `
    <button class="avatar-option${state.profileAvatarDraft === avatar ? ' selected' : ''}" type="button"
      data-avatar="${avatar}" role="radio" aria-checked="${state.profileAvatarDraft === avatar ? 'true' : 'false'}">
      <span class="avatar-option-icon">${avatarSvg(avatar)}</span>
      <span>${labels[avatar]}</span>
    </button>`).join('');
  elements.accountAvatarChoices.querySelectorAll('.avatar-option').forEach((button) => {
    button.addEventListener('click', () => {
      state.profileAvatarDraft = normalizeAvatar(button.dataset.avatar);
      elements.accountAvatarChoices.querySelectorAll('.avatar-option').forEach((entry) => {
        const active = entry.dataset.avatar === state.profileAvatarDraft;
        entry.classList.toggle('selected', active);
        entry.setAttribute('aria-checked', active ? 'true' : 'false');
      });
      elements.accountAvatarPreview.innerHTML = avatarSvg(state.profileAvatarDraft);
    });
  });
}

function renderCurrentUser() {
  if (!state.me) return;
  const avatar = normalizeAvatar(state.me.avatar);
  elements.headerAvatar.innerHTML = avatarSvg(avatar);
  elements.headerUsername.textContent = state.me.username;
  elements.accountAvatarPreview.innerHTML = avatarSvg(avatar);
  elements.accountDisplayName.value = state.me.display_name || '';
  elements.accountInfo.textContent = `@${state.me.username} · ${roleLabel(state.me.role)}`;
  renderAvatarPicker(avatar);
}

async function saveOwnProfile() {
  if (guardKioskAction()) return;
  try {
    const updated = await api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({
        display_name: elements.accountDisplayName.value,
        avatar: state.profileAvatarDraft,
      }),
    });
    state.me = { ...state.me, ...updated, csrf: state.csrf };
    renderCurrentUser();
    if (state.me.role === 'admin') await renderUsers();
    toast('Profile saved');
  } catch (error) { toast(error.message); }
}

async function boot() {
  state.me = await api('/api/me');
  state.csrf = state.me.csrf;
  $$('.admin-only').forEach((element) => {
    if (state.me.role !== 'admin') element.hidden = true;
    else if (!element.classList.contains('tabpane')) element.hidden = false;
  });
  elements.add.hidden = !state.me.can_write;
  elements.fab.hidden = !state.me.can_write;
  renderCurrentUser();
  hardenSearchAgainstCredentialAutofill();

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
  elements.roomDescription.textContent = state.me?.role === 'admin' ? 'Create a room in Settings to get started.' : 'No storage rooms are assigned to this account.';
  elements.roomPlan.innerHTML = `<div class="empty">${state.me?.role === 'admin' ? 'No storage rooms yet.' : 'No rooms assigned.'}</div>`;
  elements.cabinetView.innerHTML = `<p class="empty">${state.me?.role === 'admin' ? 'No storage rooms yet.' : 'No rooms assigned.'}</p>`;
  elements.locations.innerHTML = '';
  elements.items.innerHTML = '<div class="empty">No items found.</div>';
  elements.stats.textContent = '0 items';
}

function renderRoomSelect() {
  const options = state.rooms.map((room) => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join('');
  elements.roomSelect.innerHTML = options;
  elements.kioskRoom.innerHTML = options;
  if (elements.plannerRoomSelect) elements.plannerRoomSelect.innerHTML = options;
  renderRoomEditor();
}

function normalizeLayout(payload) {
  const layout = payload?.layout && typeof payload.layout === 'object' ? payload.layout : {};
  return {
    room_id: payload?.room_id || state.room?.id || null,
    width: clamp(Number(payload?.width) || 4, 1, 50),
    height: clamp(Number(payload?.height) || 3, 1, 50),
    layout: {
      ceiling_height: clamp(Number(layout.ceiling_height) || 2.5, 1.8, 8),
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
  state.previewLocationId = null;
  elements.roomSelect.value = String(selected.id);
  if (elements.plannerRoomSelect) elements.plannerRoomSelect.value = String(selected.id);
  elements.roomTitle.textContent = selected.name;
  elements.roomDescription.textContent = selected.description || '';
  elements.heading.textContent = 'All items';
  localStorage.setItem(LAST_ROOM_STORAGE_KEY, String(selected.id));

  const [locations, shelves, items, layout] = await Promise.all([
    api(`/api/locations?room_id=${selected.id}`),
    api(`/api/shelves?room_id=${selected.id}`),
    api(`/api/items?room_id=${selected.id}`),
    api(`/api/layout?room_id=${selected.id}`),
  ]);

  state.locations = locations;
  state.shelves = shelves;
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
  if (state.visualMode === 'shelves') renderShelfBrowser();
}

function applyItemFilters() {
  const query = elements.q.value.trim().toLocaleLowerCase();
  state.items = state.allItems.filter((item) => {
    if (state.activeLocationCode && item.location_code !== state.activeLocationCode) return false;
    if (!query) return true;
    const haystack = [item.name, item.category, item.notes, item.shelf_name || item.shelf, item.quantity, item.location_code, item.location_name]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  });
  renderItems();
  renderCabinets();
  renderRoomPlan();
  if (elements.locationDialog?.open && state.viewingLocation) renderShelfView(state.viewingLocation);
  if (state.visualMode === 'shelves') renderShelfBrowser();
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
      <span class="code">${escapeHtml(location.code)}</span>
      <div class="loc-copy"><span>${escapeHtml(location.name)}</span><small>${shelfCountForLocation(location)} shelves</small></div>
      <button class="loc-shelf-button" data-shelf-location-id="${location.id}" type="button" aria-label="Open shelves for ${escapeHtml(location.code)}">Shelves</button>
    </div>`).join('');
  elements.locations.innerHTML = `<h2>Locations</h2>${allLocations}${rows}`;
  $$('.loc').forEach((row) => row.addEventListener('click', (event) => {
    if (event.target.closest('.loc-shelf-button')) return;
    setActiveLocation(row.dataset.code);
  }));
  $$('.loc-shelf-button').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    showShelvesForLocation(Number(button.dataset.shelfLocationId));
  }));
}

function renderCabinets() {
  const counts = itemCountsByLocation();
  const matching = matchingLocationIds();
  const canReorder = state.me?.role === 'admin' && !isKioskMode() && state.locations.length > 1;
  const selectedPreview = state.locations.find((entry) => entry.id === Number(state.previewLocationId));

  const cards = state.locations.map((location) => `
    <article class="cabinet-card ${state.activeLocationCode === location.code ? 'active' : ''} ${matching.has(location.id) ? 'search-match' : ''}" data-id="${location.id}">
      ${canReorder ? '<button class="drag-handle location-drag-handle" type="button" aria-label="Reorder storage location" title="Drag to reorder">⋮⋮</button>' : ''}
      <button class="cabinet-main" data-preview-id="${location.id}" type="button">
        <span class="cabinet-code">${escapeHtml(location.code)}</span>
        <span class="cabinet-name">${escapeHtml(location.name)}</span>
        <span class="cabinet-count">${counts[location.id] || 0} items · ${shelfCountForLocation(location)} shelves</span>
        ${location.side ? `<span class="cabinet-side-badge">${escapeHtml(location.side)}</span>` : ''}
      </button>
    </article>`).join('');

  const preview = selectedPreview ? compactShelfPreview(selectedPreview) : '';
  elements.cabinetView.innerHTML = state.locations.length ? `
    <div class="location-overview-copy">
      <span>Tap a location for a quick shelf preview.</span>
      ${canReorder ? '<span>Drag ⋮⋮ to change the global location order and every dropdown.</span>' : ''}
    </div>
    <div id="locationOverviewGrid" class="location-overview-grid">${cards}</div>
    ${preview}` : '<p class="empty">No locations yet. Add one in Settings.</p>';

  elements.cabinetView.querySelectorAll('.cabinet-main').forEach((button) => button.addEventListener('click', () => {
    const id = Number(button.dataset.previewId);
    state.previewLocationId = state.previewLocationId === id ? null : id;
    renderCabinets();
  }));
  elements.cabinetView.querySelector('[data-open-location]')?.addEventListener('click', () => openLocationView(Number(state.previewLocationId)));
  elements.cabinetView.querySelector('[data-filter-location]')?.addEventListener('click', () => {
    const location = state.locations.find((entry) => entry.id === Number(state.previewLocationId));
    if (location) setActiveLocation(location.code);
  });

  if (canReorder) {
    installPointerSorter(
      $('#locationOverviewGrid'),
      '.cabinet-card',
      '.location-drag-handle',
      persistLocationOrder,
    );
  }
  elements.clearFilter.hidden = !state.activeLocationCode;
}

function setVisualMode(mode) {
  state.visualMode = ['plan', 'locations', 'shelves'].includes(mode) ? mode : 'plan';
  localStorage.setItem('storage-room-visual-mode', state.visualMode);
  elements.planView.hidden = state.visualMode !== 'plan';
  elements.cabinetView.hidden = state.visualMode !== 'locations';
  elements.shelfBrowserView.hidden = state.visualMode !== 'shelves';
  elements.showPlan.classList.toggle('active', state.visualMode === 'plan');
  elements.showCabinets.classList.toggle('active', state.visualMode === 'locations');
  elements.showShelves.classList.toggle('active', state.visualMode === 'shelves');
  if (state.visualMode === 'shelves') renderShelfBrowser();
}

function getLocationLayout(locationId) {
  return state.layout?.layout?.locations?.[String(locationId)] || null;
}

function shelfCountForLocation(location) {
  return location ? getShelvesForLocation(location.id).length : 0;
}

function parseShelfNumber(value, maxShelves) {
  const text = String(value || '').trim();
  const match = text.match(/(\d+)/);
  const number = match ? Number(match[1]) : null;
  return Number.isInteger(number) && number >= 1 && number <= maxShelves ? number : null;
}

function updateShelfSuggestions(preferredShelfId = null) {
  const locationId = Number(elements.location.value);
  const shelves = getShelvesForLocation(locationId);
  const previous = preferredShelfId ?? (Number(elements.shelf.value) || null);
  elements.shelf.innerHTML = `<option value="">Unassigned</option>${shelves.map((shelf) => `
    <option value="${shelf.id}">${escapeHtml(shelf.name)}</option>`).join('')}`;
  if (previous && shelves.some((shelf) => shelf.id === Number(previous))) elements.shelf.value = String(previous);
  else elements.shelf.value = '';
}

function shelfItemMarkup(item, queryActive) {
  const isMatch = queryActive && state.items.some((entry) => entry.id === item.id);
  const editable = canWriteItems();
  return `<button class="shelf-item${isMatch ? ' search-match' : ''}${editable ? ' draggable-item' : ' readonly'}" type="button" data-item-id="${item.id}">
    <span class="shelf-item-name">${escapeHtml(item.name)}</span>
    ${item.quantity ? `<span class="shelf-item-qty">${escapeHtml(item.quantity)}</span>` : ''}
  </button>`;
}

function shelfMarkup(location, { compact = false } = {}) {
  const shelves = getShelvesForLocation(location.id);
  const all = state.allItems.filter((item) => Number(item.location_id) === Number(location.id));
  const queryActive = Boolean(elements.q.value.trim());
  const byShelf = new Map(shelves.map((shelf) => [shelf.id, []]));
  const unassigned = [];

  all.forEach((item) => {
    if (item.shelf_id && byShelf.has(Number(item.shelf_id))) byShelf.get(Number(item.shelf_id)).push(item);
    else unassigned.push(item);
  });

  const shelfHtml = shelves.map((shelf) => {
    const items = byShelf.get(shelf.id) || [];
    const hasMatch = queryActive && items.some((item) => state.items.some((entry) => entry.id === item.id));
    const itemMarkup = compact
      ? (items.length ? `<span class="shelf-preview-items">${items.slice(0, 3).map((item) => escapeHtml(item.name)).join(' · ')}${items.length > 3 ? ` +${items.length - 3}` : ''}</span>` : '<span class="shelf-empty">Empty</span>')
      : (items.length ? items.map((item) => shelfItemMarkup(item, queryActive)).join('') : '<span class="shelf-empty">Empty</span>');
    return `<section class="shelf-level${hasMatch ? ' search-match' : ''}" data-shelf-id="${shelf.id}">
      <div class="shelf-label"><span>${escapeHtml(shelf.name)}</span><small>${items.length} item${items.length === 1 ? '' : 's'}</small></div>
      <div class="shelf-items">${itemMarkup}</div>
    </section>`;
  }).join('');

  const custom = !compact && unassigned.length ? `<section class="shelf-unassigned" data-shelf-id="">
      <div class="shelf-label"><span>Unassigned</span><small>${unassigned.length}</small></div>
      <div class="shelf-items">${unassigned.map((item) => shelfItemMarkup(item, queryActive)).join('')}</div>
    </section>` : '';

  return `<div class="shelf-unit${compact ? ' compact' : ''}" style="--shelf-count:${Math.max(1, shelves.length)}">${shelfHtml}</div>${custom}`;
}

function compactShelfPreview(location) {
  const itemCount = state.allItems.filter((item) => Number(item.location_id) === Number(location.id)).length;
  return `<section class="cabinet-inline-preview">
    <div class="cabinet-inline-preview-head">
      <div>
        <strong>${escapeHtml(location.code)} · ${escapeHtml(location.name)}</strong>
        <span>${shelfCountForLocation(location)} shelves · ${itemCount} item${itemCount === 1 ? '' : 's'}</span>
      </div>
      <div class="inline-actions">
        <button class="btn secondary mini" data-filter-location type="button">Show inventory</button>
        <button class="btn mini" data-open-location type="button">Open full view</button>
      </div>
    </div>
    ${shelfMarkup(location, { compact: true })}
  </section>`;
}

async function persistLocationOrder(ids) {
  if (!state.room || state.me?.role !== 'admin') return;
  await api('/api/locations/reorder', {
    method: 'POST',
    body: JSON.stringify({ room_id: state.room.id, location_ids: ids }),
  });
  const lookup = new Map(state.locations.map((location) => [location.id, location]));
  state.locations = ids.map((id, index) => ({ ...lookup.get(id), sort_order: index }));
  fillLocationSelect();
  renderLocations();
  renderCabinets();
  renderLocationEditor();
  if (state.visualMode === 'shelves') renderShelfBrowser();
  toast('Location order saved');
}

async function moveItemToShelf(itemId, shelfId) {
  if (!canWriteItems()) return;
  const item = state.allItems.find((entry) => entry.id === Number(itemId));
  const shelf = state.shelves.find((entry) => entry.id === Number(shelfId));
  if (!item || !shelf || Number(item.location_id) !== Number(shelf.location_id) || Number(item.shelf_id) === Number(shelf.id)) return;
  await api(`/api/items/${item.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: item.name,
      category: item.category,
      location_id: item.location_id,
      shelf_id: shelf.id,
      quantity: item.quantity,
      notes: item.notes,
    }),
  });
  await refreshInventory();
  toast(`Moved to ${shelf.name}`);
}

function bindShelfItemDrag(container) {
  if (!container || !canWriteItems()) return;
  container.querySelectorAll('.shelf-item').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;
      let targetShelfId = null;
      try { button.setPointerCapture(pointerId); } catch { /* optional */ }

      const clearTargets = () => container.querySelectorAll('.shelf-level.drop-target').forEach((row) => row.classList.remove('drop-target'));
      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 8) {
          dragging = true;
          button.classList.add('dragging-item');
        }
        if (!dragging) return;
        clearTargets();
        const under = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const row = under?.closest('.shelf-level[data-shelf-id]');
        targetShelfId = row ? Number(row.dataset.shelfId) : null;
        if (row) row.classList.add('drop-target');
      };
      const onUp = async (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        button.removeEventListener('pointermove', onMove);
        button.removeEventListener('pointerup', onUp);
        button.removeEventListener('pointercancel', onUp);
        clearTargets();
        button.classList.remove('dragging-item');
        if (dragging) {
          button.dataset.dragged = '1';
          window.setTimeout(() => { delete button.dataset.dragged; }, 0);
          if (targetShelfId) {
            try { await moveItemToShelf(Number(button.dataset.itemId), targetShelfId); }
            catch (error) { toast(error.message); }
          }
        }
      };
      button.addEventListener('pointermove', onMove);
      button.addEventListener('pointerup', onUp);
      button.addEventListener('pointercancel', onUp);
    });
  });
}

function bindShelfItemActions(container, { closeDialog = false } = {}) {
  if (!container) return;
  if (canWriteItems()) {
    container.querySelectorAll('.shelf-item').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.dragged) return;
      const item = state.allItems.find((entry) => entry.id === Number(button.dataset.itemId));
      if (!item) return;
      if (closeDialog && elements.locationDialog.open) elements.locationDialog.close();
      openItem(item);
    }));
    bindShelfItemDrag(container);
  }
}

function renderShelfView(location) {
  if (!location || !elements.shelfView) return;
  elements.shelfView.innerHTML = shelfMarkup(location);
  bindShelfItemActions(elements.shelfView, { closeDialog: true });
}

function renderShelfBrowser(locationId = state.shelfBrowserLocationId) {
  if (!elements.shelfBrowser) return;
  if (!state.locations.length) {
    elements.shelfLocationSelect.innerHTML = '';
    elements.shelfBrowserTitle.textContent = 'Shelves';
    elements.shelfBrowserMeta.textContent = '';
    elements.shelfBrowser.innerHTML = '<div class="empty">No storage locations yet.</div>';
    return;
  }
  const requested = Number(locationId);
  const active = state.locations.find((entry) => entry.id === requested)
    || state.locations.find((entry) => entry.code === state.activeLocationCode)
    || state.locations[0];
  state.shelfBrowserLocationId = active.id;
  elements.shelfLocationSelect.innerHTML = state.locations.map((location) => `
    <option value="${location.id}" ${location.id === active.id ? 'selected' : ''}>${escapeHtml(location.code)} · ${escapeHtml(location.name)}</option>`).join('');
  const itemCount = state.allItems.filter((item) => Number(item.location_id) === active.id).length;
  elements.shelfBrowserTitle.textContent = `${active.code} · ${active.name}`;
  elements.shelfBrowserMeta.textContent = `${shelfCountForLocation(active)} shelves · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}${active.side ? ` · ${active.side}` : ''}`;
  elements.shelfBrowser.innerHTML = shelfMarkup(active);
  bindShelfItemActions(elements.shelfBrowser);
}

function showShelvesForLocation(codeOrId) {
  const location = state.locations.find((entry) => entry.code === String(codeOrId) || entry.id === Number(codeOrId));
  if (!location) return;
  state.shelfBrowserLocationId = location.id;
  setVisualMode('shelves');
  renderShelfBrowser(location.id);
}

function openLocationView(codeOrId) {
  const location = state.locations.find((entry) => entry.code === String(codeOrId) || entry.id === Number(codeOrId));
  if (!location) return;
  state.viewingLocation = location;
  const itemCount = state.allItems.filter((item) => Number(item.location_id) === location.id).length;
  elements.locationViewTitle.textContent = `${location.code} · ${location.name}`;
  elements.locationViewMeta.textContent = `${shelfCountForLocation(location)} shelves · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}${location.side ? ` · ${location.side}` : ''}`;
  renderShelfView(location);
  elements.locationDialog.showModal();
}

function filterViewedLocation() {
  if (!state.viewingLocation) return;
  const code = state.viewingLocation.code;
  if (elements.locationDialog.open) elements.locationDialog.close();
  setActiveLocation(code);
  elements.items?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <article class="item ${canWriteItems() ? '' : 'readonly'}" data-id="${item.id}">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="meta">
        <span class="pill locpill">${escapeHtml(item.location_code)}${(item.shelf_name || item.shelf) ? ` · ${escapeHtml(item.shelf_name || item.shelf)}` : ''}</span>
        ${item.category ? `<span class="pill">${escapeHtml(item.category)}</span>` : ''}
        ${item.quantity ? `<span class="pill">${escapeHtml(item.quantity)}</span>` : ''}
      </div>
      ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ''}
    </article>`).join('');

  if (canWriteItems()) {
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
          height: 2.1,
        };
      } else {
        result[location.id] = {
          x: offset,
          y: side === 'top' ? margin : Math.max(margin, height - wallDepth - margin),
          w: span,
          h: wallDepth,
          rotation: 0,
          height: 2.1,
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
      height: 2.1,
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
      state.layout.layout.locations[id] = defaults[location.id] || { x: 0.2, y: 0.2, w: 0.6, h: 0.4, rotation: 0, height: 2.1 };
    }
    state.layout.layout.locations[id] = normalizePlanObject(state.layout.layout.locations[id], state.layout.width, state.layout.height);
  });
  state.layout.layout.fixtures = state.layout.layout.fixtures.map((fixture) => normalizeFixture(fixture, state.layout.width, state.layout.height));
}

function normalizePlanObject(object, roomWidth, roomHeight) {
  const w = clamp(Number(object?.w) || 0.6, 0.1, roomWidth);
  const h = clamp(Number(object?.h) || 0.4, 0.1, roomHeight);
  return {
    x: snap(clamp(Number(object?.x) || 0, 0, Math.max(0, roomWidth - w))),
    y: snap(clamp(Number(object?.y) || 0, 0, Math.max(0, roomHeight - h))),
    w: snap(w),
    h: snap(h),
    rotation: [0, 90, 180, 270].includes(Number(object?.rotation)) ? Number(object.rotation) : 0,
    height: clamp(Number(object?.height) || 2.1, 0.1, Number(state.layout?.layout?.ceiling_height) || 2.5),
  };
}

function isLinearFixture(fixture) {
  return fixture?.kind === 'door' || fixture?.kind === 'window';
}

function normalizeFixture(fixture, roomWidth, roomHeight) {
  if (!isLinearFixture(fixture)) return normalizePlanObject(fixture, roomWidth, roomHeight);

  const rotation = [0, 90, 180, 270].includes(Number(fixture?.rotation)) ? Number(fixture.rotation) : 0;
  const maxLength = rotation % 180 === 0 ? roomWidth : roomHeight;
  const w = snap(clamp(Number(fixture?.w) || (fixture?.kind === 'door' ? 0.9 : 1), 0.1, Math.max(0.1, maxLength)));
  const h = snap(clamp(Number(fixture?.h) || 0.08, 0.01, Math.max(roomWidth, roomHeight)));
  let x = Number(fixture?.x) || 0;
  let y = Number(fixture?.y) || 0;

  // Doors and windows use x/y as an anchor point. This keeps a vertical door at
  // x=0 actually on the left wall instead of rotating it around a box centre.
  if (rotation === 0) {
    x = clamp(x, 0, Math.max(0, roomWidth - w));
    y = clamp(y, 0, roomHeight);
  } else if (rotation === 90) {
    x = clamp(x, 0, roomWidth);
    y = clamp(y, 0, Math.max(0, roomHeight - w));
  } else if (rotation === 180) {
    x = clamp(x, w, roomWidth);
    y = clamp(y, 0, roomHeight);
  } else {
    x = clamp(x, 0, roomWidth);
    y = clamp(y, w, roomHeight);
  }

  return {
    ...fixture,
    x: snap(x),
    y: snap(y),
    w,
    h,
    rotation,
    height: clamp(Number(fixture?.height) || 0.1, 0.01, Number(state.layout?.layout?.ceiling_height) || 2.5),
  };
}

function fixtureEndpoint(fixture, angleOffset = 0) {
  const angle = ((Number(fixture.rotation) || 0) + angleOffset) * Math.PI / 180;
  return {
    x: round(fixture.x + Math.cos(angle) * fixture.w, 4),
    y: round(fixture.y + Math.sin(angle) * fixture.w, 4),
  };
}

function pointInsideRoom(point, margin = 0) {
  return point.x >= margin && point.x <= state.layout.width - margin
    && point.y >= margin && point.y <= state.layout.height - margin;
}

function doorSwingDirection(fixture) {
  // Pick the swing that remains inside the room where possible. This makes doors
  // placed on an outer wall read naturally without requiring another setting.
  const clockwise = fixtureEndpoint(fixture, 90);
  const counterClockwise = fixtureEndpoint(fixture, -90);
  const cwInside = pointInsideRoom(clockwise, -0.001);
  const ccwInside = pointInsideRoom(counterClockwise, -0.001);
  if (cwInside !== ccwInside) return cwInside ? 1 : -1;

  const centre = { x: state.layout.width / 2, y: state.layout.height / 2 };
  const distanceSquared = (point) => ((point.x - centre.x) ** 2) + ((point.y - centre.y) ** 2);
  return distanceSquared(clockwise) <= distanceSquared(counterClockwise) ? 1 : -1;
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
    const shelves = [...new Set(matchingItems.map((item) => item.shelf_name || item.shelf).filter(Boolean))];
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
    element.addEventListener('click', () => openLocationView(element.dataset.code));
  });
}

function renderFixtureSvg(fixture, editable) {
  const f = normalizeFixture(fixture, state.layout.width, state.layout.height);
  const kind = fixture.kind || 'obstacle';
  const classes = `plan-fixture fixture-${kind}${editable ? ' planner-element' : ''}${isPlannerSelected('fixture', fixture.id) ? ' selected' : ''}`;
  const data = editable ? `data-planner-type="fixture" data-planner-id="${escapeHtml(fixture.id)}"` : '';

  if (kind === 'door') {
    const swing = doorSwingDirection(f);
    const closedEnd = fixtureEndpoint(f, 0);
    const openEnd = fixtureEndpoint(f, swing * 90);
    const sweepFlag = swing > 0 ? 1 : 0;
    return `<g class="${classes}" ${data}>
      <title>Door</title>
      <line x1="${f.x}" y1="${f.y}" x2="${closedEnd.x}" y2="${closedEnd.y}" class="fixture-door-frame"></line>
      <line x1="${f.x}" y1="${f.y}" x2="${openEnd.x}" y2="${openEnd.y}" class="fixture-door-leaf"></line>
      <path d="M ${closedEnd.x} ${closedEnd.y} A ${f.w} ${f.w} 0 0 ${sweepFlag} ${openEnd.x} ${openEnd.y}" class="fixture-door-arc"></path>
      <circle cx="${f.x}" cy="${f.y}" r="0.035" class="fixture-hinge"></circle>
      <line x1="${f.x}" y1="${f.y}" x2="${openEnd.x}" y2="${openEnd.y}" class="fixture-hit"></line>
    </g>`;
  }

  if (kind === 'window') {
    const end = fixtureEndpoint(f, 0);
    const angle = Math.atan2(end.y - f.y, end.x - f.x);
    const px = Math.sin(angle) * f.h / 2;
    const py = -Math.cos(angle) * f.h / 2;
    const points = [
      `${f.x + px},${f.y + py}`,
      `${end.x + px},${end.y + py}`,
      `${end.x - px},${end.y - py}`,
      `${f.x - px},${f.y - py}`,
    ].join(' ');
    return `<g class="${classes}" ${data}>
      <title>Window</title>
      <polygon points="${points}" class="fixture-window-body"></polygon>
      <line x1="${f.x}" y1="${f.y}" x2="${end.x}" y2="${end.y}" class="fixture-window-centre"></line>
      <line x1="${f.x}" y1="${f.y}" x2="${end.x}" y2="${end.y}" class="fixture-hit"></line>
    </g>`;
  }

  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const transform = `rotate(${f.rotation} ${cx} ${cy})`;
  return `<g class="${classes}" ${data} transform="${transform}">
    <title>Obstacle</title>
    <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="0.05"></rect>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(0.09, Math.min(f.w, f.h) * 0.24)}">${escapeHtml(fixture.label || 'Obstacle')}</text>
  </g>`;
}

function openItem(item = null) {
  if (guardWriteAction()) return;
  if (!state.locations.length) { toast('Add a location first'); return; }
  state.editingItem = item;
  elements.formTitle.textContent = item ? 'Edit item' : 'Add item';
  elements.name.value = item?.name || '';
  elements.category.value = item?.category || '';
  elements.quantity.value = item?.quantity || '';
  elements.notes.value = item?.notes || '';
  const activeLocation = state.locations.find((location) => location.code === state.activeLocationCode);
  const locationId = item?.location_id || activeLocation?.id || state.locations[0]?.id;
  if (locationId) elements.location.value = String(locationId);
  updateShelfSuggestions(item?.shelf_id || null);
  elements.deleteItem.hidden = !item;
  elements.itemDialog.showModal();
}

async function saveItem(event) {
  event.preventDefault();
  if (guardWriteAction(event)) return;
  const payload = {
    name: elements.name.value,
    category: elements.category.value,
    location_id: Number(elements.location.value),
    shelf_id: elements.shelf.value ? Number(elements.shelf.value) : null,
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
  if (guardWriteAction() || !state.editingItem) return;
  const ok = await confirmAction({
    title: 'Delete item?',
    message: `Delete “${state.editingItem.name}”? This cannot be undone.`,
    confirmLabel: 'Delete item',
  });
  if (!ok) return;
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

function editRoom(id) {
  if (guardKioskAction()) return;
  const room = state.rooms.find((entry) => entry.id === id);
  if (!room) return;
  state.editingRoom = room;
  elements.editRoomName.value = room.name || '';
  elements.editRoomDescription.value = room.description || '';
  elements.roomEditDialog.showModal();
}

async function saveRoomEdit(event) {
  event.preventDefault();
  if (guardKioskAction() || !state.editingRoom) return;
  try {
    await api(`/api/rooms/${state.editingRoom.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: elements.editRoomName.value,
        description: elements.editRoomDescription.value,
        sort_order: state.editingRoom.sort_order,
      }),
    });
    elements.roomEditDialog.close();
    state.editingRoom = null;
    await refreshRooms();
    toast('Room saved');
  } catch (error) { toast(error.message); }
}

async function deleteRoom(id) {
  if (guardKioskAction()) return;
  const room = state.rooms.find((entry) => entry.id === id);
  if (!room) return;
  const ok = await confirmAction({
    title: 'Delete room?',
    message: `Delete “${room.name}”? Empty storage locations in this room will also be removed.`,
    confirmLabel: 'Delete room',
  });
  if (!ok) return;
  try {
    await api(`/api/rooms/${id}`, { method: 'DELETE' });
    if (elements.roomEditDialog.open) elements.roomEditDialog.close();
    state.editingRoom = null;
    await refreshRooms();
    toast('Room deleted');
  } catch (error) { toast(error.message); }
}

async function deleteEditingRoom() {
  if (state.editingRoom) await deleteRoom(state.editingRoom.id);
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
    <div class="editor-row location-editor-row">
      <b>${escapeHtml(location.code)}</b>
      <span class="editor-row-copy"><strong>${escapeHtml(location.name)}</strong><small>${shelfCountForLocation(location)} shelves${location.side ? ` · ${escapeHtml(location.side)}` : ''}</small></span>
      <button class="btn secondary mini edit-loc" data-id="${location.id}" type="button">Edit</button>
      <button class="btn secondary mini view-loc-shelves" data-id="${location.id}" type="button">Shelves</button>
    </div>`).join('') || '<p class="empty compact-empty">No storage locations yet.</p>';
  $$('.edit-loc').forEach((button) => button.addEventListener('click', () => editLocation(Number(button.dataset.id))));
  $$('.view-loc-shelves').forEach((button) => button.addEventListener('click', () => {
    elements.settingsDialog.close();
    showShelvesForLocation(Number(button.dataset.id));
  }));
}

function editLocation(id) {
  if (guardKioskAction()) return;
  const location = state.locations.find((entry) => entry.id === id);
  if (!location) return;
  state.editingLocation = location;
  elements.editLocCode.value = location.code;
  elements.editLocName.value = location.name;
  elements.editLocSide.value = location.side || '';
  elements.editLocNotes.value = location.notes || '';
  renderShelfManager(location.id);
  elements.locationEditDialog.showModal();
}

function renderShelfManager(locationId) {
  const shelves = getShelvesForLocation(locationId);
  const canDeleteAny = shelves.length > 1;
  elements.addShelf.disabled = shelves.length >= 32;
  elements.addShelf.textContent = shelves.length >= 32 ? '32 shelves max' : '+ Shelf';
  elements.editShelfList.innerHTML = shelves.map((shelf) => {
    const count = itemCountOnShelf(shelf.id);
    return `<div class="shelf-editor-row" data-id="${shelf.id}">
      <button type="button" class="drag-handle shelf-drag-handle" aria-label="Reorder ${escapeHtml(shelf.name)}" title="Drag to reorder">⋮⋮</button>
      <input class="shelf-name-input" data-shelf-name="${shelf.id}" value="${escapeHtml(shelf.name)}" aria-label="Shelf name">
      <span class="shelf-editor-count">${count} item${count === 1 ? '' : 's'}</span>
      <button type="button" class="btn danger mini shelf-delete" data-shelf-delete="${shelf.id}" ${!canDeleteAny || count ? 'disabled' : ''} title="${count ? 'Move items before deleting this shelf' : !canDeleteAny ? 'At least one shelf is required' : 'Delete shelf'}">Delete</button>
    </div>`;
  }).join('');

  elements.editShelfList.querySelectorAll('[data-shelf-name]').forEach((input) => {
    input.addEventListener('change', () => renameShelf(Number(input.dataset.shelfName), input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
    });
  });
  elements.editShelfList.querySelectorAll('[data-shelf-delete]').forEach((button) => button.addEventListener('click', () => deleteShelf(Number(button.dataset.shelfDelete))));
  installPointerSorter(elements.editShelfList, '.shelf-editor-row', '.shelf-drag-handle', persistShelfOrder);
}

async function renameShelf(shelfId, name) {
  const shelf = state.shelves.find((entry) => entry.id === Number(shelfId));
  const trimmed = String(name || '').trim();
  if (!shelf || !trimmed || trimmed === shelf.name) {
    if (shelf && !trimmed) renderShelfManager(shelf.location_id);
    return;
  }
  try {
    const updated = await api(`/api/shelves/${shelfId}`, { method: 'PUT', body: JSON.stringify({ name: trimmed }) });
    Object.assign(shelf, updated);
    state.allItems.forEach((item) => { if (Number(item.shelf_id) === shelfId) { item.shelf = updated.name; item.shelf_name = updated.name; } });
    renderShelfManager(shelf.location_id);
    renderCabinets();
    renderShelfBrowser();
    toast('Shelf renamed');
  } catch (error) { toast(error.message); renderShelfManager(shelf.location_id); }
}

async function addShelfToEditingLocation() {
  if (!state.editingLocation || state.me?.role !== 'admin') return;
  try {
    const created = await api('/api/shelves', {
      method: 'POST',
      body: JSON.stringify({ location_id: state.editingLocation.id }),
    });
    state.shelves.push(created);
    const location = state.locations.find((entry) => entry.id === state.editingLocation.id);
    if (location) location.shelf_count = getShelvesForLocation(location.id).length;
    renderShelfManager(state.editingLocation.id);
    renderLocationEditor();
    renderCabinets();
    fillLocationSelect();
    toast('Shelf added');
  } catch (error) { toast(error.message); }
}

async function deleteShelf(shelfId) {
  const shelf = state.shelves.find((entry) => entry.id === Number(shelfId));
  if (!shelf) return;
  const ok = await confirmAction({
    title: 'Delete shelf?',
    message: `Delete “${shelf.name}”? Only empty shelves can be deleted.`,
    confirmLabel: 'Delete shelf',
  });
  if (!ok) return;
  try {
    await api(`/api/shelves/${shelfId}`, { method: 'DELETE' });
    state.shelves = state.shelves.filter((entry) => entry.id !== shelfId);
    const location = state.locations.find((entry) => entry.id === shelf.location_id);
    if (location) location.shelf_count = getShelvesForLocation(location.id).length;
    renderShelfManager(shelf.location_id);
    renderLocationEditor();
    renderCabinets();
    if (state.visualMode === 'shelves') renderShelfBrowser();
    toast('Shelf deleted');
  } catch (error) { toast(error.message); }
}

async function persistShelfOrder(ids) {
  if (!state.editingLocation) return;
  await api('/api/shelves/reorder', {
    method: 'POST',
    body: JSON.stringify({ location_id: state.editingLocation.id, shelf_ids: ids }),
  });
  const lookup = new Map(state.shelves.map((shelf) => [shelf.id, shelf]));
  const reordered = ids.map((id, index) => ({ ...lookup.get(id), sort_order: index }));
  const others = state.shelves.filter((shelf) => Number(shelf.location_id) !== Number(state.editingLocation.id));
  state.shelves = [...others, ...reordered];
  renderShelfManager(state.editingLocation.id);
  if (state.visualMode === 'shelves') renderShelfBrowser(state.editingLocation.id);
  renderCabinets();
  toast('Shelf order saved');
}

async function saveLocationEdit(event) {
  event.preventDefault();
  if (guardKioskAction() || !state.editingLocation || !state.room) return;
  try {
    await api(`/api/locations/${state.editingLocation.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        code: elements.editLocCode.value,
        name: elements.editLocName.value,
        side: elements.editLocSide.value,
        sort_order: state.editingLocation.sort_order,
        notes: elements.editLocNotes.value,
      }),
    });
    elements.locationEditDialog.close();
    state.editingLocation = null;
    await selectRoom(state.room.id);
    toast('Storage location saved');
  } catch (error) { toast(error.message); }
}

async function deleteLocation(id) {
  if (guardKioskAction()) return;
  const location = state.locations.find((entry) => entry.id === id);
  if (!location) return;
  const ok = await confirmAction({
    title: 'Delete storage location?',
    message: `Delete “${location.code} · ${location.name}”? The location must be empty first.`,
    confirmLabel: 'Delete location',
  });
  if (!ok) return;
  try {
    await api(`/api/locations/${id}`, { method: 'DELETE' });
    if (state.layout?.layout?.locations) {
      delete state.layout.layout.locations[String(id)];
      await api(`/api/layout/${state.room.id}`, { method: 'PUT', body: JSON.stringify(layoutPayload()) });
    }
    if (elements.locationEditDialog.open) elements.locationEditDialog.close();
    state.editingLocation = null;
    await selectRoom(state.room.id);
    toast('Storage location deleted');
  } catch (error) { toast(error.message); }
}

async function deleteEditingLocation() {
  if (!state.editingLocation) return;
  await deleteLocation(state.editingLocation.id);
}

async function addLocation() {
  if (guardKioskAction()) return;
  if (!state.room) { toast('Create a room first'); return; }
  const shelfCount = clamp(Math.round(Number(elements.newLocShelves.value) || 5), 1, 32);
  try {
    await api('/api/locations', {
      method: 'POST',
      body: JSON.stringify({
        room_id: state.room.id,
        code: elements.newCode.value,
        name: elements.newLocName.value,
        side: elements.newSide.value,
        shelf_count: shelfCount,
        sort_order: state.locations.length,
      }),
    });
    elements.newCode.value = '';
    elements.newLocName.value = '';
    elements.newSide.value = '';
    elements.newLocShelves.value = '5';
    await selectRoom(state.room.id);
    toast('Storage location added');
  } catch (error) { toast(error.message); }
}

function roleLabel(role) {
  return role === 'readonly' ? 'Read-only' : role === 'admin' ? 'Admin' : 'User';
}

function roomNames(roomIds) {
  const selected = new Set((roomIds || []).map(Number));
  return state.rooms.filter((room) => selected.has(room.id)).map((room) => room.name);
}

function refreshRoomAccessSummary(container, role) {
  if (!container || role === 'admin') return;
  const checked = selectedRoomIds(container);
  const summary = container.querySelector('[data-room-access-summary]');
  if (!summary) return;
  if (!state.rooms.length) {
    summary.textContent = 'No rooms exist yet.';
    return;
  }
  if (!checked.length) {
    summary.textContent = role === 'readonly' ? 'No rooms selected — choose at least one.' : 'No room access.';
    return;
  }
  summary.textContent = `${checked.length} of ${state.rooms.length} rooms selected`;
}

function renderRoomAccess(container, selectedRoomIds, role, emptyCopy = 'No rooms assigned.') {
  if (!container) return;
  if (role === 'admin') {
    container.innerHTML = '<div class="access-note"><strong>All rooms</strong><br>Administrators always have access to every room.</div>';
    return;
  }
  if (!state.rooms.length) {
    container.innerHTML = `<div class="access-note">${escapeHtml(emptyCopy)}</div>`;
    return;
  }
  const selected = new Set((selectedRoomIds || []).map(Number));
  container.innerHTML = `
    <div class="room-access-head">
      <div>
        <strong>Room access</strong>
        <span>${role === 'readonly' ? 'Explicit access: select every room this account may view.' : 'Opt-out access: all rooms start selected; uncheck rooms to hide them.'}</span>
      </div>
      <div class="room-access-actions">
        <button class="btn secondary mini" type="button" data-access-action="all">Select all</button>
        <button class="btn secondary mini" type="button" data-access-action="none">Clear</button>
      </div>
    </div>
    <div class="room-access-grid">
      ${state.rooms.map((room) => `
        <label class="room-access-option">
          <input type="checkbox" value="${room.id}" ${selected.has(room.id) ? 'checked' : ''}>
          <span><b>${escapeHtml(room.name)}</b>${room.description ? `<small>${escapeHtml(room.description)}</small>` : ''}</span>
        </label>`).join('')}
    </div>
    <div class="room-access-summary" data-room-access-summary></div>`;

  container.querySelector('[data-access-action="all"]')?.addEventListener('click', () => {
    container.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = true; });
    refreshRoomAccessSummary(container, role);
  });
  container.querySelector('[data-access-action="none"]')?.addEventListener('click', () => {
    container.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
    refreshRoomAccessSummary(container, role);
  });
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener('change', () => refreshRoomAccessSummary(container, role)));
  refreshRoomAccessSummary(container, role);
}

function selectedRoomIds(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => Number(input.value));
}

function renderNewUserRoomAccess(selectDefaults = false) {
  const role = elements.newRole.value;
  let selected = selectedRoomIds(elements.newUserRoomAccess);
  if (selectDefaults || !elements.newUserRoomAccess.dataset.initialized) {
    selected = role === 'user' ? state.rooms.map((room) => room.id) : [];
  }
  elements.newUserRoomAccess.dataset.initialized = '1';
  renderRoomAccess(elements.newUserRoomAccess, selected, role);
}

function handleNewUserRoleChange() {
  const role = elements.newRole.value;
  const current = selectedRoomIds(elements.newUserRoomAccess);
  const selected = role === 'user'
    ? state.rooms.map((room) => room.id)
    : role === 'readonly' ? current.filter((id) => state.rooms.some((room) => room.id === id)) : [];
  renderRoomAccess(elements.newUserRoomAccess, selected, role);
  elements.newUserRoomAccess.dataset.initialized = '1';
}

function handleEditUserRoleChange() {
  if (!state.editingUser) return;
  const role = elements.editRole.value;
  let selected = selectedRoomIds(elements.editUserRoomAccess);
  if (role === 'user' && state.editingUser.role !== 'user') selected = state.rooms.map((room) => room.id);
  if (role === 'readonly' && state.editingUser.role === 'admin') selected = [];
  if (role === 'admin') selected = [];
  renderRoomAccess(elements.editUserRoomAccess, selected, role);
}

async function renderUsers() {
  if (state.me.role !== 'admin') return;
  state.users = await api('/api/users');
  elements.userEditor.innerHTML = state.users.map((user) => {
    const names = user.role === 'admin' ? ['All rooms'] : roomNames(user.room_ids);
    const accessMarkup = names.length
      ? names.map((name) => `<span class="access-chip">${escapeHtml(name)}</span>`).join('')
      : '<span class="access-chip muted">No rooms</span>';
    return `
      <article class="user-card${user.active ? '' : ' disabled'}">
        <div class="user-avatar" aria-hidden="true">${avatarSvg(user.avatar)}</div>
        <div class="user-card-main">
          <div class="user-card-title">
            <b>${escapeHtml(user.display_name || user.username)}</b>
            <span>@${escapeHtml(user.username)}</span>
          </div>
          <div class="user-card-meta">
            <span class="role-badge role-${escapeHtml(user.role)}">${escapeHtml(roleLabel(user.role))}</span>
            ${user.active ? '' : '<span class="status-badge">Disabled</span>'}
          </div>
          <div class="user-room-chips">${accessMarkup}</div>
        </div>
        <button class="btn secondary user-edit" data-id="${user.id}" type="button">Edit user</button>
      </article>`;
  }).join('') || '<p class="empty compact-empty">No users found.</p>';
  elements.userEditor.querySelectorAll('.user-edit').forEach((button) => button.addEventListener('click', () => {
    editUser(state.users.find((user) => user.id === Number(button.dataset.id)));
  }));
  renderNewUserRoomAccess(!elements.newUserRoomAccess.dataset.initialized);
}

function editUser(user) {
  if (guardKioskAction() || !user) return;
  state.editingUser = user;
  elements.editUsername.value = user.username;
  elements.editDisplayName.value = user.display_name || '';
  elements.editPassword.value = '';
  elements.editAvatar.value = normalizeAvatar(user.avatar);
  elements.editRole.value = user.role;
  elements.editActive.checked = Boolean(user.active);
  renderRoomAccess(elements.editUserRoomAccess, user.room_ids || [], user.role);
  elements.userDialog.showModal();
}

function validateRoomSelection(role, roomIds) {
  if (role === 'readonly' && state.rooms.length && !roomIds.length) {
    throw new Error('Select at least one room for a read-only user');
  }
}

async function saveUser(event) {
  event.preventDefault();
  if (guardKioskAction() || !state.editingUser) return;
  const role = elements.editRole.value;
  const roomIds = role === 'admin' ? [] : selectedRoomIds(elements.editUserRoomAccess);
  try {
    validateRoomSelection(role, roomIds);
    await api(`/api/users/${state.editingUser.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        display_name: elements.editDisplayName.value,
        password: elements.editPassword.value,
        avatar: normalizeAvatar(elements.editAvatar.value),
        role,
        active: elements.editActive.checked,
        room_ids: roomIds,
      }),
    });
    elements.userDialog.close();
    state.editingUser = null;
    await renderUsers();
    toast('User saved');
  } catch (error) { toast(error.message); }
}

async function addUser() {
  if (guardKioskAction()) return;
  const role = elements.newRole.value;
  const roomIds = role === 'admin' ? [] : selectedRoomIds(elements.newUserRoomAccess);
  try {
    validateRoomSelection(role, roomIds);
    await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: elements.newUsername.value,
        display_name: elements.newDisplayName.value,
        password: elements.newPassword.value,
        avatar: normalizeAvatar(elements.newAvatar.value),
        role,
        room_ids: roomIds,
      }),
    });
    elements.newUsername.value = '';
    elements.newDisplayName.value = '';
    elements.newPassword.value = '';
    elements.newAvatar.value = 'robot';
    elements.newRole.value = 'user';
    delete elements.newUserRoomAccess.dataset.initialized;
    renderNewUserRoomAccess(true);
    await renderUsers();
    toast('User added');
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
  if (elements.plannerRoomSelect) elements.plannerRoomSelect.value = String(state.room.id);
  elements.plannerWidth.value = round(state.layout.width);
  elements.plannerHeight.value = round(state.layout.height);
  renderPlannerCanvas();
  renderPlannerInspector();
}

function renderPlannerCanvas() {
  if (!state.layout) return;
  const { width, height } = state.layout;
  const grid = 0.1;
  const majorGrid = 0.5;
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
      <defs>
        <pattern id="plannerGrid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse"><path d="M ${grid} 0 L 0 0 0 ${grid}" class="planner-grid-line minor" fill="none"></path></pattern>
        <pattern id="plannerMajorGrid" width="${majorGrid}" height="${majorGrid}" patternUnits="userSpaceOnUse"><path d="M ${majorGrid} 0 L 0 0 0 ${majorGrid}" class="planner-grid-line major" fill="none"></path></pattern>
      </defs>
      <rect class="planner-floor" x="0" y="0" width="${width}" height="${height}" rx="0.05"></rect>
      <rect class="planner-grid" x="0" y="0" width="${width}" height="${height}" fill="url(#plannerGrid)"></rect>
      <rect class="planner-grid" x="0" y="0" width="${width}" height="${height}" fill="url(#plannerMajorGrid)"></rect>
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

  object.x = snap(point.x - state.plannerDrag.offsetX);
  object.y = snap(point.y - state.plannerDrag.offsetY);
  if (state.plannerDrag.type === 'fixture') Object.assign(object, normalizeFixture(object, state.layout.width, state.layout.height));
  else Object.assign(object, normalizePlanObject(object, state.layout.width, state.layout.height));

  renderPlannerCanvas();
  renderPlannerInspector();
}

function plannerPointerUp() {
  state.plannerDrag = null;
}

function updatePlannerSelectionFromInputs() {
  const object = getPlannerObject();
  if (!object || !state.layout) return;
  object.w = Number(elements.plannerW.value) || object.w;
  object.h = Number(elements.plannerH.value) || object.h;
  object.x = Number(elements.plannerX.value) || 0;
  object.y = Number(elements.plannerY.value) || 0;
  object.rotation = Number(elements.plannerRotation.value) || 0;

  if (state.plannerSelected?.type === 'fixture') Object.assign(object, normalizeFixture(object, state.layout.width, state.layout.height));
  else Object.assign(object, normalizePlanObject(object, state.layout.width, state.layout.height));

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
  state.layout.layout.fixtures = state.layout.layout.fixtures.map((fixture) => ({ ...fixture, ...normalizeFixture(fixture, state.layout.width, state.layout.height) }));
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
    x: snap(Math.max(0, state.layout.width / 2 - (kind === 'door' ? 0.45 : kind === 'window' ? 0.5 : 0.4))),
    y: snap(Math.max(0, state.layout.height / 2)),
    w: kind === 'door' ? 0.9 : kind === 'window' ? 1.0 : 0.8,
    h: kind === 'door' || kind === 'window' ? 0.08 : 0.55,
    rotation: 0,
    height: kind === 'obstacle' ? 0.75 : 0.1,
  };
  Object.assign(fixture, normalizeFixture(fixture, state.layout.width, state.layout.height));
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
    if (location) state.layout.layout.locations[String(location.id)] = defaults[location.id] || { x: 0.2, y: 0.2, w: 0.6, h: 0.4, rotation: 0, height: 2.1 };
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
      height: round(object.height || 2.1),
    };
  });
  const fixtures = state.layout.layout.fixtures.map((fixture) => {
    const normalized = normalizeFixture(fixture, state.layout.width, state.layout.height);
    return {
      id: String(fixture.id), kind: String(fixture.kind || 'obstacle'), label: String(fixture.label || ''),
      x: round(normalized.x), y: round(normalized.y), w: round(normalized.w), h: round(normalized.h), rotation: Number(normalized.rotation) || 0,
      height: round(normalized.height || (fixture.kind === 'obstacle' ? 0.75 : 0.1)),
    };
  });
  return {
    width: round(state.layout.width),
    height: round(state.layout.height),
    layout: { ceiling_height: round(state.layout.layout.ceiling_height || 2.5), locations, fixtures },
  };
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

function openSettings(preferredTabOverride = null) {
  if (guardKioskAction()) return;
  state.kiosk = getStoredKioskSettings();
  elements.kioskEnabled.checked = state.kiosk.enabled;
  elements.kioskRoom.value = String(state.kiosk.roomId || state.room?.id || '');
  const preferredTab = preferredTabOverride || (state.me.role === 'admin' ? 'rooms' : 'kiosk');
  const tab = $(`.tab[data-tab="${preferredTab}"]`);
  if (tab) switchSettingsTab(tab);
  renderPlanner();
  if (preferredTab === 'account') renderCurrentUser();
  elements.settingsDialog.showModal();
}

function switchSettingsTab(tabButton) {
  if (!tabButton || tabButton.hidden) return;
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
  elements.userForm.addEventListener('submit', saveUser);
  elements.locationEditForm.addEventListener('submit', saveLocationEdit);
  elements.roomEditForm.addEventListener('submit', saveRoomEdit);
  elements.deleteItem.addEventListener('click', deleteCurrentItem);
  elements.deleteLocationFromDialog.addEventListener('click', deleteEditingLocation);
  elements.deleteRoomFromDialog.addEventListener('click', deleteEditingRoom);
  elements.addShelf.addEventListener('click', addShelfToEditingLocation);
  elements.addRoom.addEventListener('click', addRoom);
  elements.addLoc.addEventListener('click', addLocation);
  elements.addUser.addEventListener('click', addUser);
  elements.settings.addEventListener('click', openSettings);
  elements.profileChip.addEventListener('click', () => openSettings('account'));
  elements.saveProfile.addEventListener('click', saveOwnProfile);
  elements.saveKiosk.addEventListener('click', saveKioskSettings);
  elements.logout.addEventListener('click', logout);
  elements.logoutTop.addEventListener('click', logout);
  elements.kioskExit.addEventListener('click', confirmExitKiosk);
  elements.kioskExitFromGate.addEventListener('click', confirmExitKiosk);
  elements.kioskEnterFullscreen.addEventListener('click', requestKioskFullscreen);
  elements.showPlan.addEventListener('click', () => setVisualMode('plan'));
  elements.showCabinets.addEventListener('click', () => setVisualMode('locations'));
  elements.showShelves.addEventListener('click', () => setVisualMode('shelves'));

  elements.roomSelect.addEventListener('change', () => selectRoom(Number(elements.roomSelect.value)));
  elements.plannerRoomSelect?.addEventListener('change', async () => {
    await selectRoom(Number(elements.plannerRoomSelect.value));
    const plannerTab = $('.tab[data-tab="planner"]');
    if (plannerTab && elements.settingsDialog.open) switchSettingsTab(plannerTab);
  });
  elements.clearFilter.addEventListener('click', () => setActiveLocation(''));
  elements.add.addEventListener('click', (event) => guardKioskAction(event) || openItem());
  elements.fab.addEventListener('click', (event) => guardKioskAction(event) || openItem());
  elements.q.addEventListener('input', applyItemFilters);
  elements.location.addEventListener('change', () => updateShelfSuggestions());
  elements.shelfLocationSelect.addEventListener('change', () => renderShelfBrowser(Number(elements.shelfLocationSelect.value)));
  elements.filterLocationFromView.addEventListener('click', filterViewedLocation);
  elements.newRole.addEventListener('change', handleNewUserRoleChange);
  elements.editRole.addEventListener('change', handleEditUserRoleChange);

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

  elements.confirmAccept.addEventListener('click', () => resolveConfirm(true));
  elements.confirmCancel.addEventListener('click', () => resolveConfirm(false));
  elements.confirmClose.addEventListener('click', () => resolveConfirm(false));
  elements.confirmDialog.addEventListener('cancel', (event) => { event.preventDefault(); resolveConfirm(false); });

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
