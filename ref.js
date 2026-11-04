'use strict';
const main = document.getElementById('main');
let TOKEN = sessionStorage.getItem('ref') || null, FX = null, KO = 'PENDIENTE', WO = null, OPEN = null, NOTE = null, DRAFT = null;
async function call(method, url, body) {
  const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(errEs(j, r.status)), { status: r.status });
  return j;
}
// Offline queue: a score typed with no signal is kept on the phone and sent by itself when the signal returns.
// Stored per referee code (never shared between referees on one phone), minimised, and it expires.
const QKEY = 'refQueue:', FXKEY = 'refFixtures:', EXPIRY = 36 * 3600 * 1000;
const who = () => { let h = 5381; for (const c of String(TOKEN || '')) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const purgeExpired = () => { try { const now = Date.now(); const raw = JSON.parse(localStorage.getItem(QKEY + who()) || '[]'); const keep = raw.filter((x) => now - (x.at || 0) < EXPIRY); if (!keep.length) localStorage.removeItem(QKEY + who()); else if (keep.length !== raw.length) localStorage.setItem(QKEY + who(), JSON.stringify(keep)); const fxc = JSON.parse(localStorage.getItem(FXKEY + who()) || 'null'); if (fxc && now - (fxc.at || 0) >= EXPIRY) localStorage.removeItem(FXKEY + who()); } catch {} };
const getQ = () => { purgeExpired(); try { const now = Date.now(); const q = JSON.parse(localStorage.getItem(QKEY + who()) || '[]').filter((x) => now - (x.at || 0) < EXPIRY); return q; } catch { return []; } };
const setQ = (q) => { try { localStorage.setItem(QKEY + who(), JSON.stringify(q)); } catch {} };
const pending = () => getQ().filter((x) => !x.failed);
let FLUSHING = false, SENDING = false; // SENDING: a double tap on «Enviar» must not make two reports
async function flushQueue() {
  if (FLUSHING || !TOKEN) return; FLUSHING = true;
  try {
    for (const it of pending()) {
      try { await call('POST', '/api/ref/report', { fixtureId: it.fixtureId, report: it.report, participants: it.participants }); setQ(getQ().filter((x) => x.id !== it.id)); NOTE = { kind: 'ok', text: `Volvió la señal: ya se envió ${it.title}. Falta la aprobación del organizador.` }; }
      catch (e) { if (e.status) { setQ(getQ().map((x) => (x.id === it.id ? { ...x, failed: e.message } : x))); NOTE = { kind: 'bad', text: `No se pudo enviar ${it.title}: ${e.message}. Se queda guardado hasta que lo veas.` }; } else break; }
    }
  } finally { FLUSHING = false; }
  await refresh();
}
async function refresh() {
  try { const j = await call('GET', '/api/ref/fixtures'); FX = j.fixtures; KO = j.koLevel; WO = j.walkoverGoals || null; try { localStorage.setItem(FXKEY + who(), JSON.stringify({ at: Date.now(), koLevel: j.koLevel, walkoverGoals: j.walkoverGoals, fixtures: j.fixtures.map((f) => ({ id: f.id, stage: f.stage, round: f.round, kickoff: f.kickoff, pitch: f.pitch, home: f.home && { id: f.home.id, name: f.home.name, roster: f.home.roster.map((r) => ({ id: r.id, number: r.number })) }, away: f.away && { id: f.away.id, name: f.away.name, roster: f.away.roster.map((r) => ({ id: r.id, number: r.number })) }, approved: f.approved, submitted: f.submitted })) })); } catch {} }
  catch (e) {
    if (e.status === 401 || e.status === 403) { try { localStorage.removeItem(FXKEY + who()); if (!pending().length) localStorage.removeItem(QKEY + who()); } catch {} TOKEN = null; sessionStorage.removeItem('ref'); NOTE = { kind: 'bad', text: 'Código no válido.' }; FX = null; }
    else if (!e.status) { // no signal: keep what is on screen, or the last saved list
      if (!FX) { try { const j = JSON.parse(localStorage.getItem(FXKEY + who()) || 'null'); if (j && Date.now() - (j.at || 0) < EXPIRY) { FX = j.fixtures; KO = j.koLevel; WO = j.walkoverGoals || null; } } catch {} }
      if (!pending().length && !(NOTE && NOTE.kind === 'warn')) NOTE = { kind: 'warn', text: 'Sin señal. Puedes seguir anotando: se guarda en tu teléfono y se envía solo cuando vuelva.' };
    } else { NOTE = { kind: 'bad', text: 'No disponible: ' + e.message }; FX = null; }
  }
  // a «Enviado» note about a match that is already approved is stale: drop it
  if (NOTE && NOTE.kind === 'ok' && NOTE.fixtureId && FX && FX.some((f) => f.id === NOTE.fixtureId && f.approved)) NOTE = null;
  render();
}
setInterval(() => { if (TOKEN && !OPEN && !(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) refresh(); }, 15000);
window.addEventListener('online', () => flushQueue());
setInterval(() => { if (pending().length) flushQueue(); }, 15000);
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const nice = (k) => { if (!k) return ''; const d = new Date(k.slice(0, 10) + 'T12:00'); return DIAS[d.getDay()] + ' ' + L.t12(k); };
function stepper(key, label) {
  const out = el('output', { id: 'v-' + key }, DRAFT[key]);
  const set = (d) => { DRAFT[key] = Math.max(0, Math.min(99, DRAFT[key] + d)); render(); };
  return el('div', { class: 'rcol' }, el('div', { class: 'rname' }, label),
    el('div', { class: 'stepper v' }, el('button', { 'aria-label': 'menos ' + label, 'data-minus': key, onclick: () => set(-1) }, '−'), out, el('button', { 'aria-label': 'más ' + label, 'data-plus': key, onclick: () => set(1) }, '+')));
}
function render() {
  const msg = NOTE ? el('div', { class: 'banner ' + NOTE.kind, role: 'status', id: 'note', 'data-kind': NOTE.kind }, NOTE.text) : null;
  if (!TOKEN) {
    main.replaceChildren(...[msg, el('div', { class: 'card' }, el('h2', {}, 'Entrar'), el('div', { class: 'pad' }, el('label', { for: 'tok' }, 'Código de árbitro'), el('input', { id: 'tok', autocomplete: 'off' }),
      el('button', { class: 'btn', id: 'go', onclick: () => { TOKEN = document.getElementById('tok').value.trim(); sessionStorage.setItem('ref', TOKEN); NOTE = null; refresh(); } }, 'Entrar')))].filter(Boolean));
    return;
  }
  if (!FX) { main.replaceChildren(...[msg].filter(Boolean)); return; }
  if (OPEN) {
    const f = FX.find((x) => x.id === OPEN);
    const tie = DRAFT.hg === DRAFT.ag;
    const kids = [el('h2', {}, `${f.home.name} vs ${f.away.name}`), el('div', { class: 'stickyScore', id: 'stickyScore' }, `${f.home.name} ${DRAFT.wo ? '–' : DRAFT.hg} – ${DRAFT.wo ? '–' : DRAFT.ag} ${f.away.name}`)];
    if (f.kickoff || f.pitch) kids.push(el('p', { class: 'meta pad' }, [nice(f.kickoff), f.pitch || ''].filter(Boolean).join(' · ')));
    // D205 O1: W.O. only when the rule is confirmed; the official score comes from the rule, never typed.
    if (WO) kids.push(el('details', { class: 'pad woBox', ...(DRAFT.wo ? { open: 'open' } : {}) }, el('summary', { class: 'btn sec' }, '¿Un equipo no se presentó?'), el('label', { for: 'wo' }, 'Si se presentaron los dos, deja «Sí, se jugó»'),
      el('select', { id: 'wo', onchange: (e) => { DRAFT.wo = e.target.value || null; render(); } },
        [['', 'Sí, se jugó'], ['h', `No se presentó ${f.home.name} (W.O. ${0}-${WO})`], ['a', `No se presentó ${f.away.name} (W.O. ${WO}-0)`]].map(([v, t]) => el('option', { value: v, ...(DRAFT.wo === (v || null) ? { selected: 'selected' } : {}) }, t)))));
    if (DRAFT.wo) {
      kids.push(el('p', { class: 'meta pad', id: 'woNote' }, `W.O.: marcador oficial ${DRAFT.wo === 'a' ? WO + ' - 0' : '0 - ' + WO}. Sin goles, tarjetas, prórroga ni penales.`));
    } else {
      kids.push(el('div', { class: 'rgrid' }, stepper('hg', f.home.name), stepper('ag', f.away.name)));
    }
    const needEt = !DRAFT.wo && f.stage === 'ko' && tie && KO === 'ET_THEN_PENS';
    const needPens = !DRAFT.wo && f.stage === 'ko' && tie && (KO === 'PENS' || (needEt && DRAFT.eh === DRAFT.ea));
    if (needEt) kids.push(el('div', { class: 'pad' }, el('div', { class: 'step' }, 'Empate · goles en la prórroga'), stepper('eh', 'Prórroga ' + f.home.name), stepper('ea', 'Prórroga ' + f.away.name)));
    if (needPens) kids.push(el('div', { class: 'pad' }, el('div', { class: 'step' }, 'Tanda de penales (no cuenta como goles)'), stepper('ph', 'Penales ' + f.home.name), stepper('pa', 'Penales ' + f.away.name)));
    if (!DRAFT.wo && f.stage === 'ko' && tie && KO === 'PENDIENTE') kids.push(el('p', { class: 'meta pad' }, 'La regla de desempate de eliminatoria aún no está confirmada: el ganador quedará por definir.'));
    if (!DRAFT.wo && DRAFT.hg + DRAFT.ag > 0) {
      const rows = [];
      for (const sd of ['h', 'a']) {
        const team = sd === 'h' ? f.home : f.away, n = sd === 'h' ? DRAFT.hg : DRAFT.ag; DRAFT.gl[sd].length = n;
        for (let i = 0; i < n; i++) {
          const g = DRAFT.gl[sd][i] || (DRAFT.gl[sd][i] = { p: null, m: '' });
          rows.push(el('div', { class: 'grow', 'data-goal': sd + i }, el('div', { class: 'gt' }, el('span', {}, `Gol ${i + 1} · ${team.name}`), el('input', { type: 'number', min: '1', max: '130', inputmode: 'numeric', placeholder: 'Min.', 'aria-label': 'Minuto del gol (opcional)', value: g.m, oninput: (e) => { g.m = e.target.value; } })),
            chips('gs-' + sd + i, [...team.roster.map((x) => [x.id, `#${x.number} ${x.displayName || ''}`.trim()]), ['', 'No sé']], g.p, (v) => { g.p = v; render(); }, 'Quién metió el gol de ' + team.name)));
        }
      }
      kids.push(el('div', { class: 'pad', id: 'goals' }, el('div', { class: 'step' }, '¿Quién metió los goles? (si lo sabes)'), el('p', { class: 'meta' }, 'Elige quién metió cada gol. El minuto es opcional.'), ...rows));
    }
    // D205 O1: cards. "Sin anotar" (unknown) is different from "No hubo tarjetas" (recorded, zero): missing is never zero.
    if (!DRAFT.wo) {
      const side = (x) => (x === 'h' ? f.home : f.away);
      const ck = [el('div', { class: 'step' }, 'Tarjetas (opcional)')];
      if (DRAFT.cards === null) ck.push(el('p', { class: 'meta', id: 'cardsState' }, 'Tarjetas: sin anotar.'),
        el('button', { class: 'btn sec', id: 'noCards', onclick: () => { DRAFT.cards = []; render(); } }, 'No hubo tarjetas'),
        el('button', { class: 'btn sec', id: 'addCards', onclick: () => { DRAFT.cards = []; DRAFT.cardForm = true; render(); } }, 'Anotar tarjetas'));
      else {
        ck.push(el('p', { class: 'meta', id: 'cardsState' }, DRAFT.cards.length ? `${DRAFT.cards.length} tarjeta(s) anotada(s).` : 'No hubo tarjetas.'),
          ...DRAFT.cards.map((c, i) => el('div', { class: 'row', 'data-card': i }, el('div', { class: 'team' }, `${c.kind === 'amarilla' ? 'Amarilla' : 'Expulsión'} · ${side(c.side).name}${c.number !== undefined ? ' · #' + c.number : ''} · min ${c.minute}`),
            el('button', { class: 'btn sec inline', onclick: () => { DRAFT.cards.splice(i, 1); render(); } }, 'Quitar'))),
          el('label', { for: 'cs' }, 'Equipo'), el('select', { id: 'cs' }, [['h', f.home.name], ['a', f.away.name]].map(([v, t]) => el('option', { value: v }, t))),
          el('label', { for: 'ck' }, 'Tarjeta'), el('select', { id: 'ck' }, [['amarilla', 'Amarilla'], ['expulsion', 'Expulsión (roja o doble amarilla)']].map(([v, t]) => el('option', { value: v }, t))),
          el('label', { for: 'cm' }, 'Minuto'), el('input', { id: 'cm', type: 'number', min: '1', max: '130', inputmode: 'numeric' }),
          el('label', { for: 'cd' }, 'Dorsal (opcional)'), el('input', { id: 'cd', type: 'number', min: '0', max: '99', inputmode: 'numeric' }),
          el('button', { class: 'btn sec', id: 'addCard', onclick: () => {
            const sd = document.getElementById('cs').value, minute = Number(document.getElementById('cm').value), dv = document.getElementById('cd').value;
            if (!Number.isInteger(minute) || minute < 1 || minute > 130) { NOTE = { kind: 'warn', text: 'Escribe el minuto (1 a 130).' }; return render(); }
            const card = { side: sd, kind: document.getElementById('ck').value, minute };
            if (dv !== '') { const pl = side(sd).roster.find((p) => p.number === Number(dv)); if (!pl) { NOTE = { kind: 'warn', text: `No hay dorsal ${dv} en ${side(sd).name}.` }; return render(); } card.playerId = pl.id; card.number = pl.number; }
            DRAFT.cards.push(card); NOTE = null; render(); } }, 'Agregar tarjeta'),
          el('label', {}, el('input', { type: 'checkbox', id: 'invH', class: 'chk', ...(DRAFT.inv.h ? { checked: 'checked' } : {}), onchange: (e) => { DRAFT.inv.h = e.target.checked; } }), `La barra de ${f.home.name} invadió el campo`),
          el('label', {}, el('input', { type: 'checkbox', id: 'invA', class: 'chk', ...(DRAFT.inv.a ? { checked: 'checked' } : {}), onchange: (e) => { DRAFT.inv.a = e.target.checked; } }), `La barra de ${f.away.name} invadió el campo`),
          el('button', { class: 'btn sec', id: 'clearCards', onclick: () => { DRAFT.cards = null; DRAFT.inv = { h: false, a: false }; render(); } }, 'Volver a «sin anotar»'));
      }
      if (DRAFT.cards !== null && !DRAFT.cardForm && !DRAFT.cards.length) { // «No hubo tarjetas» = no form; the form opens only when asked
        const ck0 = ck[0], keep = ck.filter((n) => n && (n.id === 'cardsState' || n.id === 'clearCards'));
        keep.splice(1, 0, el('button', { class: 'btn sec', id: 'openCardForm', onclick: () => { DRAFT.cardForm = true; render(); } }, 'Anotar una tarjeta')); ck.length = 0; ck.push(ck0, ...keep); }
      kids.push(el('div', { class: 'pad', id: 'cards' }, ...ck));
    }
    if (NOTE && NOTE.kind !== 'ok') kids.push(el('div', { class: 'pad' }, el('div', { class: 'banner ' + NOTE.kind, role: 'alert', id: 'noteNear', 'data-kind': NOTE.kind }, NOTE.text)));
    { const miss = ['h', 'a'].reduce((n, sd) => n + DRAFT.gl[sd].filter((g) => !g.p).length, 0); if (!DRAFT.wo && DRAFT.hg + DRAFT.ag > 0 && miss > 0) kids.push(el('div', { class: 'pad' }, el('p', { class: 'meta', id: 'missNudge' }, `Faltan ${miss} goleador${miss > 1 ? 'es' : ''} (opcional).`))); }
    kids.push(el('div', { class: 'pad' }, el('p', { class: 'meta' }, 'Revisa el marcador. Al enviar, el organizador lo aprueba antes de que sea público.'),
      el('button', { class: 'btn', id: 'send', onclick: async () => {
        if (SENDING) return; SENDING = true; try {
        let report;
        if (DRAFT.wo) report = DRAFT.wo === 'a' ? { hg: WO, ag: 0, wo: 'a' } : { hg: 0, ag: WO, wo: 'h' };
        else {
          report = { hg: DRAFT.hg, ag: DRAFT.ag };
          const gl = ['h', 'a'].flatMap((sd) => DRAFT.gl[sd].map((g) => ({ sd, g })));
          if (gl.some((x) => x.g.p || x.g.m !== '')) { // unchosen scorer (null) = nobody named for that goal
            for (const x of gl) { if (x.g.m === '') continue; const m = Number(x.g.m); if (!Number.isInteger(m) || m < 1 || m > 130) { NOTE = { kind: 'warn', text: 'El minuto va de 1 a 130. Déjalo en blanco si no lo sabes.' }; return render(); } }
            report.goals = gl.map((x) => ({ side: x.sd, ...(x.g.m !== '' ? { minute: Number(x.g.m) } : {}), ...(x.g.p ? { playerId: x.g.p } : {}) }));
          }
          if (needEt) report.et = { hg: DRAFT.eh, ag: DRAFT.ea };
          if (needPens) report.pens = { hg: DRAFT.ph, ag: DRAFT.pa };
          if (DRAFT.cards !== null) { report.cards = DRAFT.cards.map(({ number, ...c }) => c); const inv = ['h', 'a'].filter((x) => DRAFT.inv[x]); if (inv.length) report.invasion = inv; }
        }
        const snap = { home: f.home.id, away: f.away.id };
        try { await call('POST', '/api/ref/report', { fixtureId: f.id, report, participants: snap }); NOTE = { kind: 'ok', fixtureId: f.id, text: `✓ Enviado: ${f.home.name} ${scoreText(report)} ${f.away.name}. Falta la aprobación del organizador.` }; OPEN = null; }
        catch (e) {
          if (!e.status) { setQ(getQ().filter((x) => x.fixtureId !== f.id).concat([{ id: 'q' + Date.now(), at: Date.now(), fixtureId: f.id, report, participants: snap, title: `${f.home.name} ${scoreText(report)} ${f.away.name}` }]));
            NOTE = { kind: 'warn', text: `Sin señal: guardé ${f.home.name} ${scoreText(report)} ${f.away.name} en tu teléfono. Se enviará solo cuando vuelva la señal; puedes seguir con el siguiente partido.` }; OPEN = null; }
          else NOTE = { kind: 'bad', text: 'No se envió: ' + e.message + '. Tu marcador sigue aquí; intenta de nuevo.' }; }
        await refresh(); window.scrollTo(0, 0);
        } finally { SENDING = false; }
      } }, 'Enviar resultado'), el('button', { class: 'btn sec', id: 'back', onclick: () => { OPEN = null; NOTE = null; render(); } }, 'Volver')));
    main.replaceChildren(...[msg, el('div', { class: 'card refForm' }, ...kids)].filter(Boolean));
    return;
  }
  const list = FX.length ? FX.slice().sort((a, b) => (a.kickoff || 'z').localeCompare(b.kickoff || 'z')).map((f) => el('div', { class: 'row', 'data-fixture': f.id }, el('div', { class: 'team' }, f.home && f.away ? `${f.home.name} vs ${f.away.name}` : `${f.round || ''} · equipos por definir`,
    el('div', { class: 'meta' }, [nice(f.kickoff), f.pitch || '', f.approved ? 'Aprobado' : f.invalidated ? 'Resultado anulado (' + f.invalidated + ') · vuelve a anotarlo' : getQ().some((x) => x.fixtureId === f.id && x.failed) ? 'No se pudo enviar · anótalo de nuevo' : pending().some((x) => x.fixtureId === f.id) ? 'Guardado en tu teléfono · falta enviar' : f.submitted ? 'Enviado · esperando al organizador' : 'Pendiente'].filter(Boolean).join(' · '))),
    !f.approved && f.home && f.away ? el('button', { class: 'btn inline' + (f.submitted ? ' sec' : ''), [f.submitted && !f.invalidated ? 'data-resend' : 'data-open']: f.id, onclick: () => { OPEN = f.id; NOTE = null; DRAFT = { gl: { h: [], a: [] }, hg: 0, ag: 0, eh: 0, ea: 0, ph: 0, pa: 0, wo: null, cards: null, inv: { h: false, a: false } }; render(); } }, f.submitted && !f.invalidated ? 'Corregir' : 'Anotar') : null))
    : [el('div', { class: 'msg' }, 'No tienes partidos asignados.')];
  const failed = getQ().filter((x) => x.failed).map((x) => el('div', { class: 'banner bad', 'data-failed': x.id }, `${x.title}: ${x.failed}`, el('button', { class: 'btn sec', 'data-discard': x.id, onclick: () => { setQ(getQ().filter((y) => y.id !== x.id)); render(); } }, 'Descartar')));
  const exit = el('button', { class: 'btn sec', id: 'logout', onclick: () => { const n = pending().length; if (!window.confirm(n ? `Hay ${n} marcador(es) sin enviar. Si sales y borras, se pierden. ¿Salir de todos modos?` : '¿Salir y borrar los datos de este teléfono?')) return; try { localStorage.removeItem(FXKEY + who()); localStorage.removeItem(QKEY + who()); } catch {} TOKEN = null; FX = null; sessionStorage.removeItem('ref'); NOTE = { kind: 'ok', text: 'Listo: saliste y se borraron los datos de este teléfono.' }; render(); } }, 'Cambiar de árbitro');
  const who2 = window.TosDemo ? el('div', { class: 'card', id: 'demoRef' }, el('div', { class: 'pad' }, el('div', { class: 'step' }, 'Partidos de la cancha'), chips('refPick', [['DEMO-REF1', 'Cancha 1'], ['DEMO-REF2', 'Cancha 2']], TOKEN, (v) => { window.TosDemo.setRef(v); TOKEN = v; FX = null; OPEN = null; NOTE = null; refresh(); }, 'Árbitro de qué cancha'))) : null;
  main.replaceChildren(...[msg, who2, ...failed, el('div', { class: 'card' }, el('h2', {}, 'Mis partidos' + (() => { const ps = [...new Set((FX || []).map((f) => f.pitch).filter(Boolean))]; return ps.length === 1 ? ' · ' + ps[0] : ''; })()), list), FX ? exit : null].filter(Boolean));
}
TOKEN ? refresh() : render();
