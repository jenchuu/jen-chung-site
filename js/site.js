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
  const REVEAL_FIRST_MS = 150;   // first card's delay once its row scrolls into view
  const REVEAL_STEP_MS = 350;    // then each next card, in reading order
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

  /* ---- Archive: Helix runway ------------------------------------------------------ */
  // Built from the archive cards in index.html, so editing a card there updates this too.
  const archive = document.getElementById('archive');
  if (archive && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const cards = [...archive.querySelectorAll('.grid-archive > .card')];
    const N = cards.length;
    const data = cards.map((c) => ({
      img: c.querySelector('img').getAttribute('src'),
      label: c.querySelector('.card-label').textContent,
      desc: c.querySelector('.card-desc').textContent,
      href: c.getAttribute('href'),
    }));
    archive.classList.add('is-runway');
    const runway = Object.assign(document.createElement('div'), { className: 'runway' });
    runway.style.height = `calc(${N - 1} * 45vh + 100vh)`;
    runway.innerHTML = `<div class="runway-stage"><div class="runway-inner">
        <h2>Archive</h2>
        <div class="runway-track" aria-hidden="true"></div>
        <ol class="runway-index" aria-label="Archive projects"></ol>
        <div class="runway-detail" aria-live="polite"><p class="runway-count"></p><h3 class="card-label"></h3><p class="card-desc"></p></div>
      </div></div>`;
    archive.append(runway);
    const track = runway.querySelector('.runway-track'), list = runway.querySelector('.runway-index');
    const detail = runway.querySelector('.runway-detail');
    const items = data.map((d, i) => {
      const it = document.createElement(d.href ? 'a' : 'div');
      it.className = 'runway-item';
      if (d.href) { it.href = d.href; it.tabIndex = -1; }
      it.innerHTML = `<div class="card-media"><img src="${d.img}" alt="" loading="lazy"></div>`;
      it.addEventListener('click', (e) => { if (i !== active) { e.preventDefault(); jump(i); } });
      track.append(it);
      const li = document.createElement('li');
      li.innerHTML = `<button type="button"><span>${String(i + 1).padStart(2, '0')}</span><span>${d.label}</span></button>`;
      li.firstChild.addEventListener('click', () => jump(i));
      list.append(li);
      return it;
    });
    const buttons = [...list.querySelectorAll('button')];

    let cur = 0, active = -1, running = false;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const progress = () => {
      const r = runway.getBoundingClientRect();
      return clamp(-r.top / (r.height - innerHeight), 0, 1) * (N - 1);
    };
    function jump(i) {
      const top = runway.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + (i / (N - 1)) * (runway.offsetHeight - innerHeight), behavior: 'smooth' });
    }
    function setActive(i) {
      if (i === active) return;
      active = i;
      const d = data[i];
      buttons.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      items.forEach((it, k) => it.classList.toggle('is-center', k === i));
      detail.querySelector('.runway-count').textContent = `${i + 1} of ${N}`;
      detail.querySelector('.card-label').textContent = d.label;
      detail.querySelector('.card-desc').textContent = d.desc;
      detail.querySelector('a')?.remove();
      if (d.href) detail.insertAdjacentHTML('beforeend', `<a href="${d.href}">View project <span class="arrow">--&gt;</span></a>`);
    }
    function render() {
      cur += (progress() - cur) * 0.1;
      const step = innerWidth < 760 ? innerWidth * 0.42 : Math.min(320, innerWidth * 0.22);
      items.forEach((el, i) => {
        const d = i - cur, a = Math.abs(d);
        const x = d * step + Math.sin(d * 1.15) * step * 0.35;   // the helix twist
        const y = d * step * 0.42;
        el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${-a * 170}px) rotateY(${-d * 26}deg) rotateX(${d * 4}deg)`;
        el.style.opacity = clamp(1.2 - a * 0.42, 0, 1);              // neighbours fade so the centre leads
        el.style.zIndex = 100 - Math.round(a * 10);
        el.style.pointerEvents = a > 2.5 ? 'none' : '';
      });
      setActive(clamp(Math.round(cur), 0, N - 1));
      if (running) requestAnimationFrame(render);
    }
    new IntersectionObserver(([e]) => {   // only animate while the archive is on screen
      if (e.isIntersecting && !running) { running = true; requestAnimationFrame(render); }
      else if (!e.isIntersecting) running = false;
    }, { rootMargin: '200px 0px' }).observe(runway);
    cur = progress(); setActive(0); render();
  }

  /* ---- Konbini hero ------------------------------------------------------------- */
  // The hero is its own page (konbini/konbini-hero.html) shown in a frame. It talks to this
  // page with messages: theme, page width, frame height, case-study links and the ↓ scroll.
  function tellHero(msg) { if (hero.contentWindow) hero.contentWindow.postMessage(msg, '*'); }
  const hello = () => tellHero({ type: 'konbini:hello', width: innerWidth, theme: theme() });

  hero.src = `konbini/konbini-hero.html?theme=${theme()}&fit=${HERO_FIT}`;
  hero.addEventListener('load', hello);

  let heroNatural = 0, heroView = 'store';
  function sizeHero() {
    const gap = parseFloat(getComputedStyle(hero.parentElement).paddingTop) || 0;
    const room = Math.max(420, innerHeight - nav.offsetHeight - gap);
    // Storefront: no taller than it needs (no gap above Work). Inside the fridge on phones:
    // the full screen height, so the fridge can be shown at full width.
    const fitToContent = heroNatural && !(heroView === 'fridge' && innerWidth < 760);
    const natural = heroNatural + 2;
    const fold = room - 24;          // keep a little space between the helper line and the fold
    hero.style.height = `${!fitToContent ? room : HERO_FIT === 'width' ? natural : Math.min(fold, natural)}px`;
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
