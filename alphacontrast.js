/**
 * Alpha Contrast v2.0
 *
 * Reads the visible content behind an element via the browser's own
 * compositing engine and recolors it pixel-by-pixel to display the
 * contrasting color — masked to the element's foreground shape.
 *
 * Architecture:
 *   Uses CSS `backdrop-filter` for the color transform (GPU-accelerated,
 *   reads the actual composited backdrop) and CSS `mask-image` to clip
 *   the effect to the foreground shape's alpha channel.
 *
 * Usage:
 *   <div class="alphacontrast"><h1>Hello World</h1></div>
 *
 *   <div class="alphacontrast" data-ac-mode="complement">
 *     <img src="logo.png" alt="Logo"/>
 *   </div>
 *
 *   <div class="alphacontrast" data-ac-mode="bw">
 *     <svg viewBox="0 0 100 100">
 *       <circle cx="50" cy="50" r="50"/>
 *     </svg>
 *   </div>
 *
 * Data attributes on .alphacontrast:
 *   data-ac-src        — explicit mask image URL (overrides child detection)
 *   data-ac-mode       — "invert" (default) | "complement" | "bw" | "luminance"
 *   data-ac-fill       — optional background-color on the overlay (default: transparent)
 *   data-ac-threshold  — contrast() strength for bw mode (default: 100)
 *   data-ac-mask-size  — CSS mask-size value (default: "100% 100%")
 *
 * Modes (all GPU-accelerated via backdrop-filter):
 *   invert     — full RGB inversion: backdrop-filter: invert(1)
 *   complement — hue rotation 180°: backdrop-filter: hue-rotate(180deg)
 *   bw         — black or white by luminance: invert(1) contrast(N)
 *   luminance  — lightness inversion, hue preserved: invert(1) hue-rotate(180deg)
 *
 * JS API:
 *   AlphaContrast.scan()                — re-scan DOM for .alphacontrast
 *   AlphaContrast.init(el [, opts])     — manually initialise one element
 *   AlphaContrast.refresh([el])         — rebuild mask (one or all)
 *   AlphaContrast.setMode(el, mode)     — change mode live
 *   AlphaContrast.destroy(el)           — tear down one
 *   AlphaContrast.destroyAll()          — tear down all
 *   AlphaContrast.registerMode(name, backdropFilterCSS)
 */

;(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlphaContrast = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  /* ─── built-in modes ───────────────────────────────────────── */

  var MODES = {
    invert:     'invert(1)',
    complement: 'hue-rotate(180deg)',
    bw:         'invert(1) contrast(__THRESHOLD__%)',
    luminance:  'invert(1) hue-rotate(180deg)'
  };

  var DEFAULT_OPTS = {
    mode:      'invert',
    fill:      '',
    threshold: 100,
    maskSize:  '100% 100%'
  };

  /* ─── registry ─────────────────────────────────────────────── */

  var instances = new Map();
  var mutObs    = null;

  /* ─── helpers ──────────────────────────────────────────────── */

  function resolveFilter(mode, opts) {
    var tpl = MODES[mode] || MODES.invert;
    return tpl.replace('__THRESHOLD__', String(opts.threshold || 100));
  }

  function findMaskSource(el) {
    if (el.dataset.acSrc) return el.dataset.acSrc;

    var img = el.querySelector('img:not(.ac-overlay)');
    if (img && img.src) return img.src;

    var svg = el.querySelector('svg');
    if (svg) return svgToDataURL(svg);

    var bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      var m = bg.match(/url\(["']?(.+?)["']?\)/);
      if (m) return m[1];
    }
    return null;
  }

  function svgToDataURL(svg) {
    var clone = svg.cloneNode(true);
    clone.removeAttribute('style');
    if (!clone.getAttribute('xmlns'))
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('width'))  clone.setAttribute('width',  '100%');
    if (!clone.getAttribute('height')) clone.setAttribute('height', '100%');
    var str = new XMLSerializer().serializeToString(clone);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  }

  /**
   * Rasterise an image URL to a canvas data-URL so that mask-image
   * works reliably across browsers (avoids cross-origin and format quirks).
   */
  function rasteriseMask(src, w, h, cb) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var c   = document.createElement('canvas');
      c.width  = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/png'));
    };
    img.onerror = function () { cb(src); };  // fallback: raw URL
    img.src = src;
  }

  function setMask(overlay, url, size) {
    var val = 'url("' + url + '")';
    overlay.style.webkitMaskImage    = val;
    overlay.style.maskImage          = val;
    overlay.style.webkitMaskSize     = size;
    overlay.style.maskSize           = size;
    overlay.style.webkitMaskRepeat   = 'no-repeat';
    overlay.style.maskRepeat         = 'no-repeat';
    overlay.style.webkitMaskPosition = 'center';
    overlay.style.maskPosition       = 'center';
  }

  function setFilter(overlay, filterStr, fill) {
    overlay.style.webkitBackdropFilter = filterStr;
    overlay.style.backdropFilter       = filterStr;
    overlay.style.backgroundColor      = fill || 'transparent';
  }

  function hideChildren(el) {
    for (var i = 0; i < el.children.length; i++) {
      if (!el.children[i].classList.contains('ac-overlay'))
        el.children[i].style.visibility = 'hidden';
    }
  }
  function showChildren(el) {
    for (var i = 0; i < el.children.length; i++) {
      if (!el.children[i].classList.contains('ac-overlay'))
        el.children[i].style.visibility = '';
    }
  }

  /* ─── core ─────────────────────────────────────────────────── */

  function setup(el, userOpts) {
    if (instances.has(el)) return;

    var o = {};
    var k;
    for (k in DEFAULT_OPTS) o[k] = DEFAULT_OPTS[k];
    if (userOpts) { for (k in userOpts) o[k] = userOpts[k]; }
    if (el.dataset.acMode)      o.mode      = el.dataset.acMode;
    if (el.dataset.acFill)      o.fill      = el.dataset.acFill;
    if (el.dataset.acThreshold) o.threshold = parseInt(el.dataset.acThreshold, 10);
    if (el.dataset.acMaskSize)  o.maskSize  = el.dataset.acMaskSize;

    // positioning context
    if (getComputedStyle(el).position === 'static')
      el.style.position = 'relative';

    // overlay
    var overlay = document.createElement('div');
    overlay.className = 'ac-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText =
      'position:absolute;inset:0;z-index:1;pointer-events:none;';
    el.appendChild(overlay);

    var state = { overlay: overlay, opts: o, ro: null };
    instances.set(el, state);

    applyEffect(el, state);

    // responsive: rebuild mask on size change
    if (typeof ResizeObserver !== 'undefined') {
      state.ro = new ResizeObserver(function () { applyEffect(el, state); });
      state.ro.observe(el);
    }
  }

  function applyEffect(el, state) {
    var filterStr = resolveFilter(state.opts.mode, state.opts);
    var maskSrc   = findMaskSource(el);

    setFilter(state.overlay, filterStr, state.opts.fill);

    if (!maskSrc) {
      // No mask → full-element effect
      state.overlay.style.webkitMaskImage = 'none';
      state.overlay.style.maskImage       = 'none';
      return;
    }

    // SVG data URIs can go straight into mask-image
    if (maskSrc.indexOf('data:image/svg') === 0) {
      setMask(state.overlay, maskSrc, state.opts.maskSize);
      hideChildren(el);
      return;
    }

    // Raster images: canvas → data URL for reliable cross-browser masking
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    rasteriseMask(maskSrc, rect.width, rect.height, function (dataURL) {
      // Guard: element may have been destroyed during async load
      if (!instances.has(el)) return;
      setMask(state.overlay, dataURL, state.opts.maskSize);
      hideChildren(el);
    });
  }

  function teardown(el) {
    var state = instances.get(el);
    if (!state) return;
    if (state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    if (state.ro) state.ro.disconnect();
    showChildren(el);
    instances.delete(el);
  }

  /* ─── public API ───────────────────────────────────────────── */

  var AlphaContrast = {
    init: function (el, opts) { setup(el, opts); return this; },

    scan: function () {
      if (typeof document === 'undefined') return this;
      var els = document.querySelectorAll('.alphacontrast');
      for (var i = 0; i < els.length; i++) setup(els[i]);
      return this;
    },

    refresh: function (el) {
      if (el) {
        var s = instances.get(el);
        if (s) applyEffect(el, s);
      } else {
        instances.forEach(function (s, e) { applyEffect(e, s); });
      }
      return this;
    },

    setMode: function (el, mode) {
      var s = instances.get(el);
      if (!s) return this;
      s.opts.mode = mode;
      var f = resolveFilter(mode, s.opts);
      s.overlay.style.webkitBackdropFilter = f;
      s.overlay.style.backdropFilter       = f;
      return this;
    },

    destroy:    function (el) { teardown(el); return this; },
    destroyAll: function ()   { instances.forEach(function (_, e) { teardown(e); }); return this; },

    registerMode: function (name, filterCSS) {
      MODES[name] = filterCSS;
      return this;
    },

    modes: MODES
  };

  /* ─── auto-boot ────────────────────────────────────────────── */

  function boot() {
    AlphaContrast.scan();

    if (typeof MutationObserver !== 'undefined') {
      mutObs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType !== 1) continue;
            if ((n.classList && n.classList.contains('alphacontrast')) ||
                (n.querySelector && n.querySelector('.alphacontrast'))) {
              AlphaContrast.scan();
              return;
            }
          }
        }
      });
      mutObs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', boot);
    else
      boot();
  }

  return AlphaContrast;
}));
