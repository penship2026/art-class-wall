/* view-students.js — L1 学员聚合页 */
(function () {
  var G = (window.Gallery = window.Gallery || {});
  var esc = G.util.esc;

  function card(a, site) {
    var count = a.workCount || 0;
    var cats = a.categoryCount || 0;
    var avatar = a.avatar || a.recentCover || '';
    var inner = '';
    if (count > 0) {
      inner =
        '<div class="avatar"><img src="' + esc(avatar) + '" alt="" loading="lazy"></div>' +
        '<div><div class="sname">' + esc(a.name) + '</div>' +
        '<div class="smeta">' + esc(a.age) + ' 岁 · ' + esc(a.class) + ' · 每周一幅，已挂 ' + count + ' 幅</div></div>' +
        '<div class="sgo"><span class="scount">共 ' + count + ' 幅 · ' + cats + ' 个分类</span>' +
        '<span>最近挂上 ' + esc(G.util.cnDate(a.recentDate)) + ' →</span></div>';
    } else {
      inner =
        '<div class="avatar"><img src="' + esc(avatar) + '" alt="" loading="lazy"></div>' +
        '<div><div class="sname">' + esc(a.name) + '</div>' +
        '<div class="smeta">' + esc(a.age) + ' 岁 · ' + esc(a.class) + '</div></div>' +
        '<div class="sgo"><span class="scount">作品准备中</span><span>第一幅画正在路上 →</span></div>';
    }
    return '<a class="scard' + (count ? '' : ' ghost') + '" href="#/a/' + esc(a.id) + '" aria-label="进入' + esc(a.name) + '的作品墙">' +
      '<span class="pin"></span>' + inner + '</a>';
  }

  function freshItem(a) {
    if (!a || !a.recentWorkId) return '';
    var cat = a.recentCategory ? G.store.categoryName(G.store.site() || {}, a.recentCategory) : '';
    return '<div class="item" data-work="' + esc(a.recentWorkId) + '" tabindex="0" role="link">' +
      '<img src="' + esc(a.recentCover) + '" alt="" loading="lazy">' +
      '<div>' + esc(a.recentTitle || '新作品') + '<em>' + esc(G.util.shortDate(a.recentDate)) + ' · ' + esc(cat) + '</em></div></div>';
  }

  function mount(root, ctx) {
    var site = ctx.site, index = ctx.index;
    var authors = (index.authors || []).filter(function (a) { return a.visible !== false; });
    var totalWorks = authors.reduce(function (s, a) { return s + (a.workCount || 0); }, 0);
    var fresh = authors.filter(function (a) { return a.recentWorkId; }).slice(0, 3);

    root.innerHTML =
      '<section class="view" aria-label="学员聚合页">' +
        '<div class="hero"><h2>' + esc(site.landing.title) + '</h2><p>' + esc(site.landing.subtitle) + '</p></div>' +
        '<div class="landing">' +
          '<div class="students">' + (authors.length ? authors.map(function (a) { return card(a, site); }).join('') : '<div class="empty"><h3>还没有小作者</h3><p>用管理台添加第一位学员吧。</p></div>') + '</div>' +
          (fresh.length ? '<aside class="fresh"><h3>本周新挂上</h3>' + fresh.map(freshItem).join('') + '<a class="more" href="#/all">其他小作者陆续加入 →</a></aside>' : '') +
        '</div>' +
        '<div class="foot"><span>' + (site.landing.showAllWorksEntry ? '<a href="#/all">全班作品（混合视角）</a> · ' : '') + esc(site.subtitle) + '</span><span>' + totalWorks + ' 幅作品 · 手机端同样可浏览</span></div>' +
      '</section>';

    Array.prototype.forEach.call(root.querySelectorAll('.item[data-work]'), function (el) {
      el.addEventListener('click', function () { G.app.navigate('#/w/' + el.dataset.work); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); G.app.navigate('#/w/' + el.dataset.work); } });
    });
  }

  G.views = G.views || {};
  G.views.students = { mount: mount };
})();
