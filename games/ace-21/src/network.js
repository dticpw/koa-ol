const STORAGE = 'ace21-room-v1';
const API = location.hostname === '127.0.0.1' || location.hostname === 'localhost'
  ? 'http://127.0.0.1:4183' : 'https://muq.koa-ol.com/ace21-api';
export function savedRoom() {
  const code = new URL(location.href).searchParams.get('table');
  if (!/^10[01]0[0-3]$/.test(code || '')) return null;
  try { const token = sessionStorage.getItem('koa-table-token'); return token ? {code,token} : (location.replace('./lobby/'),null); } catch { location.replace('./lobby/');return null; }
}
export class RoomClient {
  constructor(onUpdate, onStatus, session = null) {
    this.session = session || { token: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') };
    this.onUpdate = onUpdate; this.onStatus = onStatus; this.closed = false; this.busy = false; this.revision = 0;
  }
  async request(path, body) {
    const response = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${this.session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || '连接失败'), { status: response.status });
    return data;
  }
  receive(data) {
    if (this.closed || data.revision < this.revision) return;
    this.revision = data.revision; this.session.code = data.code;
    try { sessionStorage.setItem(STORAGE, JSON.stringify(this.session)); this.storageAvailable = true; } catch { this.storageAvailable = false; }
    this.onStatus('connected', data); this.onUpdate(data);
  }
  async poll() {
    clearTimeout(this.timer);
    if (this.closed) return;
    if (!this.busy) {
      try { this.receive(await this.request(`/tables/ace21/${this.session.code}`)); }
      catch (e) { if (this.closed) return; this.onStatus([401, 403, 404].includes(e.status) ? 'expired' : 'offline', null, e.message); }
    }
    if (!this.closed) this.timer = setTimeout(() => this.poll(), document.hidden ? 5000 : 1100);
  }
  async act(action) {
    if (this.closed || this.busy) return;
    this.busy = true;
    const requestId = crypto.randomUUID();
    const submit = () => this.request(`/tables/ace21/${this.session.code}/action`, { revision: this.revision, requestId, action });
    try {
      let data;
      try { data = await submit(); }
      catch(e) {
        if(e.status !== 409 || e.message !== '桌面刚刚更新，请重试。') throw e;
        this.receive(await this.request(`/tables/ace21/${this.session.code}`));
        data = await submit();
      }
      this.receive(data);
    }
    catch (e) {
      // Refresh after an uncertain write, never replay a game action automatically.
      try { this.receive(await this.request(`/tables/ace21/${this.session.code}`)); }
      catch { this.onStatus('offline'); }
      throw e;
    } finally { this.busy = false; }
  }
  stop() { this.closed = true; clearTimeout(this.timer); try { sessionStorage.removeItem(STORAGE); } catch {} }
}
