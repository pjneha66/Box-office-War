/* Rebuild Slots-module harness (pattern from test/rebuild-posters.mjs): runs game/data.js +
   game/engine.js + game/slots.js in a VM sandbox with a stubbed localStorage, a minimal
   document stub, and the ui.js globals slots.js touches (render/closeSheet/pushToast/
   drainFlash, PREFS + setPref, VIEW/lastCash, statrow/tag). Slots has no weekly tick, so
   after the static/exports checks it exercises every slot mechanic through slotsAction
   (save → snapshot+meta, load → S rebound + cash restored, inline rename, two-tap delete,
   logo segs + logoChipHTML, PREFS.frame), drives 60 advanceWeek() calls with slot ops
   interleaved, and covers the error paths (empty-slot load, corrupt snapshot). Prints one
   line per check; exits non-zero on failure. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + extra : ""));
  if (!ok) failures++;
}

const mem = {};
const ctx = vm.createContext({
  console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
  Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  },
  /* minimal document stub (brief) — rename-confirm reads #slotName.value */
  document: {
    getElementById: () => ({ value: "Renamed" }),
    querySelector: () => null,
    body: { setAttribute() {}, style: {} }
  },
  /* ui.js helpers (same behavior as ui.js) */
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
/* ui.js globals slots.js touches — pre-declared so strict-mode rebinds work */
const renderCalls = { n: 0 }, closeCalls = { n: 0 };
const toasts = [];
ctx.VIEW = "start";
ctx.lastCash = 1234;
ctx.PREFS = {};
ctx.render = () => { renderCalls.n++; };
ctx.closeSheet = () => { closeCalls.n++; };
ctx.pushToast = (txt) => { toasts.push(String(txt)); };
ctx.drainFlash = () => { /* same behavior as ui.js drainFlash */
  const fl = ctx.S && ctx.S.flash;
  if (fl && fl.length) { fl.forEach((t) => ctx.pushToast(t.txt, t.kind)); ctx.S.flash = []; }
};
ctx.setPref = (k, v) => { ctx.PREFS[k] = v; try { ctx.localStorage.setItem("bow2.prefs", JSON.stringify(ctx.PREFS)); } catch (e) {} };

for (const f of ["data.js", "engine.js", "slots.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const SAVE_KEY = "bow2.save.v1";

function elx(id, key) { return { getAttribute: (k) => (k === "data-id" ? id : (k === "data-key" ? key : null)) }; }
function slotsStore() { try { return JSON.parse(mem["bow2.slots"] || "{}").slots || []; } catch (e) { return []; } }
function toastLast() { return toasts.length ? toasts[toasts.length - 1] : ""; }

/* ── static contract checks ───────────────────────────────────── */
const src = readFileSync(path.join(gameDir, "slots.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis", "Math.random"]) {
  check("ES2017-safe + no '" + tok + "'", !src.includes(tok));
}
check("slotsAction / SLOTS_DESKS / logoChipHTML / slotPickerHTML / forecastAdjust_slots exported",
  typeof C.slotsAction === "function" && Array.isArray(C.SLOTS_DESKS) &&
  typeof C.logoChipHTML === "function" && typeof C.slotPickerHTML === "function" &&
  typeof C.forecastAdjust_slots === "function");
check("SLOTS_DESKS = 2 desks in group 'Slots' (slots-mgr 💾, slots-logo 🎨)",
  C.SLOTS_DESKS.length === 2 &&
  C.SLOTS_DESKS.map((d) => d.id).join(",") === "slots-mgr,slots-logo" &&
  C.SLOTS_DESKS.every((d) => d.group === "Slots" && d.icon && d.name && typeof d.render === "function") &&
  C.SLOTS_DESKS[0].icon === "💾" && C.SLOTS_DESKS[1].icon === "🎨");
check("forecastAdjust_slots() → 0 (no weekly cash)", C.forecastAdjust_slots() === 0);

/* ── start-screen picker before anything is saved ─────────────── */
check("slotPickerHTML empty state (before first save)", C.slotPickerHTML().includes("No saved studios yet"));

/* ── game start + desk renders ────────────────────────────────── */
C.newGame("Test", "veteran");
check("newGame → S.studio fields finite", isFinite(C.S.studio.cash) && C.S.studio.year === 1 && typeof C.S.studio.name === "string");
let mgr = C.SLOTS_DESKS[0].render();
check("Save slots desk renders 6 rows, all empty before first save",
  (mgr.match(/data-action="slot-save"/g) || []).length === 6 && mgr.includes("— empty —"));
let logo = C.SLOTS_DESKS[1].render();
check("Studio logo desk renders chip + segs + poster frame",
  logo.includes("logo-chip") && logo.includes("slot-logo-shape") && logo.includes("slot-logo-bg") &&
  logo.includes("slot-logo-text") && logo.includes("slot-frame") && logo.includes(">T</span>"));

/* ── mechanic 1: save slot 1 → snapshot + meta ────────────────── */
check("slot-save returns handled", C.slotsAction("slot-save", elx(1)) === true);
let rows = slotsStore();
check("bow2.slots has 6 rows after save", rows.length === 6);
const snap1 = rows[0].snapshot;
let parsed1 = null;
try { parsed1 = JSON.parse(snap1); } catch (e) {}
check("slot 1 snapshot is the full save JSON (v1 + studio)", !!parsed1 && parsed1.v === 1 && !!parsed1.studio && typeof parsed1.studio.cash === "number");
const savedCash = parsed1.studio.cash;
check("slot 1 meta = {year, cash, rep, films} from live S",
  rows[0].meta && rows[0].meta.year === C.S.studio.year && rows[0].meta.cash === savedCash &&
  rows[0].meta.rep === Math.round(C.S.studio.rep) && rows[0].meta.films === C.S.films.length);
check("slot-save defaults name to 'Slot 1'", rows[0].name === "Slot 1");
check("slot-save toast fired", toastLast().indexOf("💾 Saved to Slot 1") === 0);

/* ── mechanic 1: load slot 1 restores S ───────────────────────── */
C.S.studio.cash = 9999; /* in-memory change only */
toasts.length = 0;
const closeBefore = closeCalls.n;
check("slot-load returns handled", C.slotsAction("slot-load", elx(1)) === true);
check("load restores S.studio.cash from snapshot (not 9999)", C.S.studio.cash === savedCash && C.S.studio.cash !== 9999);
check("load writes snapshot back to SAVE_KEY", mem[SAVE_KEY] === snap1);
check("load sets VIEW='studio' and lastCash=null", C.VIEW === "studio" && C.lastCash === null);
check("load closes the sheet", closeCalls.n > closeBefore);
check("load toasts 'Loaded Slot 1'", toasts.some((t) => t === "Loaded Slot 1."));
check("S.slots ensured after load (logo namespace present)", !!C.S.slots && !!C.S.slots.logo && C.S.slots.logo.shape === "circle");

/* ── mechanic 1: rename (two-tap, prompt-free, #slotName) ─────── */
check("slot-rename first tap arms inline editor", C.slotsAction("slot-rename", elx(1)) === true && C.S.slotsRenaming === 1);
mgr = C.SLOTS_DESKS[0].render();
check("renaming row renders #slotName text-input + confirm button",
  mgr.includes('id="slotName"') && mgr.includes('data-action="slot-rename-confirm"') && mgr.includes('value="Slot 1"'));
check("slot-rename-confirm reads document stub → 'Renamed'", C.slotsAction("slot-rename-confirm", elx(1)) === true);
rows = slotsStore();
check("slot 1 renamed to 'Renamed' and editor closed", rows[0].name === "Renamed" && C.S.slotsRenaming === null);

/* ── mechanic 1: full roundtrip at a later week ───────────────── */
for (let i = 0; i < 3; i++) C.advanceWeek();
const wkA = C.S.studio.week, cashA = C.S.studio.cash;
C.slotsAction("slot-save", elx(2));
for (let i = 0; i < 5; i++) C.advanceWeek();
check("slot 2 roundtrip: week + cash restored exactly",
  C.slotsAction("slot-load", elx(2)) === true && C.S.studio.week === wkA && C.S.studio.cash === cashA);

/* ── mechanic 1: delete with two-tap confirm ──────────────────── */
rows = slotsStore();
check("delete first tap arms only (snapshot kept, S.slotsConfirm=1)",
  C.slotsAction("slot-delete", elx(1)) === true && C.S.slotsConfirm === 1 && slotsStore()[0].snapshot === snap1);
mgr = C.SLOTS_DESKS[0].render();
check("armed delete button shows 'Sure?'", mgr.includes(">Sure?</button>"));
check("delete second tap executes (snapshot cleared, confirm reset)",
  C.slotsAction("slot-delete", elx(1)) === true && slotsStore()[0].snapshot === null && C.S.slotsConfirm === null);
toasts.length = 0;
check("delete on empty slot errors politely", C.slotsAction("slot-delete", elx(1)) === true && C.S.flash.some((t) => t.txt.includes("is empty")));
if (typeof C.drainFlash === "function") C.drainFlash();

/* ── mechanic 2: logo editor ──────────────────────────────────── */
check("logo shape seg → star", C.slotsAction("slot-logo-shape", elx(null, "star")) === true && C.S.slots.logo.shape === "star");
check("logo bg seg → mint", C.slotsAction("slot-logo-bg", elx(null, "mint")) === true && C.S.slots.logo.bg === "mint");
check("logo text seg → light", C.slotsAction("slot-logo-text", elx(null, "light")) === true && C.S.slots.logo.text === "light");
let chip = C.logoChipHTML();
check("logoChipHTML: star clip-path + mint bg + light text + weight 800 + initial T",
  chip.includes("clip-path:polygon(50% 0%") && chip.includes("background:#6fd7b2") &&
  chip.includes("color:#ffffff") && chip.includes("font-weight:800") && chip.includes(">T</span>"));
C.slotsAction("slot-logo-shape", elx(null, "circle"));
C.slotsAction("slot-logo-shape", elx(null, "square"));
C.slotsAction("slot-logo-shape", elx(null, "roundel"));
const chipSq = (C.S.slots.logo.shape = "square", C.logoChipHTML());
const chipRd = (C.S.slots.logo.shape = "roundel", C.logoChipHTML());
const chipCi = (C.S.slots.logo.shape = "circle", C.logoChipHTML());
check("square chip → 4px radius", chipSq.includes("border-radius:4px"));
check("roundel chip → radius 50% + inset ring", chipRd.includes("border-radius:50%") && chipRd.includes("box-shadow:inset 0 0 0 2px"));
check("circle chip → radius 50%", chipCi.includes("border-radius:50%"));
check("invalid logo key rejected", C.slotsAction("slot-logo-shape", elx(null, "banana")) === true && C.S.slots.logo.shape === "circle");

/* ── mechanic 3: PREFS.frame segment ──────────────────────────── */
check("slot-frame → setPref('frame','polaroid')", C.slotsAction("slot-frame", elx(null, "polaroid")) === true && C.PREFS.frame === "polaroid");
check("PREFS.frame persisted to bow2.prefs", (mem["bow2.prefs"] || "").includes("polaroid"));
logo = C.SLOTS_DESKS[1].render();
check("logo desk marks polaroid frame segment on", logo.includes('class="on" data-action="slot-frame" data-key="polaroid"'));
check("invalid frame key ignored", C.slotsAction("slot-frame", elx(null, "banana")) === true && C.PREFS.frame === "polaroid");

/* ── error paths: empty load + corrupt snapshot ───────────────── */
const cashBefore = C.S.studio.cash;
toasts.length = 0;
check("load from empty slot 6 errors, S untouched", C.slotsAction("slot-load", elx(6)) === true && C.S.flash.some((t) => t.txt.includes("Slot 6 is empty")) && C.S.studio.cash === cashBefore);
rows = slotsStore();
rows[5].snapshot = "{oops";
try { mem["bow2.slots"] = JSON.stringify({ slots: rows }); } catch (e) {}
toasts.length = 0;
check("corrupt snapshot load errors, S untouched", C.slotsAction("slot-load", elx(6)) === true && C.S.flash.some((t) => t.txt.includes("corrupted")) && C.S.studio.cash === cashBefore);

/* ── 60-week soak: slot ops interleaved with the sim ──────────── */
C.newGame("Soak", "veteran");
let soakErr = null, minWeekSeen = 1 / 0, savedAll = false, roundtripOk = false;
try {
  const snapWk = {};
  for (let i = 1; i <= 60; i++) {
    C.advanceWeek();
    if (!isFinite(C.S.studio.cash)) throw new Error("cash not finite at call " + i);
    if (C.S.studio.week < minWeekSeen) minWeekSeen = C.S.studio.week;
    if (i === 10) { C.slotsAction("slot-save", elx(3)); snapWk[3] = C.S.studio.week; }
    if (i === 20) { C.slotsAction("slot-load", elx(3)); roundtripOk = C.S.studio.week === snapWk[3]; }
    if (i === 50) { for (let s2 = 1; s2 <= 6; s2++) C.slotsAction("slot-save", elx(s2)); savedAll = true; }
  }
} catch (e) { soakErr = e; }
check("60 advanceWeek + interleaved slot ops: no throw", soakErr === null, soakErr && soakErr.message);
check("cash finite every week (soak)", soakErr === null && minWeekSeen < 1 / 0);
check("slot 3 roundtrip inside soak restored its week", roundtripOk);
check("all 6 slots hold snapshots after the soak", savedAll && slotsStore().every((r) => !!r.snapshot));
check("S.slots namespace exists after soak", !!C.S.slots && !!C.S.slots.logo);
mgr = C.SLOTS_DESKS[0].render();
check("Save slots desk shows meta on every saved row",
  (mgr.match(/data-action="slot-save"/g) || []).length === 6 && !mgr.includes("— empty —") && mgr.includes("· 0 films"));
const picker = C.slotPickerHTML();
check("slotPickerHTML lists saved slots with Load buttons",
  picker.includes("slot-load") && (picker.match(/data-id="\d+"/g) || []).length === 6);

/* ── start-screen load (S may be null on the start view) ──────── */
const soakCash = (function () { try { return JSON.parse(slotsStore()[4].snapshot).studio.cash; } catch (e) { return null; } })(); /* slot 5 snapshot baseline */
C.S = null;
let pickerNullOk = false;
try { pickerNullOk = C.slotPickerHTML().includes("slot-load"); } catch (e) {}
check("slotPickerHTML works with S = null (start view)", pickerNullOk);
toasts.length = 0;
const loadNullOk = C.slotsAction("slot-load", elx(5)) === true;
check("slot-load with S = null boots the saved studio",
  loadNullOk && !!C.S && C.S.studio.name === "Soak" && C.S.studio.cash === soakCash && C.VIEW === "studio");

console.log(checks + " checks, " + failures + " failures");
process.exit(failures ? 1 : 0);
