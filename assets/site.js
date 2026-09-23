/* ═══════════════════════════════════════════════════════════════════
   MERGVS deck controller
   One behaviour on every screen: the page is a stack of composed
   chapters, advanced by wheel, key, swipe or the rail. When a chapter
   is taller than the frame it scrolls inside itself first, and only
   hands the gesture on once it reaches an edge.
   Pages without .panel elements (legal, journal) just get the menu.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var html = document.documentElement;
  html.classList.remove('no-js');

  /* ── mobile menu (every page) ── */
  var burger = document.getElementById('burger');
  var mob = document.getElementById('mob');
  function closeMob() {
    if (!mob) return;
    mob.classList.remove('on');
    burger.classList.remove('x');
    burger.setAttribute('aria-expanded', 'false');
  }
  if (burger && mob) {
    burger.addEventListener('click', function () {
      var on = !mob.classList.contains('on');
      mob.classList.toggle('on', on);
      burger.classList.toggle('x', on);
      burger.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    mob.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' || e.target === mob) closeMob();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMob();
    });
  }

  /* the injected contact form paints its dark layer beneath a full-screen
     overlay, so a tap outside the box never reaches it. Close on the
     overlay itself, whenever it is injected. */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'mgv-overlay') {
      var c = document.getElementById('mgv-close');
      if (c) c.click();
    }
  });

  /* ── reading progress (article pages) ── */
  var bar = document.getElementById('progress');
  if (bar) {
    var tick = function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? Math.min(1, scrollY / h) * 100 : 0) + '%';
    };
    addEventListener('scroll', tick, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  if (!panels.length) return;          /* article page: nothing else to do */

  html.classList.add('deck');

  var rail = document.getElementById('rail');
  var stMid = document.getElementById('stMid');
  var stNum = document.getElementById('stNum');
  var spec = document.getElementById('spec');
  var last = panels.length - 1;
  var cur = 0, busy = false;

  var CH = panels.map(function (p, i) {
    return {
      hash: p.getAttribute('data-hash') || '',
      label: p.getAttribute('data-label') || ('Chapter ' + i),
      rail: p.getAttribute('data-rail') || p.getAttribute('data-label') || String(i)
    };
  });
  var ALIAS = { properties: 2, why: 1, how: 2, cities: 4, contact: last, pricing: 3 };

  /* ── rail ── */
  var railBtns = [];
  if (rail) {
    CH.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<b></b><span>' + pad(i) + ' ' + c.rail + '</span>';
      b.setAttribute('aria-label', 'Chapter ' + i + ': ' + c.label);
      b.addEventListener('click', function () { go(i, true); });
      rail.appendChild(b);
      railBtns.push(b);
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* how much of the frame this chapter's content needs. The stage uses it
     to lift the maquette clear of dense chapters in portrait */
  var deckEl = document.getElementById('deck');
  var bandNow = 0;                 /* the share of the frame left to the stage */
  function fill(n) {
    var pin = panels[n].querySelector('.pin');
    if (!pin || !deckEl || !deckEl.clientHeight) return 0;
    /* the share of the frame this chapter takes, which is what the maquette
       needs to know: a chapter that reserves a band is not dense */
    return Math.min(1, pin.clientHeight / deckEl.clientHeight);
  }
  window.__mgvFill = fill;

  /* ── overflow affordance ── */
  function marks() {
    var pin = panels[cur].querySelector('.pin');
    if (pin) pin.classList.toggle('more', pin.scrollHeight - pin.clientHeight > 8);
  }

  /* ── navigation ── */
  function go(n, focus) {
    n = Math.max(0, Math.min(last, n));
    cur = n;
    panels.forEach(function (p, i) {
      var on = i === n;
      p.classList.toggle('on', on);
      p.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (!on) { var q = p.querySelector('.pin'); if (q) q.scrollTop = 0; }
    });
    if (focus) panels[n].focus({ preventScroll: true });
    railBtns.forEach(function (b, i) { b.setAttribute('aria-current', i === n ? 'true' : 'false'); });
    html.setAttribute('data-ch', String(n));
    /* the frame is divided first, then everything else reads the division:
       in portrait the maquette keeps the upper band and the text takes what
       it needs. A light chapter leaves the model a wide band; a dense one
       borrows from it. */
    var pin = panels[n].querySelector('.pin');
    if (pin && deckEl && deckEl.clientHeight) {
      /* what the chapter's blocks actually measure, which is not the pin's
         own height: the pin fills the frame by design */
      var kids = pin.children, top = null, bot = null, i, r, pos;
      for (i = 0; i < kids.length; i++) {
        pos = getComputedStyle(kids[i]).position;
        if (pos === 'fixed' || pos === 'absolute') continue;  /* the plate */
        r = kids[i].getBoundingClientRect();
        if (!r.height) continue;
        if (top === null || r.top < top) top = r.top;
        if (bot === null || r.bottom > bot) bot = r.bottom;
      }
      var content = (top === null) ? 0 : bot - top;
      var frame = deckEl.clientHeight;
      var want = (content + frame * 0.07) / frame;
      /* a chapter can reserve a band for the maquette, and the chapter that is
         about the maquette does. Otherwise the model is either a presence or a
         wash, never a clipped sliver: the text leaves it a third of the frame
         or it takes the lot. */
      var band = parseFloat(panels[n].getAttribute('data-band'));
      /* a reserved band gives the maquette room, but the text is never
         clipped for it: the band yields down to a floor of 30% */
      var pct = band > 0 ? Math.min(0.7, Math.max(want, 1 - band)) * 100
                         : (want > 0.82 ? 100 : Math.max(34, want * 100));
      html.style.setProperty('--pin-max', pct.toFixed(1) + '%');
      bandNow = 1 - pct / 100;
    }
    /* a dense chapter needs a solid ground under it; a sparse one can let
       the stage breathe through */
    var f = fill(n);
    html.style.setProperty('--scrim',
      (0.45 + 0.55 * Math.max(0, Math.min(1, (f - 0.42) / 0.48))).toFixed(3));
    if (stMid) stMid.textContent = CH[n].label;
    if (stNum) stNum.textContent = pad(n);
    if (spec) spec.classList.toggle('on', window.__mgv3d === 'ready' && n === 0);
    var h = CH[n].hash ? '#' + CH[n].hash : '';
    try { history.replaceState(null, '', h || location.pathname); } catch (e) {}
    setTimeout(marks, 60);
    window.dispatchEvent(new CustomEvent('mgv:chapter',
      { detail: { index: n, fill: f, band: bandNow } }));
  }
  window.__mgvGo = go;
  window.__mgvCount = panels.length;

  function step(d) {
    if (busy) return;
    var n = cur + d;
    if (n < 0 || n > last) return;
    busy = true;
    go(n, false);
    setTimeout(function () { busy = false; }, 760);
  }

  /* ── does the active chapter still have room to scroll? ── */
  function room(dir) {                 /* dir: 1 = down, -1 = up */
    var pin = panels[cur].querySelector('.pin');
    if (!pin) return false;
    var slack = pin.scrollHeight - pin.clientHeight;
    if (slack <= 6) return false;
    return dir > 0 ? pin.scrollTop < slack - 2 : pin.scrollTop > 2;
  }
  function inModal(t) {
    while (t && t !== document.body) { if (t.id === 'mgv-box') return true; t = t.parentNode; }
    return false;
  }
  function modalOpen() {
    var o = document.getElementById('mgv-overlay');
    return !!o && o.classList.contains('open');
  }

  /* ── wheel ── */
  var acc = 0, accT = 0;
  window.addEventListener('wheel', function (e) {
    if (inModal(e.target) || modalOpen()) return;
    var dir = e.deltaY > 0 ? 1 : -1;
    if (room(dir)) return;             /* let the chapter scroll itself */
    e.preventDefault();
    var now = Date.now();
    if (now - accT > 220) acc = 0;
    accT = now;
    acc += e.deltaY;
    if (Math.abs(acc) > 42) { step(acc > 0 ? 1 : -1); acc = 0; }
  }, { passive: false });

  /* ── keyboard ── */
  window.addEventListener('keydown', function (e) {
    if (modalOpen()) return;
    if (mob && mob.classList.contains('on')) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown') { if (room(1)) return; e.preventDefault(); step(1); }
    else if (k === 'ArrowUp' || k === 'PageUp') { if (room(-1)) return; e.preventDefault(); step(-1); }
    else if (k === 'Home') { e.preventDefault(); go(0, true); }
    else if (k === 'End') { e.preventDefault(); go(last, true); }
    else if (/^[0-9]$/.test(k) && +k <= last) { go(+k, true); }
  });

  /* ── touch ── */
  var ty = 0, tx = 0, tRoomUp = false, tRoomDown = false, tTime = 0;
  window.addEventListener('touchstart', function (e) {
    ty = e.touches[0].clientY;
    tx = e.touches[0].clientX;
    tTime = Date.now();
    tRoomUp = room(-1);
    tRoomDown = room(1);
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (modalOpen()) return;
    var dy = ty - e.changedTouches[0].clientY;
    var dx = Math.abs(tx - e.changedTouches[0].clientX);
    if (Math.abs(dy) < 46 || dx > Math.abs(dy)) return;
    if (Date.now() - tTime > 900) return;
    if (dy > 0 && tRoomDown) return;   /* the chapter absorbed the swipe */
    if (dy < 0 && tRoomUp) return;
    step(dy > 0 ? 1 : -1);
  }, { passive: true });

  /* ── links ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-go],a[href^="#"]') : null;
    if (!a || a.hasAttribute('data-mgv-open')) return;
    var n = a.hasAttribute('data-go') ? +a.getAttribute('data-go') : resolve(a.getAttribute('href'));
    if (n === null || isNaN(n)) return;
    e.preventDefault();
    go(n, true);
    closeMob();
  });

  function resolve(href) {
    if (!href || href.charAt(0) !== '#') return null;
    var k = href.slice(1);
    if (!k) return 0;
    for (var i = 0; i < CH.length; i++) if (CH[i].hash === k) return i;
    if (k.indexOf('ch-') === 0) return +k.slice(3);
    return (k in ALIAS) ? Math.min(ALIAS[k], last) : null;
  }

  window.addEventListener('hashchange', function () {
    var n = resolve(location.hash);
    if (n !== null && n !== cur) go(n, false);
  });
  window.addEventListener('resize', function () {
    marks();
    window.dispatchEvent(new CustomEvent('mgv:chapter',
      { detail: { index: cur, fill: fill(cur), band: bandNow } }));
  });

  /* ── boot ── */
  var start = resolve(location.hash);
  go(start === null ? 0 : start, false);
  marks();
})();
