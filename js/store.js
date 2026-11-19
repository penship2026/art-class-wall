/* store.js — 数据加载、索引、检索、老师解析、file:// 兜底 */
(function () {
  var G = (window.Gallery = window.Gallery || {});
  var state = { site: null, index: null, cache: {} };

  function bootGlobal(name) { return window[name] || null; }

  async function fetchJSON(path, fallbackName) {
    try {
      var res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      var g = bootGlobal(fallbackName);
      if (g) return g;
      throw e;
    }
  }

  async function loadSite() {
    if (!state.site) state.site = await fetchJSON('./data/site.json', '__GALLERY_SITE__');
    return state.site;
  }

  async function loadIndex() {
    if (!state.index) state.index = await fetchJSON('./data/authors.index.json', '__GALLERY_INDEX__');
    return state.index;
  }

  function normalize(list, site, authors) {
    var alias = (site && site.tags && site.tags.aliases) || {};
    var authorMap = {};
    (authors || []).forEach(function (a) { authorMap[a.id] = a; });
    return (list || [])
      .filter(function (w) { return w && w.visible !== false; })
      .map(function (w) {
        var a = w.author || authorMap[w.authorId] || {};
        var tags = (w.tags || []).map(function (t) { return alias[t] || t; });
        return {
          id: w.id, title: w.title || '未命名', date: w.date || '', term: w.term || '',
          week: w.week, category: w.category || 'daily', categoryDetail: w.categoryDetail || {},
          teacher: w.teacher || '', teacherNote: w.teacherNote || '', medium: w.medium || [],
          size: w.size || '', tags: tags, summary: w.summary || '', description: w.description || '',
          image: w.image || {}, featured: !!w.featured, visible: true,
          authorId: w.authorId || a.id || '', author: { name: a.name || '', age: a.age, class: a.class || '' }
        };
      })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  }

  async function getWorks(authorId) {
    var key = authorId || '__all__';
    if (!state.cache[key]) {
      state.cache[key] = (async function () {
        var site = await loadSite();
        var index = await loadIndex();
        var data = authorId
          ? await fetchJSON('./data/works/' + encodeURIComponent(authorId) + '.json', '__GALLERY_DATA__')
          : await fetchJSON('./data/works.json', '__GALLERY_DATA__');
        var list = authorId && data && data.works ? data.works : (data && data.works ? data.works.filter(function (w) { return !authorId || w.authorId === authorId; }) : []);
        return normalize(list, site, index.authors);
      })();
    }
    return state.cache[key];
  }

  function categoryName(site, id) {
    var c = (site.categories || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : id;
  }

  function buildIndex(works, site) {
    var cats = {};
    (site.categories || []).forEach(function (c) { cats[c.id] = { id: c.id, name: c.name, total: 0, hidden: !!c.hidden }; });
    var years = {}, terms = {}, mediums = {}, tags = {}, tagGroups = {};
    (site.tags && site.tags.groups || []).forEach(function (g) { tagGroups[g.id] = {}; });
    works.forEach(function (w) {
      if (!cats[w.category]) cats[w.category] = { id: w.category, name: w.category, total: 0, hidden: false };
      cats[w.category].total++;
      if (w.date) years[w.date.slice(0, 4)] = (years[w.date.slice(0, 4)] || 0) + 1;
      if (w.term) terms[w.term] = (terms[w.term] || 0) + 1;
      (w.medium || []).forEach(function (m) { mediums[m] = (mediums[m] || 0) + 1; });
      (w.tags || []).forEach(function (t) {
        tags[t] = (tags[t] || 0) + 1;
        var group = findTagGroup(site, t);
        if (group && tagGroups[group]) tagGroups[group][t] = (tagGroups[group][t] || 0) + 1;
      });
    });
    return { categories: cats, years: years, terms: terms, mediums: mediums, tags: tags, tagGroups: tagGroups };
  }

  function findTagGroup(site, tag) {
    var groups = (site.tags && site.tags.groups) || [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].items.indexOf(tag) >= 0) return groups[i].id;
    }
    return null;
  }

  function resolveTeacher(work, author, site) {
    if (work.teacher) {
      var t = findTeacher(site, work.teacher);
      return { name: t ? t.name : work.teacher, note: work.teacherNote || '' };
    }
    var date = String(work.date || '');
    var authorSegs = (author && author.termTeachers) || [];
    var seg = authorSegs.filter(function (s) { return date >= s.from && date <= s.to; })[0];
    if (!seg) {
      var term = (site.terms || []).filter(function (t) { return t.term === work.term; })[0]
        || (site.terms || []).filter(function (t) { return date >= t.start && date <= t.end; })[0];
      seg = term && (term.segments || []).filter(function (s) { return date >= s.from && date <= s.to; })[0];
    }
    var id = seg ? seg.teacher : ((author && author.mainTeacher) || (site.teachers && site.teachers.default));
    var teacher = findTeacher(site, id);
    return { name: teacher ? teacher.name : (id || '未指定'), note: '' };
  }

  function findTeacher(site, id) {
    return ((site.teachers && site.teachers.list) || []).filter(function (t) { return t.id === id; })[0];
  }

  function matchQuery(w, q, site) {
    if (!q) return true;
    q = String(q).toLowerCase();
    var cat = categoryName(site, w.category);
    var cd = w.categoryDetail || {};
    var hay = [w.title, w.summary, w.description, (w.tags || []).join(' '), (w.medium || []).join(' '), cat, cd.name, cd.subject, cd.place, cd.topic].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function filterWorks(works, filters, site) {
    filters = filters || {};
    var out = works.filter(function (w) {
      if (filters.category && filters.category !== 'all' && w.category !== filters.category) return false;
      if (filters.year && String(w.date).slice(0, 4) !== filters.year) return false;
      if (filters.term && w.term !== filters.term) return false;
      if (filters.medium && (w.medium || []).indexOf(filters.medium) < 0) return false;
      if (filters.tag && (w.tags || []).indexOf(filters.tag) < 0) return false;
      if (!matchQuery(w, filters.q, site)) return false;
      return true;
    });
    var sort = filters.sort || 'newest';
    out.sort(function (a, b) {
      if (sort === 'oldest') return String(a.date).localeCompare(String(b.date));
      if (sort === 'featured') return (Number(!!b.featured) - Number(!!a.featured)) || String(b.date).localeCompare(String(a.date));
      if (sort === 'category') return String(a.category).localeCompare(String(b.category)) || String(b.date).localeCompare(String(a.date));
      return String(b.date).localeCompare(String(a.date));
    });
    return out;
  }

  function authorById(id) {
    var authors = (state.index && state.index.authors) || [];
    return authors.filter(function (a) { return a.id === id; })[0] || null;
  }

  G.store = {
    loadSite: loadSite, loadIndex: loadIndex, getWorks: getWorks,
    buildIndex: buildIndex, filterWorks: filterWorks, resolveTeacher: resolveTeacher,
    categoryName: categoryName, authorById: authorById,
    site: function () { return state.site; }, index: function () { return state.index; },
    clearCache: function () { state.cache = {}; }
  };
})();
