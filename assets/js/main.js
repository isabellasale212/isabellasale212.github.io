// Small, dependency-free interactions.

// Sticky nav border once the page scrolls
const nav = document.querySelector('.nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Experience accordion: one row open at a time
document.querySelectorAll('.xp-head').forEach((btn) => {
  btn.addEventListener('click', () => {
    const row = btn.closest('.xp-row');
    const wasOpen = row.classList.contains('open');
    document.querySelectorAll('.xp-row.open').forEach((r) => {
      r.classList.remove('open');
      r.querySelector('.xp-head').setAttribute('aria-expanded', 'false');
    });
    if (!wasOpen) {
      row.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// Fade sections in as they enter the viewport
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 })
  : null;
document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

// Year in footer
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

/*
  Correlation dot plot for the dissertation.
  Values are taken directly from Tables 4 and 5 of the submitted dissertation (April 2026).
  Each row: label, r (or Spearman rho), p, group.
*/
const CORRELATIONS = [
  { group: 'Jump RFD vs 505 braking RFD', label: 'CMJ peak vs 505 peak', r: -0.20, p: 0.423 },
  { group: 'Jump RFD vs 505 braking RFD', label: 'CMJ avg vs 505 avg', r: -0.25, p: 0.290 },
  { group: 'Jump RFD vs 505 braking RFD', label: 'DJ avg vs 505 avg', r: 0.15, p: 0.551 },
  { group: 'Jump RFD vs 505 braking RFD', label: 'DJ peak vs 505 peak', r: -0.17, p: 0.484 },
  { group: 'Jump RFD vs 505 braking RFD', label: 'BJ avg vs 505 avg', r: 0.35, p: 0.188 },
  { group: 'Jump RFD vs 505 braking RFD', label: 'BJ peak vs 505 peak', r: 0.26, p: 0.332 },
  { group: 'Jump RFD vs 505 time', label: 'CMJ peak vs 505 time', r: -0.55, p: 0.014 },
  { group: 'Jump RFD vs 505 time', label: 'CMJ avg vs 505 time', r: -0.34, p: 0.142 },
  { group: 'Jump RFD vs 505 time', label: 'DJ peak vs 505 time', r: -0.30, p: 0.204 },
  { group: 'Jump RFD vs 505 time', label: 'BJ avg vs 505 time', r: -0.19, p: 0.493 },
  { group: 'Jump RFD vs 505 time', label: 'BJ peak vs 505 time', r: -0.10, p: 0.704 },
  { group: 'Jump RFD vs 505 time', label: 'DJ avg vs 505 time', r: 0.08, p: 0.759 },
];

function drawCorrelationPlot(el, { compact = false } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const dark = el.dataset.theme === 'dark';
  const ink = dark ? '#f6f5f2' : '#141414';
  const muted = dark ? '#8d8b86' : '#6e6c68';
  const line = dark ? '#3a3a3a' : '#e2dfd8';
  const sig = dark ? '#8f9cff' : '#1f2a8a';
  const W = compact ? 300 : 720;
  const left = compact ? 0 : 190;
  const right = 24;
  const rowH = compact ? 15 : 30;
  const groupGap = compact ? 14 : 40;
  const top = compact ? 8 : 34;
  const groups = [...new Set(CORRELATIONS.map((d) => d.group))];
  const H = top + CORRELATIONS.length * rowH + (groups.length - 1) * groupGap + (compact ? 10 : 46);
  const x = (r) => left + ((r + 1) / 2) * (W - left - right);

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Correlation coefficients between jump eccentric RFD and 505 outcomes. Only CMJ peak RFD versus 505 time was significant, r = -0.55, p = 0.014.');
  const add = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    svg.appendChild(n);
    return n;
  };

  const bottom = H - (compact ? 6 : 30);
  // "trivial" zone, |r| < 0.3
  add('rect', { x: x(-0.3), y: top - 10, width: x(0.3) - x(-0.3), height: bottom - top + 4, fill: dark ? '#1f1f1f' : '#f3f1ec', rx: 6 });
  [-1, -0.5, 0, 0.5, 1].forEach((t) => {
    add('line', { x1: x(t), x2: x(t), y1: top - 10, y2: bottom - 6, stroke: t === 0 ? muted : line, 'stroke-width': t === 0 ? 1 : 1, 'stroke-dasharray': t === 0 ? '' : '3 4' });
    if (!compact) add('text', { x: x(t), y: bottom + 16, 'text-anchor': 'middle', 'font-size': 12, fill: muted }, t.toFixed(1));
  });
  if (!compact) add('text', { x: x(0), y: 14, 'text-anchor': 'middle', 'font-size': 12, fill: muted }, 'shaded = weak (|r| < 0.3)');

  let y = top;
  groups.forEach((g, gi) => {
    if (gi > 0) y += groupGap;
    if (!compact) add('text', { x: 0, y: y - 2, 'font-size': 12, 'font-weight': 600, fill: ink, 'letter-spacing': '.04em' }, g.toUpperCase());
    CORRELATIONS.filter((d) => d.group === g).forEach((d) => {
      y += rowH;
      const s = d.p < 0.05;
      const cy = y - rowH / 2 + (compact ? 0 : 4);
      if (!compact) add('text', { x: 0, y: cy + 4, 'font-size': 13, fill: s ? ink : muted, 'font-weight': s ? 600 : 400 }, d.label);
      add('line', { x1: x(0), x2: x(d.r), y1: cy, y2: cy, stroke: s ? sig : muted, 'stroke-width': s ? 2.5 : 1.5, opacity: s ? 1 : 0.6 });
      const c = add('circle', { cx: x(d.r), cy, r: compact ? (s ? 5 : 3.5) : (s ? 7 : 5), fill: s ? sig : dark ? '#141414' : '#fff', stroke: s ? sig : muted, 'stroke-width': 1.5 });
      const t = document.createElementNS(ns, 'title');
      t.textContent = `${d.label}: r = ${d.r.toFixed(2)}, p = ${d.p.toFixed(3)}`;
      c.appendChild(t);
      if (!compact) add('text', { x: d.r < 0 ? x(d.r) - 12 : x(d.r) + 12, y: cy + 4, 'font-size': 12, 'text-anchor': d.r < 0 ? 'end' : 'start', fill: s ? sig : muted, 'font-weight': s ? 600 : 400 }, (s ? 'r = ' : '') + d.r.toFixed(2) + (s ? '  p = 0.014' : ''));
    });
  });
  if (!compact) add('text', { x: x(0), y: H - 2, 'text-anchor': 'middle', 'font-size': 12, fill: muted }, 'correlation coefficient (r / rho)');
  el.appendChild(svg);
}

document.querySelectorAll('[data-corr-plot]').forEach((el) => drawCorrelationPlot(el, { compact: el.dataset.corrPlot === 'compact' }));
