/* view-list.js — L2 作品墙、分类 Tab、筛选、搜索、时间轴与空态 */
(function () {
  var G = (window.Gallery = window.Gallery || {});
  var esc = G.util.esc;
  var site, index, works, route, filters, root, idx, currentFiltered = [];

  function categoryList() {
    return (site.categories || []).filter(function (c) { return !c.hidden; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  function tabsHTML() {
    var cats = categoryList();
    var total = works.length;
    var html = '<button class="tab' + (activeCat() === 'all' ? ' on' : '') + '" data-cat="all" type="button">全部<b>' + total + '</b></button>';
    cats.forEach(function (c) {
      var count = (idx.categories[c.id] && idx.categories[c.id].total) || 0;
      html += '<button class="tab' + (activeCat() === c.id ? ' on' : '') + '" data-cat="' + esc(c.id) + '" type="button"' + (count === 0 ? ' aria-label="' + esc(c.name) + '，0 幅"' : '') + '>' + esc(c.name) + '<b>' + count + '</b></button>';
    });
    return html;
  }

  function activeCat() { return filters.category || 'all'; }

  function optionsHTML(map, current, allLabel) {
    var keys = Object.keys(map || {}).sort();
    if (!keys.length) return '';
    return '<option value=""' + (current ? '' : ' selected') + '>' + allLabel + '</option>' +
      keys.map(function (k) { return '<option value="' + esc(k) + '"' + (current === k ? ' selected' : '') + '>' + esc(k) + '（' + map[k] + '）</option>'; }).join('');
  }

  function tagsHTML() {
    var groups = site.tags && site.tags.groups || [];
    var any = Object.keys(idx.tags || {}).length > 0;
    if (!any) return '';
    var body = '<option value=""' + (filters.tag ? '' : ' selected') + '>全部标签</option>';
    groups.forEach(function (g) {
      var items = Object.keys((idx.tagGroups && idx.tagGroups[g.id]) || {}).filter(function (t) { return idx.tagGroups[g.id][t] > 0; });
      if (!items.length) return;
      body += '<optgroup label="' + esc(g.name) + '">' + items.map(function (t) {
        return '<option value="' + esc(t) + '"' + (filters.tag === t ? ' selected' : '') + '>' + esc(t) + '（' + idx.tagGroups[g.id][t] + '）</option>';
      }).join('') + '</optgroup>';
    });
    return '<label class="field">标签<select data-filter="tag">' + body + '</select></label>';
  }

  function filterbarHTML() {
    var hasFilter = filters.q || filters.year || filters.term || filters.medium || filters.tag || (filters.sort && filters.sort !== 'newest') || filters.view === 'timeline';
    return '<div class="filterbar">' +
      '<label class="searchbox"><span aria-hidden="true">⌕</span><input type="search" data-filter="q" value="' + esc(filters.q || '') + '" placeholder="搜索标题、简介、标签…" aria-label="搜索作品"><em>300ms</em></label>' +
      (Object.keys(idx.years || {}).length ? '<label class="field">年份<select data-filter="year">' + optionsHTML(idx.years, filters.year, '全部年份') + '</select></label>' : '') +
      (Object.keys(idx.terms || {}).length ? '<label class="field">学期<select data-filter="term">' + optionsHTML(idx.terms, filters.term, '全部学期') + '</select></label>' : '') +
      (Object.keys(idx.mediums || {}).length ? '<label class="field">媒材<select data-filter="medium">' + optionsHTML(idx.mediums, filters.medium, '全部媒材') + '</select></label>' : '') +
      tagsHTML() +
      '<label class="field">排序<select data-filter="sort">' +
        [['newest', '最新优先'], ['oldest', '最早优先'], ['featured', '精选优先']].map(function (p) {
          return '<option value="' + p[0] + '"' + ((filters.sort || 'newest') === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
        }).join('') + '</select></label>' +
      (hasFilter ? '<button class="clear" type="button" data-clear>清除全部筛选</button>' : '') +
      '<span class="viewtoggle"><button class="btn' + (filters.view !== 'timeline' ? ' primary' : '') + '" type="button" data-view="wall">作品墙</button>' +
      '<button class="btn' + (filters.view === 'timeline' ? ' primary' : '') + '" type="button" data-view="timeline">时间轴</button></span>' +
      '</div>';
  }

  function resultHTML(list) {
    var cat = activeCat();
    var name = cat === 'all' ? '全部作品' : (G.store.categoryName(site, cat) || cat);
    return '<div class="resultline">当前显示 <b>' + list.length + '</b> 幅 · ' + esc(name) + (filters.q ? ' · 搜索“' + esc(filters.q) + '”' : '') + '</div>';
  }

  function cardHTML(w) {
    var cat = G.store.categoryName(site, w.category);
    var img = w.image || {};
    var ratio = img.ratio || (img.height && img.width ? img.height / img.width : 0.7);
    var cd = w.categoryDetail || {};
    var badge = '';
    if (w.category === 'contest' && (cd.award || cd.level)) {
      badge = '<span class="award-badge">' + esc(cd.level || cd.award) + '</span>';
    }
    return '<article class="card" data-work="' + esc(w.id) + '" tabindex="0" role="link" aria-label="查看作品 ' + esc(w.title) + '">' +
      '<span class="pin"></span>' + badge +
      '<div class="img" style="aspect-ratio:' + (1 / ratio).toFixed(3) + '"><img src="' + esc(img.cover || '') + '" alt="' + esc(w.title) + '" loading="lazy" decoding="async"></div>' +
      '<h3>' + esc(w.title) + '</h3><p>' + esc(w.summary) + '</p>' +
      '<div class="meta"><span class="chip">' + esc(cat) + '</span><span>' + esc(G.util.shortDate(w.date)) + '</span></div>' +
      '</article>';
  }

  function wallHTML(list) {
    var host = root.querySelector('#list-content');
    var wall = document.createElement('div');
    wall.className = 'wall';
    wall.setAttribute('data-wall', '');
    host.appendChild(wall);
    fillWall(wall, list);
  }

  function fillWall(wall, list) {
    var cs = getComputedStyle(wall);
    var gap = parseFloat(cs.columnGap || cs.gap || '26') || 26;
    var cols = G.layout.columnsFor(wall, 260, gap);
    var inner = wall.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    var cardWidth = Math.max(120, (inner - gap * (cols - 1)) / cols);
    var distributed = G.layout.distribute(list, cols, gap, cardWidth);
    wall.innerHTML = distributed.map(function (col) {
      return '<div class="col">' + col.map(cardHTML).join('') + '</div>';
    }).join('');
    bindCards(wall);
  }

  function timelineHTML(list) {
    var groups = {}, order = [];
    list.forEach(function (w) {
      var k = G.util.monthKey(w.date) || '未标注';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(w);
    });
    var html = '<div class="tlwrap"><div class="tlhead"><h2>成长时间轴</h2><span>按周 / 月串成的成长线</span></div>';
    var prevTeacher = '';
    order.forEach(function (k) {
      html += '<div class="tlmonth">' + esc(k.replace('-', ' 年 ')) + ' 月</div>';
      groups[k].forEach(function (w) {
        var author = G.store.authorById(w.authorId) || w.author || {};
        var tr = G.store.resolveTeacher(w, author, site);
        if (prevTeacher && tr.name !== prevTeacher) html += '<div class="tlmonth">换师 · 由 ' + esc(tr.name) + ' 带课</div>';
        prevTeacher = tr.name;
        var img = w.image || {};
        html += '<div class="tlitem" data-work="' + esc(w.id) + '" tabindex="0" role="link">' +
          '<img src="' + esc(img.cover || '') + '" alt="" loading="lazy">' +
          '<div class="txt"><h3>' + esc(w.title) + '</h3><p>' + esc(w.summary) + '</p></div>' +
          '<span class="when">' + esc(G.util.shortDate(w.date)) + (w.week ? ' · 第 ' + esc(w.week) + ' 周' : '') + '</span></div>';
      });
    });
    return html + '</div>';
  }

  function emptyHTML() {
    if (activeCat() !== 'all') {
      return '<div class="wall-empty"><div class="empty"><div class="glyph">◇</div><h3>这个分类还在等第一幅画</h3><p>换个分类看看，或者回到全部作品。</p><button class="btn" type="button" data-cat="all">去全部作品</button></div></div>';
    }
    return '<div class="wall-empty"><div class="empty"><div class="glyph">◇</div><h3>没有找到作品</h3><p>试试清除筛选，或换个关键词。</p><button class="btn" type="button" data-clear>清除全部筛选</button></div></div>';
  }

  function renderContent(list) {
    currentFiltered = list;
    var host = root.querySelector('#list-content');
    if (!host) return;
    host.innerHTML = '';
    if (!list.length) { host.innerHTML = emptyHTML(); return; }
    if (filters.view === 'timeline') host.innerHTML = timelineHTML(list);
    else wallHTML(list);
  }

  function refresh() {
    var resultEl = root.querySelector('.resultline');
    if (resultEl) resultEl.outerHTML = resultHTML(currentFiltered = G.store.filterWorks(works, filters, site));
    renderContent(currentFiltered);
    bindActions(root.querySelector('#list-content'));
    var bar = root.querySelector('.filterbar');
    if (bar) {
      var old = bar.querySelector('[data-clear]');
      var need = filters.q || filters.year || filters.term || filters.medium || filters.tag || (filters.sort && filters.sort !== 'newest') || filters.view === 'timeline';
      if (need && !old) {
        var b = document.createElement('button'); b.className = 'clear'; b.type = 'button'; b.dataset.clear = ''; b.textContent = '清除全部筛选';
        bar.insertBefore(b, bar.querySelector('.viewtoggle'));
      } else if (!need && old) old.remove();
    }
  }

  function bindCards(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-work]'), function (el) {
      var open = function () { G.app.openWork(el.dataset.work); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      Array.prototype.forEach.call(el.querySelectorAll('img'), function (img) {
        img.addEventListener('error', function () {
          var box = img.closest('.img') || img.parentElement;
          if (box) box.innerHTML = '<div class="img-miss"><span>◇</span><span>纸张占位 · 图片暂缺</span></div>';
        });
      });
    });
  }

  function bindActions(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-cat]'), function (b) {
      b.addEventListener('click', function () { G.app.setCategory(b.dataset.cat); });
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-clear]'), function (b) {
      b.addEventListener('click', function () { G.app.clearFilters(); });
    });
  }

  function ownerHTML() {
    var author = route.authorId ? G.store.authorById(route.authorId) : null;
    if (route.all) {
      var authors = index.authors || [];
      return '<div class="owner"><b>全班作品</b><span>混合视角</span></div>' +
        '<span class="stats">' + authors.map(function (a) { return '<a class="btn" href="#/a/' + esc(a.id) + '">' + esc(a.name) + '</a>'; }).join(' ') + '</span>';
    }
    var avatar = author ? (author.avatar || author.recentCover || '') : '';
    return '<a class="back" href="#/">← 小小美术馆</a>' +
      '<div class="owner"><div class="av"><img src="' + esc(avatar) + '" alt="" loading="lazy"></div><b>' + esc(author ? author.name : '作品墙') + '</b>' +
      '<span>' + esc(author ? (author.age + ' 岁 · ' + author.class) : '') + '</span></div>' +
      '<div class="stats">共 ' + works.length + ' 幅 · ' + Object.keys(idx.categories).filter(function (k) { return idx.categories[k].total > 0; }).length + ' 个分类</div>';
  }

  function catHeroHTML() {
    if (!route.category || route.category === 'all' || route.authorId) return '';
    var c = (site.categories || []).filter(function (x) { return x.id === route.category; })[0];
    if (!c) return '';
    var count = currentFiltered.length;
    var extra = route.category === 'contest' ? '<p>获奖信息仅展示赛事、奖项与作品；证书图按隐私规范不进首版。</p>' : '';
    return '<section class="cat-hero"><div><div class="eyebrow">分类作品 · CATEGORY</div><h2>' + esc(c.name) + '</h2><p>' + esc(c.desc || '') + extra + '</p></div><span class="num">' + count + ' 幅</span></section>';
  }

  function mount(_root, ctx) {
    root = _root; site = ctx.site; index = ctx.index; works = ctx.works; route = ctx.route; filters = ctx.filters;
    idx = G.store.buildIndex(works, site);
    currentFiltered = G.store.filterWorks(works, filters, site);

    root.innerHTML = '<section class="view" aria-label="作品墙">' +
      catHeroHTML() +
      '<div class="subnav">' + ownerHTML() + '</div>' +
      '<div class="tabs" role="tablist">' + tabsHTML() + '</div>' +
      filterbarHTML() + resultHTML(currentFiltered) +
      '<div id="list-content"></div></section>';

    renderContent(currentFiltered);

    bindActions(root);

    Array.prototype.forEach.call(root.querySelectorAll('[data-filter]'), function (el) {
      var key = el.dataset.filter;
      if (key === 'q') {
        el.addEventListener('input', G.util.debounce(function () { filters.q = el.value.trim(); refresh(); }, 300));
      } else {
        el.addEventListener('change', function () { filters[key] = el.value; refresh(); });
      }
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () {
        filters.view = b.dataset.view;
        Array.prototype.forEach.call(root.querySelectorAll('[data-view]'), function (x) { x.classList.toggle('primary', x === b); });
        refresh();
      });
    });

    var onResize = G.util.debounce(function () {
      if (filters.view !== 'timeline') {
        var wall = root.querySelector('[data-wall]');
        if (wall) fillWall(wall, currentFiltered);
      }
    }, 150);
    window.addEventListener('resize', onResize);
    if (ctx.registerCleanup) ctx.registerCleanup(function () { window.removeEventListener('resize', onResize); });
  }

  G.views = G.views || {};
  G.views.list = { mount: mount };
})();
