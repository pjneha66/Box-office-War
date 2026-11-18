/* Box Office War — full talent catalog (root web build).
   The Cast Directory can browse ~1,000 performers and crew from a deterministic catalog.
   Catalog entries are NOT saved: they are regenerated from a fixed seed each session.
   A catalog entry only joins your roster when you sign it (castSign), which copies it into
   G.talent and charges a signing fee. Nothing here changes how existing talent is booked or priced. */
(function () {
  var CATALOG_SIZE = 1000;
  var SEED = 20261118;
  var _cache = null;

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build() {
    var R = rng(SEED), out = [], i;
    var first = (DATA.FIRST_M || []).concat(DATA.FIRST_F || []);
    var last = DATA.LAST || [];
    var genres = Object.keys(DATA.GENRES || {});
    if (!first.length || !last.length) return out;
    for (i = 0; i < CATALOG_SIZE; i++) {
      var r = R(), kind = r < 0.62 ? "actor" : r < 0.76 ? "director" : r < 0.88 ? "writer" : "producer";
      var p = R(), power = p < 0.30 ? 1 : p < 0.60 ? 2 : p < 0.80 ? 3 : p < 0.94 ? 4 : 5;
      var skill = Math.min(96, Math.max(40, Math.round(45 + power * 3 + R() * 40)));
      var fee = Math.round([0.3, 1.2, 4, 12, 25][power - 1] * (kind === "actor" ? 1 : 0.7) * 10) / 10;
      var name = first[Math.floor(R() * first.length)] + " " + last[Math.floor(R() * last.length)];
      out.push({
        id: "c" + (i + 1), catalog: true, kind: kind, name: name,
        power: power, skill: skill, fee: fee, bookedUntil: 0, heat: 0,
        genreFit: genres.length ? genres[Math.floor(R() * genres.length)] : null,
        age: 24 + Math.floor(R() * 34), scandal: 0, pics: 0,
        ability: null, abilityKnown: false, agency: null,
        powerByRegion: { NA: power, EU: power, AS: power, LA: power, AF: power }
      });
    }
    return out;
  }

  function castCatalog() {
    if (!_cache) _cache = build();
    return _cache;
  }
  function castSignCost(t) {
    return Math.max(0.2, Math.round((t.fee || 0) * 0.5 * 10) / 10);
  }
  function castSigned(catId) {
    return (G.talent || []).some(function (t) { return t && t.catalogId === String(catId); });
  }
  function castSign(catId) {
    if (typeof G === "undefined" || !G || !Array.isArray(G.talent)) return false;
    var c = castCatalog().filter(function (x) { return x.id === String(catId); })[0];
    if (!c) return false;
    if (castSigned(c.id)) { toast(c.name + " is already on your roster.", ""); return false; }
    var cost = castSignCost(c);
    if (G.studio.cash < cost) { toast("Need " + fmtM(cost) + " to sign " + c.name + ".", "bad"); return false; }
    spend("studio", cost);
    var t = Object.assign({}, c, { id: nid(), catalog: false, catalogId: c.id, bookedUntil: 0 });
    G.talent.push(t);
    log(c.name + " signs with your studio for " + fmtM(cost) + ".", "good");
    toast("Signed " + c.name + ".", "gold");
    saveGame();
    return true;
  }

  window.castCatalog = castCatalog;
  window.castSignCost = castSignCost;
  window.castSigned = castSigned;
  window.castSign = castSign;
})();
