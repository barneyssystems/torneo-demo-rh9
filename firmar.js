'use strict';
// Family signing page. The link token lives in the URL #fragment (never sent to the server as a URL, never in logs);
// it is kept in sessionStorage and the fragment is removed from the address bar.
const main = document.getElementById('main');
if (location.hash.length > 1) { sessionStorage.setItem('firma', location.hash.slice(1)); history.replaceState(null, '', location.pathname); }
const TOKEN = sessionStorage.getItem('firma');
let V = null, NOTE = null;
async function call(method, url, body) {
  const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errEs(j, r.status));
  return j;
}
function pad(id) {
  // finger/mouse signature -> compact path "M x y L x y ..." (integers)
  const c = el('canvas', { id, width: '600', height: '200', class: 'sig' });
  const pts = []; let down = false;
  const pos = (ev) => { const r = c.getBoundingClientRect(); const t = ev.touches ? ev.touches[0] : ev; return [Math.round((t.clientX - r.left) * 600 / r.width), Math.round((t.clientY - r.top) * 200 / r.height)]; };
  const g = c.getContext('2d'); g.lineWidth = 3; g.lineCap = 'round';
  const start = (ev) => { ev.preventDefault(); down = true; const [x, y] = pos(ev); pts.push(`M ${x} ${y}`); g.beginPath(); g.moveTo(x, y); };
  const move = (ev) => { if (!down) return; ev.preventDefault(); const [x, y] = pos(ev); if (pts.length < 790) { pts.push(`L ${x} ${y}`); g.lineTo(x, y); g.stroke(); } };
  const end = () => { down = false; };
  for (const [t, f] of [['touchstart', start], ['touchmove', move], ['touchend', end], ['mousedown', start], ['mousemove', move], ['mouseup', end], ['mouseleave', end]]) c.addEventListener(t, f, { passive: false });
  c.mark = () => (pts.filter((p) => p[0] === 'L').length >= 2 ? pts.join(' ') : null);
  return c;
}
const val = (id) => document.getElementById(id).value.trim();
async function load() {
  if (!TOKEN) { main.replaceChildren(el('div', { class: 'banner bad', 'data-kind': 'bad' }, 'Este enlace no es válido. Pide uno nuevo al organizador.')); return; }
  try { V = await call('GET', '/api/familia/ver'); } catch (e) { main.replaceChildren(el('div', { class: 'banner bad', 'data-kind': 'bad' }, 'Enlace no válido: ' + e.message)); return; }
  render();
}
function render() {
  const who = V.player.isMinor ? 'madre, padre o tutor legal' : 'el propio jugador (mayor de edad)';
  const rel = V.player.isMinor ? 'tutor' : 'jugador';
  document.getElementById('sub').textContent = `Jugador #${V.player.number} · ${V.player.team}`;
  const out = [];
  if (NOTE) out.push(el('div', { class: 'banner ' + NOTE.kind, id: 'note', 'data-kind': NOTE.kind, role: 'status' }, NOTE.text));
  if (!V.waiver) out.push(el('div', { class: 'card' }, el('h2', {}, '1 · Exoneración'), el('div', { class: 'pad' }, el('p', { class: 'meta' }, 'El organizador aún no ha publicado la exoneración.'))));
  else if (V.signed) out.push(el('div', { class: 'card' }, el('h2', {}, '1 · Exoneración'), el('div', { class: 'pad' }, el('p', { id: 'signed' }, `Firmada (versión ${V.waiver.version}). Gracias.`))));
  else {
    const sig = pad('sig1');
    out.push(el('div', { class: 'card' }, el('h2', {}, `1 · Exoneración (versión ${V.waiver.version})`), el('div', { class: 'pad' },
      el('p', { class: 'pre', id: 'wtext' }, V.waiver.text),
      el('p', { class: 'meta' }, 'Firma: ' + who + '.'),
      el('label', { for: 'n1' }, 'Nombre completo de quien firma'), el('input', { id: 'n1', autocomplete: 'name' }),
      el('label', {}, el('input', { type: 'checkbox', id: 'ok1', class: 'chk' }), 'Leí y acepto este texto'),
      el('label', {}, 'Firma con el dedo'), sig,
      el('button', { class: 'btn', id: 'sign', onclick: async () => {
        try {
          if (!document.getElementById('ok1').checked) throw new Error('marca «Leí y acepto»');
          const mark = sig.mark(); if (!mark) throw new Error('dibuja tu firma');
          await call('POST', '/api/familia/firmar', { version: V.waiver.version, textHash: V.waiver.textHash, signerName: val('n1'), relation: rel, accepted: true, mark });
          NOTE = { kind: 'ok', text: 'Exoneración firmada.' };
        } catch (e) { NOTE = { kind: 'bad', text: 'No se firmó: ' + e.message }; }
        await load();
      } }, 'Firmar exoneración'))));
  }
  const c = V.consent;
  const kids = [el('p', { class: 'meta' }, 'Opcional y separado de la exoneración. En esta versión los menores siempre aparecen como «#número · equipo» en lo público, con o sin permiso: el permiso queda registrado, pero no publica ningún nombre ni imagen. Horarios, equipos, marcadores y tablas siempre son públicos. Los datos de contacto nunca se publican.')];
  if (c && c.active) {
    kids.push(el('p', { id: 'cstate' }, `Permiso activo: ${c.scope.join(', ')}. ${c.verified ? 'Verificado por el organizador.' : 'Pendiente de que el organizador lo verifique en persona.'}`));
    kids.push(el('button', { class: 'btn sec', id: 'revoke', onclick: async () => { try { await call('POST', '/api/familia/revocar', {}); NOTE = { kind: 'ok', text: 'Permiso retirado y anotado en el historial.' }; } catch (e) { NOTE = { kind: 'bad', text: 'No se pudo retirar: ' + e.message }; } await load(); } }, 'Retirar permiso'));
  } else {
    const sig2 = pad('sig2');
    kids.push(...['perfil', 'foto', 'video', 'destacados'].map((s) => el('label', {}, el('input', { type: 'checkbox', 'data-scope': s, class: 'chk' }), ({ perfil: 'Nombre (registrado; hoy no se publica)', foto: 'Fotos', video: 'Videos', destacados: 'Jugadas destacadas' })[s])),
      el('label', { for: 'n2' }, 'Nombre de quien da el permiso (' + who + ')'), el('input', { id: 'n2' }), el('label', {}, 'Firma con el dedo'), sig2,
      el('button', { class: 'btn', id: 'consent', onclick: async () => {
        try {
          const scope = [...document.querySelectorAll('[data-scope]')].filter((x) => x.checked).map((x) => x.dataset.scope);
          if (!scope.length) throw new Error('elige al menos un permiso');
          const mark = sig2.mark(); if (!mark) throw new Error('dibuja tu firma');
          await call('POST', '/api/familia/consentir', { scope, signerName: val('n2'), relation: rel, mark });
          NOTE = { kind: 'ok', text: 'Permiso registrado. El organizador lo verificará en persona. En esta versión no se publica ningún nombre ni imagen de menores.' };
        } catch (e) { NOTE = { kind: 'bad', text: 'No se registró: ' + e.message }; }
        await load();
      } }, 'Dar permiso'));
  }
  out.push(el('div', { class: 'card' }, el('h2', {}, '2 · Permiso de nombre e imagen (registro)'), el('div', { class: 'pad' }, ...kids)));
  main.replaceChildren(...out);
}
load();
