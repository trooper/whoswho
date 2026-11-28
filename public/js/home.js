// Display screen: rotates The Map → The Cloud → Wishes, live-updates over SSE.
// Everything is laid out on a fixed 1920×1080 stage that scales to the screen.

import { h, $ } from './dom.js';
import { api, live } from './api.js';
import { animalLabel } from './animals.js';
import { sticker } from './sticker.js';
import { VIBES } from './weather.js';
import { createMapView } from './views/map3d.js';
import { createCloudView } from './views/cloud3d.js';
import { createWishesView } from './views/wishes.js';

const LABELS = { map: 'The Map', cloud: 'The Cloud', wishes: 'Wishes' };
const QR_COPY = {
  map: ['Join the zoo', 'Scan · pick your animal'],
  cloud: ['Say something fun', 'Scan · it floats into the sky'],
  wishes: ['Light your lantern', 'Scan · say what you need'],
  splash: ['Join the zoo', 'Scan · pick your animal'],
};
// Something new arrived: jump to the view that shows it, at most this often.
const JUMP_COOLDOWN_MS = 25_000;

const stage = $('#stage');
const bar = $('#progress');
const sections = Object.fromEntries([...document.querySelectorAll('.view')].map((el) => [el.dataset.view, el]));

let views = {};
let state = { guests: [], secrets: [], wishes: [] };
let settings = { title: "Who's here?", rotateSeconds: 40, views: ['map', 'cloud', 'wishes'] };
let current = null;
let startedAt = 0;
let duration = 0;
let pausedAt = null;
let lastJump = 0;

const mod = (n, m) => ((n % m) + m) % m;
const available = () => settings.views.filter((id) => views[id]?.hasData(state));

// ------------------------------------------------------------------ stage
function fit() {
  const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.setProperty('--k', k.toFixed(4));
}
window.addEventListener('resize', fit);
fit();

// --------------------------------------------------------------- rotation
function nextId(dir) {
  const list = available();
  if (!list.length) return 'splash';
  const order = settings.views;
  const i = order.indexOf(current);
  const start = i === -1 ? (dir > 0 ? -1 : order.length) : i;
  for (let k = 1; k <= order.length; k++) {
    const cand = order[mod(start + dir * k, order.length)];
    if (list.includes(cand)) return cand;
  }
  return 'splash';
}

function activate(id) {
  const prev = current;
  current = id;
  duration = settings.rotateSeconds * 1000;
  startedAt = performance.now();
  if (pausedAt != null) pausedAt = startedAt;
  if (prev !== id) {
    for (const [vid, el] of Object.entries(sections)) el.classList.toggle('active', vid === id);
    views[prev]?.hide();
    views[id]?.show();
  }
  document.body.dataset.view = id;
  const [title, sub] = QR_COPY[id] || QR_COPY.splash;
  $('#qr-title').textContent = title;
  $('#qr-sub').textContent = sub;
  renderTabs();
}

const step = (dir = 1) => activate(nextId(dir));

// Someone is exploring the view (tapping an animal, arranging the sky): give
// it a fresh full slot on screen without re-showing it.
function restartTimer(id) {
  if (current !== id) return;
  startedAt = performance.now();
  if (pausedAt != null) pausedAt = startedAt;
}

/** Show `id` for whatever just arrived, unless we jumped very recently. */
function jumpTo(id) {
  if (!settings.views.includes(id) || pausedAt != null) return false;
  if (current !== id) {
    if (Date.now() - lastJump < JUMP_COOLDOWN_MS) return false;
    lastJump = Date.now();
    activate(id);
  } else restartTimer(id);
  return true;
}

function frame(now) {
  if (views[current]) {
    const t = pausedAt ?? now;
    const p = Math.min(1, (t - startedAt) / duration);
    bar.style.transform = `scaleX(${p})`;
    if (p >= 1 && pausedAt == null) step(1);
  } else {
    bar.style.transform = 'scaleX(0)';
  }
  requestAnimationFrame(frame);
}

function renderTabs() {
  const avail = available();
  $('#tabs').replaceChildren(
    ...settings.views.map((id) =>
      h('button', {
        type: 'button',
        class: `tab${id === current ? ' on' : ''}`,
        disabled: !avail.includes(id),
        'aria-pressed': String(id === current),
        title: avail.includes(id) ? `Show ${LABELS[id]}` : `Nothing on ${LABELS[id]} yet`,
        onclick: () => activate(id),
      }, LABELS[id]),
    ),
  );
}

// ----------------------------------------------------------------- toasts
function toast(...children) {
  const el = h('div.toast', ...children);
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 6000);
  setTimeout(() => el.remove(), 6800);
}

// ------------------------------------------------------------------- data
// /home?view=cloud starts on that view (handy for testing, or to open on it).
let startView = new URLSearchParams(location.search).get('view');

function pushState() {
  for (const v of Object.values(views)) v.update(state);
  if (startView && available().includes(startView)) activate(startView);
  else if (!views[current] || !available().includes(current)) step(1);
  else renderTabs();
  startView = null;
}

async function loadAll() {
  const [guests, secrets, wishes] = await Promise.all([api('GET', '/api/guests'), api('GET', '/api/secrets'), api('GET', '/api/wishes')]);
  state = { guests, secrets, wishes };
  pushState();
}

async function onGuests(e) {
  state = { ...state, guests: await api('GET', '/api/guests') };
  if (e?.type === 'deleted' || e?.type === 'reset') state.secrets = await api('GET', '/api/secrets');
  pushState();
  const g = e?.guest;
  if (!g) return;
  if (e.type === 'created') {
    toast(sticker(g.avatar.animal, 128), h('div', h('small', 'Welcome to the zoo!'), h('b', `${g.name}, the ${animalLabel(g.avatar.animal).toLowerCase()}`)));
    if (g.lat != null && jumpTo('map')) views.map.highlight(g.id);
  }
}

async function onWishes(e) {
  state = { ...state, wishes: await api('GET', '/api/wishes') };
  pushState();
  if (e?.type !== 'created') return;
  if (jumpTo('wishes') || current === 'wishes') views.wishes.highlight(e.wish.id);
  else toast(h('div', h('small', 'A new lantern is rising'), h('b', e.wish.text)));
}

async function onSecrets(e) {
  state = { ...state, secrets: await api('GET', '/api/secrets') };
  pushState();
  if (e?.type !== 'created') return;
  // Something fun about someone: fly to their card on the map, so the room
  // sees who said it. (Anyone not on the map gets the Cloud's spotlight.)
  let who = state.guests.find((g) => g.id === e.secret.aboutId);
  if (!who) { // they may have joined a moment ago, ahead of our guest list
    state = { ...state, guests: await api('GET', '/api/guests') };
    pushState();
    who = state.guests.find((g) => g.id === e.secret.aboutId);
  }
  if (who?.lat != null && settings.views.includes('map') && (jumpTo('map') || current === 'map')) views.map.highlight(who.id);
  else if (jumpTo('cloud') || current === 'cloud') views.cloud.highlight(e.secret);
  else {
    const v = VIBES[e.secret.vibe] || VIBES.mist;
    toast(h('div', h('small', 'Something fun just floated into the cloud'), h('b', `${v.weather} · ${v.name}`)));
  }
}

function applySettings(s) {
  const viewsChanged = JSON.stringify(s.views) !== JSON.stringify(settings.views);
  const timingChanged = s.rotateSeconds !== settings.rotateSeconds;
  settings = s;
  document.title = s.title;
  $('#splash-title').textContent = s.title;
  views.map?.setTitle(s.title);
  if (viewsChanged || !settings.views.includes(current)) step(1);
  else if (timingChanged && views[current]) activate(current);
  else renderTabs();
}

async function loadInfo() {
  const info = await api('GET', '/api/info');
  const short = info.hiUrl.replace(/^https?:\/\//, '');
  document.querySelectorAll('.hi-url').forEach((el) => { el.textContent = short; });
  document.querySelectorAll('img[src^="/api/qr.svg"]').forEach((img) => { img.src = `/api/qr.svg?t=${Date.now()}`; });
}

async function resync() {
  applySettings(await api('GET', '/api/settings'));
  await loadAll();
  loadInfo().catch(() => {});
}

// --------------------------------------------------------------- controls
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === ' ') {
    e.preventDefault();
    if (pausedAt == null) pausedAt = performance.now();
    else { startedAt += performance.now() - pausedAt; pausedAt = null; }
    $('#paused').hidden = pausedAt == null;
  } else if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
});

let idle;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('idle');
  clearTimeout(idle);
  idle = setTimeout(() => document.body.classList.add('idle'), 3000);
});

// ------------------------------------------------------------------ boot
// Keep retrying until the server answers, so a display left on a TV recovers
// by itself if it was opened before the server started.
async function boot() {
  let geo;
  try {
    geo = await fetch('/data/london-3d.json').then((r) => r.json());
    views = {
      map: createMapView(sections.map, { geo, onInteract: () => restartTimer('map') }),
      cloud: createCloudView(sections.cloud, { geo, onInteract: () => restartTimer('cloud') }),
      wishes: createWishesView(sections.wishes, { onInteract: () => restartTimer('wishes') }),
    };
    await resync();
    // Warm up both 3D scenes now, so the first jump to a new guest or
    // secret is instant instead of waiting for shaders to compile.
    views.map.prepare();
    views.cloud.prepare();
  } catch (err) {
    console.error(err);
    views = {};
    for (const el of Object.values(sections)) if (el.dataset.view !== 'splash') el.replaceChildren();
    setTimeout(boot, 3000);
    return;
  }
  requestAnimationFrame(frame);
  live({
    guests: (e) => onGuests(e).catch(() => {}),
    secrets: (e) => onSecrets(e).catch(() => {}),
    wishes: (e) => onWishes(e).catch(() => {}),
    settings: applySettings,
    onResync: () => resync().catch(() => {}),
  });
  setInterval(() => loadInfo().catch(() => {}), 5 * 60_000);
}
boot();
