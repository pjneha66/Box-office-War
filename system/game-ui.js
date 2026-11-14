/* ═══════════════════════════════════════════════════════════════════════════
   BOX OFFICE WAR — UI SYSTEM / GAME SKIN BEHAVIORS
   ═══════════════════════════════════════════════════════════════════════════

   Vanilla behaviors for the gx-* components in system/game-ui.css.
   No dependencies, no framework. Everything is delegated through data-
   attributes so new UI can opt in with markup alone:

     <div class="gx-flower">…</div>                    radial menu
     <div class="gx-cardstack">…</div>                 save-slot deck
     <button data-gx-shred="#target">…</button>        two-step shred
     <button data-gx-drawer-open="#drawer">…</button>  curve drawer
     <input class="gx-slider" type="range">            fill + value label
     <div class="gx-progress" data-fill="60">…</div>   8-bit blocks

   window.GX exposes imperative helpers for engine/ui code:
     GX.setProgress(el, pct) · GX.shred(el) · GX.openDrawer(el) · GX.closeDrawer(el)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── helpers ──────────────────────────────────────────────────────────── */
  function all(root, sel) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ── flower menu ──────────────────────────────────────────────────────── */
  function initFlower(f) {
    if (f.__gx) return;
    f.__gx = true;
    var petals = all(f, ".gx-flower__petal");
    if (!petals.length) return;
    f.style.setProperty("--gx-petals", petals.length);
    petals.forEach(function (p, i) { p.style.setProperty("--i", i); });
    var toggle = f.querySelector(".gx-flower__toggle");
    if (toggle && !toggle.__gx) {
      toggle.__gx = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-haspopup", "true");
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = f.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    petals.forEach(function (p) {
      p.addEventListener("click", function () {
        petals.forEach(function (q) { q.classList.remove("is-active"); });
        p.classList.add("is-active");
        f.classList.remove("is-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      });
    });
  }
  document.addEventListener("click", function (e) {
    all(document, ".gx-flower.is-open").forEach(function (f) {
      if (!f.contains(e.target)) {
        f.classList.remove("is-open");
        var t = f.querySelector(".gx-flower__toggle");
        if (t) t.setAttribute("aria-expanded", "false");
      }
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    all(document, ".gx-flower.is-open").forEach(function (f) { f.classList.remove("is-open"); });
    all(document, ".gx-drawer.is-open").forEach(closeDrawer);
  });

  /* ── card stack (save slots) ──────────────────────────────────────────── */
  function initCardstack(cs) {
    if (cs.__gx) return;
    cs.__gx = true;
    var cards = all(cs, ".gx-cardstack__card");
    if (!cards.length) return;
    cards[cards.length - 1].classList.add("is-top");
    var lastDir = "is-sent-left";
    cs.addEventListener("click", function (e) {
      var top = cs.querySelector(".gx-cardstack__card.is-top");
      if (!top) return;
      // Clicking a button inside the top card (e.g. "Load") should not shuffle.
      if (e.target.closest("button") && !e.target.classList.contains("gx-cardstack__card")) return;
      lastDir = lastDir === "is-sent-left" ? "is-sent-right" : "is-sent-left";
      top.classList.remove("is-top");
      top.classList.add(lastDir);
      setTimeout(function () {
        top.classList.remove(lastDir);
        cs.appendChild(top);
        var newTop = cs.querySelector(".gx-cardstack__card:last-child");
        if (newTop) newTop.classList.add("is-top");
      }, 240);
    });
  }

  /* ── paper shred (two-step confirm) ───────────────────────────────────── */
  function shred(target) {
    if (!target) return;
    var host = target.classList.contains("gx-shredable") ? target : target.closest(".gx-shredable") || target;
    var rect = host.getBoundingClientRect();
    var n = Math.max(6, Math.min(12, Math.round(rect.width / 34)));
    for (var i = 0; i < n; i++) {
      var s = document.createElement("i");
      s.className = "gx-shred-strip";
      s.style.left = Math.round((i + 0.5) * (rect.width / n) - 4) + "px";
      s.style.setProperty("--spin", (Math.round(Math.random() * 40 - 20)) + "deg");
      s.style.animationDelay = (i * 22) + "ms";
      document.body.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 900); })(s);
    }
    host.classList.add("is-shredding");
    setTimeout(function () { host.style.display = "none"; }, 520);
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-gx-shred]");
    if (!btn) return;
    var target = document.querySelector(btn.getAttribute("data-gx-shred"));
    if (!target) return;
    if (!btn.classList.contains("is-armed")) {
      btn.classList.add("is-armed");
      var old = btn.textContent;
      btn.setAttribute("data-gx-label", old);
      btn.textContent = "Sure? Tap again";
      setTimeout(function () {
        if (btn.isConnected && btn.classList.contains("is-armed")) {
          btn.classList.remove("is-armed");
          btn.textContent = btn.getAttribute("data-gx-label") || old;
        }
      }, 2600);
      return;
    }
    shred(target);
  });

  /* ── curve drawer ─────────────────────────────────────────────────────── */
  function ensureScrim() {
    var scrim = document.querySelector(".gx-drawer-scrim");
    if (scrim) return scrim;
    scrim = document.createElement("div");
    scrim.className = "gx-drawer-scrim";
    scrim.addEventListener("click", function () {
      all(document, ".gx-drawer.is-open").forEach(closeDrawer);
    });
    document.body.appendChild(scrim);
    return scrim;
  }
  function openDrawer(d) {
    if (!d) return;
    ensureScrim().classList.add("is-open");
    d.classList.add("is-open");
    d.setAttribute("aria-hidden", "false");
  }
  function closeDrawer(d) {
    if (!d) return;
    d.classList.remove("is-open");
    d.setAttribute("aria-hidden", "true");
    var anyOpen = all(document, ".gx-drawer.is-open").length > 0;
    if (!anyOpen) { var s = document.querySelector(".gx-drawer-scrim"); if (s) s.classList.remove("is-open"); }
  }
  document.addEventListener("click", function (e) {
    var opener = e.target.closest("[data-gx-drawer-open]");
    if (opener) openDrawer(document.querySelector(opener.getAttribute("data-gx-drawer-open")));
    var closer = e.target.closest("[data-gx-drawer-close]");
    if (closer) {
      var drawer = closer.closest(".gx-drawer");
      closeDrawer(drawer);
    }
  });

  /* ── slider ───────────────────────────────────────────────────────────── */
  function updateSlider(input) {
    var min = Number(input.min || 0), max = Number(input.max || 100);
    var pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--gx-fill", pct + "%");
    var wrap = input.closest(".gx-slider");
    if (wrap) {
      var v = wrap.querySelector(".gx-slider__value");
      if (v) v.textContent = input.value;
    }
  }
  document.addEventListener("input", function (e) {
    if (e.target && e.target.type === "range" && e.target.closest(".gx-slider")) updateSlider(e.target);
  });

  /* ── 8-bit progress ───────────────────────────────────────────────────── */
  function setProgress(el, pct) {
    if (!el) return;
    var blocks = all(el, ".gx-progress__block");
    var p = Math.max(0, Math.min(100, Number(pct != null ? pct : el.getAttribute("data-fill") || 0)));
    var filled = Math.round((p / 100) * blocks.length);
    blocks.forEach(function (b, i) { b.classList.toggle("is-filled", i < filled); });
    var num = el.querySelector(".gx-progress__num");
    if (num) num.textContent = Math.round(p) + "%";
  }
  function initProgress(el) {
    if (el.__gx) return;
    el.__gx = true;
    var track = el.querySelector(".gx-progress__track");
    if (!track) {
      track = document.createElement("div");
      track.className = "gx-progress__track";
      el.insertBefore(track, el.firstChild);
      var count = Number(el.getAttribute("data-blocks") || 12);
      for (var i = 0; i < count; i++) track.appendChild(document.createElement("i")).className = "gx-progress__block";
    }
    setProgress(el, el.getAttribute("data-fill"));
  }

  /* ── polaroid fan ─────────────────────────────────────────────────────── */
  function initPolaroidStack(ps) {
    if (ps.__gx) return;
    ps.__gx = true;
    ps.addEventListener("click", function () { ps.classList.toggle("is-fanned"); });
  }

  /* ── unlock confidential folder ───────────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".gx-folder__unlock");
    if (!btn) return;
    var folder = btn.closest(".gx-folder");
    if (!folder) return;
    folder.classList.remove("is-locked");
    btn.remove();
  });

  /* ── init sweep ───────────────────────────────────────────────────────── */
  function init(root) {
    all(root, ".gx-flower").forEach(initFlower);
    all(root, ".gx-cardstack").forEach(initCardstack);
    all(root, ".gx-progress").forEach(initProgress);
    all(root, ".gx-polaroid-stack").forEach(initPolaroidStack);
    all(root, ".gx-slider input[type='range']").forEach(updateSlider);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(document); });
  } else {
    init(document);
  }

  /* The game re-renders #view per desk; re-scan when it changes. */
  var view = document.getElementById("view");
  if (view && "MutationObserver" in window) {
    var t = null;
    new MutationObserver(function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () { init(view); }, 120);
    }).observe(view, { childList: true, subtree: true });
  }

  /* Public API. */
  window.GX = {
    setProgress: setProgress,
    shred: shred,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    rescan: function () { init(document); }
  };
})();
