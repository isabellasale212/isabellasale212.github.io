/*
  Bath Lacrosse athlete monitoring dashboard (sample data).
  A Power BI style report rebuilt in plain JavaScript and SVG so it runs on GitHub Pages.
  All data is simulated with a fixed seed: same numbers on every load, no real athlete data.
*/
(() => {
  const C = { navy: '#1f2a8a', navyL: '#8e97db', navyD: '#141b5c', gold: '#e3a83b', goldL: '#f3d79f', ink: '#1b1d29', muted: '#6a6f80', grid: '#e6e8ef', red: '#c2502a', green: '#2f9e6b' };
  const TYPE_COL = { Training: C.navy, Match: C.gold };
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ---------- Seeded random ----------
  let seed = 2025;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const avg = (a) => (a.length ? sum(a) / a.length : 0);

  // ---------- Squad ----------
  const POSITIONS = { Attack: 'ABCDE', Midfield: 'FGHIJKL', Defence: 'MNOPQR', Goalkeeper: 'ST' };
  const POS_BASE = { Attack: [4300, 0.11], Midfield: [5300, 0.13], Defence: [4000, 0.09], Goalkeeper: [1700, 0.03] };
  const players = [];
  Object.entries(POSITIONS).forEach(([pos, ids]) => ids.split('').forEach((id) => {
    players.push({ id, name: `Player ${id}`, pos, dist: POS_BASE[pos][0] * (1 + 0.1 * gauss()), hsr: POS_BASE[pos][1] * (1 + 0.15 * gauss()), cmj: 30 + 4 * gauss(), trend: 0.04 + 0.11 * gauss() });
  }));
  const pById = Object.fromEntries(players.map((p) => [p.id, p]));

  // Injury spells (week index ranges) so availability changes through the season
  const INJURY = { G: [6, 8, 'Ankle niggle'], N: [14, 17, 'Hamstring tightness'], C: [19, 20, 'Hand'], Q: [23, 25, 'Knee soreness'], K: [25, 25, 'Illness'] };
  const isOut = (pid, w) => INJURY[pid] && w >= INJURY[pid][0] && w <= INJURY[pid][1];

  // ---------- Season ----------
  const START = Date.UTC(2025, 8, 29); // Monday 29 Sep 2025
  const N_WEEKS = 26;
  const BREAK = new Set([11, 12, 13]); // winter break
  const SESSIONS = [{ dow: 1, type: 'Training' }, { dow: 2, type: 'Match' }, { dow: 3, type: 'Training' }, { dow: 5, type: 'Training' }];
  const gps = []; const well = []; const cmj = []; const flags = [];
  const fmtDate = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`; };

  for (let w = 0; w < N_WEEKS; w++) {
    if (BREAK.has(w)) continue;
    const weekPhase = 1 + 0.12 * Math.sin(w / 2.2); // undulating load
    players.forEach((p) => {
      if (isOut(p.id, w)) return;
      const pw = 1 + 0.16 * gauss() + (INJURY[p.id] && w === INJURY[p.id][1] + 1 ? 0.35 : 0); // player-week variation, spike on return
      // weekly CMJ test on Monday
      cmj.push({ w, pid: p.id, pos: p.pos, t: START + (w * 7) * 864e5, v: +(p.cmj + p.trend * w - 1.4 * (weekPhase - 1) * 5 + 1.1 * gauss()).toFixed(1) });
      SESSIONS.forEach((s, si) => {
        if (s.type === 'Match' && (w === 0 || w % 5 === 4)) return; // bye weeks
        const t = START + (w * 7 + s.dow) * 864e5;
        // pre-session check-in (about 9 in 10 complete)
        const done = rnd() < 0.9;
        const afterMatch = si === 2;
        if (done) {
          const sore = clamp(Math.round(2 + (afterMatch ? 1 : 0) + (weekPhase - 1) * 4 + 0.8 * gauss()), 1, 5);
          const fat = clamp(Math.round(2 + (afterMatch ? 0.7 : 0) + (weekPhase - 1) * 4 + 0.8 * gauss()), 1, 5);
          const str = clamp(Math.round(2.2 + (w > 20 ? 0.6 : 0) + 0.8 * gauss()), 1, 5);
          const slp = clamp(Math.round(3.7 - (w > 20 ? 0.4 : 0) + 0.8 * gauss()), 1, 5);
          const ready = Math.round(((6 - sore) + (6 - fat) + (6 - str) + slp) / 20 * 100);
          well.push({ w, t, pid: p.id, pos: p.pos, done: true, sore, fat, str, slp, ready });
          if (sore >= 5 && rnd() < 0.35) flags.push({ t, pid: p.id, pos: p.pos, note: 'High soreness flagged' });
        } else {
          well.push({ w, t, pid: p.id, pos: p.pos, done: false });
        }
        const m = s.type === 'Match' ? 1.32 : s.dow === 5 ? 0.78 : 1;
        const dist = Math.max(600, p.dist * m * weekPhase * pw * (1 + 0.08 * gauss()));
        const hsr = Math.max(0, dist * p.hsr * (s.type === 'Match' ? 1.25 : 1) * (1 + 0.18 * gauss()));
        gps.push({ w, t, dow: s.dow, type: s.type, pid: p.id, pos: p.pos, dist, hsr, acc: Math.round(dist / 115 * (1 + 0.15 * gauss())) });
      });
    });
    Object.entries(INJURY).forEach(([pid, [a, , note]]) => { if (a === w) flags.push({ t: START + w * 7 * 864e5, pid, pos: pById[pid].pos, note, injury: true }); });
  }
  const LAST_W = N_WEEKS - 1;
  const WEEKS = [...Array(N_WEEKS).keys()].filter((w) => !BREAK.has(w));
  const weekLabel = (w) => { const d = new Date(START + w * 7 * 864e5); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

  // ---------- Filter state ----------
  const state = { tab: 'load', pos: null, pid: null, type: null };
  const keep = (r, { ignoreType = false } = {}) =>
    (!state.pos || r.pos === state.pos) && (!state.pid || r.pid === state.pid) && (ignoreType || !state.type || !r.type || r.type === state.type);
  const F = (rows, o) => rows.filter((r) => keep(r, o));

  // ---------- SVG helpers ----------
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const tipAttr = (t) => ` data-tip="${esc(t)}"`;
  const clickAttr = (k, v) => ` data-k="${k}" data-v="${esc(v)}" class="clickable"`;
  const nice = (v) => { if (v <= 0) return 1; const e = 10 ** Math.floor(Math.log10(v)); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  const fmt = (v, d = 0) => v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtK = (v) => (v >= 1e6 ? fmt(v / 1e6, 1) + 'M' : v >= 1e3 ? fmt(v / 1e3, v >= 1e4 ? 0 : 1) + 'K' : fmt(v));
  const legend = (items) => `<div class="lg">${items.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>`;
  const dimmed = (k, v) => (state[k] && state[k] !== v ? ' opacity="0.3"' : '');

  function donut(items, { W = 420, H = 250, center = '', clickKey } = {}) {
    const total = sum(items.map((d) => d.value)) || 1;
    const cx = W / 2, cy = H / 2 + 6, R = 76, r = 28;
    let a0 = -Math.PI / 2, out = '';
    items.forEach((d, i) => {
      const a1 = a0 + (d.value / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
      const pct = (d.value / total) * 100;
      const path = d.value >= total ? `M${cx - R},${cy}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0M${cx - r},${cy}a${r},${r} 0 1,1 ${2 * r},0a${r},${r} 0 1,1 ${-2 * r},0` : `M${x0},${y0}A${R},${R} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 ${large} 0 ${x3},${y3}Z`;
      out += `<path d="${path}" fill="${d.color}" fill-rule="evenodd" stroke="#fff" stroke-width="1.5"${clickKey ? clickAttr(clickKey, d.label) : ''}${dimmed(clickKey, d.label)}${tipAttr(`${d.label}: ${d.fmt ? d.fmt(d.value) : fmt(d.value)} (${pct.toFixed(1)}%)`)}/>`;
      // leader label
      const am = (a0 + a1) / 2; const [lx, ly] = p(am, R + 8); const [ex, ey] = p(am, R + 22);
      const right = Math.cos(am) >= 0; const tx = right ? ex + 14 : ex - 14;
      out += `<polyline points="${lx},${ly} ${ex},${ey} ${tx},${ey}" fill="none" stroke="${C.ink}" stroke-width="1"/>`;
      out += `<text x="${right ? tx + 4 : tx - 4}" y="${ey + 4}" font-size="12" text-anchor="${right ? 'start' : 'end'}" fill="${C.ink}">${d.label} ${pct.toFixed(1)}%</text>`;
      a0 = a1;
    });
    if (center) out += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="${C.ink}">${center}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function hbar(cats, series, { W = 420, rowH = 30, labelW = 110, clickKey, valFmt = fmt, maxV } = {}) {
    const H = cats.length * rowH + 30;
    const totals = cats.map((_, i) => sum(series.map((s) => s.values[i])));
    const max = maxV || nice(Math.max(...totals, 1));
    const x = (v) => labelW + (v / max) * (W - labelW - 16);
    let out = '';
    for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; out += `<line x1="${x(v)}" x2="${x(v)}" y1="0" y2="${H - 24}" stroke="${C.grid}"/><text x="${x(v)}" y="${H - 8}" font-size="11.5" text-anchor="middle" fill="${C.muted}">${fmtK(v)}</text>`; }
    cats.forEach((c, i) => {
      const y = i * rowH + 4; let acc = 0;
      out += `<text x="${labelW - 8}" y="${y + rowH / 2 + 2}" font-size="12.5" text-anchor="end" fill="${C.ink}"${clickKey ? clickAttr(clickKey, c.key ?? c) : ''}>${c.label ?? c}</text>`;
      series.forEach((s) => {
        const v = s.values[i]; if (!v) return;
        out += `<rect x="${x(acc)}" y="${y + 3}" width="${Math.max(0, x(acc + v) - x(acc))}" height="${rowH - 10}" fill="${s.color}"${clickKey ? clickAttr(clickKey, c.key ?? c) : ''}${clickKey ? dimmed(clickKey, c.key ?? c) : ''}${tipAttr(`${c.label ?? c}${s.name ? ' · ' + s.name : ''}: ${valFmt(v)}`)}/>`;
        acc += v;
      });
    });
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function vbar(cats, series, { W = 420, H = 230, valFmt = fmt, sub } = {}) {
    const L = 44, B = sub ? 40 : 26, T = 8;
    const totals = cats.map((_, i) => sum(series.map((s) => s.values[i])));
    const max = nice(Math.max(...totals, 1));
    const y = (v) => H - B - (v / max) * (H - B - T);
    const bw = (W - L - 6) / cats.length;
    let out = '';
    for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; out += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11.5" text-anchor="end" fill="${C.muted}">${fmtK(v)}</text>`; }
    cats.forEach((c, i) => {
      let acc = 0; const x0 = L + i * bw + bw * 0.08;
      series.forEach((s) => {
        const v = s.values[i]; if (!v) return;
        out += `<rect x="${x0}" y="${y(acc + v)}" width="${bw * 0.84}" height="${y(acc) - y(acc + v)}" fill="${s.color}"${tipAttr(`${c}${s.name ? ' · ' + s.name : ''}: ${valFmt(v)}`)}/>`;
        acc += v;
      });
      out += `<text x="${x0 + bw * 0.42}" y="${H - B + 16}" font-size="12" text-anchor="middle" fill="${C.ink}">${c}</text>`;
    });
    if (sub) out += `<text x="${L + (W - L) / 2}" y="${H - 6}" font-size="12" text-anchor="middle" fill="${C.muted}">${sub}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function line(xl, series, { W = 860, H = 240, min, max, valFmt = (v) => fmt(v, 1), band } = {}) {
    const L = 40, B = 28, T = 10, R = 10;
    const all = series.flatMap((s) => s.values.filter((v) => v != null));
    const lo = min ?? Math.floor(Math.min(...all)); const hi = max ?? Math.ceil(Math.max(...all));
    const x = (i) => L + (i / Math.max(1, xl.length - 1)) * (W - L - R);
    const y = (v) => H - B - ((v - lo) / (hi - lo || 1)) * (H - B - T);
    let out = '';
    if (band) out += `<rect x="${L}" y="${y(band[1])}" width="${W - L - R}" height="${y(band[0]) - y(band[1])}" fill="${C.green}" opacity=".08"/>`;
    for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) / 4) * i; out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11.5" text-anchor="end" fill="${C.muted}">${fmt(v, hi - lo < 6 ? 1 : 0)}</text>`; }
    const step = Math.ceil(xl.length / 9);
    xl.forEach((l, i) => { if (i % step === 0) out += `<text x="${x(i)}" y="${H - 8}" font-size="11.5" text-anchor="middle" fill="${C.muted}">${l}</text>`; });
    series.forEach((s) => {
      let d = ''; let pen = false;
      s.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i)},${y(v)}`; pen = true; });
      out += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
      s.values.forEach((v, i) => { if (v != null) out += `<circle cx="${x(i)}" cy="${y(v)}" r="3.2" fill="#fff" stroke="${s.color}" stroke-width="1.6"${tipAttr(`${s.name} · w/c ${xl[i]}: ${valFmt(v)}`)}/>`; });
    });
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function spark(vals, W = 64, H = 40) {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const x = (i) => (i / (vals.length - 1)) * W; const y = (v) => H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 6);
    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}L${W},${H}L0,${H}Z" fill="#c8cbe0"/><path d="${d}" fill="none" stroke="${C.ink}" stroke-width="1.4"/></svg>`;
  }

  function gauge(pct) {
    const W = 176, H = 82, cx = 88, cy = 72, R = 52, r = 34;
    const arc = (a0, a1, col) => {
      const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
      return `<path d="M${x0},${y0}A${R},${R} 0 0 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 0 0 ${x3},${y3}Z" fill="${col}"/>`;
    };
    const a = Math.PI + (clamp(pct, 0, 100) / 100) * Math.PI;
    return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:170px">${arc(Math.PI, 2 * Math.PI, '#e3e5ec')}${arc(Math.PI, a, C.navyD)}<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="19" font-weight="700" fill="${C.ink}">${Math.round(pct)} %</text><text x="${cx - R - 2}" y="${cy + 6}" font-size="10" text-anchor="end" fill="${C.ink}">0 %</text><text x="${cx + R + 2}" y="${cy + 6}" font-size="10" fill="${C.ink}">100 %</text></svg>`;
  }

  function heatmap(rowsL, colsL, M, { W = 860, cellH = 20, labelW = 74 } = {}) {
    const H = rowsL.length * cellH + 24; const cw = (W - labelW) / colsL.length;
    const col = (v) => v == null ? '#f1f2f6' : v >= 75 ? C.navy : v >= 68 ? '#5964bd' : v >= 60 ? C.navyL : v >= 52 ? C.goldL : C.gold;
    let out = '';
    rowsL.forEach((rl, i) => {
      out += `<text x="${labelW - 8}" y="${i * cellH + cellH / 2 + 4}" font-size="11.5" text-anchor="end" fill="${C.ink}" data-k="pid" data-v="${rl.id}" class="clickable">${rl.label}</text>`;
      colsL.forEach((cl, j) => {
        const v = M[i][j];
        out += `<rect x="${labelW + j * cw + 1}" y="${i * cellH + 1}" width="${cw - 2}" height="${cellH - 2}" rx="3" fill="${col(v)}"${tipAttr(`${rl.label} · w/c ${cl}: ${v == null ? 'no data / unavailable' : 'readiness ' + v + '%'}`)}/>`;
        if (v != null && cw > 34) out += `<text x="${labelW + j * cw + cw / 2}" y="${i * cellH + cellH / 2 + 4}" font-size="10.5" text-anchor="middle" fill="${v >= 68 ? '#fff' : C.ink}" pointer-events="none">${v}</text>`;
      });
    });
    colsL.forEach((cl, j) => { out += `<text x="${labelW + j * cw + cw / 2}" y="${H - 6}" font-size="11" text-anchor="middle" fill="${C.muted}">${cl}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function acwrChart(items, { W = 420 } = {}) {
    const rowH = 17, labelW = 70, H = items.length * rowH + 30, lo = 0.4, hi = 1.8;
    const x = (v) => labelW + ((clamp(v, lo, hi) - lo) / (hi - lo)) * (W - labelW - 40);
    let out = `<rect x="${x(0.8)}" y="0" width="${x(1.3) - x(0.8)}" height="${H - 24}" fill="${C.green}" opacity=".1"/>`;
    [0.5, 0.8, 1.0, 1.3, 1.6].forEach((t) => { out += `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H - 24}" stroke="${C.grid}"${t === 1 ? '' : ' stroke-dasharray="3 3"'}/><text x="${x(t)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="${C.muted}">${t.toFixed(1)}</text>`; });
    items.forEach((d, i) => {
      const y = i * rowH + rowH / 2 + 2; const c = d.v > 1.3 ? C.red : d.v < 0.8 ? C.gold : C.navy;
      out += `<text x="${labelW - 8}" y="${y + 4}" font-size="11.5" text-anchor="end" fill="${C.ink}" data-k="pid" data-v="${d.id}" class="clickable">${d.label}</text>`;
      out += `<line x1="${x(1)}" x2="${x(d.v)}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="2"/><circle cx="${x(d.v)}" cy="${y}" r="5" fill="${c}"${tipAttr(`${d.label}: ACWR ${d.v.toFixed(2)}${d.v > 1.3 ? ' · spike, review load' : d.v < 0.8 ? ' · underloaded' : ' · in range'}`)}/>`;
      out += `<text x="${x(d.v) + (d.v >= 1 ? 9 : -9)}" y="${y + 4}" font-size="10.5" text-anchor="${d.v >= 1 ? 'start' : 'end'}" fill="${C.muted}">${d.v.toFixed(2)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function diverging(items, { W = 860, rowH = 18, labelW = 74 } = {}) {
    const H = items.length * rowH + 28; const m = Math.max(3, ...items.map((d) => Math.abs(d.v))); const mid = labelW + (W - labelW) / 2;
    const x = (v) => mid + (v / m) * ((W - labelW) / 2 - 30);
    let out = '';
    [-m, -m / 2, 0, m / 2, m].forEach((t) => { out += `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H - 22}" stroke="${t === 0 ? C.muted : C.grid}"/><text x="${x(t)}" y="${H - 6}" font-size="11" text-anchor="middle" fill="${C.muted}">${t > 0 ? '+' : ''}${fmt(t, 1)} cm</text>`; });
    items.forEach((d, i) => {
      const y = i * rowH + 2; const c = d.v >= 0 ? C.navy : C.gold;
      out += `<text x="${labelW - 8}" y="${y + rowH / 2 + 3}" font-size="11.5" text-anchor="end" fill="${C.ink}" data-k="pid" data-v="${d.id}" class="clickable">${d.label}</text>`;
      out += `<rect x="${Math.min(x(0), x(d.v))}" y="${y + 2}" width="${Math.abs(x(d.v) - x(0))}" height="${rowH - 5}" fill="${c}" rx="2"${tipAttr(`${d.label}: ${d.v >= 0 ? '+' : ''}${d.v.toFixed(1)} cm vs first 4 weeks`)}/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  function scatter(pts, { W = 420, H = 250, xl, yl } = {}) {
    const L = 44, B = 40, T = 10, R = 10;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const x = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R); const y = (v) => H - B - ((v - y0) / (y1 - y0 || 1)) * (H - B - T);
    let out = '';
    for (let i = 0; i <= 4; i++) { const vy = y0 + ((y1 - y0) / 4) * i; out += `<line x1="${L}" x2="${W - R}" y1="${y(vy)}" y2="${y(vy)}" stroke="${C.grid}"/><text x="${L - 6}" y="${y(vy) + 4}" font-size="11" text-anchor="end" fill="${C.muted}">${fmt(vy, 1)}</text>`; }
    for (let i = 0; i <= 3; i++) { const vx = x0 + ((x1 - x0) / 3) * i; out += `<text x="${x(vx)}" y="${H - B + 16}" font-size="11" text-anchor="middle" fill="${C.muted}">${fmtK(vx)}</text>`; }
    // least squares trend
    const mx = avg(xs), my = avg(ys); const b = sum(pts.map((p) => (p.x - mx) * (p.y - my))) / (sum(pts.map((p) => (p.x - mx) ** 2)) || 1); const a = my - b * mx;
    const r = sum(pts.map((p) => (p.x - mx) * (p.y - my))) / Math.sqrt(sum(xs.map((v) => (v - mx) ** 2)) * sum(ys.map((v) => (v - my) ** 2)) || 1);
    pts.forEach((p) => { out += `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="3" fill="${C.navy}" opacity=".55"${tipAttr(`${p.label}: ${fmt(p.x)} m, ${p.y >= 0 ? '+' : ''}${p.y.toFixed(1)} cm`)}/>`; });
    out += `<line x1="${x(x0)}" y1="${y(a + b * x0)}" x2="${x(x1)}" y2="${y(a + b * x1)}" stroke="${C.gold}" stroke-width="2" stroke-dasharray="6 4"/>`;
    out += `<text x="${W - R}" y="${T + 12}" font-size="12" text-anchor="end" fill="${C.ink}">r = ${r.toFixed(2)}</text>`;
    out += `<text x="${L + (W - L) / 2}" y="${H - 6}" font-size="11.5" text-anchor="middle" fill="${C.muted}">${xl}</text>`;
    out += `<text transform="translate(11 ${(H - B) / 2}) rotate(-90)" font-size="11.5" text-anchor="middle" fill="${C.muted}">${yl}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }

  // ---------- Aggregations ----------
  const posList = Object.keys(POSITIONS);
  const scopePlayers = () => players.filter((p) => (!state.pos || p.pos === state.pos) && (!state.pid || p.id === state.pid));
  const monthKey = (t) => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const weeklyDistance = (rows, pid) => { const m = {}; rows.forEach((r) => { if (!pid || r.pid === pid) m[r.w] = (m[r.w] || 0) + r.dist; }); return m; };

  // ---------- Render ----------
  const $ = (s) => document.querySelector(s);
  const viz = (title, body, { span = 1, lg = '', hint = '' } = {}) =>
    `<div class="viz${span === 2 ? ' span2' : ''}"><h3>${title}</h3>${hint ? `<span class="hint" data-tip="${esc(hint)}">?</span>` : ''}${lg}${body}</div>`;

  function renderKPIs() {
    const W = F(well, { ignoreType: true }); const done = W.filter((r) => r.done);
    const G = F(gps); const J = F(cmj, { ignoreType: true });
    const byWeek = (rows, fn) => WEEKS.map((w) => fn(rows.filter((r) => r.w === w)));
    const sp = scopePlayers(); const out = sp.filter((p) => isOut(p.id, LAST_W)).length;
    const recent = J.filter((r) => r.w > LAST_W - 4);
    const k = [
      ['Check-ins', '#5a64c8', `<div><b>${fmt(done.length)}</b><span>Total Check-ins</span></div>${spark(byWeek(done, (a) => a.length))}`],
      ['Completion', C.navyD, gauge((done.length / (W.length || 1)) * 100)],
      ['Readiness', '#2b3a8f', gauge(avg(done.map((r) => r.ready)))],
      ['Total Distance', '#6a5f3a', `<div><b>${fmt(sum(G.map((r) => r.dist)) / 1000, 0)} km</b><span>${state.type ? state.type : 'All sessions'}</span></div>${spark(byWeek(G, (a) => sum(a.map((r) => r.dist))))}`],
      ['CMJ Height', '#b07f22', `<div><b>${fmt(avg(recent.map((r) => r.v)), 1)} cm</b><span>Avg, last 4 wks</span></div>${spark(byWeek(J, (a) => avg(a.map((r) => r.v)) || null).filter((v) => v))}`],
    ];
    $('#kpis').innerHTML = k.map(([h, c, b]) => `<div class="kpi"><div class="kh" style="background:${c}">${h}</div><div class="kb"${b.startsWith('<svg') ? ' style="justify-content:center"' : ''}>${b}</div></div>`).join('') +
      `<div class="kpi plain"><div><b>${out} | ${sp.length ? Math.round((out / sp.length) * 100) : 0}%</b><span>Unavailable this week</span></div></div>`;
  }

  function renderLoad() {
    const G = F(gps); const GnoType = F(gps, { ignoreType: true });
    const types = ['Training', 'Match'];
    const tot = (rows) => sum(rows.map((r) => r.dist));
    const s1 = viz('Total Distance by Session Type', donut(types.map((t) => ({ label: t, value: tot(GnoType.filter((r) => r.type === t)), color: TYPE_COL[t], fmt: (v) => fmt(v / 1000, 0) + ' km' })), { clickKey: 'type' }), { hint: 'Click a segment to filter by session type.' });

    const posCats = posList.filter((p) => !state.pid || pById[state.pid].pos === p);
    const tSeries = (fn) => types.filter((t) => !state.type || t === state.type).map((t) => ({ name: t, color: TYPE_COL[t], values: fn(t) }));
    const s2 = viz('Total Distance by Position & Session Type', hbar(posCats.map((p) => ({ label: p, key: p })), tSeries((t) => posCats.map((p) => tot(gps.filter((r) => r.pos === p && r.type === t)))), { clickKey: 'pos', valFmt: (v) => fmt(v / 1000, 0) + ' km', labelW: 92 }),
      { lg: legend(types.map((t) => [t, TYPE_COL[t]])), hint: 'Click a position to filter the whole report.' });

    const hsrBy = {}; G.forEach((r) => { hsrBy[r.pid] = hsrBy[r.pid] || { Training: 0, Match: 0 }; hsrBy[r.pid][r.type] += r.hsr; });
    const top = Object.entries(hsrBy).sort((a, b) => (b[1].Training + b[1].Match) - (a[1].Training + a[1].Match)).slice(0, 7);
    const s3 = viz('High-Speed Running by Player & Type', hbar(top.map(([id]) => ({ label: pById[id].name, key: id })), tSeries((t) => top.map(([, v]) => v[t])), { clickKey: 'pid', valFmt: (v) => fmt(v / 1000, 1) + ' km', labelW: 80, rowH: 26 }),
      { lg: legend(types.map((t) => [t, TYPE_COL[t]])), hint: 'Season total. Top 7 players in the current filter.' });

    const months = [...new Set(gps.map((r) => monthKey(r.t)))].sort((a, b) => a - b);
    const s4 = viz('Total Distance by Month & Session Type', vbar(months.map((m) => MONTHS[m % 12]), tSeries((t) => months.map((m) => tot(G.filter((r) => r.type === t && monthKey(r.t) === m)))), { valFmt: (v) => fmt(v / 1000, 0) + ' km', sub: '2025 - 26 season' }), { lg: legend(types.map((t) => [t, TYPE_COL[t]])) });

    const dows = [1, 2, 3, 5];
    const s5 = viz('Total Distance by Day & Session Type', vbar(dows.map((d) => DAYS[d]), tSeries((t) => dows.map((d) => tot(G.filter((r) => r.type === t && r.dow === d)))), { valFmt: (v) => fmt(v / 1000, 0) + ' km' }), { lg: legend(types.map((t) => [t, TYPE_COL[t]])) });

    const ac = scopePlayers().filter((p) => !isOut(p.id, LAST_W)).map((p) => {
      const wd = weeklyDistance(GnoType, p.id); const chronic = avg([LAST_W - 1, LAST_W - 2, LAST_W - 3, LAST_W - 4].map((w) => wd[w] || 0));
      return { id: p.id, label: p.name, v: chronic ? (wd[LAST_W] || 0) / chronic : 1 };
    }).sort((a, b) => b.v - a.v);
    const s6 = viz('Acute:Chronic Workload Ratio (this week)', acwrChart(ac), { lg: legend([['Spike > 1.3', C.red], ['In range', C.navy], ['Under 0.8', C.gold]]), hint: 'This week\'s distance divided by the average of the previous 4 weeks. Green band = 0.8 to 1.3.' });
    return s1 + s2 + s3 + s4 + s5 + s6;
  }

  function renderWellness() {
    const W = F(well, { ignoreType: true }); const done = W.filter((r) => r.done);
    const s1 = viz('Check-in Completion', donut([{ label: 'Completed', value: done.length, color: C.navy }, { label: 'Missed', value: W.length - done.length, color: C.navyL }], { center: `${fmt(W.length)} due` }), { hint: 'Pre-session check-ins completed vs expected.' });

    const metrics = [['Soreness', 'sore', C.gold], ['Fatigue', 'fat', C.red], ['Stress', 'str', '#8e97db'], ['Sleep', 'slp', C.navy]];
    const s2 = viz('Squad Wellness by Week (1 to 5)', line(WEEKS.map(weekLabel), metrics.map(([n, k, c]) => ({ name: n, color: c, values: WEEKS.map((w) => { const a = done.filter((r) => r.w === w).map((r) => r[k]); return a.length ? +avg(a).toFixed(2) : null; }) })), { min: 1, max: 5, valFmt: (v) => v.toFixed(2) }),
      { span: 2, lg: legend(metrics.map(([n, , c]) => [n, c])), hint: 'Higher sleep is better. Higher soreness, fatigue and stress are worse.' });

    const lastW = WEEKS.slice(-8);
    const sp = scopePlayers();
    const M = sp.map((p) => lastW.map((w) => { const a = done.filter((r) => r.pid === p.id && r.w === w).map((r) => r.ready); return a.length ? Math.round(avg(a)) : null; }));
    const s3 = viz('Readiness by Player, last 8 weeks (%)', heatmap(sp.map((p) => ({ id: p.id, label: p.name })), lastW.map(weekLabel), M), { span: 2, lg: legend([['75+', C.navy], ['68 to 74', '#5964bd'], ['60 to 67', C.navyL], ['52 to 59', C.goldL], ['Under 52', C.gold], ['No data', '#e3e5ec']]), hint: 'Readiness combines soreness, fatigue, stress and sleep. Click a name to filter.' });

    const posCats = posList.filter((p) => !state.pid || pById[state.pid].pos === p);
    const s4 = viz('Avg Readiness by Position', hbar(posCats.map((p) => ({ label: p, key: p })), [{ name: 'Readiness', color: C.navy, values: posCats.map((p) => avg(well.filter((r) => r.done && r.pos === p).map((r) => r.ready))) }], { clickKey: 'pos', maxV: 100, valFmt: (v) => fmt(v, 1) + '%', labelW: 92 }), { hint: 'Click a position to filter.' });

    const FL = F(flags, { ignoreType: true });
    const months = [...new Set(gps.map((r) => monthKey(r.t)))].sort((a, b) => a - b);
    const s5 = viz('Flags Raised by Month', vbar(months.map((m) => MONTHS[m % 12]), [
      { name: 'Injury', color: C.gold, values: months.map((m) => FL.filter((f) => f.injury && monthKey(f.t) === m).length) },
      { name: 'High soreness', color: C.navy, values: months.map((m) => FL.filter((f) => !f.injury && monthKey(f.t) === m).length) }]), { lg: legend([['Injury', C.gold], ['High soreness', C.navy]]) });

    const latest = FL.slice().sort((a, b) => b.t - a.t).slice(0, 7);
    const tbl = `<table class="tbl"><thead><tr><th>Date</th><th>Player</th><th>Position</th><th>Flag</th></tr></thead><tbody>${latest.map((f) => `<tr><td>${fmtDate(f.t)}</td><td>${pById[f.pid].name}</td><td>${f.pos}</td><td class="${f.injury ? 'flag' : ''}">${f.note}</td></tr>`).join('') || '<tr><td colspan="4">No flags in this filter</td></tr>'}</tbody></table>`;
    const s6 = viz('Latest Flags', tbl, { span: 2 });
    return s1 + s2 + s3 + s4 + s5 + s6;
  }

  function renderTesting() {
    const J = F(cmj, { ignoreType: true }); const sp = scopePlayers();
    const s1 = viz('Squad CMJ Jump Height by Week (cm)', line(WEEKS.map(weekLabel), [{ name: state.pid ? pById[state.pid].name : state.pos || 'Squad', color: C.navy, values: WEEKS.map((w) => { const a = J.filter((r) => r.w === w).map((r) => r.v); return a.length ? +avg(a).toFixed(1) : null; }) }], { valFmt: (v) => v.toFixed(1) + ' cm' }), { span: 2, hint: 'Weekly Monday CMJ. A sustained drop can signal accumulated fatigue.' });

    const posCats = posList.filter((p) => !state.pid || pById[state.pid].pos === p);
    const s2 = viz('Avg CMJ Height by Position', hbar(posCats.map((p) => ({ label: p, key: p })), [{ name: 'CMJ', color: C.gold, values: posCats.map((p) => avg(cmj.filter((r) => r.pos === p).map((r) => r.v))) }], { clickKey: 'pos', valFmt: (v) => fmt(v, 1) + ' cm', labelW: 92, maxV: 40 }), { hint: 'Click a position to filter.' });

    const change = sp.map((p) => {
      const rows = cmj.filter((r) => r.pid === p.id).sort((a, b) => a.w - b.w);
      const base = avg(rows.slice(0, 4).map((r) => r.v)); const last = avg(rows.slice(-4).map((r) => r.v));
      return { id: p.id, label: p.name, v: last - base };
    }).sort((a, b) => b.v - a.v);
    const s3 = viz('CMJ Change: last 4 weeks vs first 4 weeks', diverging(change), { span: 2, lg: legend([['Improved', C.navy], ['Dropped', C.gold]]), hint: 'Click a name to filter.' });

    const G = F(gps, { ignoreType: true });
    const pts = [];
    sp.forEach((p) => {
      const wd = weeklyDistance(G, p.id); const rows = cmj.filter((r) => r.pid === p.id); const base = avg(rows.slice(0, 4).map((r) => r.v));
      rows.forEach((r) => { if (wd[r.w - 1]) pts.push({ x: wd[r.w - 1], y: r.v - base, label: `${p.name}, w/c ${weekLabel(r.w)}` }); });
    });
    const s4 = viz('Previous Week Load vs CMJ Change', scatter(pts, { xl: 'previous week distance (m)', yl: 'CMJ change (cm)' }), { hint: 'Each dot is one player-week.' });
    return s1 + s2 + s3 + s4;
  }

  function render() {
    renderKPIs();
    $('#canvas').innerHTML = state.tab === 'load' ? renderLoad() : state.tab === 'wellness' ? renderWellness() : renderTesting();
    const parts = [state.type, state.pos, state.pid && pById[state.pid].name].filter(Boolean);
    $('#chip').classList.toggle('on', parts.length > 0);
    $('#chipTxt').textContent = 'Filtered: ' + parts.join(' · ');
    $('#slicer').value = state.pid ? 'pid:' + state.pid : state.pos ? 'pos:' + state.pos : 'all';
  }

  // ---------- Controls ----------
  const sel = $('#slicer');
  sel.innerHTML = '<option value="all">All</option>' + posList.map((pos) => `<optgroup label="${pos}"><option value="pos:${pos}">All ${pos}</option>${players.filter((p) => p.pos === pos).map((p) => `<option value="pid:${p.id}">${p.name}</option>`).join('')}</optgroup>`).join('');
  sel.addEventListener('change', () => {
    const [k, v] = sel.value.split(':');
    state.pos = k === 'pos' ? v : k === 'pid' ? pById[v].pos : null;
    state.pid = k === 'pid' ? v : null;
    render();
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
    state.tab = t.dataset.tab; render();
  }));
  const reset = () => { state.pos = state.pid = state.type = null; render(); };
  $('#resetBtn').addEventListener('click', reset);
  $('#chipX').addEventListener('click', reset);
  $('#infoBtn').addEventListener('click', () => alertBox());

  // Cross-filter clicks (toggle)
  $('#canvas').addEventListener('click', (e) => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const k = el.dataset.k, v = el.dataset.v;
    if (k === 'type') state.type = state.type === v ? null : v;
    if (k === 'pos') { if (state.pos === v && !state.pid) state.pos = null; else { state.pos = v; state.pid = null; } }
    if (k === 'pid') { if (state.pid === v) state.pid = null; else { state.pid = v; state.pos = pById[v].pos; } }
    hideTip(); render();
  });

  // Tooltip
  const tip = $('#tip');
  const hideTip = () => { tip.style.opacity = 0; };
  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el || !$('#pbi').contains(el)) return hideTip();
    tip.textContent = el.dataset.tip; tip.style.opacity = 1;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY + 16) + 'px';
  });
  document.addEventListener('touchstart', hideTip, { passive: true });

  // About panel (non-blocking, no browser dialogs)
  function alertBox() {
    let box = document.getElementById('aboutBox');
    if (box) { box.remove(); return; }
    box = document.createElement('div'); box.id = 'aboutBox';
    box.style.cssText = 'background:#fff;border-radius:10px;padding:14px 18px;margin:10px 0 0;font-size:13.5px;color:#1b1d29;border:1px solid #dfe2ec';
    box.innerHTML = '<b>About this report.</b> An MSc project exploring how to show performance data to coaches, informed by working with Power BI reports at Scottish Rugby. My working versions use US lacrosse data sets. This public version is simulated: 20 anonymised players, 23 weeks, GPS load, pre-session wellness check-ins, weekly CMJ testing and injury flags. Click charts to cross-filter, use the slicer to drill into a position or player, and Reset Filters to start again.';
    $('.pbi-head').after(box);
  }

  render();
})();
