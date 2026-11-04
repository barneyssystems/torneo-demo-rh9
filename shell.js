'use strict';
const KEY = 'tos-demo-log-v1';
const frames = { familia: document.getElementById('f-familia'), arbitro: document.getElementById('f-arbitro'), papa: document.getElementById('f-papa') };
function show(role) {

  for (const [r, f] of Object.entries(frames)) f.hidden = r !== role;
  document.querySelectorAll('.bar [data-role]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.role === role)));
  const w = frames[role].contentWindow; try { w.scrollTo(0, 0); } catch {} try { Promise.resolve((w.load || w.refresh).call(w)).then(() => { if (role === 'papa' && w.goHomeIfWaiting) w.goHomeIfWaiting(); w.scrollTo(0, 0); }); } catch {} // pick up what the other roles just did
}
document.querySelectorAll('.bar [data-role]').forEach((b) => b.addEventListener('click', () => { const n = document.getElementById('note'); if (n) n.hidden = true; show(b.dataset.role); }));
document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('¿Empezar de nuevo? Se borra lo que hiciste en esta prueba.')) return;
  localStorage.removeItem(KEY); for (const f of Object.values(frames)) f.contentWindow.location.reload();
});

document.getElementById('demoMenu').addEventListener('click', () => { const p = document.getElementById('demoPanel'); p.hidden = !p.hidden; document.getElementById('demoMenu').setAttribute('aria-expanded', String(!p.hidden)); });
