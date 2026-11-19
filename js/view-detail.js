/* view-detail.js — L3 全屏详情覆盖层（CR-006：手势与焦点 7 条规格） */
(function () {
  var G = (window.Gallery = window.Gallery || {});
  var esc = G.util.esc;
  var overlay = null;
  var lastFocus = null;
  var onKey = null;
  var currentWorkId = null;
  var switching = false;
  var zoom = { scale: 1, x: 0, y: 0 };
  var listeners = [];

  function detailRow(label, value) {
    if (!value) return '';
    return '<div class="row"><em>' + esc(label) + '</em><span>' + esc(value) + '</span></div>';
  }

  function extraRows(w) {
    var d = w.categoryDetail || {};
    if (w.category === 'exam') return detailRow('科目', d.subject) + detailRow('级别', d.level);
    if (w.category === 'contest') return detailRow('赛事', d.name) + detailRow('奖项', d.level || d.award);
    if (w.category === 'sketch') return detailRow('地点', d.place) + detailRow('主题', d.subject);
    if (w.category === 'theme') return detailRow('主题', d.topic) + detailRow('场合', d.occasion);
    return '';
  }

  function neighbor(list, id, delta) {
    var i = list.findIndex(function (w) { return w.id === id; });
    if (i < 0) return null;
    return list[i + delta] || null;
  }

  function add(el, type, fn) { el.addEventListener(type, fn); listeners.push([el, type, fn]); }
  function clearListeners() { listeners.forEach(function (x) { x[0].removeEventListener(x[1], x[2]); }); listeners = []; }

  function applyTransform(img, animate) {
    if (!img) return;
    img.style.transition = animate ? 'transform 220ms cubic-bezier(.2,.7,.2,1)' : 'none';
    img.style.transform = 'translate(' + zoom.x + 'px,' + zoom.y + 'px) scale(' + zoom.scale + ')';
  }

  function clampPan(img) {
    var box = img.parentElement;
    if (!box) return;
    var maxX = Math.max(0, (box.clientWidth * (zoom.scale - 1)) / 2);
    var maxY = Math.max(0, (box.clientHeight * (zoom.scale - 1)) / 2);
    zoom.x = G.util.clamp(zoom.x, -maxX, maxX);
    zoom.y = G.util.clamp(zoom.y, -maxY, maxY);
  }

  function mount(ctx) {
    var w = ctx.work, site = ctx.site, list = ctx.works || [];
    if (overlay && currentWorkId === w.id) return;
    close(true);
    currentWorkId = w.id;

    var author = ctx.author || G.store.authorById(w.authorId) || w.author || {};
    var teacher = G.store.resolveTeacher(w, author, site);
    var cat = G.store.categoryName(site, w.category);
    var prev = neighbor(list, w.id, -1), next = neighbor(list, w.id, 1);
    var img = w.image || {};

    if (!switching) lastFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'detail-layer';
    overlay.innerHTML =
      '<div class="scrim" data-close></div>' +
      '<div class="detail" role="dialog" aria-modal="true" aria-label="' + esc(w.title) + ' 作品详情">' +
        '<button class="close" type="button" data-close aria-label="关闭详情">×</button>' +
        '<div class="left"><img draggable="false" src="' + esc(img.full || img.cover || '') + '" alt="' + esc(w.title) + '"></div>' +
        '<div class="label">' +
          '<div class="cat">' + esc(cat) + (w.category === 'contest' && (w.categoryDetail || {}).level ? ' · ' + esc(w.categoryDetail.level) : '') + '</div>' +
          '<h2>' + esc(w.title) + '</h2>' +
          '<div class="by">' + esc(author.name || '') + (author.class ? ' · ' + esc(author.class) : '') + ' · ' + esc(G.util.cnDate(w.date)) + (w.week ? ' · 第 ' + esc(w.week) + ' 周' : '') + '</div>' +
          (w.description ? '<div class="desc">' + esc(w.description) + '</div>' : '') +
          ((w.tags && w.tags.length) ? '<div class="tags">' + w.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="spec">' +
            detailRow('指导老师', teacher.name + (teacher.note ? '（' + teacher.note + '）' : '')) +
            detailRow('媒材', (w.medium || []).join(' / ')) +
            detailRow('画幅', w.size) +
            detailRow('学期', w.term) +
            extraRows(w) +
          '</div>' +
          '<div class="pager">' +
            (prev ? '<button type="button" data-go="' + esc(prev.id) + '">← 上一幅 · ' + esc(prev.title) + '</button>' : '<span></span>') +
            (next ? '<button type="button" data-go="' + esc(next.id) + '">下一幅 · ' + esc(next.title) + ' →</button>' : '<span></span>') +
          '</div>' +
          '<div class="hintline">← → 切图 · 双击缩放 · 双指放大 · Esc 关闭</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var appEl = document.getElementById('app');
    if (appEl) { appEl.setAttribute('inert', ''); appEl.setAttribute('aria-hidden', 'true'); }

    var imgEl = overlay.querySelector('.left img');
    add(imgEl, 'error', function () {
      imgEl.parentElement.innerHTML = '<div class="img-miss"><span>◇</span><span>纸张占位 · 大图暂缺</span></div>';
    });

    // 图从卡片位置放大：取触发卡片中心作为变换原点
    var left = overlay.querySelector('.left');
    if (lastFocus && lastFocus.getBoundingClientRect && imgEl) {
      var from = lastFocus.getBoundingClientRect();
      var to = left.getBoundingClientRect();
      imgEl.style.transformOrigin = G.util.clamp(((from.left + from.width / 2 - to.left) / to.width) * 100, 0, 100) + '% ' +
        G.util.clamp(((from.top + from.height / 2 - to.top) / to.height) * 100, 0, 100) + '%';
    }
    applyTransform(imgEl, false);

    add(overlay, 'click', function (e) {
      if (e.target.closest('[data-close]')) { G.app.closeDetail(); return; }
      var go = e.target.closest('[data-go]');
      if (go) { switching = true; G.app.openWork(go.dataset.go); }
    });

    function go(delta) {
      var target = delta < 0 ? prev : next;
      if (target) { switching = true; G.app.openWork(target.id); }
    }

    // 键盘：Esc 关闭、左右切图、Tab 焦点陷阱
    onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); G.app.closeDetail(); return; }
      if (e.key === 'ArrowLeft' && zoom.scale <= 1) { e.preventDefault(); go(-1); return; }
      if (e.key === 'ArrowRight' && zoom.scale <= 1) { e.preventDefault(); go(1); return; }
      if (e.key === 'Tab') {
        var focusables = Array.prototype.slice.call(overlay.querySelectorAll('button'));
        if (!focusables.length) return;
        var i = focusables.indexOf(document.activeElement);
        e.preventDefault();
        focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
      }
    };
    add(document, 'keydown', onKey);

    // 指针手势：滑动切图 / 拖动 / 双指缩放
    var pointers = {}, start = null, last = null, pinch = null, swiped = false, pinching = false;
    function dist() {
      var pts = Object.keys(pointers).map(function (k) { return pointers[k]; });
      return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    // 关键：img 默认可被 HTML5 原生拖放，鼠标拖动会触发 pointercancel（clientX/Y=0），
    // 导致滑动判定读到错误位移。三层阻断：draggable=false / dragstart preventDefault / pointerdown preventDefault。
    add(left, 'dragstart', function (e) { e.preventDefault(); });
    add(left, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse') e.preventDefault();
      try { left.setPointerCapture(e.pointerId); } catch (err) {}
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      last = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length === 1) { start = { x: e.clientX, y: e.clientY, sx: zoom.x, sy: zoom.y }; swiped = false; }
      if (Object.keys(pointers).length === 2) { pinch = { d: dist(), scale: zoom.scale }; pinching = true; }
    });
    add(left, 'pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      last = { x: e.clientX, y: e.clientY };
      var count = Object.keys(pointers).length;
      if (count >= 2 && pinch) {
        zoom.scale = G.util.clamp(pinch.scale * (dist() / (pinch.d || 1)), 1, 3);
        clampPan(imgEl); applyTransform(imgEl, false);
        return;
      }
      if (count === 1 && start) {
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (zoom.scale > 1) {
          zoom.x = start.sx + dx; zoom.y = start.sy + dy;
          clampPan(imgEl); applyTransform(imgEl, false);
        } else if (Math.abs(dx) > 3) {
          zoom.x = G.util.clamp(dx, -40, 40) * 0.45;
          applyTransform(imgEl, false);
        }
      }
    });
    function endPointer(e) {
      var count = Object.keys(pointers).length;
      // pointercancel 的 clientX/Y 可能归零，用最后一次 pointermove 坐标兜底
      var pt = (e.type === 'pointercancel' && last) ? last : { x: e.clientX, y: e.clientY };
      var dx = start ? pt.x - start.x : 0, dy = start ? pt.y - start.y : 0;
      delete pointers[e.pointerId];
      if (count >= 2) { if (Object.keys(pointers).length < 2) { pinch = null; pinching = false; } return; }
      if (!pinching && zoom.scale <= 1 && Math.abs(dx) >= 60 && Math.abs(dy) < 30) {
        swiped = true; go(dx < 0 ? 1 : -1); return;
      }
      if (zoom.scale <= 1) { zoom.x = 0; zoom.y = 0; applyTransform(imgEl, true); }
      start = null;
    }
    add(left, 'pointerup', endPointer);
    add(left, 'pointercancel', endPointer);
    add(left, 'dblclick', function () {
      zoom.scale = zoom.scale > 1 ? 1 : 2;
      zoom.x = 0; zoom.y = 0;
      applyTransform(imgEl, true);
    });

    var closeBtn = overlay.querySelector('.close');
    if (closeBtn) closeBtn.focus();
  }

  function close(keepZoom) {
    if (overlay) { overlay.remove(); overlay = null; }
    clearListeners();
    if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
    var appEl = document.getElementById('app');
    if (appEl) { appEl.removeAttribute('inert'); appEl.removeAttribute('aria-hidden'); }
    var target = lastFocus;
    if (!target || !document.contains(target)) {
      target = (currentWorkId && document.querySelector('[data-work="' + currentWorkId + '"]')) || document.querySelector('.card');
    }
    if (!switching && target && document.contains(target)) { try { target.focus(); } catch (e) {} }
    if (!keepZoom) { zoom.scale = 1; zoom.x = 0; zoom.y = 0; currentWorkId = null; switching = false; }
    if (!switching) lastFocus = null;
  }

  G.views = G.views || {};
  G.views.detail = { mount: mount, close: close, resetView: function () { zoom.scale = 1; zoom.x = 0; zoom.y = 0; currentWorkId = null; switching = false; }, current: function () { return currentWorkId; } };
})();
