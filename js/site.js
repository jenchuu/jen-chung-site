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
  const ARCHIVE_STEP_MS = 120;   // archive cards: no first delay, and this far apart (they take 0.8s each)
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
          const fast = grid.classList.contains('grid-archive');   // archive: no wait, short steps
          const start = Math.max(now + (fast ? 0 : REVEAL_FIRST_MS), nextStart.get(grid) || 0);
          nextStart.set(grid, start + (fast ? ARCHIVE_STEP_MS : REVEAL_STEP_MS));
          // anything before this card that scrolled past too fast to be seen is simply shown
          for (let c = card.previousElementSibling; c; c = c.previousElementSibling) {
            if (c.classList.contains('reveal') && !c.classList.contains('is-in')) { c.classList.add('is-in'); io.unobserve(c); }
          }
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
  // On a case study with data-gate, everything after the summary is locked (the page's head
  // script adds .cs-is-locked): its start shows blurred under the password form, the rest is cut
  // off. The right password unlocks it as soon as it's typed (or on Enter) and is remembered on
  // this device. The page only stores the password's SHA-256, so the password itself isn't
  // readable in the source.
  // (This keeps casual visitors out; it isn't real security. Anyone who reads the source can
  // still see the hidden text and images.)
  const gated = document.querySelector('main[data-gate]');
  const gate = document.getElementById('gate');
  if (gated && gate) {
    const KEY = `jc-unlocked-${gated.dataset.gate}`;
    const hidden = document.getElementById('cs-gated');
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-input');
    const error = document.getElementById('gate-error');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const locked = () => root.classList.contains('cs-is-locked');
    // the blurred part can't be clicked, tabbed into or read out while it's locked
    if (locked()) hidden.inert = true;

    const sha256 = async (text) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    };
    const matches = async () => {
      try { return (await sha256(input.value.trim())) === gated.dataset.gateHash; } catch (err) { return false; }
    };
    function unlock() {
      if (!locked()) return;
      try { localStorage.setItem(KEY, '1'); } catch (err) {}
      input.blur();
      gate.classList.add('is-opening');                          // fade the veil away, then reveal
      setTimeout(() => {
        root.classList.remove('cs-is-locked');
        hidden.inert = false;
        gate.classList.remove('is-opening', 'is-wrong');
        hidden.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' });
      }, reduce.matches ? 0 : 400);
    }
    input.addEventListener('input', async () => {
      if (error.textContent) { error.textContent = ''; gate.classList.remove('is-wrong'); }
      if (await matches()) unlock();                             // no need to press Enter
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await matches()) { unlock(); return; }
      gate.classList.remove('is-wrong'); void gate.offsetWidth; gate.classList.add('is-wrong');
      error.textContent = 'Incorrect password. Try again.';
      input.select();
    });
  }

  /* ---- Enlarged visuals (case studies) ----------------------------------------- */
  // Every image in a case study opens full screen. A side-by-side pair (.cs-pair) opens side by
  // side; below 760px wide, and for the V1–V4 row (.cs-scroller) always, they open one at a time
  // in a sideways strip (scroll, swipe, ← → or arrow keys). The enlarged copy keeps each image's
  // crop. ✕, a click on the veil, or Esc closes it.
  const cs = document.querySelector('main.cs');
  if (cs) {
    const X_ICON = '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M24 8L16 16M16 16L8 24M16 16L8 8M16 16L24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const ARROW = (d) => `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const lb = document.createElement('div');
    lb.className = 'lb'; lb.hidden = true;
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Enlarged image');
    lb.innerHTML = `<div class="lb-wrap"><div class="lb-stage"></div>
      <div class="lb-nav"><button type="button" class="lb-prev" aria-label="Previous image">${ARROW('M12.5 4L6.5 10L12.5 16')}</button><span class="lb-count" aria-live="polite"></span><button type="button" class="lb-next" aria-label="Next image">${ARROW('M7.5 4L13.5 10L7.5 16')}</button></div></div>
      <button type="button" class="lb-x" aria-label="Close">${X_ICON}</button>`;
    document.body.append(lb);
    const stage = lb.querySelector('.lb-stage');
    const count = lb.querySelector('.lb-count');
    let items = [], index = 0, lastFocus = null;

    // what each clickable visual is: the image (or its crop frame), plus its caption
    const visualOf = (el) => (el.closest('.crop') || el);
    const captionOf = (el) => {
      const fig = el.closest('figure');
      const cap = fig && [...fig.children].find((c) => c.tagName === 'FIGCAPTION');
      return cap ? cap.textContent.trim() : '';
    };
    const visuals = [...new Set([...cs.querySelectorAll('img')].filter((img) => !img.closest('.gate')).map(visualOf))];
    visuals.forEach((v) => {
      const img = v.matches('img') ? v : v.querySelector('img');
      v.classList.add('cs-zoom');
      v.tabIndex = 0;
      v.setAttribute('role', 'button');
      v.setAttribute('aria-label', `Enlarge image: ${img.alt}`);
    });
    const groupFor = (v) => {
      const set = v.closest('.cs-pair, .cs-scroller');
      const members = set ? [...set.children].filter((c) => c.querySelector('img') || c.matches('img')).map((c) => visualOf(c.matches('img') ? c : c.querySelector('img'))) : [v];
      return { list: members.map((el) => ({ el, caption: captionOf(el) })), at: Math.max(0, members.indexOf(v)), strip: !!(set && set.matches('.cs-scroller')) };
    };

    // Pairs sit side by side on wide screens. Small screens, and the V1–V4 row everywhere, get a
    // "gallery": one at a time in a sideways strip (scroll, swipe, ← → buttons or arrow keys).
    let strip = false;
    const single = () => innerWidth < 760;
    const gallery = () => strip || single();
    const stepBtns = { prev: lb.querySelector('.lb-prev'), next: lb.querySelector('.lb-next') };
    function syncCount() {
      count.textContent = `${index + 1} / ${items.length}`;
      if (gallery()) { stepBtns.prev.disabled = index === 0; stepBtns.next.disabled = index === items.length - 1; }
    }
    function render() {
      const g = gallery();
      lb.classList.toggle('is-gallery', g);
      lb.classList.toggle('has-many', items.length > 1);
      const hasCap = items.some((it) => it.caption);
      const gap = 24;
      const padX = single() ? 16 : 72, padY = single() ? 72 : 64;
      const navH = g && items.length > 1 ? 60 : 0;
      const availH = innerHeight - padY * 2 - (hasCap ? 30 : 0) - navH;
      const ratios = items.map((it) => { const r = it.el.getBoundingClientRect(); return r.width / r.height || 1.4; });
      // gallery: each one fits the screen on its own; side by side: one shared height
      const heights = g
        ? ratios.map((r) => Math.min(availH, (innerWidth - padX * 2) / r))
        : ratios.map(() => Math.min(availH, (innerWidth - padX * 2 - gap * (items.length - 1)) / ratios.reduce((a, b) => a + b, 0)));
      stage.replaceChildren(...items.map((it, i) => {
        const fig = document.createElement('figure');
        fig.className = 'lb-item';
        const copy = it.el.cloneNode(true);
        copy.classList.remove('cs-zoom'); copy.removeAttribute('tabindex'); copy.removeAttribute('role'); copy.removeAttribute('aria-label');
        (copy.matches('img') ? [copy] : [...copy.querySelectorAll('img')]).forEach((img) => { img.loading = 'eager'; });
        const w = Math.round(heights[i] * ratios[i]);
        copy.style.width = `${w}px`; copy.style.height = `${Math.round(heights[i])}px`;
        copy.style.aspectRatio = 'auto'; copy.style.flex = 'none';
        fig.append(copy);
        if (it.caption) fig.append(Object.assign(document.createElement('figcaption'), { textContent: it.caption, style: `width: ${w}px` }));
        return fig;
      }));
      if (g) stage.scrollLeft = index * stage.clientWidth;
      syncCount();
    }
    function open(v) {
      const g = groupFor(v);
      items = g.list; index = g.at; strip = g.strip;
      lastFocus = document.activeElement;
      lb.hidden = false;
      root.classList.add('lb-open');
      render();
      lb.querySelector('.lb-x').focus();
    }
    function close() {
      lb.hidden = true;
      root.classList.remove('lb-open');
      stage.replaceChildren();
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }
    const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
    const step = (d) => {
      if (!gallery() || items.length < 2) return;
      const to = Math.min(items.length - 1, Math.max(0, index + d));
      if (to !== index) stage.scrollTo({ left: to * stage.clientWidth, behavior: smooth() });
    };
    stage.addEventListener('scroll', () => {
      if (!gallery()) return;
      const i = Math.round(stage.scrollLeft / Math.max(1, stage.clientWidth));
      if (i !== index) { index = i; syncCount(); }
    }, { passive: true });
    // a mouse wheel (up/down) also steps through the gallery; sideways trackpad scrolling just scrolls
    let wheelLock = 0;
    lb.addEventListener('wheel', (e) => {
      if (!gallery() || items.length < 2 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (performance.now() < wheelLock || Math.abs(e.deltaY) < 8) return;
      wheelLock = performance.now() + 600;
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // V1–V4 row on the page. Like the home page Archive: when it reaches the middle of the screen
    // it stays put and slides sideways as you scroll down (one pixel down = one pixel sideways).
    // With reduced motion or on very short screens it's a row you swipe, with ← → under it.
    cs.querySelectorAll('.cs-scroller').forEach((row) => {
      const figure = row.closest('figure');
      const nav = document.createElement('div');
      nav.className = 'cs-scroller-nav';
      nav.innerHTML = `<button type="button" aria-label="Previous exploration">${ARROW('M12.5 4L6.5 10L12.5 16')}</button><button type="button" aria-label="Next exploration">${ARROW('M7.5 4L13.5 10L7.5 16')}</button>`;
      row.after(nav);
      const [prev, next] = nav.querySelectorAll('button');
      const slide = () => row.firstElementChild.getBoundingClientRect().width + 16;
      const pin = Object.assign(document.createElement('div'), { className: 'cs-scroll-pin' });
      const canPin = () => innerHeight >= 500 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      let pinned = null, shift = 0, stickTop = 0, raf = 0, lastW = 0;
      function sync() {                                          // swipe mode: buttons + height
        if (pinned) return;
        prev.disabled = row.scrollLeft < 4;
        next.disabled = row.scrollLeft > row.scrollWidth - row.clientWidth - 4;
        // the row is as tall as the one in view, so a short one doesn't leave a gap under it
        const i = next.disabled ? row.children.length - 1 : Math.round(row.scrollLeft / slide());
        row.style.height = `${row.children[Math.min(i, row.children.length - 1)].offsetHeight}px`;
      }
      function layout() {
        const want = canPin();
        if (want !== pinned) {
          pinned = want;
          row.classList.toggle('is-pinned', pinned);
          if (pinned) { figure.before(pin); pin.append(figure); row.scrollLeft = 0; row.style.height = ''; }
          else if (pin.isConnected) { pin.before(figure); pin.remove(); row.style.transform = ''; figure.style.top = ''; }
        }
        lastW = row.clientWidth;
        if (pinned) {
          const last = row.lastElementChild;
          shift = Math.max(0, Math.ceil(last.offsetLeft + last.offsetWidth - row.clientWidth));
          stickTop = Math.max(16, (innerHeight - figure.offsetHeight) / 2);   // centered on screen
          figure.style.top = `${stickTop}px`;
          pin.style.height = `${figure.offsetHeight + shift}px`;
          update();
        } else sync();
      }
      function update() {
        raf = 0;
        if (!pinned) return;
        const p = Math.min(1, Math.max(0, (stickTop - pin.getBoundingClientRect().top) / Math.max(1, shift)));
        row.style.transform = `translate3d(${-p * shift}px, 0, 0)`;
      }
      prev.addEventListener('click', () => row.scrollBy({ left: -slide(), behavior: smooth() }));
      next.addEventListener('click', () => row.scrollBy({ left: slide(), behavior: smooth() }));
      row.addEventListener('scroll', sync, { passive: true });
      addEventListener('scroll', () => { if (pinned && !raf) raf = requestAnimationFrame(update); }, { passive: true });
      addEventListener('resize', layout);
      // (also re-measure if the column changes width, e.g. after the password unlocks the page)
      if ('ResizeObserver' in window) new ResizeObserver(() => { if (Math.abs(row.clientWidth - lastW) > 1) layout(); }).observe(row);
      layout();
    });

    // Main images: rise in once both have loaded
    const heroImgs = [...cs.querySelectorAll('.cs-hero img')];
    if (heroImgs.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cs.querySelector('.cs-hero').classList.add('will-rise');
      heroImgs[0].getBoundingClientRect();                       // start from the hidden state, even if they're already loaded
      const loaded = heroImgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); })));
      const go = () => requestAnimationFrame(() => requestAnimationFrame(() => heroImgs.forEach((img) => img.classList.add('is-in'))));
      Promise.all(loaded).then(go);
      setTimeout(go, 2500);                                      // don't wait forever on a slow connection
    }

    // % numbers: digits flip through random numbers, then settle left to right (once, in view)
    const nums = [...cs.querySelectorAll('.cs-stat-num')];
    if (nums.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const FLIP_MS = 45, SETTLE_MS = 700, EACH_MS = 220;        // ✏️ flip speed, when the first digit settles, then each next
      nums.forEach((el) => {
        const final = el.textContent.trim();
        el.textContent = '';
        el.append(Object.assign(document.createElement('span'), { className: 'sr-only', textContent: final }),
          Object.assign(document.createElement('span'), { className: 'scramble', textContent: final }));
        el.lastChild.setAttribute('aria-hidden', 'true');
      });
      const scramble = (el) => {
        const out = el.querySelector('.scramble');
        const final = out.textContent;
        const digits = [...final].map((ch, i) => (/\d/.test(ch) ? i : -1)).filter((i) => i >= 0);
        const t0 = performance.now();
        const tick = () => {
          const t = performance.now() - t0;
          let done = true;
          out.textContent = [...final].map((ch, i) => {
            const k = digits.indexOf(i);
            if (k < 0 || t >= SETTLE_MS + k * EACH_MS) return ch;
            done = false;
            return String(Math.floor(Math.random() * 10));
          }).join('');
          if (!done) setTimeout(tick, FLIP_MS);
        };
        tick();
      };
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { io.unobserve(e.target); scramble(e.target); }
      }), { threshold: 0.6 });
      nums.forEach((el) => io.observe(el));
    }

    cs.addEventListener('click', (e) => { const v = e.target.closest('.cs-zoom'); if (v) open(v); });
    cs.addEventListener('keydown', (e) => {
      const v = e.target.closest && e.target.closest('.cs-zoom');
      if (v && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(v); }
    });
    lb.addEventListener('click', (e) => {
      if (e.target.closest('.lb-prev')) step(-1);
      else if (e.target.closest('.lb-next')) step(1);
      else if (e.target.closest('.lb-x') || !e.target.closest('.lb-item > .crop, .lb-item > img, .lb-item figcaption, .lb-nav')) close();   // ✕ or the veil
    });
    // keys work as soon as it's open, wherever focus is
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1); }
      else if (e.key === 'Tab') {                                // keep focus inside
        const btns = [...lb.querySelectorAll('button')].filter((b) => b.offsetParent && !b.disabled);
        const first = btns[0], last = btns[btns.length - 1];
        if (!lb.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    addEventListener('resize', () => { if (!lb.hidden) render(); });
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
