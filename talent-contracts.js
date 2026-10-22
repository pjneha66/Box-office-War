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
    S.talentPacts.activeContracts = S.talentPacts.activeContracts || [];
    S.talentPacts.completedContracts = S.talentPacts.completedContracts || [];
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

    if(talent.retired) return { ok:false, error:"Retired talent cannot sign new picture commitments." };
    const count = Number(picturesCount) === 5 ? 5 : 3;
    const existing = S.talentPacts.activeContracts.find(c => c.talentId === talentId);
    if(existing){
      return { ok: false, error: talent.name + " already has an active " + existing.picturesRemaining + "-picture pact with the studio." };
    }

    // Base salary with 20% multi-picture volume discount
    const standardFee = Number(talent.fee) || ((Number(talent.power) || 3) * 2.5);
    const discountedRate = Math.round(standardFee * 0.8 * 10) / 10;
    const signingBonus = Math.round(discountedRate * (count === 5 ? 1.2 : 0.8) * 10) / 10;

    if((S.studio.cash || 0) < signingBonus){
      return { ok: false, error: "Insufficient funds. Signing bonus requires $" + signingBonus + "M." };
    }

    if(S === _getG() && typeof spend === "function") spend("talent", signingBonus);
    else S.studio.cash = Math.round((S.studio.cash - signingBonus) * 10) / 10;

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

    if(S === _getG() && typeof saveGame === "function") saveGame();
    return { ok: true, contract };
  }

  function consumeContractPicture(talentId, filmId, state){
    const S = _getG(state);
    if(!S || !S.talentPacts) return false;
    const contract = S.talentPacts.activeContracts.find(c => c.talentId === talentId);
    if(!contract || contract.picturesRemaining <= 0) return false;

    if(filmId != null && (contract.usedInFilms || []).includes(filmId)) return false;
    contract.usedInFilms = contract.usedInFilms || [];
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

    const contracts=S.talentPacts.activeContracts;
    let h = `<header class="command-dialog-hero"><div><span class="command-eyebrow">STUDIO HQ / TALENT PARTNERSHIPS</span><h2>Picture Partners</h2><p>A shared slate. A fixed quote. Long-term creative relationships.</p></div></header><div class="partner-workspace"><aside class="partner-ledger"><span class="command-eyebrow">YOUR COMMITMENTS</span><h3>${contracts.length} active partners</h3><p>Signing reserves a rate, not a calendar slot. Attach available partners in film development.</p>${contracts.map(c=>`<article><small>${esc(c.talentKind)}</small><b>${esc(c.talentName)}</b><div class="picture-slots" aria-label="${c.picturesRemaining} of ${c.totalPictures} pictures remaining">${Array.from({length:c.totalPictures},(_,i)=>`<i class="${i<c.picturesRemaining?'remaining':''}"></i>`).join('')}</div><span>${c.picturesRemaining} pictures left · $${c.lockedRate}M / film</span></article>`).join('')||'<div class="partner-empty">Your next creative partnership starts at the signing desk.</div>'}<button id="btnPactDevelop" class="command-primary">Develop with partners ↗</button><footer>${S.talentPacts.completedContracts.length} completed commitments</footer></aside><section class="partner-signing"><div class="partner-signing-heading"><span class="command-eyebrow">THE SIGNING DESK</span><h3>Find your next collaborator.</h3><p>20% below the base quote. A signing bonus is paid now; the locked fee is paid on each greenlight.</p></div><div class="partner-filters"><input id="partnerSearch" type="search" placeholder="Search talent by name" aria-label="Search picture partners"><select id="partnerRole" aria-label="Filter talent role"><option value="all">Every discipline</option><option value="actor">Actors</option><option value="director">Directors</option><option value="writer">Writers</option><option value="producer">Producers</option><option value="signed">Signed partners</option></select></div><div class="partner-roster">`;
    (S.talent||[]).filter(t=>!t.retired).forEach(t=>{
      const pact=contracts.find(c=>c.talentId===t.id), q=getTalentQuirk(t);
      const rate=Math.round((Number(t.fee)||((Number(t.power)||3)*2.5))*.8*10)/10;
      const bonus3=Math.round(rate*.8*10)/10, bonus5=Math.round(rate*1.2*10)/10;
      h+=`<article class="partner-person" data-partner-name="${esc(t.name.toLowerCase())}" data-partner-role="${esc(t.kind||'actor')}" data-partner-signed="${!!pact}"><div class="partner-monogram" aria-hidden="true">${esc(t.name.trim().split(/\s+/).map(n=>n[0]).slice(0,2).join(''))}</div><div class="partner-person-info"><small>${esc(t.kind||'actor')} / ${t.power||3} STAR</small><h4>${esc(t.name)}</h4><p>${t.bookedUntil>S.week?'On production until W'+t.bookedUntil:'Available for your next film'}</p>${q?`<span class="partner-trait">${esc(q.name)} · ${esc(q.desc)}</span>`:''}</div><div class="partner-offer"><small>LOCKED FILM QUOTE</small><strong>$${pact?pact.lockedRate:rate}M</strong>${pact?`<span class="partner-signed">SIGNED / ${pact.picturesRemaining} LEFT</span>`:`<div><button data-pact="${t.id}:3" ${S.studio.cash<bonus3?'disabled':''}>3 pictures <small>$${bonus3}M upfront</small></button><button data-pact="${t.id}:5" ${S.studio.cash<bonus5?'disabled':''}>5 pictures <small>$${bonus5}M upfront</small></button></div>`}</div></article>`;
    });
    h+='</div><p class="partner-no-results" hidden>No collaborators match your search.</p></section></div><footer class="command-dialog-footer"><span>Multi-picture commitments / Current career</span><button class="command-primary" onclick="closeModal()">Return to studio</button></footer>';

    const v = openModal("<section class='command-dialog picture-partners'>" + h + "</section>");
    v.querySelector(".modal").classList.add("command-modal");
    function filterPartners(){
      const search=v.querySelector('#partnerSearch').value.trim().toLowerCase();
      const role=v.querySelector('#partnerRole').value;
      let visible=0;
      v.querySelectorAll('[data-partner-name]').forEach(row=>{
        row.hidden=!row.dataset.partnerName.includes(search)||(role==='signed'?row.dataset.partnerSigned!=='true':role!=='all'&&row.dataset.partnerRole!==role);
        if(!row.hidden)visible++;
      });
      v.querySelector('.partner-no-results').hidden=visible>0;
    }
    v.querySelector('#partnerSearch').oninput=filterPartners;
    v.querySelector('#partnerRole').onchange=filterPartners;
    const develop = v.querySelector("#btnPactDevelop");
    if(develop) develop.onclick = ()=>{ closeModal(); switchTab("develop"); };
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
