// The Map: a 3D zoo over paper London. Every guest is a spirit animal hopping
// on their postcode district. The tour is about the people: each card shows the
// fun things they said about themselves, big enough to read across the room.

import { h } from '../dom.js';
import { PALETTE, animalLabel } from '../animals.js';
import { project } from '../geo.js';

const RIVER = ['Richmond upon Thames', 'Kingston upon Thames', 'Hounslow', 'Hammersmith and Fulham', 'Wandsworth', 'Kensington and Chelsea', 'Westminster', 'Lambeth', 'City of London', 'Southwark', 'Tower Hamlets', 'Greenwich', 'Newham', 'Barking and Dagenham', 'Bexley', 'Havering', 'Lewisham'];
const PAPER = ['#F2D3A8', '#EDB9A0', '#BFDCB0', '#B5CDE8', '#EFCB7E', '#D9B6DC', '#F5C7A3'];
const TOUR_MS = 7000;
const HOLD_MS = 15000; // after someone taps an animal (or a new guest lands)
const READ_MS = 14000; // time on a guest who said something: long enough to read it
const WIDE_EVERY = 6; // a wide shot of London between every few guests
const MAX_FACTS = 3;
const WEATHER_MS = 50000; // each spell of weather
// The room's mood sets the weather, the same way it does in the Cloud.
const BY_VIBE = { wander: 'sunny', foodie: 'sunny', nature: 'breezy', rainy: 'rain', happy: 'snow', creative: 'rainbow', mist: 'fog', storm: 'thunder' };
const WEATHER = {
  sunny: ['Sunny spells', 'rgba(255, 196, 110, 0.1)'],
  breezy: ['A fresh breeze', 'rgba(190, 225, 170, 0.06)'],
  rain: ['Light drizzle', 'rgba(80, 100, 135, 0.2)'],
  snow: ['Snow', 'rgba(235, 242, 252, 0.22)'],
  rainbow: ['Rainbows', 'rgba(255, 200, 225, 0.07)'],
  fog: ['Pea-souper fog', 'rgba(244, 243, 238, 0.32)'],
  thunder: ['Thunderstorms', 'rgba(45, 45, 85, 0.3)'],
};
const DEFAULT_SKY = ['sunny', 'breezy', 'rain', 'rainbow', 'snow', 'fog', 'thunder'];
// /home?weather=snow holds one kind of weather (handy for trying them out)
const PINNED = new URLSearchParams(location.search).get('weather');

export function createMapView(root, { geo, onInteract }) {
  const canvas = h('canvas', { width: 1920, height: 1080, 'aria-label': 'Paper pop-up model of London with landmarks, parks and traffic, and a hopping spirit animal for each guest' });
  const pinsEl = h('div.mz-pins', { 'aria-hidden': 'true' });
  const lead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  for (const [k, v] of Object.entries({ x1: 0, y1: 0, x2: 0, y2: 0, stroke: '#C2553A', 'stroke-width': 3, 'stroke-dasharray': '10 8', 'stroke-linecap': 'round', opacity: 0 })) lead.setAttribute(k, v);
  const leadSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leadSvg.setAttribute('class', 'mz-lead');
  leadSvg.setAttribute('width', 1920);
  leadSvg.setAttribute('height', 1080);
  leadSvg.append(lead);

  const card = h('section.mz-card.off', { 'aria-live': 'polite' });
  const titleEl = h('h1', "Who's here?");
  const guestStat = h('b', '0');
  const factStat = h('b', '0');
  const tint = h('div.mz-tint', { 'aria-hidden': 'true' });
  const flashEl = h('div.mz-flash', { 'aria-hidden': 'true' });
  const wxEl = h('p.mz-wx', { 'aria-live': 'polite' });
  const zoomBtn = (label, f, sym) => h('button', { type: 'button', 'aria-label': label, title: label, onclick: () => map?.zoomBy(f) }, sym);
  root.append(
    canvas, tint, pinsEl, leadSvg, card, flashEl,
    h('header.mz-top',
      h('div.paper-plate', titleEl, h('p', 'the zoo has come to London'), wxEl),
      h('div.mz-stats',
        h('div.paper-stat', guestStat, h('span', 'animals in town')),
        h('div.paper-stat', factStat, h('span', 'fun things said'))),
    ),
    h('div.mz-zoom', zoomBtn('Zoom in', 0.7, '+'), zoomBtn('Zoom out', 1 / 0.7, '−')),
    h('p.mz-note', 'Every animal is a guest. Tap one · drag to turn · pinch or scroll to zoom · two fingers to move'),
  );

  let guests = []; // guests on the map, in marker order
  let secrets = [];
  let pinEls = [];
  let focus = -1;
  let touched = 0;
  let tourAt = 0;
  let tour = null;
  let focusedAt = 0;
  let life = null;
  let weatherAt = 0;
  let weatherTimer = null;
  let lastKind = null;
  let map = null;
  let visible = false;

  const focusById = (id) => guests.findIndex((g) => g.id === id);

  function setFocus(i) {
    focus = i;
    focusedAt = Date.now();
    renderCard();
  }

  function onFlash() {
    flashEl.classList.remove('on');
    void flashEl.offsetWidth;
    flashEl.classList.add('on');
  }

  // Weather on a long loop, led by what the room has been saying: the most
  // common moods come round first, with the rest of the sky for variety.
  function nextWeather() {
    const counts = {};
    for (const s of secrets) { const k = BY_VIBE[s.vibe] || 'fog'; counts[k] = (counts[k] || 0) + 1; }
    const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const order = [...ranked, ...DEFAULT_SKY.filter((k) => !ranked.includes(k))];
    const kind = WEATHER[PINNED] ? PINNED : order[(order.indexOf(lastKind) + 1) % order.length];
    setWeather(kind, counts[kind] || 0);
  }

  function setWeather(kind, n) {
    lastKind = kind;
    weatherAt = Date.now();
    life?.setWeather(kind);
    const [label, color] = WEATHER[kind];
    tint.style.backgroundColor = color;
    wxEl.textContent = n
      ? `${label} over London, brought on by ${n} fun ${n === 1 ? 'thing' : 'things'} said tonight`
      : `${label} over London`;
  }

  function boot() {
    if (map || !window.THREE || !window.WWMap) return;
    const Z = window.WWZoo;
    const Z3 = window.WWZoo3D;
    map = window.WWMap(canvas, {
      boroughs: geo.boroughs,
      thames: geo.thames,
      theme: {
        fog: 0xF1E0C6, fogNear: 70, fogFar: 170, ground: 0xEAD7BA,
        heights: (bi, n) => (RIVER.includes(n) ? 0.6 : 0.3 + ((bi * 37) % 4) * 0.075), bevel: 0, inset: 0.99,
        bor: PAPER,
        borColor: (bi) => PAPER[(bi * 3) % 7],
        borMat: (T, c) => new T.MeshLambertMaterial({ color: new T.Color(c) }),
        edge: 0xFFFFFF, edgeOp: 1,
        riverMat: (T) => new T.MeshLambertMaterial({ color: 0x86B8EA, side: T.DoubleSide }), riverW: 0.32,
        shadowBounds: 24, shadowSize: 4096,
        hemi: [0xFFF4E4, 0xB89A74, 0.5], sun: [0xFFF1DD, 0.72],
      },
      cam: { wide: { r: 23, phi: 0.82, tx: 1.0, tz: -0.8 }, focus: { r: 14, phi: 0.9, side: 3.2, lift: 0.5 } },
      labelScale: 24,
      marker: (ctx, g, i, at, delay) => Z3.marker(ctx, g, i, at, g.c1, { delay }),
      extras: (ctx) => {
        const city = Z.city(ctx, { traffic: () => true, clouds: () => true });
        life = window.WWLife ? window.WWLife.create(ctx, { onFlash }) : null;
        return { update: (t, dt, f) => { city.update?.(t, dt, f); life?.update(t, dt, f); } };
      },
      input: root,
      getFocus: () => focus,
      onPick: (i) => { touched = Date.now(); setFocus(i); onInteract?.(); },
      onTouch: () => { touched = Date.now(); onInteract?.(); },
      pins: () => pinEls,
      lead: () => lead,
      cardAt: [1010, 300],
    });
    syncMarkers();
  }

  function syncMarkers() {
    if (!map) return;
    map.setGuests(guests);
  }

  function renderPins() {
    pinEls = guests.map((g) => h('div.mz-pin', { style: { opacity: 0 } }, g.name, h('small', animalLabel(g.animal))));
    pinsEl.replaceChildren(...pinEls);
  }

  function renderCard() {
    const g = guests[focus];
    card.classList.toggle('off', !g);
    if (!g) return;
    const facts = secrets.filter((s) => s.aboutId === g.id);
    const shown = facts.slice(-MAX_FACTS).reverse();
    card.replaceChildren(
      h('span.mz-kind', [g.code, g.area].filter(Boolean).join(' · ') || 'London'),
      h('h2', `${g.name}, the ${animalLabel(g.animal).toLowerCase()}`),
      h('p.mz-sub', facts.length === 0 ? 'Hasn’t said anything fun yet' : facts.length === 1 ? 'Something fun about them' : `${facts.length} fun things about them`),
      ...(shown.length
        ? shown.map((f) => h('p.mz-fact', h('q', f.text), f.by === 'friend' ? h('small', 'Overheard by a friend') : null))
        : [h('p.mz-fact.empty', h('q', 'Say something fun about you, from your phone.'))]),
    );
  }

  function step() {
    if (!visible || Date.now() - touched < HOLD_MS || !guests.length) return;
    // stay on a person long enough to read what's on their card
    const g = guests[focus];
    const dwell = g && secrets.some((x) => x.aboutId === g.id) ? READ_MS : 0;
    if (Date.now() - focusedAt < dwell) return;
    // the odd wide shot, so the room sees the whole of London
    const seq = [];
    guests.forEach((_, i) => { if (i % WIDE_EVERY === 0) seq.push(-1); seq.push(i); });
    tourAt = (tourAt + 1) % seq.length;
    setFocus(seq[tourAt]);
  }

  return {
    hasData: ({ guests: list }) => list.some((g) => g.lat != null),

    update({ guests: list, secrets: s }) {
      const prevId = guests[focus]?.id;
      guests = list
        .filter((g) => g.lat != null)
        .map((g) => {
          const [x, y] = project(g.lat, g.lng);
          return { ...g, ...g.avatar, x, y, c1: PALETTE[g.avatar.color][0], code: g.outcode, key: `${g.id}:${g.avatar.animal}:${g.avatar.color}` };
        });
      secrets = s;
      guestStat.textContent = guests.length;
      factStat.textContent = secrets.length;
      renderPins();
      syncMarkers();
      focus = prevId == null ? -1 : focusById(prevId);
      renderCard();
    },

    setTitle(t) { titleEl.textContent = t; },

    /** A new guest landed (or said something fun): fly to them. */
    highlight(guestId) {
      const i = focusById(guestId);
      if (i < 0) return;
      touched = Date.now();
      setFocus(i);
    },

    /** Build the 3D scene early (compiles shaders), then sleep until shown. */
    prepare() {
      boot();
      setTimeout(() => { if (!visible) map?.pause(); }, 3000);
    },

    show() {
      visible = true;
      boot();
      map?.resume();
      if (!lastKind || Date.now() - weatherAt > WEATHER_MS) nextWeather();
      clearInterval(weatherTimer);
      weatherTimer = setInterval(nextWeather, WEATHER_MS);
      clearInterval(tour);
      tour = setInterval(step, TOUR_MS);
    },

    hide() {
      visible = false;
      clearInterval(weatherTimer);
      clearInterval(tour);
      map?.pause();
    },
  };
}
