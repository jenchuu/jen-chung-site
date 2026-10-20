/* ==========================================================================
   jen-chung.com — site behaviour: theme toggle, mobile menu, konbini hero bridge
   ========================================================================== */
(() => {
  'use strict';

  /* ✏️ Settings ------------------------------------------------------------------- */
  // true  = the intro, konbini and helper line always use the full content width, like
  //         the rest of the page (on shorter screens the helper line may sit below the fold).
  // false = everything shrinks to fit on one screen.
  const HERO_FULL_WIDTH = true;
  const REVEAL_FIRST_MS = 100;   // first card's delay once its row scrolls into view
  const REVEAL_STEP_MS = 200;    // then each next card, in reading order
  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const theme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');

  /* ---- Light / dark ---------------------------------------------------------- */
  const toggle = document.getElementById('theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  function renderTheme() {
    const dark = theme() === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    themeColor.setAttribute('content', dark ? '#222222' : '#fcf9ef');
  }
  toggle.addEventListener('click', () => {
    root.dataset.theme = theme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('jc-theme', theme()); } catch (e) {}
    renderTheme();
    tellHero({ type: 'konbini:theme', theme: theme() });
  });
  renderTheme();

  /* ---- Mobile menu ------------------------------------------------------------ */
  const nav = document.querySelector('.nav');
  const menuBtn = document.getElementById('menu-btn');
  const setMenu = (open) => { nav.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  document.getElementById('nav-menu').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); } });
  document.addEventListener('click', (e) => { if (nav.classList.contains('is-open') && !nav.contains(e.target)) setMenu(false); });

  /* ---- Card entrance ------------------------------------------------------------ */
  // Each card reveals once, when a fifth of it is on screen — whether visitors scroll,
  // click Work in the nav, or click the ↓ in the konbini. Cards always come in reading
  // order (row 1 left, row 1 right, row 2 left…), one step apart, even if several
  // scroll into view at once.
  if (root.classList.contains('reveal-ready')) {
    const nextStart = new Map();   // per grid: when the next card may start
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting)
        .sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .forEach((e) => {
          const card = e.target, grid = card.parentElement, now = performance.now();
          const start = Math.max(now + REVEAL_FIRST_MS, nextStart.get(grid) || 0);
          nextStart.set(grid, start + REVEAL_STEP_MS);
          card.style.setProperty('--reveal-delay', `${Math.round(start - now)}ms`);
          card.classList.add('is-in');
          io.unobserve(card);
        });
    }, { threshold: 0.2 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  /* ---- Konbini hero ------------------------------------------------------------- */
  // The hero is its own page (konbini/konbini-hero.html) shown in a frame. It talks to this
  // page with messages: theme, page width, frame height, case-study links and the ↓ scroll.
  function tellHero(msg) { if (hero.contentWindow) hero.contentWindow.postMessage(msg, '*'); }
  const hello = () => tellHero({ type: 'konbini:hello', width: innerWidth, theme: theme() });

  hero.src = `konbini/konbini-hero.html?theme=${theme()}${HERO_FULL_WIDTH ? '&fit=width' : ''}`;
  hero.addEventListener('load', hello);

  let heroNatural = 0, heroView = 'store';
  function sizeHero() {
    const gap = parseFloat(getComputedStyle(hero.parentElement).paddingTop) || 0;
    const room = Math.max(420, innerHeight - nav.offsetHeight - gap);
    // Storefront: no taller than it needs (no gap above Work). Inside the fridge on phones:
    // the full screen height, so the fridge can be shown at full width.
    const fitToContent = heroNatural && !(heroView === 'fridge' && innerWidth < 760);
    const natural = heroNatural + 2;
    hero.style.height = `${!fitToContent ? room : HERO_FULL_WIDTH ? natural : Math.min(room, natural)}px`;
  }
  addEventListener('resize', sizeHero);

  addEventListener('message', (e) => {
    if (e.source !== hero.contentWindow) return;
    const msg = e.data || {};
    if (msg.type === 'konbini:ready' || msg.type === 'konbini:measure') hello();
    if (msg.type === 'konbini:size' && msg.height > 0) { heroNatural = msg.height; sizeHero(); }
    if (msg.type === 'konbini:view') { heroView = msg.view; sizeHero(); }
    if (msg.type === 'konbini:navigate' && msg.url) location.href = msg.url;
    if (msg.type === 'konbini:scroll') document.getElementById('work').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  sizeHero();
})();
