// Local integration only. Enable a reviewed, deployed endpoint in source later;
// never take an endpoint from a URL parameter, storage, or page content.
export const ACTIVITY_ENDPOINT = null;
export const ACTIVITY_KEY = 'xiangqi-assist:activity:v1';
const LOCK = ACTIVITY_KEY;
const INTERVAL = 60_000, EXPIRY = 300_000, TIMEOUT = 8_000;
let current = null;

function endpointURL(value) {
  if (!value) return null;
  const url = new URL(value, location.href);
  const local = u => u.protocol === 'http:' && u.hostname === '127.0.0.1';
  if (url.username || url.password || url.search || url.hash ||
      url.pathname !== '/activity/xiangqi-assist') return null;
  if (!(local(url) && local(location)) &&
      !(url.protocol === 'https:' && url.origin === location.origin)) return null;
  return url.href;
}

// A single shared, expiring record, with no visit log. If atomic coordination or
// storage is unavailable, omit this optional statistic instead of overcounting.
export function startActivity({endpoint = ACTIVITY_ENDPOINT} = {}) {
  if (current) return current;
  let target, storage, locks;
  try {
    target = endpointURL(endpoint);
    if (!target) return null;
    storage = localStorage; locks = navigator.locks;
    if (!locks?.request || !crypto?.getRandomValues) return null;
    storage.getItem(ACTIVITY_KEY);
  } catch { return null; }
  let stopped = false, suspended = false, busy = false;
  let timer, expiryTimer, timeout, controller;
  const active = () => !stopped && !suspended && !document.hidden;
  function read(at) {
    const raw = storage.getItem(ACTIVITY_KEY);
    if (!raw) return null;
    let record;
    try { record = JSON.parse(raw); } catch { /* replace invalid record */ }
    if (record && typeof record.visitorId === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(record.visitorId) &&
        Number.isSafeInteger(record.lastAttempt) && Number.isSafeInteger(record.expiresAt) &&
        record.expiresAt === record.lastAttempt + EXPIRY && record.expiresAt > at) {
      // A large backwards clock correction cannot safely establish freshness.
      // Stop this optional metric instead of creating another concurrent ID.
      if (record.lastAttempt > at + EXPIRY) throw new Error('Activity clock moved backwards');
      return record;
    }
    storage.removeItem(ACTIVITY_KEY);
    return null;
  }
  function cleanupAt(at) {
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => {
      if (stopped) return;
      void locks.request(LOCK, {ifAvailable:true}, lock => {
        if (!lock || stopped) return;
        const record = read(Date.now());
        if (record) cleanupAt(record.expiresAt);
      }).catch(stop);
    }, Math.max(1, at - Date.now()));
  }
  function schedule(delay = INTERVAL) {
    clearTimeout(timer);
    if (active()) timer = setTimeout(tick, Math.max(1, delay));
  }
  async function tick(opening = false) {
    // Opening a background tab may register once; only foreground pages renew.
    const allowed = () => active() || (opening && !stopped && !suspended);
    if (!allowed() || busy) return;
    busy = true;
    let wait = INTERVAL;
    try {
      const visitorId = await locks.request(LOCK, {ifAvailable:true}, lock => {
        if (!lock || !allowed()) return null;
        const at = Date.now();
        let record = read(at);
        if (record) {
          cleanupAt(record.expiresAt);
          const elapsed = at - record.lastAttempt;
          if (elapsed < INTERVAL) {
            wait = Math.min(INTERVAL, INTERVAL - elapsed);
            return null;
          }
        } else {
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          record = {visitorId: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')};
        }
        record.lastAttempt = at; record.expiresAt = at + EXPIRY;
        // Reserve the interval before network I/O, including failed requests.
        storage.setItem(ACTIVITY_KEY, JSON.stringify(record));
        cleanupAt(record.expiresAt);
        return record.visitorId;
      });
      if (visitorId && allowed()) {
        controller = new AbortController();
        timeout = setTimeout(() => controller?.abort(), TIMEOUT);
        try {
          await fetch(target, {method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({visitorId}), signal:controller.signal,
            credentials:'omit', cache:'no-store', redirect:'error', referrerPolicy:'no-referrer'});
        } catch { /* timeout, offline, HTTP errors: next ordinary interval only */ }
        finally { clearTimeout(timeout); controller = null; }
      }
    } catch { stop(); }
    finally { busy = false; schedule(wait); }
  }
  function pause() { clearTimeout(timer); controller?.abort(); }
  function visibility() { if (active()) void tick(); else pause(); }
  function hide() { suspended = true; pause(); }
  function show() { suspended = false; visibility(); }
  function changed(event) {
    if (event.key !== ACTIVITY_KEY || stopped) return;
    void locks.request(LOCK, {ifAvailable:true}, lock => {
      if (!lock || stopped) return;
      const record = read(Date.now()); if (record) cleanupAt(record.expiresAt);
    }).catch(stop);
  }
  function stop() {
    stopped = true; pause(); clearTimeout(expiryTimer); clearTimeout(timeout);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show);
    window.removeEventListener('storage', changed);
    current = null;
  }
  current = {stop};
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', hide); window.addEventListener('pageshow', show);
  window.addEventListener('storage', changed);
  void tick(true);
  return current;
}

// Independent from the chess module: a missing/failed activity resource cannot
// delay its initialization. Defaults to no network, including ordinary preview.
if (typeof window !== 'undefined') startActivity();
