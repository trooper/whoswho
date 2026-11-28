// The Cloud's weather: what a secret is about decides how its cloud looks.
// Shared by the server (classifies on insert) and the display (legend,
// clusters, forecast). Plain keyword rules, so it is instant and offline.

export const VIBES = {
  wander:   { name: 'Wanderlust',  weather: 'Sunny',      cloud: '#FFF4DA', accent: '#FFC93D', sky: ['#9FD0FF', '#FFE6BF'], forecast: 'sunny spells of wanderlust' },
  creative: { name: 'Creative',    weather: 'Rainbows',   cloud: '#EEDFFF', accent: '#B98CFF', sky: ['#CDB8FF', '#FFDDEB'], forecast: 'rainbows of creativity' },
  happy:    { name: 'Hilarious',   weather: 'Giggly',     cloud: '#FFD3E4', accent: '#FF7AA8', sky: ['#FFB8D2', '#FFF0D6'], forecast: 'scattered giggles' },
  storm:    { name: 'Superpowers', weather: 'Thunder',    cloud: '#6F6BB5', accent: '#FFD84D', sky: ['#6E6AB0', '#C9C3F0'], forecast: 'thunderstorms of hidden talent' },
  foodie:   { name: 'Foodies',     weather: 'Warm front', cloud: '#FFD7BC', accent: '#FF9A4D', sky: ['#FFC9A3', '#FFF1DE'], forecast: 'a warm front of good food' },
  nature:   { name: 'Outdoorsy',   weather: 'Breezy',     cloud: '#D3F2E0', accent: '#3FB36A', sky: ['#A8E2C4', '#F1FAE8'], forecast: 'a fresh breeze from the great outdoors' },
  rainy:    { name: 'Tender',      weather: 'Drizzle',    cloud: '#BAC7DC', accent: '#4F86FF', sky: ['#9FB0CC', '#E6ECF4'], forecast: 'a light drizzle of confessions' },
  mist:     { name: 'Mysterious',  weather: 'Misty',      cloud: '#FFFFFF', accent: '#9D95D6', sky: ['#C9C6E8', '#F4F2FB'], forecast: 'patches of mystery' },
};
export const VIBE_IDS = Object.keys(VIBES);

// Checked in order; the first rule with a matching keyword wins.
const RULES = [
  ['rainy', ["can't", 'cannot', 'burn', 'cried', 'cry', 'lost', 'broke', 'miss ', 'scared', 'afraid', 'alone', 'sad']],
  ['happy', ['teapot', 'socks', 'tattoo', 'pop star', 'camel', 'dressed as', 'high-five', 'high five', 'tickl', 'laugh', 'joke', 'silly', 'karaoke']],
  ['wander', ['countr', 'hitchhik', 'boat', 'suitcase', 'maps', 'lisbon', 'istanbul', 'travel', 'sailed', 'backpack', 'abroad', 'moved to', 'road trip', 'flew']],
  ['storm', ['language', 'record', 'under a minute', 'champion', 'marathon', 'juggl', 'rubik', 'black belt', 'genius', 'world', 'medal', 'won ']],
  ['creative', ['piano', 'music', 'dj', 'band', 'novel', 'wrote', 'magician', 'ballroom', 'danc', 'film', 'extra in', 'paint', 'ukulele', 'sing', 'choir', 'poem', 'guitar', 'draw', 'theatre']],
  ['foodie', ['cook', 'supper', 'sourdough', 'bake', 'chef', 'restaurant', 'food', 'kimchi', 'espresso', 'coffee', 'wine', 'cheese', 'eat', 'ate ']],
  ['nature', ['goat', 'farm', 'bees', 'garden', 'sauna', 'surf', 'swam', 'swim', 'lake', 'mountain', 'hike', 'climb', 'tomato', 'grows', 'forest', 'camp']],
];

export function classify(text) {
  const s = ` ${String(text || '').toLowerCase().replace(/[’‘]/g, "'")} `;
  for (const [vibe, words] of RULES) if (words.some((w) => s.includes(w))) return vibe;
  return 'mist';
}

/** Cluster secrets by vibe or by voice (self / friend), biggest group first. */
export function groups(secrets, mode) {
  const map = new Map();
  for (const c of secrets) {
    const key = mode === 'voice' ? c.by : c.vibe;
    if (!map.has(key)) map.set(key, { key, members: [] });
    map.get(key).members.push(c.id);
  }
  const list = [...map.values()].map((g) => {
    if (mode === 'voice') {
      g.label = g.key === 'self' ? 'In their own words' : 'Overheard by friends';
      g.color = g.key === 'self' ? '#FF7AA8' : '#4F86FF';
    } else {
      const v = VIBES[g.key] || VIBES.mist;
      g.label = `${v.weather} · ${v.name}`;
      g.color = v.accent;
    }
    g.count = g.members.length;
    return g;
  });
  return list.sort((a, b) => b.count - a.count);
}

export function dominant(secrets) {
  return groups(secrets, 'vibe')[0]?.key || 'mist';
}

export function forecast(secrets) {
  const g = groups(secrets, 'vibe');
  if (!g.length) return 'Clear skies, for now.';
  const a = VIBES[g[0].key].forecast;
  const b = g[1] && VIBES[g[1].key].forecast;
  return `Tonight’s forecast: ${a}${b ? `, with ${b}` : ''}.`;
}
