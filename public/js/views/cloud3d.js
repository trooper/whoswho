// The Cloud: every fun thing guests said is a 3D cloud whose weather comes
// from its words. One at a time, a cloud floats to the front and its words
// show big enough to read across the room. Anonymous: no names on this screen.

import { h } from '../dom.js';
import { VIBES, groups, forecast, dominant } from '../weather.js';

const MAX_CLOUDS = 35; // in the sky at once; older ones still count in the legend
const FOCUS_MS = 9000; // each fun thing's turn at the front
const HOLD_MS = 15000; // after someone taps a cloud, or a new one arrives
const FLIP_PX = 170; // drag the card this far (stage px), or fling it, to flip

export function createCloudView(root, { geo, onInteract }) {
  const canvas = h('canvas', { width: 1920, height: 1080, 'aria-label': '3D sky of clouds, one per fun thing guests said, each with weather that matches its words' });
  const toast = h('div.cw-toast.off', { role: 'status' });
  const spotQ = h('q');
  const spotChip = h('span');
  const spot = h('section.cw-spot.off', { 'aria-live': 'polite' }, spotQ, h('p', '— someone in this room ', spotChip));
  const hint = h('p.cw-hint', 'Swipe the card for the next one · tap any cloud to read it');
  const forecastEl = h('p');
  const chips = h('div.cw-chips');
  const countEl = h('b', '0');
  root.append(
    canvas, toast, spot, hint,
    h('header.cw-top',
      h('div.paper-plate.cw-plate', h('h1', 'The Cloud'), forecastEl, chips),
      h('div.mz-stats',
        h('div.paper-stat', countEl, h('span', 'fun things')),
        h('div.paper-stat', h('b', '0'), h('span', 'names shown'))),
    ),
  );

  let clouds = []; // in the sky: {id, t, by, vibe}
  let all = []; // every fun thing, for the legend and forecast
  let spotId = null;
  let touched = 0;
  let engine = null;
  let visible = false;
  let timer = null;
  let toastT;

  function boot() {
    if (engine || !window.THREE || !window.WWCloud) return;
    engine = window.WWCloud.create(canvas, {
      vibes: VIBES,
      groups,
      boroughs: geo.boroughs,
      getSpot: () => spotId,
    });
    render();
    engine.snap();
  }

  function renderSpot() {
    const c = clouds.find((x) => x.id === spotId);
    spot.classList.toggle('off', !c);
    if (!c) return;
    const v = VIBES[c.vibe] || VIBES.mist;
    spotQ.textContent = c.t;
    // shorter words get bigger type
    spot.dataset.len = c.t.length > 90 ? 'long' : c.t.length > 45 ? 'mid' : 'short';
    spotChip.textContent = `${v.weather} · ${v.name}`;
    spotChip.style.background = v.cloud;
  }

  // from: -1/1 slides the card in from that side (a flip); otherwise it drops in
  function focus(id, from = 0) {
    spotId = id;
    spot.style.transition = 'none';
    spot.style.opacity = '';
    if (from) {
      spot.style.transform = `translateX(${from * 900}px) rotate(${from * 4}deg)`;
      engine?.setNudge(from * 700, false, true);
      void spot.offsetWidth;
      spot.style.transition = '';
      spot.style.transform = '';
      renderSpot();
      return;
    }
    spot.style.transform = '';
    // replay the card's entrance so each turn reads as new
    spot.classList.add('off');
    void spot.offsetWidth;
    spot.style.transition = '';
    renderSpot();
  }

  function neighbour(dir) {
    const i = clouds.findIndex((c) => c.id === spotId);
    return clouds[((i < 0 ? 0 : i + dir) % clouds.length + clouds.length) % clouds.length].id;
  }

  function next() {
    if (!clouds.length) return focus(null);
    focus(neighbour(1));
  }

  // dir 1 = next (card thrown to the left), -1 = previous
  function flip(dir) {
    if (clouds.length < 2) return settle();
    touched = Date.now();
    onInteract?.();
    const to = neighbour(dir);
    spot.style.transition = 'transform 0.22s ease-in, opacity 0.22s';
    spot.style.transform = `translateX(${-dir * 1400}px) rotate(${-dir * 10}deg)`;
    spot.style.opacity = '0';
    clearTimeout(flipT);
    flipT = setTimeout(() => focus(to, dir), 200);
  }

  function settle() {
    spot.style.transition = '';
    spot.style.transform = '';
    engine?.setNudge(0, false);
  }

  // ----------------------------------------------------------- gestures
  // Grab the card (or anywhere in the sky) and drag it sideways to flip;
  // tap a cloud to bring it to the front.
  let grab = null;
  let flipT;
  let wheelAcc = 0;
  let wheelAt = 0;
  const k = () => 1920 / (root.getBoundingClientRect().width || 1920);
  root.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || grab) return;
    grab = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, moved: 0, t: performance.now(), vx: 0, onCard: spot.contains(e.target) };
    touched = Date.now(); // a hand on the sky holds the slideshow
    try { root.setPointerCapture(e.pointerId); } catch { /* fine */ }
  });
  root.addEventListener('pointermove', (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    const now = performance.now();
    const dx = (e.clientX - grab.x) * k();
    grab.vx = (dx - grab.dx) / Math.max(1, now - grab.t);
    grab.t = now;
    grab.dx = dx;
    grab.moved = Math.max(grab.moved, Math.abs(dx), Math.abs(e.clientY - grab.y) * k());
    if (grab.moved < 8 || !spotId) return;
    spot.style.transition = 'none';
    spot.style.transform = `translateX(${dx}px) rotate(${-0.8 + dx * 0.012}deg)`;
    engine?.setNudge(dx, true);
  });
  const release = (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    const g = grab;
    grab = null;
    if (g.moved < 8) { // a tap
      if (e.type === 'pointercancel') return;
      const id = engine?.pick(e.clientX, e.clientY);
      touched = Date.now();
      onInteract?.();
      if (id && id !== spotId) focus(id);
      else if (g.onCard) flip(1);
      return;
    }
    touched = Date.now();
    if (Math.abs(g.dx) > FLIP_PX || (Math.abs(g.dx) > 60 && Math.abs(g.vx) > 0.7)) flip(g.dx < 0 ? 1 : -1);
    else settle();
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  // a trackpad swipe (or mouse wheel) flips too
  root.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (performance.now() - wheelAt < 700) return;
    wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(wheelAcc) < 90) return;
    flip(wheelAcc > 0 ? 1 : -1);
    wheelAcc = 0;
    wheelAt = performance.now();
  }, { passive: false });

  function render() {
    const sky = (VIBES[dominant(all)] || VIBES.mist).sky;
    root.style.background = `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 70%, #F6E7D2 100%)`;
    forecastEl.textContent = forecast(all);
    countEl.textContent = all.length;
    chips.replaceChildren(
      ...groups(all, 'vibe').map((g) => h('span.cw-chip', h('i', { style: { background: g.color } }), g.label, ' ', h('b', g.count))),
    );
    renderSpot();
    if (engine) {
      engine.sync(clouds, 'drift');
      engine.setSky(sky[1]);
    }
  }

  function tick() {
    if (grab || Date.now() - touched < HOLD_MS) return;
    next();
  }

  return {
    hasData: ({ secrets }) => secrets.length > 0,

    update({ secrets }) {
      all = secrets;
      clouds = secrets.slice(-MAX_CLOUDS).map((s) => ({ id: `s${s.id}`, t: s.text, by: s.by, vibe: s.vibe }));
      if (spotId && !clouds.some((c) => c.id === spotId)) spotId = null;
      if (!spotId && clouds.length) spotId = clouds[clouds.length - 1].id;
      render();
    },

    /** Something fun just arrived: toast it and bring it to the front. */
    highlight(secret) {
      if (!secret) return;
      const v = VIBES[secret.vibe] || VIBES.mist;
      toast.textContent = `Something fun just floated in: ${v.weather} · ${v.name}`;
      toast.classList.remove('off');
      clearTimeout(toastT);
      toastT = setTimeout(() => toast.classList.add('off'), 4000);
      touched = Date.now();
      focus(`s${secret.id}`);
    },

    /** Build the 3D scene early (compiles shaders), then sleep until shown. */
    prepare() {
      boot();
      setTimeout(() => { if (!visible) engine?.pause(); }, 3000);
    },

    show() {
      visible = true;
      boot();
      engine?.resume();
      clearInterval(timer);
      timer = setInterval(tick, FOCUS_MS);
    },

    hide() {
      visible = false;
      clearInterval(timer);
      engine?.pause();
    },
  };
}
