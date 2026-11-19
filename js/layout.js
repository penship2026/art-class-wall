/* layout.js — 最短列优先错落墙，不用 CSS columns */
(function () {
  var G = (window.Gallery = window.Gallery || {});

  function columnsFor(el, minWidth, gap) {
    if (!el) return 1;
    var cs = getComputedStyle(el);
    var inner = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    minWidth = minWidth || 260;
    gap = gap || 26;
    if (window.innerWidth < 640) return 2;
    return G.util.clamp(Math.floor((inner + gap) / (minWidth + gap)), 1, 5);
  }

  function estimate(item, cardWidth) {
    var img = item.image || {};
    var ratio = img.ratio || (img.height && img.width ? img.height / img.width : 0.7);
    return Math.round(cardWidth * ratio) + 92;
  }

  function distribute(items, columns, gap, cardWidth) {
    var heights = new Array(columns).fill(0);
    var result = Array.from({ length: columns }, function () { return []; });
    (items || []).forEach(function (item) {
      var target = heights.indexOf(Math.min.apply(null, heights));
      result[target].push(item);
      heights[target] += estimate(item, cardWidth) + gap;
    });
    return result;
  }

  G.layout = { columnsFor: columnsFor, distribute: distribute, estimate: estimate };
})();
