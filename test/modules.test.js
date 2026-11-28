import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePostcode, lookupOutcode, jitter, resolveLocation } from '../src/postcode.js';
import { normalizeAvatar, randomAvatar, animalLabel, ANIMALS, COLORS } from '../public/js/animals.js';
import { classify, groups, forecast, dominant, VIBES } from '../public/js/weather.js';
import { project } from '../public/js/geo.js';
import { lanAddresses } from '../src/network.js';
import { loadEnvFile } from '../src/env.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('parsePostcode handles full, partial, spacing and case', () => {
  assert.deepEqual(parsePostcode('sw1a 1aa'), { postcode: 'SW1A 1AA', outcode: 'SW1A' });
  assert.deepEqual(parsePostcode('E81AB'), { postcode: 'E8 1AB', outcode: 'E8' });
  assert.deepEqual(parsePostcode(' e8 '), { postcode: 'E8', outcode: 'E8' });
  assert.deepEqual(parsePostcode('n1c'), { postcode: 'N1C', outcode: 'N1C' });
  assert.deepEqual(parsePostcode('SE15 4QF'), { postcode: 'SE15 4QF', outcode: 'SE15' });
  assert.equal(parsePostcode('hello'), null);
  assert.equal(parsePostcode(''), null);
  assert.equal(parsePostcode(42), null);
});

test('lookupOutcode knows London districts and not others', () => {
  assert.equal(lookupOutcode('E8').area, 'Hackney');
  assert.ok(lookupOutcode('SW11'));
  assert.equal(lookupOutcode('M1'), null); // Manchester
});

test('jitter is deterministic and bounded (150–450 m)', () => {
  const a = jitter(51.5, -0.1, 'seed');
  assert.deepEqual(a, jitter(51.5, -0.1, 'seed'));
  assert.notDeepEqual(a, jitter(51.5, -0.1, 'other'));
  for (const s of ['1', '2', '3', 'x', 'y']) {
    const p = jitter(51.5, -0.1, s);
    const dy = (p.lat - 51.5) * 111320;
    const dx = (p.lng + 0.1) * 111320 * Math.cos((51.5 * Math.PI) / 180);
    const d = Math.hypot(dx, dy);
    assert.ok(d >= 149 && d <= 451, `distance ${d}`);
  }
});

test('resolveLocation stores what was typed, places known districts only', () => {
  const known = resolveLocation('e8 3pb', 1);
  assert.equal(known.postcode, 'E8 3PB');
  assert.equal(known.area, 'Hackney');
  assert.ok(known.known && typeof known.lat === 'number');
  const unknown = resolveLocation('M1 1AE', 1);
  assert.equal(unknown.postcode, 'M1 1AE');
  assert.equal(unknown.lat, null);
  assert.equal(resolveLocation('', 1).postcode, null);
  assert.equal(resolveLocation('not a postcode', 1).lat, null);
});

test('normalizeAvatar whitelists the zoo and maps old 2D avatars', () => {
  assert.deepEqual(normalizeAvatar({ animal: 'lion', color: 'mint', hat: '<script>' }), { animal: 'lion', color: 'mint' });
  // old ids under another name
  assert.equal(normalizeAvatar({ animal: 'bunny' }).animal, 'rabbit');
  assert.equal(normalizeAvatar({ animal: 'puppy' }).animal, 'dog');
  // old ids that the zoo now has itself
  assert.deepEqual(normalizeAvatar({ animal: 'axolotl', bg: 'sky' }), { animal: 'axolotl', color: 'blue' });
  for (const id of ['parrot', 'sloth', 'redpanda']) assert.equal(normalizeAvatar({ animal: id }).animal, id);
  // pre-spirit-animal avatars still get a stable, valid animal
  const old = { skin: 'honey', hair: 'buzz', hat: 'cap', bg: 'mint' };
  const a = normalizeAvatar(old);
  assert.ok(ANIMALS.includes(a.animal) && COLORS.includes(a.color));
  assert.deepEqual(normalizeAvatar({ ...old }), a, 'same old spec -> same animal');
  for (const x of [null, 'nope', {}]) {
    const n = normalizeAvatar(x);
    assert.ok(ANIMALS.includes(n.animal) && COLORS.includes(n.color));
  }
  const r = randomAvatar();
  assert.deepEqual(normalizeAvatar(r), r);
});

test('the zoo has 66 animals, the same list the 2D and 3D engines draw', () => {
  assert.equal(ANIMALS.length, 66);
  assert.equal(new Set(ANIMALS).size, 66);
  const src = (f) => fs.readFileSync(new URL(`../public/js/3d/${f}`, import.meta.url), 'utf8');
  const kinds = src('ww-zoo.js').match(/Z\.kinds = \[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map((q) => q.slice(1, -1));
  assert.deepEqual(kinds, ANIMALS);
  for (const f of ['ww-zoo.js', 'ww-zoo3d.js']) {
    const cases = new Set([...src(f).matchAll(/case '([a-z]+)':/g)].map((m) => m[1]));
    assert.deepEqual(ANIMALS.filter((a) => !cases.has(a)), [], `${f} draws every animal`);
  }
  assert.equal(animalLabel('polarbear'), 'Polar bear');
  assert.equal(animalLabel('redpanda'), 'Red panda');
  assert.equal(animalLabel('axolotl'), 'Axolotl');
});

test('classify turns a secret into weather', () => {
  const cases = {
    'plays piano by ear and never learned to read music': 'creative',
    "can't whistle, at all": 'rainy',
    'can’t whistle (curly apostrophe)': 'rainy',
    'ran a marathon dressed as a teapot': 'happy',
    'hitchhiked from Lisbon to Istanbul': 'wander',
    'speaks five languages and swears in seven': 'storm',
    'ran a supper club out of a launderette': 'foodie',
    'keeps bees on a rooftop': 'nature',
    'has a twin nobody here has met': 'mist',
  };
  for (const [text, vibe] of Object.entries(cases)) assert.equal(classify(text), vibe, text);
  assert.equal(classify(''), 'mist');
  assert.ok(Object.keys(VIBES).every((k) => VIBES[k].sky.length === 2));
});

test('groups, dominant and forecast read the room', () => {
  const s = [
    { id: 1, vibe: 'happy', by: 'self' },
    { id: 2, vibe: 'happy', by: 'friend' },
    { id: 3, vibe: 'nature', by: 'friend' },
  ];
  const byVibe = groups(s, 'vibe');
  assert.deepEqual(byVibe.map((g) => [g.key, g.count]), [['happy', 2], ['nature', 1]]);
  assert.equal(byVibe[0].label, 'Giggly · Hilarious');
  assert.deepEqual(groups(s, 'voice').map((g) => [g.label, g.count]), [['Overheard by friends', 2], ['In their own words', 1]]);
  assert.equal(dominant(s), 'happy');
  assert.equal(dominant([]), 'mist');
  assert.equal(forecast(s), 'Tonight’s forecast: scattered giggles, with a fresh breeze from the great outdoors.');
  assert.equal(forecast([]), 'Clear skies, for now.');
});

test('project puts Charing Cross at the origin, km east/north', () => {
  assert.deepEqual(project(51.5074, -0.1278), [0, 0]);
  const [x, y] = project(51.5074 + 1 / 110.57, -0.1278);
  assert.ok(Math.abs(x) < 1e-9 && Math.abs(y - 1) < 1e-9);
});

test('loadEnvFile fills process.env from a file without overriding the shell', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whoswho-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'WHOSWHO_TEST_FROM_FILE="file"\nABU_TEST_SHELL_WINS=file\n');
  process.env.WHOSWHO_TEST_SHELL_WINS = 'shell';
  try {
    assert.equal(loadEnvFile(file), true);
    assert.equal(process.env.WHOSWHO_TEST_FROM_FILE, 'file');
    assert.equal(process.env.WHOSWHO_TEST_SHELL_WINS, 'shell');
    assert.equal(loadEnvFile(path.join(dir, 'missing')), false);
  } finally {
    delete process.env.WHOSWHO_TEST_FROM_FILE;
    delete process.env.WHOSWHO_TEST_SHELL_WINS;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test('lanAddresses prefers private Wi-Fi/Ethernet over VPN and link-local', () => {
  const list = lanAddresses({
    lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    utun3: [{ family: 'IPv4', address: '10.8.0.2', internal: false }],
    en0: [{ family: 'IPv4', address: '192.168.1.23', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
    en5: [{ family: 'IPv4', address: '169.254.10.1', internal: false }],
  });
  assert.equal(list[0].address, '192.168.1.23');
  assert.ok(!list.some((a) => a.address.startsWith('169.254')));
});
