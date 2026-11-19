/* theme.js — 主题解析、持久化、切换器与无障碍 */
(function () {
  var G = (window.Gallery = window.Gallery || {});
  var KEY = 'theme';
  var THEMES = [
    { id: 'gallery', name: '展墙' },
    { id: 'playful', name: '童趣' },
    { id: 'paper', name: '素纸' },
    { id: 'night', name: '夜展' }
  ];
  var selection = 'gallery';
  var popover = null;
  var toggleBtn = null;
  var focusIndex = 0;

  function allowed(id) {
    return id === 'system' || THEMES.some(function (t) { return t.id === id; });
  }

  function systemTheme() {
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'gallery';
  }

  function resolve() {
    var fromUrl = new URLSearchParams(location.search).get('theme');
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    var id = allowed(fromUrl) ? fromUrl : (allowed(stored) ? stored : 'gallery');
    return id || 'gallery';
  }

  function effective(id) { return id === 'system' ? systemTheme() : id; }

  function apply(id, opts) {
    opts = opts || {};
    if (!allowed(id)) id = 'gallery';
    selection = id;
    document.documentElement.dataset.theme = effective(id);
    if (opts.persist !== false) {
      try { localStorage.setItem(KEY, id); } catch (e) {}
    }
    if (opts.syncUrl !== false) {
      var url = new URL(location.href);
      if (id === 'gallery' && !url.searchParams.get('theme')) {
        // 默认主题不写 URL，保持链接干净
      } else {
        url.searchParams.set('theme', id);
        history.replaceState(history.state, '', url.href);
      }
    }
    renderPopover();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: effective(id), selection: id } }));
  }

  function buildPopover() {
    if (popover) return;
    popover = document.createElement('div');
    popover.className = 'popover';
    popover.id = 'theme-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', '切换视觉主题');
    popover.hidden = true;
    popover.innerHTML =
      '<div class="ttl">选择视觉主题</div>' +
      '<div class="swatches">' +
      THEMES.map(function (t, i) {
        return '<button class="swatch" type="button" role="option" data-t="' + t.id + '" data-i="' + i + '">' +
          '<span class="dot"></span><span>' + t.name + '</span><span class="tick" aria-hidden="true"></span></button>';
      }).join('') +
      '</div>' +
      '<button class="system-row" type="button" id="theme-system">' +
      '<span>跟随系统深浅色</span><span class="switch" aria-hidden="true"></span></button>' +
      '<div class="hint">方向键选择 · Enter 确认 · Esc 关闭</div>';
    document.body.appendChild(popover);

    popover.addEventListener('click', function (e) {
      var sw = e.target.closest('.swatch');
      if (sw) { apply(sw.dataset.t); close(); return; }
      if (e.target.closest('#theme-system')) { apply('system'); close(); }
    });
    popover.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(popover.querySelectorAll('.swatch, #theme-system'));
      var idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault(); focusIndex = (idx + 1 + items.length) % items.length; items[focusIndex].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); focusIndex = (idx - 1 + items.length) % items.length; items[focusIndex].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault(); close();
      }
    });
    document.addEventListener('click', function (e) {
      if (!popover.hidden && !popover.contains(e.target) && e.target !== toggleBtn) close();
    });
  }

  function renderPopover() {
    if (!popover) return;
    Array.prototype.forEach.call(popover.querySelectorAll('.swatch'), function (b) {
      var on = b.dataset.t === selection;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.querySelector('.tick').textContent = on ? '✓' : '';
    });
    popover.querySelector('#theme-system').classList.toggle('on', selection === 'system');
  }

  function close() {
    if (!popover) return;
    popover.hidden = true;
    if (toggleBtn) toggleBtn.focus();
  }

  function bindToggle() {
    toggleBtn = document.getElementById('theme-toggle') || document.querySelector('.palette');
    if (!toggleBtn || toggleBtn.dataset.bound) return;
    toggleBtn.dataset.bound = '1';
    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      buildPopover();
      if (popover.hidden) {
        popover.hidden = false;
        renderPopover();
        var first = popover.querySelector('.swatch.on') || popover.querySelector('.swatch');
        focusIndex = Number(first.dataset.i || 0);
        first.focus();
      } else close();
    });
  }

  function init() {
    selection = resolve();
    document.documentElement.dataset.theme = effective(selection);
    buildPopover();
    renderPopover();
    bindToggle();
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (selection === 'system') apply('system', { persist: false, syncUrl: false }); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  G.theme = { init: init, apply: apply, resolve: resolve, bindToggle: bindToggle, close: close, current: function () { return selection; }, THEMES: THEMES };
})();
