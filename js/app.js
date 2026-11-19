/* app.js — hash 路由、视图调度、历史策略、全局错误边界 */
(function () {
  var G = (window.Gallery = window.Gallery || {});
  var esc = G.util.esc;
  var filters = { category: 'all', q: '', year: '', term: '', medium: '', tag: '', sort: 'newest', view: 'wall' };
  var cleanups = [];
  var detailReturn = '#/';
  var detailReturnSet = false;
  var site, index;
  var appRoot;

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var parts = raw.split('?');
    var path = parts[0] || '';
    var query = new URLSearchParams(parts[1] || '');
    var seg = path.split('/').filter(Boolean);
    var route = { type: 'students', authorId: null, category: null, workId: null, all: false };
    if (seg[0] === 'a' && seg[1]) { route.type = 'list'; route.authorId = decodeURIComponent(seg[1]); }
    else if (seg[0] === 'c' && seg[1]) { route.type = 'list'; route.category = decodeURIComponent(seg[1]); route.all = true; }
    else if (seg[0] === 'all') { route.type = 'list'; route.all = true; }
    else if (seg[0] === 'w' && seg[1]) { route.type = 'detail'; route.workId = decodeURIComponent(seg[1]); }
    if (query.get('c')) route.category = query.get('c');
    return route;
  }

  function urlWithQuery(path, key, value) {
    var q = new URLSearchParams(location.search);
    if (key) {
      if (value) q.set(key, value); else q.delete(key);
    }
    var theme = q.get('theme');
    var hashQuery = '';
    if (routeCategoryQuery()) hashQuery = routeCategoryQuery();
    var search = q.toString() ? '?' + q.toString() : '';
    return search + '#' + path + hashQuery;
  }

  function routeCategoryQuery() {
    var raw = location.hash.replace(/^#\/?/, '');
    var parts = raw.split('?');
    return parts[1] ? '?' + parts[1] : '';
  }

  function navigate(url, replace) {
    if (replace) history.replaceState(history.state, '', url);
    else location.hash = url.startsWith('#') ? url.slice(1) : url;
    if (replace) render();
  }

  function registerCleanup(fn) { cleanups.push(fn); }

  function cleanup() {
    cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
    cleanups = [];
    // 详情内切换（目标仍是 #/w/）保留缩放；离开详情或回到列表才重置。
    // 从列表首次打开时 openWork 已调用 resetView，保留缩放不会带入旧状态。
    G.views.detail.close(parseHash().type === 'detail');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function navHTML(totalAuthors, totalWorks) {
    return '<header class="nav"><div class="brand"><div class="logo">点</div><h1>小小美术馆</h1></div>' +
      '<div class="right"><label class="nav-search"><span aria-hidden="true">⌕</span><input id="nav-search" type="search" placeholder="搜索作品" aria-label="搜索作品"></label>' +
      '<span>共 ' + totalAuthors + ' 位小作者 · ' + totalWorks + ' 幅作品</span>' +
      '<button class="palette" id="theme-toggle" type="button" aria-label="切换视觉主题" title="切换视觉主题">◐</button></div></header>';
  }

  function shell() {
    appRoot.innerHTML = navHTML(0, 0) + '<div id="view-root"></div>';
    G.theme.bindToggle();
  }

  function loadingView() {
    var sk = '<div class="skcard"><div class="skel skimg"></div><div class="skel skline"></div><div class="skel skline s"></div></div>';
    appRoot.innerHTML = navHTML(0, 0) +
      '<main class="view"><div class="wall">' +
      '<div class="col">' + sk + sk + '</div><div class="col">' + sk + sk + '</div><div class="col">' + sk + sk + '</div>' +
      '</div></main>';
    G.theme.bindToggle();
  }

  function errorView(err) {
    appRoot.innerHTML = navHTML(0, 0) +
      '<main class="view"><div class="errwrap"><div class="errpanel">' +
      '<div class="mark">!</div><h2>作品数据暂时读不到</h2>' +
      '<p>浏览器直接双击打开时，部分环境会拦截本地 JSON。请在本目录启动一个本地服务再访问，或确认 <code>data/</code> 目录完整。</p>' +
      '<div class="code">cd ' + esc(location.pathname.replace(/\/index\.html$/, '') || '.') + '\npython3 -m http.server 8000\n# 然后打开 http://localhost:8000/</div>' +
      '<div class="acts"><button class="btn primary" type="button" data-retry>重试</button><a class="btn" href="#/">返回聚合页</a></div>' +
      '</div></div></main>';
    var retry = appRoot.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', function () { G.store.clearCache(); render(); });
    G.theme.bindToggle();
  }

  async function render() {
    cleanup();
    if (!site || !index) {
      loadingView();
      try { site = await G.store.loadSite(); index = await G.store.loadIndex(); }
      catch (e) { errorView(e); return; }
    }

    var route = parseHash();
    var q = new URLSearchParams(location.search);
    var shortAuthor = q.get('a');
    if (shortAuthor && route.type === 'students') {
      q.delete('a');
      var search = q.toString() ? '?' + q.toString() : '';
      history.replaceState(history.state, '', search + '#/a/' + encodeURIComponent(shortAuthor));
      route = parseHash();
    }

    var authors = (index.authors || []).filter(function (a) { return a.visible !== false; });
    var totalWorks = authors.reduce(function (s, a) { return s + (a.workCount || 0); }, 0);

    if (route.authorId) {
      var author = G.store.authorById(route.authorId);
      if (!author || author.visible === false) {
        toast('该学员暂未开放');
        history.replaceState(history.state, '', location.pathname + location.search + '#/');
        route = parseHash();
      }
    }

    var workId = route.type === 'detail' ? route.workId : null;
    var scopeAuthor = route.authorId;
    if (workId && !scopeAuthor) {
      var m = String(workId).match(/^([a-z0-9]+)-/);
      if (m) scopeAuthor = m[1];
    }

    var works = [];
    if (route.type !== 'students') {
      try { works = await G.store.getWorks(scopeAuthor || null); }
      catch (e) { errorView(e); return; }
    }

    if (route.category) filters.category = route.category;
    else if (route.type === 'list') filters.category = 'all';
    if (q.get('view') === 'timeline') filters.view = 'timeline';
    if (q.get('q')) filters.q = q.get('q');

    appRoot.innerHTML = navHTML(authors.length, totalWorks) + '<div id="view-root"></div>';
    var viewRoot = appRoot.querySelector('#view-root');
    var ctx = { site: site, index: index, works: works, route: route, filters: filters, registerCleanup: registerCleanup };

    try {
      if (route.type === 'students') G.views.students.mount(viewRoot, ctx);
      else {
        G.views.list.mount(viewRoot, ctx);
        if (workId) {
          var work = works.filter(function (w) { return w.id === workId; })[0];
          if (work) {
            if (!detailReturnSet) detailReturn = scopeAuthor ? '#/a/' + encodeURIComponent(scopeAuthor) : '#/';
            G.views.detail.mount({ site: site, work: work, works: G.store.filterWorks(works, { category: 'all', sort: filters.sort }, site), author: G.store.authorById(scopeAuthor) });
          } else { toast('这幅作品暂未开放'); history.replaceState(history.state, '', location.pathname + location.search + detailReturn); }
        }
      }
    } catch (e) { errorView(e); return; }

    G.theme.init();
    bindNavSearch();
  }

  function bindNavSearch() {
    var input = document.getElementById('nav-search');
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = input.value.trim();
      if (!q) return;
      var author = (index.authors || []).filter(function (a) { return a.visible !== false; })[0];
      if (!author) return;
      filters.q = q; filters.category = 'all';
      navigate('#/a/' + encodeURIComponent(author.id));
      setTimeout(function () { var f = document.querySelector('[data-filter="q"]'); if (f) { f.focus(); f.setSelectionRange(q.length, q.length); } }, 50);
    });
  }

  function setCategory(cat) {
    var route = parseHash();
    if (cat === 'all') filters.category = 'all';
    if (route.authorId) {
      var raw = location.hash.replace(/^#\/?/, '').split('?')[0];
      var q = new URLSearchParams();
      if (cat !== 'all') q.set('c', cat);
      var theme = new URLSearchParams(location.search).get('theme');
      var search = theme ? '?theme=' + encodeURIComponent(theme) : '';
      history.replaceState(history.state, '', search + '#' + raw + (q.toString() ? '?' + q.toString() : ''));
      render();
    } else {
      navigate(cat === 'all' ? '#/all' : '#/c/' + encodeURIComponent(cat), true);
    }
  }

  function clearFilters() {
    filters.q = ''; filters.year = ''; filters.term = ''; filters.medium = ''; filters.tag = ''; filters.sort = 'newest'; filters.view = 'wall'; filters.category = 'all';
    var route = parseHash();
    if (route.authorId) {
      var raw = location.hash.replace(/^#\/?/, '').split('?')[0];
      var theme = new URLSearchParams(location.search).get('theme');
      history.replaceState(history.state, '', (theme ? '?theme=' + encodeURIComponent(theme) : '') + '#' + raw);
    }
    render();
  }

  function openWork(id) {
    if (parseHash().type !== 'detail') {
      detailReturn = location.hash || '#/';
      detailReturnSet = true;
      if (G.views.detail.resetView) G.views.detail.resetView();
    }
    navigate('#/w/' + encodeURIComponent(id));
  }

  function closeDetail() {
    var focusId = G.views.detail.current && G.views.detail.current();
    G.views.detail.close();
    var back = (detailReturn && !detailReturn.startsWith('#/w/')) ? detailReturn : '#/';
    detailReturnSet = false;
    history.replaceState(history.state, '', location.pathname + location.search + back);
    var done = render();
    if (done && done.then) done.then(function () {
      var card = focusId && document.querySelector('[data-work="' + focusId + '"]');
      if (card) card.focus();
    });
  }

  window.addEventListener('popstate', render);
  window.addEventListener('hashchange', render);

  G.app = {
    state: { filters: filters },
    init: function () { appRoot = document.getElementById('app'); render(); },
    render: render, navigate: navigate, setCategory: setCategory, clearFilters: clearFilters,
    openWork: openWork, closeDetail: closeDetail, toast: toast
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', G.app.init);
  else G.app.init();
})();
