// HTTP Basic auth for admin routes, with Web Crypto only (runs on Node and on
// Cloudflare Workers). Open when no password is set.

const enc = new TextEncoder();
const sha256 = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));

/** Compare digests so timing doesn't leak how much of the password matched. */
async function same(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** @returns {Promise<boolean>} whether this Authorization header may use admin routes */
export async function checkAdmin(header, password) {
  if (!password) return true;
  const [scheme, encoded] = (header || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  let decoded;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  return same(decoded.slice(decoded.indexOf(':') + 1), password);
}
