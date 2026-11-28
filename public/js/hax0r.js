// Admin: list / edit / delete guests, moderate secrets, display settings, reset.

import { h, $ } from './dom.js';
import { api, live } from './api.js';
import { ANIMALS, COLORS, PALETTE, animalLabel } from './animals.js';
import { VIBES } from './weather.js';
import { sticker } from './sticker.js';

let guests = [];
let secrets = [];
let wishes = [];
let confirmingId = null;
let confirmingSecret = null;
const dialog = $('#edit-dialog');

const badge = (avatar) =>
  h('span.ad-sticker', { style: { background: PALETTE[avatar.color][1] }, title: animalLabel(avatar.animal) }, sticker(avatar.animal, 96));

// ------------------------------------------------------------------ guests
async function loadGuests() {
  [guests, secrets, wishes] = await Promise.all([api('GET', '/api/admin/guests'), api('GET', '/api/admin/secrets'), api('GET', '/api/wishes')]);
  renderGuests();
  renderSecrets();
}

const fmtTime = (iso) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function renderGuests() {
  const q = $('#filter').value.trim().toLowerCase();
  const shown = [...guests]
    .reverse()
    .filter((g) => !q || [g.name, g.need, g.postcode, g.area, g.avatar.animal].some((v) => v && v.toLowerCase().includes(q)));
  const counts = new Map();
  for (const s of secrets) counts.set(s.aboutId, (counts.get(s.aboutId) || 0) + 1);
  $('#guest-count').textContent = guests.length;
  $('#empty').hidden = guests.length > 0;
  $('#guest-rows').replaceChildren(
    ...shown.map((g) =>
      h('tr', { dataset: { id: g.id } },
        h('td', badge(g.avatar)),
        h('td.ad-name', g.name, h('small.ad-about', `the ${animalLabel(g.avatar.animal).toLowerCase()}`)),
        h('td.ad-need', g.need || h('span.ad-dim', '—'), (() => {
          const n = wishes.filter((w) => w.guestId === g.id).length;
          return n > 1 ? h('small', `+${n - 1} more lantern${n > 2 ? 's' : ''}`) : null;
        })()),
        h('td.ad-loc',
          g.postcode ? h('span', g.postcode) : h('span.ad-dim', '—'),
          g.postcode ? h('small', g.area || 'not on map') : null),
        h('td.ad-dim', String(counts.get(g.id) || 0)),
        h('td.ad-dim', fmtTime(g.createdAt)),
        h('td.ad-actions',
          confirmingId === g.id
            ? [
                h('span.ad-sure', 'Sure?'),
                h('button.ad-btn.danger', { type: 'button', onclick: () => remove(g) }, 'Yes, delete'),
                h('button.ad-btn', { type: 'button', onclick: () => { confirmingId = null; renderGuests(); } }, 'No'),
              ]
            : [
                h('button.ad-btn', { type: 'button', onclick: () => edit(g) }, 'Edit'),
                h('button.ad-btn.danger-ghost', { type: 'button', onclick: () => { confirmingId = g.id; renderGuests(); } }, 'Delete'),
              ],
        ),
      ),
    ),
  );
}

async function remove(g) {
  try {
    await api('DELETE', `/api/admin/guests/${g.id}`);
  } catch (e) {
    if (e.status !== 404) alertInline(e.message);
  }
  confirmingId = null;
  await loadGuests();
}

function edit(g) {
  $('#edit-title').textContent = `Edit ${g.name}`;
  const select = (name, list, value, label) =>
    h('select', { name }, list.map((v) => h('option', { value: v, selected: v === value }, label(v))));
  const status = h('span.ad-status', { role: 'status' });
  const form = h('form.ad-form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api('PUT', `/api/admin/guests/${g.id}`, {
          name: f.name.value, postcode: f.postcode.value,
          avatar: { animal: f.animal.value, color: f.color.value },
        });
        dialog.close();
      } catch (err) {
        status.textContent = err.message;
        status.className = 'ad-status err';
      }
    },
  },
  h('label', 'Name', h('input', { type: 'text', name: 'name', maxlength: 40, value: g.name, required: true })),
  h('div.ad-row',
    h('label', 'Animal', select('animal', ANIMALS, g.avatar.animal, animalLabel)),
    h('label', 'Colour', select('color', COLORS, g.avatar.color, (c) => c))),
  h('label', 'Postcode', h('input', { type: 'text', name: 'postcode', maxlength: 10, value: g.postcode || '' })),
  wishList(g),
  h('div.ad-form-foot',
    h('button.ad-btn.primary', { type: 'submit' }, 'Save changes'),
    h('button.ad-btn', { type: 'button', onclick: () => dialog.close() }, 'Cancel'),
    status));
  $('#edit-body').replaceChildren(form);
  dialog.showModal();
}

// Their lanterns, each deletable on its own (no editing: they're the guest's words).
function wishList(g) {
  const box = h('div.ad-wishes');
  const render = () => {
    const mine = wishes.filter((w) => w.guestId === g.id);
    box.replaceChildren(
      h('span.ad-label', `Lanterns (${mine.length})`),
      ...(mine.length
        ? mine.map((w) => h('div.ad-wish', h('span', w.text),
          h('button.ad-btn.danger-ghost', {
            type: 'button',
            onclick: async () => {
              try { await api('DELETE', `/api/admin/wishes/${w.id}`); } catch (e) { if (e.status !== 404) return alertInline(e.message); }
              wishes = wishes.filter((x) => x.id !== w.id);
              render();
            },
          }, 'Delete')))
        : [h('span.ad-dim', 'No wishes yet')]),
    );
  };
  render();
  return box;
}

// ----------------------------------------------------------------- secrets
function renderSecrets() {
  $('#secret-count').textContent = secrets.length;
  $('#secrets-empty').hidden = secrets.length > 0;
  $('#secret-rows').replaceChildren(
    ...[...secrets].reverse().map((s) => {
      const v = VIBES[s.vibe] || VIBES.mist;
      return h('tr',
        h('td', h('span.ad-vibe', h('i', { style: { background: v.accent } }), `${v.weather} · ${v.name}`)),
        h('td.ad-secret-text', s.text),
        h('td', s.aboutName, h('small.ad-about', s.by === 'self' ? 'about themselves' : 'by a friend')),
        h('td.ad-dim', s.authorName || '—'),
        h('td.ad-dim', fmtTime(s.createdAt)),
        h('td.ad-actions',
          confirmingSecret === s.id
            ? [
                h('button.ad-btn.danger', { type: 'button', onclick: () => removeSecret(s) }, 'Yes, delete'),
                h('button.ad-btn', { type: 'button', onclick: () => { confirmingSecret = null; renderSecrets(); } }, 'No'),
              ]
            : h('button.ad-btn.danger-ghost', { type: 'button', onclick: () => { confirmingSecret = s.id; renderSecrets(); } }, 'Delete')),
      );
    }),
  );
}

async function removeSecret(s) {
  try {
    await api('DELETE', `/api/admin/secrets/${s.id}`);
  } catch (e) {
    if (e.status !== 404) alertInline(e.message);
  }
  confirmingSecret = null;
  await loadGuests();
}
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close(); // click on backdrop
});

function alertInline(msg) {
  const s = $('#reset-status');
  s.textContent = msg;
  s.className = 'ad-status err';
}

$('#filter').addEventListener('input', renderGuests);

// ---------------------------------------------------------------- settings
const sf = $('#settings-form');

function fillSettings(s) {
  sf.title.value = s.title;
  sf.rotateSeconds.value = s.rotateSeconds;
  for (const cb of sf.querySelectorAll('input[name=views]')) cb.checked = s.views.includes(cb.value);
}

function flash(el, msg, ok = true) {
  el.textContent = msg;
  el.className = `ad-status ${ok ? 'ok' : 'err'}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, 4000);
}

sf.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const s = await api('PUT', '/api/settings', {
      title: sf.title.value,
      rotateSeconds: Number(sf.rotateSeconds.value),
      views: [...sf.querySelectorAll('input[name=views]:checked')].map((cb) => cb.value),
    });
    fillSettings(s);
    flash($('#settings-status'), 'Saved ✓ — display updated');
  } catch (err) {
    flash($('#settings-status'), err.message, false);
  }
});

// ------------------------------------------------------------------- reset
$('#reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.confirm;
  if (input.value !== 'DELETE') return flash($('#reset-status'), 'Type DELETE (in capitals) to confirm', false);
  try {
    const r = await api('DELETE', '/api/admin/guests', { confirm: 'DELETE' });
    input.value = '';
    flash($('#reset-status'), `Deleted ${r.deleted} guest${r.deleted === 1 ? '' : 's'} and their secrets`);
    await loadGuests();
  } catch (err) {
    flash($('#reset-status'), err.message, false);
  }
});

// ---------------------------------------------------------------- network
async function loadInfo() {
  const info = await api('GET', '/api/info');
  const row = (label, url) =>
    [h('dt', label), h('dd', h('a', { href: url, target: '_blank' }, url),
      h('button.ad-btn.small', { type: 'button', onclick: (e) => copy(url, e.target) }, 'Copy'))];
  $('#urls').replaceChildren(...row('Display', info.homeUrl), ...row('Register', info.hiUrl), ...row('Admin', info.adminUrl));
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    btn.textContent = 'Select & copy';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
}

// -------------------------------------------------------------------- boot
const boot = async () => {
  fillSettings(await api('GET', '/api/settings'));
  await loadGuests();
  loadInfo().catch(() => {});
};
await boot();
live({
  guests: () => { if (!dialog.open) loadGuests(); },
  secrets: () => { if (!dialog.open) loadGuests(); },
  wishes: () => { if (!dialog.open) loadGuests(); },
  settings: fillSettings,
  onResync: boot,
});
dialog.addEventListener('close', () => loadGuests());
