/* ==========================================================================
   jen-chung.com — site behaviour: theme toggle, mobile menu, konbini hero bridge
   ========================================================================== */
(() => {
  'use strict';

  /* ✏️ Settings ------------------------------------------------------------------- */
  // How the hero fits the screen:
  // 'crop'  = full width; on shorter screens the konbini gets shorter (crops sky/pavement)
  //           so the intro, konbini and helper line all fit above the fold.
  // 'width' = full width at full height (the helper line may sit below the fold).
  // 'scale' = everything shrinks to fit (narrower than the rest of the page).
  const HERO_FIT = 'crop';
  const SHORT_SCREEN = 500;      // windows shorter than this (phones held sideways): hero isn't fit to the screen
  const REVEAL_FIRST_MS = 150;   // first card's delay once its row scrolls into view
  const REVEAL_STEP_MS = 500;    // then each next card, in reading order
  // (how long each card's own animation takes is --reveal-dur in css/site.css)
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

  /* ---- Archive: horizontal scroll ------------------------------------------------- */
  // The archive is a row of cards. On larger screens the section pins while you scroll
  // down and the row slides left; on phones (and with reduced motion) it's a row you swipe.
  const archive = document.getElementById('archive');
  if (archive) {
    const row = archive.querySelector('.grid-archive');
    const cards = [...row.children];
    const N = cards.length;
    const progress = Object.assign(document.createElement('div'), { className: 'archive-progress' });
    progress.innerHTML = '<span class="archive-count">1 of ' + N + '</span><span class="archive-bar"><span></span></span>';
    row.after(progress);
    const count = progress.querySelector('.archive-count'), fill = progress.querySelector('.archive-bar span');
    const show = (p) => {   // p: 0 … 1 along the row
      fill.style.transform = `scaleX(${Math.max(0.04, p)})`;
      const edge = progress.getBoundingClientRect().left + 40;   // the content's left edge (doesn't move)
      const first = cards.findIndex((c) => c.getBoundingClientRect().right > edge);
      const i = p > 0.995 ? N - 1 : Math.max(0, first);
      count.textContent = `${i + 1} of ${N}`;
    };

    const canPin = () => innerWidth >= 760 && innerHeight >= 560 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pinned = false, maxShift = 0, raf = 0;
    const content = archive.firstElementChild;                  // h2 + row + progress
    const pin = Object.assign(document.createElement('div'), { className: 'archive-pin' });
    const stage = Object.assign(document.createElement('div'), { className: 'archive-stage' });
    function layout() {
      const want = canPin();
      if (want !== pinned) {
        pinned = want;
        archive.classList.toggle('is-pinned', pinned);
        if (pinned) { stage.append(content); pin.append(stage); archive.append(pin); }
        else { archive.append(content); pin.remove(); row.style.transform = ''; }
      }
      if (pinned) {
        maxShift = Math.max(0, row.scrollWidth - row.clientWidth);
        pin.style.height = `${maxShift + innerHeight}px`;     // one pixel down = one pixel sideways
      }
      update();
    }
    function update() {
      raf = 0;
      if (pinned) {
        const r = pin.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
        row.style.transform = `translate3d(${-p * maxShift}px, 0, 0)`;
        show(p);
      } else {
        show(row.scrollLeft / Math.max(1, row.scrollWidth - row.clientWidth));
      }
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener('scroll', queue, { passive: true });
    row.addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', layout);
    window.addEventListener('load', layout);
    layout();
  }

  /* ---- Konbini hero ------------------------------------------------------------- */
  // The hero is its own page (konbini/konbini-hero.html) shown in a frame. It talks to this
  // page with messages: theme, page width, frame height, case-study links and the ↓ scroll.
  function tellHero(msg) { if (hero.contentWindow) hero.contentWindow.postMessage(msg, '*'); }
  const hello = () => tellHero({ type: 'konbini:hello', width: innerWidth, height: innerHeight, theme: theme() });

  hero.src = `konbini/konbini-hero.html?theme=${theme()}&fit=${HERO_FIT}`;
  hero.addEventListener('load', hello);

  let heroNatural = 0, heroView = 'store';
  function sizeHero() {
    const gap = parseFloat(getComputedStyle(hero.parentElement).paddingTop) || 0;
    const room = Math.max(420, innerHeight - nav.offsetHeight - gap);
    // Storefront: no taller than it needs (no gap above Work). Inside the fridge on phones:
    // the full screen height, so the fridge can be shown at full width.
    const fitToContent = heroNatural && !(heroView === 'fridge' && innerWidth < 760 && innerHeight >= SHORT_SCREEN);
    const natural = heroNatural + 2;
    const fold = room - 24;          // keep a little space between the helper line and the fold
    const short = innerHeight < SHORT_SCREEN;
    hero.style.height = `${!fitToContent ? room : (HERO_FIT === 'width' || short) ? natural : Math.min(fold, natural)}px`;
  }
  addEventListener('resize', () => { sizeHero(); hello(); });

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
