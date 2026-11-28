// Wishes: "what do you need in life right now?" Every wish rises as a lantern
// over the night skyline, with the guest's name, so people who can help go and
// say hi. Guests can send as many as they like; the sky never runs out.

import { h } from '../dom.js';

const SKYLINE = `<svg class="wi-sky" viewBox="0 0 1920 300" preserveAspectRatio="none" aria-hidden="true">
<path fill="#1B1240" d="M0 300V214h60v-18h40v26h34v-40h28v40h46v-62l30-14 30 14v62h40v-30h52v-56h18v-20h14v20h18v56h44v52h36v-80h10l6-60 6 60h10v80h52v-34c0-22 18-40 40-40s40 18 40 40v34h40v-58h70v-26h12v26h44v58h30v-110l52-126 52 126v110h48v-44h56v-66h20l10-24 10 24h20v66h40v44h52v-90c0-18 16-32 34-32s34 14 34 32v90h46v-58h64v-24h10v24h60v58h44v-36h70v36h40v-70h48v70h52V300Z"/>
<g fill="none" stroke="#2A1C55" stroke-width="3"><circle cx="1680" cy="160" r="86"/><path d="M1680 74v172M1594 160h172M1619 99l122 122M1741 99l-122 122"/></g>
<path fill="#2A1C55" d="M1662 246l18-86 18 86z"/>
<path fill="#120B30" d="M0 300v-44c180 10 340-8 520 0s360 18 560 6 380-14 560-4 200 8 280 0V300Z"/>
</svg>`;
const MIN_SPAN = 1500;
const RISE = 14; // px per second at the stage's scale: a slow, drifting climb
const GAP = 70; // vertical room per lantern, so a full sky doesn't pile up

// Drag the sky up to hurry the lanterns along (down sends them back); a
// flick keeps them racing for a moment, then they settle to their slow drift.
const MAX_BOOST = 40; // × normal speed

export function createWishesView(root, { onInteract } = {}) {
  const layer = h('div', { 'aria-label': 'What guests need in life' });
  root.append(
    h('div.wi-stars', { 'aria-hidden': 'true' }),
    layer,
    h('div', { html: SKYLINE }),
    h('header.wi-top', h('h1', 'What do you need in life right now?'), h('p', 'Every lantern is somebody here. If you can help, go and say hi.')),
    h('p.wi-hint', 'Drag the sky up or down to hurry the lanterns along'),
  );

  let lanterns = []; // {id, el, x, off, ph, zp, sp, glow}, one per wish
  let SPAN = MIN_SPAN;
  let raf = 0;
  let T = 0;
  let last = 0;
  let P = 0; // how far the lanterns have risen, in seconds of normal drift
  let boost = 0; // extra speed from a flick, fading away
  let grab = null;

  const kx = () => 1080 / (root.getBoundingClientRect().height || 1080);
  root.addEventListener('pointerdown', (e) => {
    if (grab) return;
    grab = { id: e.pointerId, y: e.clientY, t: performance.now(), v: 0 };
    boost = 0;
    try { root.setPointerCapture(e.pointerId); } catch { /* fine */ }
    root.classList.add('grabbing');
  });
  root.addEventListener('pointermove', (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    const now = performance.now();
    const dy = (e.clientY - grab.y) * kx();
    const dP = -dy / RISE; // the sky follows the hand
    P += dP;
    grab.v = grab.v * 0.6 + (dP / Math.max(0.008, (now - grab.t) / 1000)) * 0.4;
    grab.y = e.clientY;
    grab.t = now;
    onInteract?.();
  });
  const release = (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    // only a recent movement counts as a flick
    if (performance.now() - grab.t < 120) boost = Math.max(-MAX_BOOST, Math.min(MAX_BOOST, grab.v - 1));
    grab = null;
    root.classList.remove('grabbing');
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    boost = Math.max(-MAX_BOOST, Math.min(MAX_BOOST, boost + d * 0.06));
    onInteract?.();
  }, { passive: false });
  const mod = (a, m) => ((a % m) + m) % m;

  // Same golden-ratio spread as the design, seeded per guest so lanterns
  // keep their place when the list changes.
  const seeded = (id, k) => {
    let s = (id * 7919 + k * 104729) % 2147483647 || 1;
    for (let i = 0; i < 3; i++) s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  function update({ guests, wishes = [] }) {
    const byId = new Map(guests.map((g) => [g.id, g]));
    const lit = wishes.filter((w) => byId.has(w.guestId));
    const n = Math.max(1, lit.length);
    SPAN = Math.max(MIN_SPAN, n * GAP);
    const old = new Map(lanterns.map((l) => [l.id, l]));
    lanterns = lit.map((w, i) => {
      const g = byId.get(w.guestId);
      const prev = old.get(w.id);
      const el = h('div.wi-ln', h('div.wi-lamp', { 'aria-hidden': 'true' }, h('i')),
        h('div.wi-tx', h('q', w.text), h('span', [g.name, g.area].filter(Boolean).join(' · '))));
      return {
        id: w.id, el,
        x: 170 + ((i * 0.618034) % 1) * 1580,
        off: prev ? prev.off : (i / n) * SPAN + seeded(w.id, 1) * 120,
        ph: seeded(w.id, 2) * 6.28, zp: seeded(w.id, 3) * 6.28, sp: 0.8 + seeded(w.id, 4) * 0.5,
        glow: prev?.glow || 0,
      };
    });
    layer.replaceChildren(...lanterns.map((l) => l.el));
  }

  /** A new wish: launch its lantern from the rooftops, up front and glowing. */
  function highlight(wishId) {
    const l = lanterns.find((x) => x.id === wishId);
    if (!l) return;
    l.zp = Math.PI / 2 - T * 0.06; // close to the viewer (z = 1)…
    const speed = RISE * l.sp * (0.55 + 0.6);
    l.off = mod(-P * speed, SPAN); // …and starting at the rooftops
    l.glow = 8;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    T += dt;
    if (!grab) {
      P += dt * (1 + boost);
      boost *= Math.exp(-dt * 0.7);
      if (Math.abs(boost) < 0.01) boost = 0;
    }
    for (const w of lanterns) {
      const z = 0.5 + 0.5 * Math.sin(T * 0.06 + w.zp);
      const sc = 0.42 + 0.68 * z;
      const y = 1160 - mod(P * RISE * w.sp * (0.55 + z * 0.6) + w.off, SPAN);
      const x = w.x + Math.sin(T * 0.15 + w.ph) * 40 + (w.x - 960) * (z - 0.5) * 0.25;
      const fadeIn = Math.min(1, (1160 - y) / 260);
      const fadeOut = Math.min(1, (y + 340) / 380);
      const op = Math.max(0, Math.min(fadeIn, fadeOut)) * (0.35 + 0.65 * z);
      const el = w.el;
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,0) scale(${sc.toFixed(3)}) rotate(${(Math.sin(T * 0.25 + w.ph) * 3).toFixed(2)}deg)`;
      el.style.opacity = op.toFixed(3);
      el.style.filter = z < 0.45 ? `blur(${((0.45 - z) * 6).toFixed(2)}px)` : 'none';
      el.style.zIndex = String(Math.round(z * 100));
      el.classList.toggle('glow', w.glow > 0);
      if (w.glow > 0) w.glow -= dt;
      el.children[1].style.opacity = Math.max(0, Math.min(1, (z - 0.35) * 3)).toFixed(2);
    }
  }

  return {
    hasData: ({ wishes = [] }) => wishes.length > 0,
    update,
    highlight,
    show() {
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    hide() {
      cancelAnimationFrame(raf);
    },
  };
}
