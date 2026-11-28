// Postcode -> district (outcode) centroid, using the bundled London table.
// Guests are deliberately placed at district level (plus a small deterministic
// jitter) rather than at their exact postcode.

import OUTCODES from '../data/outcodes.json' with { type: 'json' };

const FULL_RE = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/;
const OUTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

/** 'sw1a 1aa' -> { postcode: 'SW1A 1AA', outcode: 'SW1A' }; null if not postcode-shaped. */
export function parsePostcode(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  const full = s.match(FULL_RE);
  if (full) return { postcode: `${full[1]} ${full[2]}`, outcode: full[1] };
  if (OUTCODE_RE.test(s)) return { postcode: s, outcode: s };
  return null;
}

/** District centroid + area label, or null if unknown / outside the M25 table. */
export function lookupOutcode(outcode) {
  const row = OUTCODES[outcode];
  return row ? { lat: row[0], lng: row[1], area: row[2] } : null;
}

// FNV-1a -> [0,1)
function hash01(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/** Offset a point by 150–450 m in a direction derived from `seed` (stable per guest). */
export function jitter(lat, lng, seed) {
  const angle = hash01(`${seed}:a`) * 2 * Math.PI;
  const metres = 150 + hash01(`${seed}:d`) * 300;
  const dLat = (metres * Math.cos(angle)) / 111_320;
  const dLng = (metres * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * Resolve user input to what we store.
 * @returns {{postcode:string|null, area:string|null, lat:number|null, lng:number|null, known:boolean}}
 */
export function resolveLocation(raw, seed) {
  const empty = { postcode: null, area: null, lat: null, lng: null, known: false };
  if (raw == null || String(raw).trim() === '') return empty;
  const parsed = parsePostcode(String(raw));
  if (!parsed) return { ...empty, postcode: String(raw).trim().toUpperCase().slice(0, 10) };
  const hit = lookupOutcode(parsed.outcode);
  if (!hit) return { ...empty, postcode: parsed.postcode };
  const p = jitter(hit.lat, hit.lng, `${seed}:${parsed.outcode}`);
  return { postcode: parsed.postcode, area: hit.area, lat: p.lat, lng: p.lng, known: true };
}

export const M25_BOUNDS = [[51.27, -0.52], [51.70, 0.32]];
