'use strict';
let DATA = null, TAB = 'partidos', STALE = null;
const view = document.getElementById('view'), banner = document.getElementById('banner');
function setBanner(kind, text) { banner.replaceChildren(text ? el('div', { class: 'banner ' + kind, role: 'status' }, text) : ''); }
function teamOrSource(name, src) { return name ? el('span', {}, name) : el('span', { class: 'tbd' }, srcLabel(src) + ' · Por definir'); }
function matchRow(f) {
  const sc = scoreText(f.result);
  return el('div', { class: 'row', 'data-fixture': f.id },
    el('div', { class: 'team r' }, f.stage === 'group' ? f.home : teamOrSource(f.home, f.homeSource)),
    el('div', { class: 'score' }, sc || el('span', { class: 'tbd' }, 'vs')),
    el('div', { class: 'team' }, f.stage === 'group' ? f.away : teamOrSource(f.away, f.awaySource)));
}
// ---- UCL-structure design (own look): Hoy · Tabla · Cuadro · Goleadores. Text only; CSP forbids inline styles, so colours are classes.
let TEAMIDX = {};
const hue = (name) => { if (name in TEAMIDX) return 'c' + (TEAMIDX[name] % 12); let h = 0; for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 12; return 'c' + h; };
const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
// A generated crest: colour (12) × pattern (4) × initials, in a shield shape. Deterministic from the team name; no logos, no IP.
const pat = (name) => { let h = 7; for (const c of String(name || '?')) h = (h * 17 + c.codePointAt(0)) % 4; return 'p' + h; };
const badge = (name) => el('span', { class: 'badge crest ' + (name ? hue(name) + ' ' + pat(name) : 'empty'), 'aria-hidden': 'true' }, el('b', {}, name ? initials(name) : ''));
let FOLLOW = null; try { FOLLOW = localStorage.getItem('miEquipo'); } catch {}
function follow(name) { FOLLOW = FOLLOW === name ? null : name; try { FOLLOW ? localStorage.setItem('miEquipo', FOLLOW) : localStorage.removeItem('miEquipo'); } catch {} render(); }
const hhmm = (k) => (k ? k.slice(11, 16) : '');
const srcName = (src) => { const w = /^W:(.+)$/.exec(src || ''); if (w) { const f = DATA.fixtures.find((x) => x.id === w[1]); return 'Ganador ' + (f && f.round ? f.round : w[1]); } return srcLabel(src); };
const side = (name, src, right) => el('div', { class: 'side' + (right ? ' right' : '') + (name && name === FOLLOW ? ' mine' : '') }, badge(name), el('span', { class: 'tn' }, name || srcName(src)));
let NEXT = null, MATCH = null; // MATCH = id of the match whose page is open (Hoy → «Partido»)
const t12 = (k) => L.t12(k);
const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'justo ahora' : m < 60 ? `hace ${m} min` : m < 24 * 60 ? `hace ${Math.round(m / 60)} h` : fmtTime(iso); };
const open = (id) => { MATCH = id; window.scrollTo(0, 0); render(); };
function card(f) {
  const r = f.result;
  const mid = r ? el('div', { class: 'big' }, el('span', {}, r.hg), el('span', { class: 'dash' }, '–'), el('span', {}, r.ag)) : el('div', { class: 'big soon' }, t12(f.kickoff) || 'vs');
  const state = r ? (r.wo ? 'W.O.' : 'Terminado') : f.status && f.status !== 'Por jugar' ? (/retirado/i.test(f.status) ? 'Equipo retirado' : 'Resultado anulado') : (NEXT && NEXT.id === f.id ? 'Siguiente' : 'Por jugar');
  const extra = r && (r.pens ? ` · Penales ${r.pens.hg}-${r.pens.ag}` : r.et ? ` · Prórroga ${r.et.hg}-${r.et.ag}` : '') || '';
  return el('div', { class: 'mcard tap', 'data-fixture': f.id, role: 'button', tabindex: '0', 'aria-label': 'Ver el partido', onclick: () => open(f.id), onkeydown: (e) => { if (e.key === 'Enter') open(f.id); } }, el('div', { class: 'mrow' }, side(f.home, f.homeSource), mid, side(f.away, f.awaySource, true)),
    (r && f.goals && f.goals.some((g) => g.label) ? el('div', { class: 'mgoals' }, '⚽ ' + f.goals.filter((g) => g.label).slice(0, 4).map((g) => `${g.label} (${initials(g.side === 'h' ? f.home : f.away)})${g.minute ? ' ' + g.minute + "'" : ''}`).join(' · ')) : null),
    el('div', { class: 'mfoot' }, el('span', { class: 'chip ' + (r ? 'fin' : 'next') }, state), el('span', {}, [f.pitch, f.stage === 'group' ? 'Grupo ' + f.groupId : f.round].filter(Boolean).join(' · ') + extra + (f.corrected ? ' · resultado corregido' : '') + ' ›')));
}
const dayLabel = (iso) => new Date(iso.slice(0, 10) + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
const R = {
  partido() { // one match: score, who scored and when (the REA match page)
    const f = DATA.fixtures.find((x) => x.id === MATCH);
    if (!f) { MATCH = null; return R.partidos(); }
    const r = f.result, hs = f.goals ? f.goals.filter((g) => g.side === 'h') : [], as = f.goals ? f.goals.filter((g) => g.side === 'a') : [];
    const line = (g) => el('div', { class: 'gl' }, el('span', { class: 'gm' }, g.minute ? g.minute + "'" : '⚽'), el('span', {}, (g.minute ? '⚽ ' : '') + (g.label || 'Gol')));
    const side2 = (arr) => { const named = arr.filter((g) => g.label || g.minute), anon = arr.filter((g) => !g.label && !g.minute).length; return [...named.map(line), anon ? el('div', { class: 'gl' }, el('span', { class: 'gm' }, '⚽'), el('span', {}, anon === 1 ? 'Gol' : anon + ' goles')) : null]; };
    const state = r ? (r.wo ? 'W.O.' : 'Terminado') : /retirado/i.test(f.status) ? 'Equipo retirado' : 'Por jugar';
    return [el('button', { class: 'back', id: 'backMatch', onclick: () => { MATCH = null; render(); } }, '‹ Volver'),
      el('div', { class: 'hero', 'data-match-page': f.id }, el('div', { class: 'heroMeta' }, [f.stage === 'group' ? 'Grupo ' + f.groupId : f.round, f.kickoff ? dayLabel(f.kickoff) + ' · ' + t12(f.kickoff) : '', f.pitch].filter(Boolean).join(' · ')),
        el('div', { class: 'heroRow' }, el('div', { class: 'hs' }, badge(f.home), el('span', {}, f.home || srcName(f.homeSource))),
          r ? el('div', { class: 'heroScore' }, el('span', {}, r.hg), el('span', { class: 'dash' }, '–'), el('span', {}, r.ag)) : el('div', { class: 'heroScore soon' }, t12(f.kickoff) || 'vs'),
          el('div', { class: 'hs' }, badge(f.away), el('span', {}, f.away || srcName(f.awaySource)))),
        el('div', { class: 'heroPill' }, el('span', { class: 'chip ' + (r ? 'fin' : 'next') }, state), r && r.pens ? el('span', { class: 'meta heroX' }, `Penales ${r.pens.hg}-${r.pens.ag}`) : r && r.et ? el('span', { class: 'meta heroX' }, `Prórroga ${r.et.hg}-${r.et.ag}`) : null),
        r ? el('div', { class: 'heroGoals' }, el('div', { class: 'gcol' }, side2(hs)), el('div', { class: 'gcol r' }, side2(as))) : null,
        r && !(f.goals || []).length && (r.hg + r.ag) > 0 ? el('p', { class: 'meta center' }, 'Todavía no se anotó quién metió los goles.') : null,
        !r ? el('p', { class: 'meta center' }, 'El resultado aparece aquí cuando el organizador lo aprueba.') : null),
      f.stage === 'group' ? el('button', { class: 'btn sec', id: 'toTable', onclick: () => { MATCH = null; TAB = 'grupos'; syncTabs(); render(); } }, 'Ver la tabla del grupo') : el('button', { class: 'btn sec', id: 'toBracket', onclick: () => { MATCH = null; TAB = 'eliminatorias'; syncTabs(); render(); } }, 'Ver el cuadro')];
  },
  partidos() {
    let fx = DATA.fixtures.slice();
    if (!fx.length) return [el('div', { class: 'empty' }, 'Aún no hay calendario. El organizador lo publica pronto.')];
    const out = [];
    const first = fx.find((f) => f.kickoff), st = DATA.stats;
    if (first) out.push(el('div', { class: 'dayHead', id: 'dayHead' }, el('div', { class: 'dayT' }, dayLabel(first.kickoff)), el('div', { class: 'dayS' }, (st ? `${st.played} de ${st.total} partidos jugados` : '') + (() => { const ks = DATA.fixtures.map((f) => f.kickoff).filter(Boolean).sort(); return ks.length ? ` · primer partido ${t12(ks[0])}` : ''; })())));
    if (FOLLOW) out.push(el('div', { class: 'seg' }, el('button', { 'aria-pressed': 'false', onclick: () => follow(FOLLOW) }, 'Ver todos'), el('button', { 'aria-pressed': 'true' }, 'Mi equipo: ' + FOLLOW)));
    if (FOLLOW) fx = fx.filter((f) => f.home === FOLLOW || f.away === FOLLOW);
    fx.sort((a, b) => (a.kickoff || 'z').localeCompare(b.kickoff || 'z') || (a.pitch || '').localeCompare(b.pitch || ''));
    const slots = {}; for (const f of fx) (slots[f.kickoff ? t12(f.kickoff) : 'Por definir'] = slots[f.kickoff ? t12(f.kickoff) : 'Por definir'] || []).push(f);
    const next = fx.find((f) => !f.result && f.kickoff); NEXT = next || null;
    if (next) out.push((() => { const sameSlot = fx.filter((f) => !f.result && f.kickoff === next.kickoff); return el('div', { class: 'nextHero tap', id: 'nextHero', role: 'button', tabindex: '0', onclick: () => open(next.id) }, el('div', { class: 'nh1' }, sameSlot.length > 1 ? 'Siguen' : 'Siguiente partido'), el('div', { class: 'nh2' }, sameSlot.length > 1 ? `${t12(next.kickoff)} · ${sameSlot.length} partidos` : `${t12(next.kickoff)} · ${next.pitch || ''}`), ...sameSlot.map((f) => el('div', { class: 'nh3' }, `${f.home || srcName(f.homeSource)} vs ${f.away || srcName(f.awaySource)}${sameSlot.length > 1 && f.pitch ? ' · ' + f.pitch : ''}`))); })());
    for (const [t, list] of Object.entries(slots)) out.push(el('div', { class: 'slot' }, el('h3', { class: 'slotH' }, t), list.map(card)));
    return out;
  },
  grupos() {
    const out = [], q = DATA.qualifiersPerGroup;
    if (!DATA.rulesConfirmed) out.push(el('div', { class: 'banner warn' }, 'Las reglas de puntos aún no están confirmadas: la tabla no ordena posiciones.'));
    if (DATA.rulesLabel) out.push(el('div', { class: 'banner warn', id: 'rulesLabel' }, 'Reglas: ' + DATA.rulesLabel + '. Provisionales hasta que el organizador las confirme.'));
    const leads = Object.entries(DATA.tables).map(([g, t]) => t[0] && t[0].played > 0 ? `Grupo ${g}: ${t[0].team}` : `Grupo ${g}: aún sin partidos`);
    if (Object.values(DATA.tables).some((t) => t[0] && t[0].played > 0)) out.push(el('div', { class: 'leaders', id: 'leaders' }, el('b', {}, 'Líderes'), el('span', {}, leads.join('  ·  '))));
    for (const [g, t] of Object.entries(DATA.tables)) {
      const rows = [], closed = t.length && t.every((r) => r.edge !== 'En disputa'), showZones = t.length && t.every((r) => r.played > 0);
      t.forEach((r, i) => {
        if (showZones && q && i === 0) rows.push(el('div', { class: 'zone q' }, closed ? 'Clasifican' : 'Clasifican (por ahora)'));
        if (showZones && q && i === q) rows.push(t[i - 1] && t[i].shared && t[i - 1].shared && t[i].position === t[i - 1].position ? el('div', { class: 'zone t' }, 'Empatados por el último lugar que clasifica: lo decide el organizador') : el('div', { class: 'zone e' }, closed ? 'No clasifican' : 'No clasifican (por ahora)'));
        rows.push(el('button', { class: 'trow ' + (r.edge === 'Clasificado' ? 'q' : r.edge === 'Eliminado' ? 'e' : '') + (r.team === FOLLOW ? ' mine' : '') + (showZones && q && i === q - 1 ? ' zl' : ''), onclick: () => follow(r.team), 'aria-label': 'Seguir a ' + r.team },
          el('span', { class: 'pos' }, r.played === 0 ? i + 1 : r.shared ? r.position + '=' : r.position), el('span', { class: 'tm' }, badge(r.team), el('span', { class: 'tn' }, r.team)),
          el('span', {}, r.played), el('span', {}, (r.gd > 0 ? '+' : '') + r.gd), el('span', { class: 'pts' }, r.points === null ? '—' : r.points),
          el('span', { class: 'form', 'aria-label': 'Últimos resultados' }, (r.form || []).map((x) => el('i', { class: 'f' + x }, x)))));
      });
      out.push(el('div', { class: 'tcard' }, el('h2', {}, 'Grupo ' + g, q ? el('small', { class: 'zoneHint' }, `Pasan los ${q} primeros`) : null),
        el('div', { class: 'trow thead' }, el('span', { class: 'pos' }, '#'), el('span', { class: 'tm' }, 'Equipo'), el('span', {}, 'Jug.'), el('span', {}, 'Dif.'), el('span', { class: 'pts' }, 'Pts'), el('span', { class: 'form' }, 'Últimos')),
        rows,
        el('div', { class: 'legend' }, el('span', { class: 'lg full' }, 'Jug. partidos jugados · Dif. diferencia de goles · Pts puntos · G ganó, E empató, P perdió'), el('span', { class: 'lg full' }, 'Toca un equipo para seguir sus partidos')),
        t.some((r) => r.flag && r.played > 0) ? el('div', { class: 'meta pad', id: 'tieNote' }, '= Empate que las reglas no resuelven: lo decide el organizador.') : null));
    }
    if (!out.length) out.push(el('div', { class: 'empty' }, 'Todavía no hay grupos.'));
    return out;
  },
  eliminatorias() {
    if (!DATA.bracket.length) return [el('div', { class: 'empty' }, 'Las eliminatorias aún no están programadas.')];
    const rounds = {}, out = [];
    for (const b of DATA.bracket) (rounds[b.round] = rounds[b.round] || []).push(b);
    const fin = DATA.bracket.find((b) => b.round === 'Final');
    if (fin && fin.winner) out.push(el('div', { class: 'champ', id: 'champ' }, el('div', { class: 'champT' }, 'Campeón'), badge(fin.winner), el('div', { class: 'champN' }, fin.winner)));
    if (DATA.qualifiersPerGroup) out.unshift(el('p', { class: 'meta center', id: 'koHint' }, `Pasan los ${DATA.qualifiersPerGroup} primeros de cada grupo.`));
    const fx = (id) => DATA.fixtures.find((x) => x.id === id) || {};
    const statusOf = (b) => b.winner ? 'Avanza: ' + b.winner : b.invalidated ? 'Resultado anulado: ' + b.invalidated + '. Pendiente de volver a anotar.' + (b.sourceIneligible ? ' (' + b.sourceIneligible + ')' : '') : b.sourceIneligible ? 'Por definir (' + b.sourceIneligible + ')' : (b.home && b.away ? 'Por jugar' : 'Por definir');
    const semis = DATA.bracket.filter((b) => /^Semifinal/.test(b.round));
    if (semis.length === 2 && fin) { // a real bracket: two semifinals side by side, joined to the final
      const tc = (b, cls) => el('div', { class: 'tc' + (b.home && b.away ? ' tap' : '') + (cls ? ' ' + cls : ''), 'data-ko': b.id, ...(b.home && b.away ? { role: 'button', tabindex: '0', onclick: () => { TAB = 'partidos'; syncTabs(); open(b.id); } } : {}) },
        el('div', { class: 'tcH' }, el('b', {}, b.round), el('span', {}, [fx(b.id).kickoff ? t12(fx(b.id).kickoff) : '', fx(b.id).pitch].filter(Boolean).join(' · '))),
        [[b.home, b.homeSource, b.result && b.result.hg], [b.away, b.awaySource, b.result && b.result.ag]].map(([n, src, g]) => el('div', { class: 'tcRow' + (n && b.winner === n ? ' win' : '') }, badge(n), el('span', { class: 'tn' }, n || srcName(src)), el('span', { class: 'tg' }, g === null || g === undefined ? '' : g))),
        el('div', { class: 'tcS', 'data-ko-status': b.id }, statusOf(b) + (b.result && b.result.pens ? ` · Penales ${b.result.pens.hg}-${b.result.pens.ag}` : '')));
      if (semis.some((b) => !b.home || !b.away)) out.push(el('p', { class: 'meta center', id: 'koWait' }, 'Los equipos se definen cuando terminan los partidos de grupo.'));
      out.push(el('div', { class: 'tree' }, el('div', { class: 'treeSemis' }, tc(semis[0]), tc(semis[1])), el('div', { class: 'treeJoin', 'aria-hidden': 'true' }, el('i'), el('i')), el('div', { class: 'treeFinal' }, tc(fin, 'final'))));
      return out;
    }
    return out.concat(Object.entries(rounds).map(([r, list], i) => el('div', { class: 'slot' + (i ? ' next-round' : '') }, i ? el('div', { class: 'advance' }, '▼ Los ganadores pasan a la siguiente ronda') : null, el('h3', { class: 'slotH' }, r, list[0] && fx(list[0].id).kickoff ? el('small', { class: 'slotD' }, dayLabel(fx(list[0].id).kickoff)) : null), list.map((b) => [
      el('div', { class: 'mcard' + (b.home && b.away ? ' tap' : ''), 'data-ko': b.id, ...(b.home && b.away ? { role: 'button', tabindex: '0', onclick: () => { TAB = 'partidos'; syncTabs(); open(b.id); } } : {}) }, el('div', { class: 'mrow' }, side(b.home, b.homeSource), b.result ? el('div', { class: 'big' }, el('span', {}, b.result.hg), el('span', { class: 'dash' }, '–'), el('span', {}, b.result.ag)) : el('div', { class: 'big soon' }, t12(fx(b.id).kickoff) || 'vs'), side(b.away, b.awaySource, true)),
        el('div', { class: 'mfoot', 'data-ko-status': b.id }, el('span', { class: 'chip ' + (b.winner ? 'fin' : 'next') }, statusOf(b)),
          el('span', {}, [fx(b.id).kickoff && b.result ? t12(fx(b.id).kickoff) : '', fx(b.id).pitch, b.result && b.result.pens ? 'Penales ' + b.result.pens.hg + '-' + b.result.pens.ag : ''].filter(Boolean).join(' · '))))]))));
  },
  goleadores() {
    if (DATA.scorers === null) return [el('div', { class: 'empty', id: 'noscorers' }, 'Los goleadores no se guardan en el teléfono: vuelve a intentarlo con conexión.')];
    const st = DATA.stats, summary = st && st.played ? el('div', { class: 'sumCard', id: 'sumCard' }, el('div', {}, el('b', {}, st.goals), el('span', {}, 'goles')), el('div', {}, el('b', {}, st.played), el('span', {}, 'partidos')), el('div', {}, el('b', {}, String(st.perMatch).replace('.', ',')), el('span', {}, 'goles por partido'))) : null;
    const named = (DATA.scorers || []).reduce((n, x) => n + x.goals, 0), unnamed = st ? st.goals - named : 0;
    const unnamedNote = unnamed > 0 ? el('p', { class: 'meta center', id: 'unnamed' }, `${unnamed} ${unnamed === 1 ? 'gol' : 'goles'} sin autor anotado.`) : null;
    if (!DATA.scorers.length) return [summary, unnamedNote, el('div', { class: 'empty' }, 'Aún no hay goles con nombre. Aparecen cuando el árbitro anota quién metió cada gol.')].filter(Boolean);
    let rank = 0, prev = null;
    return [summary, unnamedNote, el('div', { class: 'tcard' }, el('h2', {}, 'Goleadores'), DATA.scorers.map((x, i) => { if (x.goals !== prev) { rank = i + 1; prev = x.goals; }
      const [who, team] = String(x.label).split(' · '); const soleLeader = DATA.scorers.filter((y) => y.goals === DATA.scorers[0].goals).length === 1;
      return el('div', { class: 'trow sc' + (rank === 1 && soleLeader ? ' lead' : '') }, el('span', { class: 'pos' }, rank), el('span', { class: 'tm' }, badge(team), el('span', { class: 'tn' }, who, el('small', {}, team))), el('span', {}), el('span', {}), el('span', { class: 'pts' }, x.goals), el('span', {})); })),
      null].filter(Boolean);
  },
};
function syncTabs() { document.querySelectorAll('nav.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === TAB))); }
function render() {
  if (!DATA) return;
  document.getElementById('tname').textContent = DATA.tournament ? DATA.tournament.name : 'Torneo';
  document.getElementById('asof').textContent = [DATA.tournament && DATA.tournament.date ? new Date(DATA.tournament.date + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) : '', (STALE ? 'Sin conexión · datos de ' + (DATA.asOf ? fmtTime(DATA.asOf) : '—') : 'Actualizado ' + (DATA.asOf ? ago(DATA.asOf) : '—'))].filter(Boolean).join(' · ');
  view.replaceChildren(...(MATCH ? R.partido() : R[TAB]()));
}
async function load() {
  try {
    const r = await fetch('/api/public', { cache: 'no-store' });
    if (r.status === 503) { const j = await r.json(); DATA = null; view.replaceChildren(); setBanner('bad', 'Los resultados no están disponibles en este momento (' + j.detail + '). No mostramos datos que no podamos garantizar.'); document.getElementById('asof').textContent = 'No disponible'; return; }
    if (!r.ok) throw new Error('http ' + r.status);
    DATA = await r.json(); STALE = null; setBanner(null);
    { const names = [...new Set(Object.values(DATA.tables || {}).flat().map((x) => x.team))].sort(); TEAMIDX = Object.fromEntries(names.map((n, i) => [n, i * 5 % 12 + (i >= 12 ? 1 : 0)])); } // distinct colours: teams are spread over the palette by their order, not by a hash that can collide
    // W2-B-02: the offline copy NEVER contains player identities (consent can be revoked while this phone is offline)
    try { localStorage.setItem('ultimo', JSON.stringify(offlineCopy(DATA))); } catch {}
  } catch (e) {
    const c = localStorage.getItem('ultimo');
    if (c) { DATA = offlineCopy(JSON.parse(c)); STALE = true; setBanner('warn', 'Sin conexión: mostrando la última copia guardada. Puede no estar al día.'); }
    else { DATA = null; view.replaceChildren(); setBanner('bad', 'Sin conexión y sin copia guardada. Intenta de nuevo cuando tengas señal.'); document.getElementById('asof').textContent = 'No disponible'; return; }
  }
  render();
}
document.querySelectorAll('nav.tabs button').forEach((b) => b.addEventListener('click', () => {
  TAB = b.dataset.tab; MATCH = null; syncTabs(); render();
}));
load(); setInterval(load, 20000);
