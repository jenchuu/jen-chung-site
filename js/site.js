/* ==========================================================================
   jen-chung.com — site behaviour: theme toggle, mobile menu, konbini hero bridge
   ========================================================================== */
(() => {
  'use strict';

  // iOS Safari only shows :active (the pressed state on text buttons) when the page listens for touches
  document.addEventListener('touchstart', () => {}, { passive: true });

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
  // ✏️ Resume: the nav's Resume link opens the PDF that matches the theme the visitor is in.
  //    Paste each Google Drive share link here (Share → Anyone with the link → Copy link).
  const RESUME = {
    light: 'https://drive.google.com/file/d/1Z2MIcYJsyO13Jyxo2BH3sNGm-nMwDpE4/view?usp=sharing',
    dark:  'https://drive.google.com/file/d/1CfXDh2Lw4okHgmZNlukYcXVHDIuUIue6/view?usp=sharing',
  };

  /* ---- Light / dark ---------------------------------------------------------- */
  const toggle = document.getElementById('theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  function renderTheme() {
    const dark = theme() === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    themeColor.setAttribute('content', dark ? '#121212' : '#fcf9ef');
    document.querySelectorAll('a[data-resume]').forEach((a) => { a.href = RESUME[theme()]; });
    // Favicon: the cream one in light mode, the dark one in dark mode (browsers that support SVG favicons)
    const icon = document.querySelector('link[data-favicon]');
    if (icon) icon.href = icon.getAttribute('href').replace(/favicon-(light|dark)\.svg/, `favicon-${theme()}.svg`);
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
  const phone = matchMedia('(max-width: 759px)');
  // Everything outside the nav: made inert while the full-page phone menu is open, so Tab stays in the menu
  const behindMenu = [...document.body.children].filter((el) => el !== nav && !['SCRIPT', 'TEMPLATE'].includes(el.tagName));
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    root.classList.toggle('menu-locked', open && phone.matches);   // full-page menu: the page doesn't scroll behind it
    behindMenu.forEach((el) => { el.inert = open && phone.matches; });
    if (!open) setWork(false);
  };
  menuBtn.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    setMenu(open);
    // the menu's links come before the ☰ button, so move focus into the menu (they'd be skipped otherwise)
    if (open) document.querySelector('#nav-menu a, #nav-menu button')?.focus({ preventScroll: true });
  });
  phone.addEventListener('change', () => setMenu(false));

  /* ---- Work menu: a dropdown on desktop (hover or click), expands in place on phones ---- */
  const WORK_CLOSE_MS = 200;   // ✏️ grace time to move the pointer from Work down into the menu
  const work = nav.querySelector('.nav-work');
  const workBtn = work.querySelector('.nav-work-btn');
  const hoverable = matchMedia('(min-width: 760px) and (hover: hover)');
  let workPinned = false, workTimer = 0;   // pinned = opened with a click, so it stays open after the pointer leaves
  function setWork(open) {
    clearTimeout(workTimer);
    if (!open) workPinned = false;
    work.classList.toggle('is-open', open);
    workBtn.setAttribute('aria-expanded', String(open));
  }
  const workOpen = () => work.classList.contains('is-open');
  workBtn.addEventListener('click', () => {
    if (!workOpen()) { setWork(true); workPinned = true; }
    else if (workPinned || !hoverable.matches) setWork(false);
    else workPinned = true;   // already open from hovering: a click keeps it open
  });
  work.addEventListener('mouseenter', () => { if (hoverable.matches) setWork(true); });
  work.addEventListener('mouseleave', () => {
    if (hoverable.matches && !workPinned) workTimer = setTimeout(() => setWork(false), WORK_CLOSE_MS);
  });
  work.addEventListener('focusout', (e) => { if (!phone.matches && !work.contains(e.relatedTarget)) setWork(false); });

  document.getElementById('nav-menu').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    else if (workOpen()) { setWork(false); workBtn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target)) setMenu(false);
    if (workOpen() && !phone.matches && !work.contains(e.target)) setWork(false);   // phones: Work stays expanded until the menu closes
  });

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
  // The archive is a row of cards. When the title + row reach the middle of the screen they stay
  // put and the row slides left as you scroll down, at every screen size; the page keeps its normal
  // spacing above and below. With reduced motion, or on very short screens (phones held sideways),
  // it's a row you swipe instead.
  const archive = document.getElementById('archive');
  if (archive) {
    const row = archive.querySelector('.grid-archive');
    const canPin = () => innerHeight >= SHORT_SCREEN && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pinned = false, maxShift = 0, stickTop = 0, raf = 0;
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
        const vh = document.documentElement.clientHeight || innerHeight;
        stickTop = Math.max(0, (vh - stage.offsetHeight) / 2);  // title + row centered on screen while it slides
        stage.style.top = `${stickTop}px`;
        pin.style.height = `${stage.offsetHeight + maxShift}px`;   // one pixel down = one pixel sideways
      }
      update();
    }
    function update() {
      raf = 0;
      if (pinned) {
        const p = Math.min(1, Math.max(0, (stickTop - pin.getBoundingClientRect().top) / Math.max(1, maxShift)));
        row.style.transform = `translate3d(${-p * maxShift}px, 0, 0)`;
      }
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener('scroll', queue, { passive: true });
    row.addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', layout);
    window.addEventListener('load', layout);
    if (document.fonts) document.fonts.ready.then(layout);
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
      try { window.umami?.track('Case study unlocked', { study: gated.dataset.gate }); } catch (err) {}   // analytics (Umami)
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
  // Every image in a case study opens full screen, together with the rest of its set: a pair
  // (.cs-pair) or a row of screens ([data-gallery]). A set's data-zoom="wide,medium" says how many
  // open side by side on wide screens (1200px+) and on medium ones (760–1199px); more than that
  // and they open a page at a time in a sideways strip (scroll, swipe, ← → or arrow keys). Phones
  // (under 760px) always get one at a time. Pairs default to "2,2"; a set without data-zoom opens
  // one at a time everywhere (Boards V1–V4). The enlarged copy keeps each image's crop. ✕, a click
  // on the veil, or Esc closes it.
  const cs = document.querySelector('main.cs');
  if (cs) {
    const X_ICON = '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const ARROW = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const lb = document.createElement('div');
    lb.className = 'lb'; lb.hidden = true;
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Enlarged image');
    lb.innerHTML = `<div class="lb-wrap"><div class="lb-stage"></div>
      <div class="lb-nav"><button type="button" class="lb-prev" aria-label="Previous image">${ARROW('M15.75 19.5 8.25 12l7.5-7.5')}</button><span class="lb-count" aria-live="polite"></span><button type="button" class="lb-next" aria-label="Next image">${ARROW('m8.25 4.5 7.5 7.5-7.5 7.5')}</button></div></div>
      <button type="button" class="lb-x" aria-label="Close">${X_ICON}</button>`;
    document.body.append(lb);
    const stage = lb.querySelector('.lb-stage');
    const count = lb.querySelector('.lb-count');
    let items = [], pages = [], index = 0, itemAt = 0, zoom = [1, 1], lastFocus = null;

    // what each clickable visual is: the image (or its crop frame), plus its caption
    const visualOf = (el) => (el.closest('.crop') || el);
    const captionOf = (el) => {
      const fig = el.closest('figure');
      const cap = fig && [...fig.children].find((c) => c.tagName === 'FIGCAPTION');
      return cap ? cap.textContent.trim() : '';
    };
    const visuals = [...new Set([...cs.querySelectorAll('img')].filter((img) => !img.closest('.gate, .theme-toggle')).map(visualOf))];
    visuals.forEach((v) => {
      const img = v.matches('img') ? v : v.querySelector('img');
      v.classList.add('cs-zoom');
      v.tabIndex = 0;
      v.setAttribute('role', 'button');
      v.setAttribute('aria-label', `Enlarge image: ${img.alt}`);
    });
    const groupFor = (v) => {
      const set = v.closest('.cs-pair, [data-gallery]');
      const members = set ? [...set.children].filter((c) => c.querySelector('img') || c.matches('img')).map((c) => visualOf(c.matches('img') ? c : c.querySelector('img'))) : [v];
      const z = set ? (set.dataset.zoom || (set.matches('.cs-pair') ? '2,2' : '1,1')) : '1,1';
      return { list: members.map((el) => ({ el, caption: captionOf(el) })), at: Math.max(0, members.indexOf(v)), zoom: z.split(',').map(Number) };
    };

    // How many open side by side right now; the set is cut into pages of that many. More than one
    // page makes a "gallery": a sideways strip of pages (scroll, swipe, ← → buttons or arrow keys).
    const single = () => innerWidth < 760;
    const perPage = () => (single() ? 1 : innerWidth >= 1200 ? zoom[0] : zoom[1]);
    const gallery = () => pages.length > 1;
    const stepBtns = { prev: lb.querySelector('.lb-prev'), next: lb.querySelector('.lb-next') };
    function syncCount() {
      count.textContent = `${index + 1} / ${pages.length}`;
      if (gallery()) { stepBtns.prev.disabled = index === 0; stepBtns.next.disabled = index === pages.length - 1; }
    }
    const zoomCopy = (it, w, h) => {
      const copy = it.el.cloneNode(true);
      copy.classList.remove('cs-zoom'); copy.removeAttribute('tabindex'); copy.removeAttribute('role'); copy.removeAttribute('aria-label');
      (copy.matches('img') ? [copy] : [...copy.querySelectorAll('img')]).forEach((img) => { img.loading = 'eager'; });
      Object.assign(copy.style, { width: `${w}px`, height: `${h}px`, aspectRatio: 'auto', flex: 'none' });
      return copy;
    };
    function render() {
      const per = Math.max(1, perPage());
      pages = [];
      for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
      index = Math.min(pages.length - 1, Math.floor(itemAt / per));
      const g = gallery();
      lb.classList.toggle('is-gallery', g);
      lb.classList.toggle('has-many', g);
      const gap = 24;
      const padX = single() ? 16 : 72, padY = single() ? 72 : 64;
      const W = innerWidth - padX * 2;
      const navH = g ? 60 : 0;
      const capLines = (text, width) => (text ? Math.ceil((text.length * 8.4) / Math.max(120, width)) : 0);   // ~8.4px a character at 16px
      stage.replaceChildren(...pages.map((page) => {
        const ratios = page.map((it) => {
          if (it.el.matches('.cs-hero-phone-43 img') && it.el.naturalWidth) return it.el.naturalWidth / it.el.naturalHeight;   // cropped on phones: enlarge the whole image
          const r = it.el.getBoundingClientRect(); return r.width / r.height || 1.4;
        });
        const sum = ratios.reduce((a, b) => a + b, 0);
        const gaps = gap * (page.length - 1);
        // screens from one figure share its caption: it's shown once, under the whole row
        const shared = page.length > 1 && page[0].caption && page.every((it) => it.caption === page[0].caption) ? page[0].caption : '';
        const capW = (rowW) => (single() ? W : shared ? Math.min(W, Math.max(rowW, 640)) : rowW / page.length);   // phones: caption runs the full width (page padding), so it takes fewer lines and the image gets the room
        const capH = (rowW) => Math.max(...page.map((it) => capLines(shared || it.caption, capW(rowW)))) * 22 + (page.some((it) => it.caption) ? 8 : 0);
        // one shared height for the row: as tall as fits the screen, caption and ← → included
        let h = Math.min(innerHeight - padY * 2 - navH - capH(W), (W - gaps) / sum);
        h = Math.min(h, innerHeight - padY * 2 - navH - capH(h * sum + gaps));
        const rowW = Math.round(h * sum + gaps);
        const pg = document.createElement('div');
        pg.className = 'lb-page';
        const row = document.createElement('div');
        row.className = 'lb-row';
        row.append(...page.map((it, i) => {
          const fig = document.createElement('figure');
          fig.className = 'lb-item';
          const w = Math.round(h * ratios[i]);
          fig.append(zoomCopy(it, w, Math.round(h)));
          if (single()) fig.style.alignItems = 'center';
          if (it.caption && !shared) fig.append(Object.assign(document.createElement('figcaption'), { textContent: it.caption, style: `width: ${single() ? W : w}px` }));
          return fig;
        }));
        pg.append(row);
        if (shared) pg.append(Object.assign(document.createElement('figcaption'), { textContent: shared, style: `width: ${Math.round(capW(rowW))}px` }));
        return pg;
      }));
      if (g) stage.scrollLeft = index * stage.clientWidth;
      syncCount();
    }
    function open(v) {
      const g = groupFor(v);
      items = g.list; itemAt = g.at; zoom = g.zoom;
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
      if (!gallery()) return;
      const to = Math.min(pages.length - 1, Math.max(0, index + d));
      if (to !== index) stage.scrollTo({ left: to * stage.clientWidth, behavior: smooth() });
    };
    stage.addEventListener('scroll', () => {
      if (!gallery()) return;
      const i = Math.round(stage.scrollLeft / Math.max(1, stage.clientWidth));
      if (i !== index) { index = i; itemAt = i * Math.max(1, perPage()); syncCount(); }
    }, { passive: true });
    // a mouse wheel (up/down) also steps through the gallery; sideways trackpad scrolling just scrolls
    let wheelLock = 0;
    lb.addEventListener('wheel', (e) => {
      if (!gallery() || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (performance.now() < wheelLock || Math.abs(e.deltaY) < 8) return;
      wheelLock = performance.now() + 600;
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // Soft rise (the hidden starting state is in css/site.css, switched on by the page's head script)
    if (root.classList.contains('cs-rise-ready')) {
      const RISE_STEP_MS = 80;                                   // ✏️ gap between blocks that arrive together
      const MAX_WAIT_MS = 240;                                   // ✏️ longest any block waits (so a fast scroll never leaves it blank)
      const blocks = [...cs.querySelectorAll('.cs-label, .cs-title, .cs-h2, .cs-meta > div, .cs-meta-title, .cs-text > *, .cs-main > :not(.cs-text, .ds-colors, .ds-scale-wrap), '
        + '.ds-intro, .ds .cs-main > .cs-text, .ds-colors > *, .ds-specimen, .ds-step')];   // (same list as css/site.css)
      let nextAt = 0;
      const riseIO = new IntersectionObserver((entries) => {
        entries.filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
          .forEach((e) => {
            const now = performance.now();
            const at = Math.min(Math.max(now, nextAt), now + MAX_WAIT_MS);
            nextAt = at + RISE_STEP_MS;
            e.target.style.setProperty('--rise-delay', `${Math.round(at - now)}ms`);
            e.target.classList.add('is-in');
            riseIO.unobserve(e.target);
            // anything above it that flew past unseen is simply shown
            for (let i = blocks.indexOf(e.target) - 1; i >= 0 && !blocks[i].classList.contains('is-in'); i--) {
              blocks[i].classList.add('is-in'); riseIO.unobserve(blocks[i]);
            }
          });
      }, { threshold: 0.15 });
      blocks.forEach((el) => riseIO.observe(el));
    }

    // Load the rest of the page's images in the background once the page is up, so a visitor who
    // scrolls straight to the end doesn't wait on them.
    {
      const warm = () => cs.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
      const later = () => ('requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 1500 }) : setTimeout(warm, 300));
      if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
    }

    // Videos: play (muted) while at least 40% is on screen, pause when scrolled away. If the visitor
    // pauses one themselves, it stays paused. Start loading a screen ahead. A video marked
    // data-autoplay="after" waits for the one before it to finish, then plays (now, if it's on
    // screen, or as soon as it's scrolled to).
    const vids = [...cs.querySelectorAll('video.cs-video')];
    vids.forEach((v, i) => {
      if (!('IntersectionObserver' in window)) return;
      const autoplay = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      let byUs = false, userPaused = false, inView = false, armed = v.dataset.autoplay !== 'after';
      v.addEventListener('pause', () => { if (!byUs && !v.ended) userPaused = true; byUs = false; });
      v.addEventListener('play', () => { userPaused = false; armed = true; });
      if (!armed && vids[i - 1]) vids[i - 1].addEventListener('ended', () => {
        armed = true; v.preload = 'auto';
        if (inView && autoplay && !userPaused) v.play().catch(() => {});
      });
      new IntersectionObserver(([e]) => { if (e.isIntersecting) v.preload = 'auto'; }, { rootMargin: '100% 0px' }).observe(v);
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        if (inView && autoplay && armed && !userPaused) v.play().catch(() => {});
        else if (!inView && !v.paused) { byUs = true; v.pause(); }
      }, { threshold: 0.4 }).observe(v);
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
      const FLIP_MS = 50, SETTLE_MS = 1000, EACH_MS = 350;       // ✏️ flip speed, when the first digit settles, then each next
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

    // Speech bubbles (.cs-bubbles): each quote pops in as "…" typing dots, then types in, one bubble after
    // the other (each waits until it's on screen). Screen readers get the quote straight away.
    const bubbleSets = [...cs.querySelectorAll('.cs-bubbles')];
    if (bubbleSets.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const DOTS_MS = 1100, TYPE_MS = 1500, MAX_CHAR_MS = 35, GAP_MS = 300;   // ✏️ dots time, typing time per bubble, slowest letter, pause between bubbles
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const onScreen = (el) => new Promise((res) => {
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); res(); } }, { threshold: 0.6 });
        io.observe(el);
      });
      const type = (live, text) => new Promise((res) => {
        const each = Math.min(MAX_CHAR_MS, TYPE_MS / text.length), t0 = performance.now();
        const frame = (now) => {
          const n = Math.min(text.length, Math.floor((now - t0) / each) + 1);
          live.textContent = text.slice(0, n);
          if (n < text.length) requestAnimationFrame(frame); else res();
        };
        requestAnimationFrame(frame);
      });
      bubbleSets.forEach(async (set) => {
        const bubbles = [...set.querySelectorAll('blockquote')].map((q) => {
          const text = q.textContent.trim();
          const live = Object.assign(document.createElement('div'), { className: 'bubble-live' });
          live.setAttribute('aria-hidden', 'true');
          q.textContent = '';
          q.append(Object.assign(document.createElement('span'), { className: 'sr-only', textContent: text }),
            Object.assign(document.createElement('span'), { className: 'bubble-ghost', textContent: text }), live);
          q.querySelector('.bubble-ghost').setAttribute('aria-hidden', 'true');
          return { q, text, live };
        });
        set.classList.add('is-typing');
        for (const b of bubbles) {
          await onScreen(b.q);
          b.live.innerHTML = '<span class="bubble-dots"><span></span><span></span><span></span></span>';
          b.live.getBoundingClientRect();                        // start from the popped-out state
          b.live.classList.add('is-on');
          await wait(DOTS_MS);
          await type(b.live, b.text);
          await wait(GAP_MS);
        }
      });
    }

    // Card titles ([data-scramble]): letters flip through random ones, then settle left to right
    // (once, in view). Spaces and punctuation stay put; screen readers get the real title.
    const titles = [...cs.querySelectorAll('[data-scramble]')];
    if (titles.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const FLIP_MS = 40, SETTLE_MS = 150, EACH_MS = 25;        // ✏️ flip speed, when the first letter settles, then each next
      const LOWER = 'abcdefghijklmnopqrstuvwxyz', UPPER = LOWER.toUpperCase();
      const jumble = (ch) => (/[a-z]/.test(ch) ? LOWER : /[A-Z]/.test(ch) ? UPPER : /\d/.test(ch) ? '0123456789' : '');
      const randomize = (final, keep) => [...final].map((ch, i) => { const set = jumble(ch); return i < keep || !set ? ch : set[Math.floor(Math.random() * set.length)]; }).join('');
      titles.forEach((el) => {
        const final = el.textContent;
        el.textContent = '';
        el.append(Object.assign(document.createElement('span'), { className: 'sr-only', textContent: final }),
          Object.assign(document.createElement('span'), { className: 'scramble', textContent: randomize(final, 0) }));
        el.lastChild.setAttribute('aria-hidden', 'true');
        el.dataset.final = final;
      });
      const run = (el) => {
        const out = el.querySelector('.scramble'), final = el.dataset.final, letters = [...final];
        const t0 = performance.now();
        const tick = () => {
          const t = performance.now() - t0;
          const keep = t < SETTLE_MS ? 0 : Math.floor((t - SETTLE_MS) / EACH_MS) + 1;
          out.textContent = randomize(final, keep);
          if (keep < letters.length) setTimeout(tick, FLIP_MS);
        };
        tick();
      };
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { io.unobserve(e.target); run(e.target); }
      }), { threshold: 0.6 });
      titles.forEach((el) => io.observe(el));
    }

    cs.addEventListener('click', (e) => { const v = e.target.closest('.cs-zoom'); if (v) open(v); });
    cs.addEventListener('keydown', (e) => {
      const v = e.target.closest && e.target.closest('.cs-zoom');
      if (v && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(v); }
    });
    lb.addEventListener('click', (e) => {
      if (e.target.closest('.lb-prev')) step(-1);
      else if (e.target.closest('.lb-next')) step(1);
      else if (e.target.closest('.lb-x') || !e.target.closest('.lb-item > .crop, .lb-item > img, .lb-page figcaption, .lb-nav')) close();   // ✕ or the veil
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

  /* ---- Design system page: color swatches ---------------------------------------- */
  // Each .ds-color row gets a light and a dark swatch drawn with the token itself, the value read
  // back from css/site.css, and for text colors the contrast ratio (WCAG AA is 4.5:1).
  const dsColors = document.getElementById('ds-colors');
  if (dsColors) {
    const rgbOf = (str) => str.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = (rgb) => rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m); return (hi + 0.05) / (lo + 0.05); };
    const pretty = (raw) => {
      raw = raw.trim();
      const veil = raw.match(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/);
      if (veil) return '#' + veil.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase() + ` at ${Math.round(veil[4] * 100)}%`;
      const hexes = (raw.match(/#[0-9a-f]{6}/gi) || []).map((h) => h.toUpperCase());
      return hexes.length ? hexes.filter((h, i) => h !== hexes[i - 1]).join(' → ') : raw;   // a gradient lists its stops
    };
    dsColors.querySelectorAll('.ds-color').forEach((row) => {
      const token = row.dataset.token, isText = 'text' in row.dataset, on = row.dataset.on || 'bg-page';
      const chip = isText ? `color:var(--${token});background:var(--${on})` : `background:var(--${token})`;
      row.innerHTML = `<p class="ds-token"><b>${token.replace('-', '/')}</b><span>${row.dataset.use}</span></p>` + ['light', 'dark'].map((mode) =>
        `<div class="ds-swatch" data-theme="${mode}"><span class="ds-chip-color" style="${chip}">${isText ? 'Aa' : ''}</span><span class="ds-hex"></span></div>`).join('');
      row.querySelectorAll('.ds-swatch').forEach((sw) => {
        let html = pretty(getComputedStyle(sw).getPropertyValue(`--${token}`));
        if (isText) {
          const st = getComputedStyle(sw.firstElementChild), r = ratio(rgbOf(st.color), rgbOf(st.backgroundColor));
          html += `<span class="ds-ratio">${r.toFixed(1)}:1${r >= 4.5 ? ' · AA' : ''}</span>`;
        }
        sw.lastElementChild.innerHTML = html;
      });
    });
  }

  /* ---- Design system page: type scale, in use only or in full ------------------------- */
  // The "Show full type scale" switch adds every weight of each typeface (css/site.css shows it with .is-full).
  const scaleToggle = document.getElementById('ds-scale-toggle');
  if (scaleToggle) {
    const scale = document.getElementById(scaleToggle.getAttribute('aria-controls'));
    scaleToggle.addEventListener('click', () => {
      const full = scaleToggle.getAttribute('aria-checked') !== 'true';
      scaleToggle.setAttribute('aria-checked', String(full));
      scale.classList.toggle('is-full', full);
    });
  }

  /* ---- Back to top (case studies) ------------------------------------------------- */
  // Hidden until the visitor reaches the last section (its heading, e.g. "Reflection", is fully on
  // screen or already scrolled past); it pops in TO_TOP_DELAY_MS later with a slight bounce
  // (css/site.css). Clicking scrolls to the top (smoothly unless reduced motion is on) and moves
  // keyboard focus to the title.
  const TO_TOP_DELAY_MS = 1000;                                  // ✏️ wait after reaching the last section
  const toTop = document.querySelector('.to-top-wrap .to-top');
  if (toTop) {
    root.classList.add('to-top-ready');
    const lastHeading = [...document.querySelectorAll('.cs-section > .cs-h2')].pop();
    let toTopTimer = 0;
    const reached = () => (lastHeading
      ? lastHeading.getBoundingClientRect().bottom <= innerHeight
      : innerHeight + scrollY >= document.documentElement.scrollHeight - 4);   // (no headings: the page's bottom)
    const checkReached = () => {
      if (toTopTimer || root.classList.contains('cs-is-locked') || !reached()) return;   // (a locked page doesn't count)
      toTopTimer = setTimeout(() => toTop.classList.add('is-in'), TO_TOP_DELAY_MS);
      removeEventListener('scroll', checkReached);
    };
    addEventListener('scroll', checkReached, { passive: true });
    checkReached();
    toTop.addEventListener('focus', () => toTop.classList.add('is-in'));   // keyboard users never tab to an invisible button
    toTop.addEventListener('click', (e) => {
      e.preventDefault();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      const title = document.querySelector('h1');
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
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

  // Arriving at index.html#work (View all in the nav on another page): the konbini above
  // settles its height after the browser has jumped to Work, so keep Work in place until it
  // has — unless the visitor starts scrolling first.
  const arrival = !atKonbini() && location.hash && document.getElementById(location.hash.slice(1));
  if (arrival) {
    const keep = new ResizeObserver(() => arrival.scrollIntoView({ behavior: 'instant' }));
    const stop = () => { keep.disconnect(); ['wheel', 'touchstart', 'keydown'].forEach((t) => removeEventListener(t, stop)); };
    keep.observe(hero);
    ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, stop, { passive: true }));
    setTimeout(stop, 4000);
  }
})();
