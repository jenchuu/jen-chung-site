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
  // The archive is a row of cards. The section pins while you scroll down and the row
  // slides left, at every screen size. With reduced motion, or on very short screens
  // (phones held sideways), it's a row you swipe instead.
  const archive = document.getElementById('archive');
  if (archive) {
    const row = archive.querySelector('.grid-archive');
    const canPin = () => innerHeight >= SHORT_SCREEN && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pinned = false, maxShift = 0, raf = 0;
    const content = archive.firstElementChild;                  // h2 + row
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
        // slide until the last card lines up with the page's right margin
        const r = row.getBoundingClientRect(), last = row.lastElementChild.getBoundingClientRect();
        const margin = parseFloat(getComputedStyle(row).paddingRight) || 0;
        maxShift = Math.max(0, Math.ceil(last.right - r.left + margin - row.clientWidth));
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
      }
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener('scroll', queue, { passive: true });
    row.addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', layout);
    window.addEventListener('load', layout);
    layout();
  }

  /* ---- Case study password gate --------------------------------------------------- */
  // On a case study with data-gate, everything after the summary stays hidden (the page's
  // head script adds .cs-is-locked). Scrolling past the summary opens the password modal; the
  // right password reveals the rest and is remembered on this device. The page only stores
  // the password's SHA-256, so the password itself isn't readable in the source.
  // (This keeps casual visitors out; it isn't real security. Anyone who reads the source can
  // still see the hidden text and images.)
  const gated = document.querySelector('main[data-gate]');
  const gate = document.getElementById('gate');
  if (gated && gate) {
    const KEY = `jc-unlocked-${gated.dataset.gate}`;
    const sentinel = document.querySelector('.cs-gate-sentinel');
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-input');
    const error = document.getElementById('gate-error');
    const locked = () => root.classList.contains('cs-is-locked');
    let armed = true;          // after closing, the modal waits until you scroll back up and past again
    let lastFocus = null;

    const sha256 = async (text) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    };
    function openGate() {
      if (!gate.hidden) return;
      lastFocus = document.activeElement;
      gate.hidden = false;
      root.classList.add('gate-open');
      input.value = ''; error.textContent = ''; gate.classList.remove('is-wrong');
      setTimeout(() => input.focus(), 50);
    }
    function closeGate() {
      gate.hidden = true;
      root.classList.remove('gate-open');
      armed = false;
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }
    function check() {
      if (!locked() || !gate.hidden || !sentinel) return;
      const top = sentinel.getBoundingClientRect().top;
      if (top > innerHeight) armed = true;                      // summary's end is below the screen again
      // (scrollY > 0: they scrolled. On a screen tall enough to show the whole summary there's
      // nothing to scroll, so a scroll attempt — wheel or swipe — counts too.)
      else if (armed && top < innerHeight - 40 && (scrollY > 0 || tried)) openGate();
    }
    let tried = false;
    const attempt = () => { if (document.documentElement.scrollHeight <= innerHeight + 1) { tried = true; check(); } };
    addEventListener('wheel', attempt, { passive: true });
    addEventListener('touchmove', attempt, { passive: true });
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);

    gate.addEventListener('click', (e) => { if (e.target.closest('[data-gate-close]')) closeGate(); });
    gate.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeGate();
      if (e.key === 'Tab') {                                     // keep focus inside the modal
        const items = [...gate.querySelectorAll('button, input, a[href]')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = false;
      try { ok = (await sha256(input.value.trim())) === gated.dataset.gateHash; } catch (err) {}
      if (!ok) {
        gate.classList.remove('is-wrong'); void gate.offsetWidth; gate.classList.add('is-wrong');
        error.textContent = 'That password isn’t right. Try again?';
        input.select();
        return;
      }
      try { localStorage.setItem(KEY, '1'); } catch (err) {}
      root.classList.remove('cs-is-locked');
      gate.hidden = true;
      root.classList.remove('gate-open');
      document.getElementById('cs-gated').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }

  /* ---- Konbini hero ------------------------------------------------------------- */
  // The hero is its own page (konbini/konbini-hero.html) shown in a frame. It talks to this
  // page with messages: theme, page width, frame height, case-study links and the ↓ scroll.
  // (Only the home page has it; everything below is skipped on case studies.)
  function tellHero(msg) { if (hero && hero.contentWindow) hero.contentWindow.postMessage(msg, '*'); }
  if (!hero) return;
  const hello = () => tellHero({ type: 'konbini:hello', width: innerWidth, height: innerHeight, theme: theme() });

  // Inside the konbini (the fridge) is its own page at #konbini: the rest of the home page
  // hides, and the browser's Back button walks back out through the doors.
  const KONBINI_HASH = '#konbini';
  const atKonbini = () => location.hash === KONBINI_HASH;
  let pushedKonbini = false;
  function setInside(inside) {
    document.body.classList.toggle('in-konbini', inside);
    if (inside) scrollTo(0, 0);
  }
  addEventListener('hashchange', () => {
    if (atKonbini()) { if (heroView !== 'fridge') tellHero({ type: 'konbini:enter', quick: true }); return; }
    pushedKonbini = false;
    if (heroView === 'fridge') {
      tellHero({ type: 'konbini:exit' });
      const target = location.hash && document.getElementById(location.hash.slice(1));   // e.g. Work in the nav
      if (target) { setInside(false); target.scrollIntoView(); }
    }
  });

  hero.src = `konbini/konbini-hero.html?theme=${theme()}&fit=${HERO_FIT}${atKonbini() ? '&view=fridge' : ''}`;
  if (atKonbini()) setInside(true);
  hero.addEventListener('load', hello);

  let heroNatural = 0, heroView = 'store';
  function sizeHero() {
    const gap = parseFloat(getComputedStyle(hero.parentElement).paddingTop) || 0;
    const room = Math.max(420, innerHeight - nav.offsetHeight - gap);
    // Storefront: no taller than it needs (no gap above Work). Inside the fridge: the full
    // screen height, since it's a page of its own.
    const fitToContent = heroNatural && heroView !== 'fridge';
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
    if (msg.type === 'konbini:view') {
      heroView = msg.view;
      const inside = heroView === 'fridge';
      setInside(inside);
      try {
        if (inside && !atKonbini()) { history.pushState(null, '', KONBINI_HASH); pushedKonbini = true; }
        else if (!inside && atKonbini()) {
          if (pushedKonbini) history.back();      // Exit = Back, so Back from the home page leaves as usual
          else history.replaceState(null, '', location.pathname + location.search);
          pushedKonbini = false;
        }
      } catch (err) {}
      sizeHero();
    }
    if (msg.type === 'konbini:navigate' && msg.url) location.href = msg.url;
    if (msg.type === 'konbini:scroll') document.getElementById('work').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  sizeHero();
})();
