/* ═════════════════════════════════════════════════════════════════════════
   TALENT-CONTRACTS.JS — Multi-Picture Deals & Talent Personality Quirks
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Sim 2 (Abilities & Contracts)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  function _getG(st){
    if(st) return st;
    if(typeof G !== "undefined") return G;
    if(typeof global !== "undefined" && global.G) return global.G;
    if(typeof window !== "undefined" && window.G) return window.G;
    return null;
  }

  // Talent Quirks / Abilities synthesized from Box Office Sim 2
  const TALENT_QUIRKS = {
    crowd_puller: {
      id: "crowd_puller",
      name: "Crowd Puller",
      rarity: "rare",
      desc: "Magnetic screen presence. Guarantees +20% opening weekend box office buzz.",
      type: "actor"
    },
    fast_shooter: {
      id: "fast_shooter",
      name: "Fast Shooter",
      rarity: "uncommon",
      desc: "Ruthlessly disciplined workflow. Shaves 2 weeks off filming phase and prevents budget overruns.",
      type: "director"
    },
    method_actor: {
      id: "method_actor",
      name: "Method Actor",
      rarity: "rare",
      desc: "Immersive transformation. +15% festival and award nomination chance, but demands a reshoot budget.",
      type: "actor"
    },
    award_magnet: {
      id: "award_magnet",
      name: "Award Magnet",
      rarity: "legendary",
      desc: "Critically revered. Adds +8 critical rating points to finished project.",
      type: "both"
    },
    improv_master: {
      id: "improv_master",
      name: "Improv Master",
      rarity: "uncommon",
      desc: "Sharp wit and spontaneous revisions. Automatically enhances script quality by +6 during shoot.",
      type: "actor"
    },
    cult_icon: {
      id: "cult_icon",
      name: "Cult Icon",
      rarity: "rare",
      desc: "Dedicated fanbase. Increases long-tail streaming and TV syndication value by +35%.",
      type: "both"
    }
  };

  function initTalentPacts(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.talentPacts){
      S.talentPacts = {
        activeContracts: [],
        completedContracts: []
      };
    }
    // Seed quirks onto talent if missing
    if(S.talent && S.talent.length){
      const quirkKeys = Object.keys(TALENT_QUIRKS);
      S.talent.forEach((t, idx) => {
        if(!t.quirk){
          // Assign quirk deterministically to ~35% of roster
          if((idx % 3) === 0){
            t.quirk = quirkKeys[idx % quirkKeys.length];
          }
        }
      });
    }
    return S.talentPacts;
  }

  function signMultiPictureDeal(talentId, picturesCount, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initTalentPacts(S);

    const talent = (S.talent || []).find(t => t.id === talentId);
    if(!talent) return { ok: false, error: "Talent not found in directory." };

    const count = picturesCount === 5 ? 5 : 3;
    const existing = S.talentPacts.activeContracts.find(c => c.talentId === talentId);
    if(existing){
      return { ok: false, error: talent.name + " already has an active " + existing.picturesRemaining + "-picture pact with the studio." };
    }

    // Base salary with 20% multi-picture volume discount
    const standardFee = talent.fee || (talent.power * 2.5);
    const discountedRate = Math.round(standardFee * 0.8 * 10) / 10;
    const signingBonus = Math.round(discountedRate * (count === 5 ? 1.2 : 0.8) * 10) / 10;

    if((S.studio.cash || 0) < signingBonus){
      return { ok: false, error: "Insufficient funds. Signing bonus requires $" + signingBonus + "M." };
    }

    S.studio.cash = Math.round((S.studio.cash - signingBonus) * 10) / 10;

    const contract = {
      id: "pact_" + Date.now() + "_" + talent.id,
      talentId: talent.id,
      talentName: talent.name,
      talentKind: talent.kind || "actor",
      totalPictures: count,
      picturesRemaining: count,
      lockedRate: discountedRate,
      signingBonus: signingBonus,
      signedWeek: S.week,
      usedInFilms: []
    };

    S.talentPacts.activeContracts.push(contract);

    if(typeof log === "function"){
      log("Signed " + count + "-picture commitment with " + talent.name + ": locked at $" + discountedRate + "M/film (signing bonus $" + signingBonus + "M).", "gold");
    }

    return { ok: true, contract };
  }

  function consumeContractPicture(talentId, filmId, state){
    const S = _getG(state);
    if(!S || !S.talentPacts) return false;
    const contract = S.talentPacts.activeContracts.find(c => c.talentId === talentId);
    if(!contract || contract.picturesRemaining <= 0) return false;

    contract.picturesRemaining -= 1;
    if(filmId && !contract.usedInFilms.includes(filmId)){
      contract.usedInFilms.push(filmId);
    }

    if(contract.picturesRemaining <= 0){
      S.talentPacts.activeContracts = S.talentPacts.activeContracts.filter(c => c.id !== contract.id);
      S.talentPacts.completedContracts.push(contract);
      if(typeof log === "function"){
        log(contract.talentName + " has fulfilled their " + contract.totalPictures + "-picture commitment to the studio.", "");
      }
    }

    return true;
  }

  function getTalentQuirk(talent){
    if(!talent || !talent.quirk) return null;
    return TALENT_QUIRKS[talent.quirk] || null;
  }

  function openTalentContractsModal(){
    const S = _getG();
    if(!S) return;
    initTalentPacts(S);

    let h = "<h3>Multi-Picture Contracts &amp; Star Talent Quirks</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Lock top stars and visionary directors into 3-picture or 5-picture commitments with upfront signing bonuses and a 20% per-film discount. Manage unique personality quirks and production traits.</div>";

    const activeCount = (S.talentPacts.activeContracts || []).length;
    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v'>" + activeCount + "</div><div class='s-l'>Active Pacts</div></div>"+
      "<div class='stat'><div class='s-v'>" + (S.talentPacts.completedContracts || []).length + "</div><div class='s-l'>Completed Pacts</div></div>"+
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>20%</div><div class='s-l'>Locked Salary Discount</div></div>"+
    "</div>";

    if(activeCount){
      h += "<div class='section-title'>Active Studio Commitments</div><div class='card' style='margin-bottom:12px'>";
      S.talentPacts.activeContracts.forEach(c => {
        h += "<div class='spread' style='padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)'>"+
          "<div><b>" + esc(c.talentName) + "</b> <span class='tag gold'>" + c.picturesRemaining + "/" + c.totalPictures + " pictures remaining</span></div>"+
          "<div style='text-align:right'><b>Locked Fee: $" + c.lockedRate + "M</b><div class='tiny muted'>Signed W" + c.signedWeek + "</div></div>"+
        "</div>";
      });
      h += "</div>";
    }

    h += "<div class='section-title'>Talent Roster &amp; Signing Desk</div><div class='grid g2'>";
    (S.talent || []).slice(0, 12).forEach(t => {
      const activePact = S.talentPacts.activeContracts.find(c => c.talentId === t.id);
      const q = getTalentQuirk(t);
      const stdFee = t.fee || (t.power * 2.5);
      const rate3 = Math.round(stdFee * 0.8 * 10) / 10;
      const bonus3 = Math.round(rate3 * 0.8 * 10) / 10;
      const bonus5 = Math.round(rate3 * 1.2 * 10) / 10;

      h += "<div class='card'>"+
        "<div class='spread'><b>" + esc(t.name) + "</b><span class='tag'>" + (t.power || 3) + " Stars</span></div>"+
        "<div class='tiny muted' style='margin:4px 0'>Role: " + (t.kind || "Actor").toUpperCase() + " · Market fee: $" + stdFee + "M</div>"+
        (q ? (
          "<div class='tiny' style='margin:6px 0;padding:4px;background:rgba(255,255,255,0.03);border-radius:6px'>"+
            "<b>Trait: " + esc(q.name) + " (" + q.rarity.toUpperCase() + ")</b><div class='muted'>" + esc(q.desc) + "</div>"+
          "</div>"
        ) : "<div class='tiny muted' style='margin:6px 0'>Standard industry professional.</div>")+
        "<div style='margin-top:8px'>"+
          (activePact ? (
            "<span class='tag green'>Pact Active (" + activePact.picturesRemaining + " pictures left)</span>"
          ) : (
            "<div class='row' style='gap:6px'>"+
              "<button class='btn btn-xs btn-primary' data-pact='" + t.id + ":3'>Sign 3-Pic ($" + bonus3 + "M)</button>"+
              "<button class='btn btn-xs btn-alt' data-pact='" + t.id + ":5'>Sign 5-Pic ($" + bonus5 + "M)</button>"+
            "</div>"
          ))+
        "</div>"+
      "</div>";
    });
    h += "</div>";

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    const v = openModal(h);
    v.querySelectorAll("[data-pact]").forEach(b => {
      b.onclick = () => {
        const parts = b.dataset.pact.split(":");
        const res = signMultiPictureDeal(+parts[0], +parts[1]);
        if(res.ok){
          if(typeof beep === "function") beep("gold");
          closeModal();
          openTalentContractsModal();
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.error, "bad");
        }
      };
    });
  }

  const TalentContractsModule = {
    TALENT_QUIRKS,
    initTalentPacts,
    signMultiPictureDeal,
    consumeContractPicture,
    getTalentQuirk,
    openTalentContractsModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = TalentContractsModule;
  }
  global.TalentContractsModule = TalentContractsModule;
  global.initTalentPacts = initTalentPacts;
  global.signMultiPictureDeal = signMultiPictureDeal;
  global.consumeContractPicture = consumeContractPicture;
  global.getTalentQuirk = getTalentQuirk;
  global.openTalentContractsModal = openTalentContractsModal;
})(typeof window !== "undefined" ? window : global);
