/* util.js — 纯工具，挂载到 Gallery.util */
(function () {
  var G = (window.Gallery = window.Gallery || {});

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shortDate(s) {
    if (!s) return '';
    var p = String(s).split('-');
    return p.length === 3 ? (p[1] + '-' + p[2]) : String(s);
  }

  function cnDate(s) {
    if (!s) return '';
    var p = String(s).split('-');
    return p.length === 3 ? (Number(p[1]) + ' 月 ' + Number(p[2]) + ' 日') : String(s);
  }

  function monthKey(s) { return String(s || '').slice(0, 7); }

  function debounce(fn, wait) {
    var t;
    return function () {
      var self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  G.util = { esc: esc, shortDate: shortDate, cnDate: cnDate, monthKey: monthKey, debounce: debounce, clamp: clamp };
})();
