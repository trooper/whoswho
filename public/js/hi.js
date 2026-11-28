// Phone: join (name, postcode, spirit animal) → say fun things about yourself
// and send wishes, as often as you like. The phone remembers who it is with a
// token from the server.

import { h, $, debounce } from './dom.js';
import { api } from './api.js';
import { ANIMALS, PALETTE, COLORS, animalLabel } from './animals.js';
import { sticker } from './sticker.js';

const KEY = 'whoswho.token';
const main = $('#hi-main');

const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(KEY, t); } catch { /* private mode: works until reload */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

let token = store.get();
let me = null;
// Drop-screen draft survives switching tabs and coming back from "sent".
const draft = { mode: 'fun', text: '', wish: '' };

const auth = () => ({ 'x-guest-token': token || '' });
const stickers = new Map();
const stickerFor = (animal) => {
  if (!stickers.has(animal)) stickers.set(animal, sticker(animal, 192));
  const c = stickers.get(animal);
  const copy = document.createElement('canvas');
  copy.width = copy.height = c.width;
  copy.getContext('2d').drawImage(c, 0, 0);
  return copy;
};

function screen(...children) {
  main.replaceChildren(h('div.scr', ...children));
  window.scrollTo({ top: 0 });
}

function bar() {
  return h('div.bar',
    h('span.mark', 'Who’s here?'),
    me
      ? h('button.me', { type: 'button', title: 'Not you? Join as someone else', onclick: notMe },
        h('i', { style: { background: PALETTE[me.avatar.color][0] } }, stickerFor(me.avatar.animal)),
        me.name, me.outcode ? ` · ${me.outcode}` : '')
      : null,
  );
}

function notMe() {
  if (!window.confirm('Join as someone else on this phone?')) return;
  store.clear();
  token = null;
  me = null;
  showJoin();
}

// --------------------------------------------------------------------- join
function showJoin() {
  const pick = { animal: ANIMALS[Math.floor(Math.random() * ANIMALS.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  const name = h('input.inp#nm', { type: 'text', autocomplete: 'nickname', maxlength: 40, placeholder: 'What do people call you?', required: true });
  const pc = h('input.inp#pc', { type: 'text', autocomplete: 'postal-code', maxlength: 10, placeholder: 'E8, SW4, N16…', autocapitalize: 'characters' });
  const pcHelp = h('p.help', 'Just the first half is fine. We pin the district, never your street.');
  const err = h('p.err', { role: 'alert' });
  const go = h('button.go', { type: 'submit' }, 'Join the zoo');
  const grid = h('div.zoo', { role: 'radiogroup', 'aria-label': 'Spirit animal' });
  const swatches = h('div.sw', { role: 'radiogroup', 'aria-label': 'Token colour' });
  const preview = h('div.pick-preview');

  function renderPick() {
    preview.replaceChildren(
      h('span.pick-art', { style: { background: PALETTE[pick.color][1] } }, stickerFor(pick.animal)),
      h('span', h('b', `The ${animalLabel(pick.animal).toLowerCase()}`), h('small', 'hops on the big map with your name')),
    );
    grid.replaceChildren(...ANIMALS.map((a) =>
      h('button', {
        type: 'button', role: 'radio', class: a === pick.animal ? 'on' : '', 'aria-checked': String(a === pick.animal),
        'aria-label': animalLabel(a), onclick: () => { pick.animal = a; renderPick(); },
      }, stickerFor(a))));
    swatches.replaceChildren(...COLORS.map((c) =>
      h('button', {
        type: 'button', role: 'radio', class: c === pick.color ? 'on' : '', 'aria-checked': String(c === pick.color),
        'aria-label': c, style: { '--c1': PALETTE[c][0], '--c2': PALETTE[c][1] }, onclick: () => { pick.color = c; renderPick(); },
      }, h('i'))));
  }

  const checkPc = debounce(async () => {
    const v = pc.value.trim();
    if (!v) { pcHelp.textContent = 'Just the first half is fine. We pin the district, never your street.'; pcHelp.className = 'help'; return; }
    try {
      const r = await api('GET', `/api/postcode/${encodeURIComponent(v)}`);
      if (!r.valid) { pcHelp.textContent = 'That doesn’t look like a UK postcode.'; pcHelp.className = 'help warn'; }
      else if (!r.known) { pcHelp.textContent = `${r.outcode} isn’t on our London map, but you can still join the cloud.`; pcHelp.className = 'help warn'; }
      else { pcHelp.textContent = `${r.outcode} · ${r.area}. Your animal lands here.`; pcHelp.className = 'help ok'; }
    } catch { /* offline for a moment: no hint */ }
  }, 300);
  pc.addEventListener('input', checkPc);

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!name.value.trim()) { err.textContent = 'Tell us your name first.'; name.focus(); return; }
      go.disabled = true;
      try {
        const r = await api('POST', '/api/guests', { name: name.value, postcode: pc.value, avatar: pick });
        token = r.token;
        me = r.guest;
        store.set(token);
        showDrop({ justJoined: true });
      } catch (ex) {
        err.textContent = ex.message;
        go.disabled = false;
      }
    },
  },
  h('h1', 'Join the ', h('span', 'zoo')),
  h('p.lede', 'Takes ten seconds. Your spirit animal pops up on the big map of London.'),
  h('div.field', h('label', { for: 'nm' }, 'Your name'), name),
  h('div.field', h('label', { for: 'pc' }, 'Postcode'), pc, pcHelp),
  h('div.field', h('label', 'Your spirit animal'), preview, grid),
  h('div.field', h('label', 'Token colour'), swatches),
  err,
  go);

  renderPick();
  screen(bar(), form);
}

// --------------------------------------------------------------------- drop
// Two things to send: something fun about you (on your card on the map, and
// a cloud in the Cloud), or a wish (a lantern with your name on it).
function showDrop({ justJoined = false } = {}) {
  const err = h('p.err', { role: 'alert' });
  const body = h('div.drop-body');
  const go = h('button.go', { type: 'submit' });

  const seg = h('div.seg', { role: 'tablist' });
  function renderSeg() {
    seg.replaceChildren(...[['fun', 'Something fun'], ['wish', 'A wish']].map(([m, label]) =>
      h('button', {
        type: 'button', role: 'tab', class: draft.mode === m ? 'on' : '', 'aria-selected': String(draft.mode === m),
        onclick: () => { draft.mode = m; renderSeg(); renderBody(); },
      }, label)));
  }

  const canSend = () => (draft.mode === 'wish' ? draft.wish.trim().length >= 2 : draft.text.trim().length >= 3);
  const refresh = () => { go.disabled = !canSend(); };

  function renderBody() {
    if (draft.mode === 'wish') {
      go.textContent = 'Send up a lantern';
      const ta = h('textarea.ta#wx', { maxlength: 140, placeholder: '…a tennis partner who won’t go easy', value: draft.wish, oninput: (e) => { draft.wish = e.target.value; refresh(); } });
      body.replaceChildren(
        h('label', { for: 'wx' }, 'What do you need in life right now?'), ta,
        h('p.help', 'It rises as a lantern with your name on it, so people can help. Send as many as you like: every wish is its own lantern.'),
      );
    } else {
      go.textContent = 'Send it';
      const ta = h('textarea.ta#tx', { maxlength: 140, placeholder: '…once won a pie-eating contest in Margate', value: draft.text, oninput: (e) => { draft.text = e.target.value; refresh(); } });
      body.replaceChildren(
        h('label', { for: 'tx' }, 'Say something fun about you'), ta,
        h('p.help', 'It shows on your card on the big map, and floats into the Cloud. Send as many as you like.'),
      );
    }
    refresh();
  }

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!canSend()) return;
      err.textContent = '';
      go.disabled = true;
      try {
        if (draft.mode === 'wish') {
          const r = await api('POST', '/api/wishes', { text: draft.wish }, auth());
          me = r.me;
          draft.wish = '';
          showSent({ mode: 'wish', text: r.wish.text });
        } else {
          const s = await api('POST', '/api/secrets', { text: draft.text, about: 'me' }, auth());
          draft.text = '';
          showSent({ mode: 'fun', text: s.text });
        }
      } catch (ex) {
        if (ex.status === 401) return lostToken();
        err.textContent = ex.message;
        refresh();
      }
    },
  },
  justJoined ? h('div.tick', { role: 'status' }, me.lat != null ? `You’re on the map over ${me.outcode}. Look at the screen!` : 'You’re in! Look at the screen.') : null,
  seg, body, err, go);

  renderSeg();
  renderBody();
  screen(bar(), form);
}

function showSent({ mode, text }) {
  const wish = mode === 'wish';
  screen(
    bar(),
    h('div.sent',
      h('div.float', text),
      h('h2', wish ? 'Your lantern is rising.' : 'It’s on the big screen.'),
      h('p', wish
        ? 'Watch the screen. If someone can help, they’ll come and find you.'
        : 'Look for your card on the map, and for a new cloud in the sky.'),
    ),
    // One way back: the drop screen has the fun / wish switch.
    h('button.go', { type: 'button', onclick: () => { draft.mode = mode; showDrop(); } }, 'Drop another'),
  );
}

// The server was reset (or this guest deleted): start over.
function lostToken() {
  store.clear();
  token = null;
  me = null;
  showJoin();
}

// --------------------------------------------------------------------- boot
api('GET', '/api/settings')
  .then((s) => { if (s.title) document.title = `Join the zoo · ${s.title}`; })
  .catch(() => {});

// A phone that already joined goes straight to dropping secrets. If the
// server is briefly unreachable, retry rather than joining a second time.
function boot() {
  if (!token) return showJoin();
  api('GET', '/api/me', undefined, auth())
    .then((g) => { me = g; showDrop(); })
    .catch((e) => {
      if (e.status === 401) return lostToken();
      screen(bar(), h('p.lede', 'Can’t reach the party server. Trying again…'));
      setTimeout(boot, 2500);
    });
}
boot();
