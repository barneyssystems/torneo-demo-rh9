'use strict';
// Demo mode: every /api/* call is answered inside this browser by the same engine (engine/core.js) over localStorage. No server, no accounts.
(function () {
  const KEY = 'tos-demo-log-v1', TOKENS = { 'DEMO-ORG': { role: 'organizador', id: 'org1' }, 'DEMO-REF1': { role: 'arbitro', id: 'ref1' }, 'DEMO-REF2': { role: 'arbitro', id: 'ref2' } };
  const SECRET = 'demo-only-not-a-secret';
  const store = { load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }, save(l) { localStorage.setItem(KEY, JSON.stringify(l)); } };
  const E = window.TosEngine, core = E.core.createCore({ store, tokens: TOKENS, key: SECRET });
  window.TosDemo = { setRef(t) { sessionStorage.setItem('ref', t); }, ref() { return sessionStorage.getItem('ref'); }, reset() { localStorage.removeItem(KEY); seed(); }, core };
  const TEAMS = { A: [['leones', 'Leones FC'], ['aguilas', 'Águilas'], ['tigres', 'Tigres'], ['halcones', 'Halcones']], B: [['lobos', 'Lobos'], ['pumas', 'Pumas'], ['jaguares', 'Jaguares'], ['condores', 'Cóndores']] };
  const NAMES = ['Mateo', 'Santiago', 'Diego', 'Nicolás', 'Samuel', 'Daniel', 'Andrés', 'Camilo'];
  function ev(type, payload) { const r = core.handle('POST', '/api/org/event', 'DEMO-ORG', { type, payload }); if (r.status !== 201) throw new Error('seed ' + type + ' ' + JSON.stringify(r.body)); }
  function seed() {
    if (store.load().length) return;
    ev('TOURNAMENT_SET', { name: 'Torneo de prueba', date: '2026-11-21' });
    ev('NAMES_PUBLIC_SET', { adults: true }); // the demo's players are all invented, so their names can be shown; a real tournament starts with names OFF
    ev('RULES_SET', { points: { win: 3, draw: 1, loss: 0 }, tiebreak: ['won', 'gd', 'gf', 'h2h_result', 'fairplay', 'ga_fewest'], walkoverGoals: 3, qualifiersPerGroup: 2, koLevel: 'PENS' });
    let n = 0;
    for (const [g, ts] of Object.entries(TEAMS)) for (const [id, name] of ts) { ev('TEAM_ADDED', { id, name, groupId: g });
      for (let i = 0; i < 3; i++) ev('PLAYER_ADDED', { id: id + '-' + (i + 1), teamId: id, displayName: NAMES[(n++) % NAMES.length] + ' ' + String.fromCharCode(65 + (n % 26)) + '.', number: [9, 10, 7][i], isMinor: false }); }
  }
  seed();
  sessionStorage.setItem('org', 'DEMO-ORG'); sessionStorage.setItem('ref', 'DEMO-REF1');
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!u.pathname.includes('/api/')) return realFetch(input, init);
    if (window.__tosOffline) throw new TypeError('Failed to fetch'); // test hook: simulate no signal
    const path = u.pathname.slice(u.pathname.indexOf('/api/'));
    const h = (init && init.headers) || {}, auth = h.authorization || h.Authorization || '';
    const m = /^Bearer (\S+)$/.exec(auth); let body;
    if (init && init.body) { try { body = JSON.parse(init.body); } catch { body = null; } }
    const r = core.handle((init && init.method) || 'GET', path, m ? m[1] : null, body);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
})();
