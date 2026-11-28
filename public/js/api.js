// Fetch helpers + live updates over Server-Sent Events.

export async function api(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.field = data.field;
    err.status = res.status;
    throw err;
  }
  return data;
}

const EVENTS = ['guests', 'secrets', 'wishes', 'settings'];
const SSE_GRACE_MS = 6000; // no "hello" by then: the stream is being buffered
const POLL_MS = 2500;

/**
 * Subscribe to server events. `onResync` fires after every (re)connect so the
 * page can refetch anything it may have missed while disconnected.
 *
 * Uses Server-Sent Events, and falls back to polling /api/poll when they don't
 * get through (some tunnels, like Cloudflare quick tunnels, buffer SSE).
 */
export function live(handlers = {}) {
  const { onResync } = handlers;
  let seq = null; // last event delivered
  let polling = false;

  const deliver = (n, event, data) => {
    if (seq != null && n <= seq) return; // already seen
    seq = n;
    handlers[event]?.(data);
  };

  const es = new EventSource('/api/events');
  let alive = false;
  let connectedBefore = false;
  for (const name of EVENTS) {
    es.addEventListener(name, (e) => deliver(Number(e.lastEventId), name, JSON.parse(e.data)));
  }
  es.addEventListener('hello', (e) => {
    alive = true;
    seq = Number(e.data); // on reconnect too: a restarted server counts from 0 again
  });
  es.addEventListener('open', () => {
    if (connectedBefore) onResync?.();
    connectedBefore = true;
  });

  async function poll() {
    try {
      const r = await api('GET', `/api/poll?since=${seq ?? -1}`);
      if (r.reset) {
        const first = seq == null;
        seq = r.seq;
        if (!first) onResync?.();
      } else {
        for (const e of r.events) deliver(e.seq, e.event, e.data);
      }
    } catch {
      // server unreachable for a moment: try again next tick
    }
    setTimeout(poll, POLL_MS);
  }

  setTimeout(() => {
    if (alive || polling) return;
    polling = true;
    es.close();
    console.info('[whoswho] live updates: SSE is blocked here, polling instead');
    onResync?.(); // catch up on anything since the page loaded
    poll();
  }, SSE_GRACE_MS);

  return es;
}
