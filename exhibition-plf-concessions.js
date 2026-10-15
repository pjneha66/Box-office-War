/* ═════════════════════════════════════════════════════════════════════════
   EXHIBITION-PLF-CONCESSIONS.JS — PLF Mastering, Concessions & Screen Saturation
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Cinema & Movie Theatre Simulator
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  function _getG(st){
    if(st && typeof st === "object" && (st.studio || st.projects || st.cash !== undefined)) return st;
    if(typeof G !== "undefined") return G;
    if(typeof global !== "undefined" && global.G) return global.G;
    if(typeof window !== "undefined" && window.G) return window.G;
    return null;
  }

  function _modCash(S, deltaM){
    if(S && S.studio && typeof S.studio.cash === "number"){
      S.studio.cash = Math.round((S.studio.cash + deltaM) * 100) / 100;
    } else if(S && typeof S.cash === "number"){
      S.cash = Math.round((S.cash + deltaM) * 100) / 100;
    }
  }

  // Premium Large Formats (PLF)
  const PLF_FORMATS = [
    {
      id: "imax_70mm",
      name: "IMAX 15/70mm Laser Giant Screen",
      masteringCostM: 2.5,
      ticketSurchargePct: 0.35, // +35% ticket revenue
      minBudgetReq: 50,
      desc: "Massive 80-foot screens with uncompressed dual 4K laser projection commanding maximum opening weekend fan sellouts."
    },
    {
      id: "dolby_cinema",
      name: "Dolby Cinema HDR & Atmos Spatial Audio",
      masteringCostM: 1.8,
      ticketSurchargePct: 0.25,
      minBudgetReq: 30,
      desc: "Pristine Christie dual-laser projection, million-to-one contrast, and vibrating luxury acoustic recliner seats."
    },
    {
      id: "motion_4dx",
      name: "4DX Dynamic Haptic Motion & Environmental FX",
      masteringCostM: 1.2,
      ticketSurchargePct: 0.20,
      minBudgetReq: 20,
      desc: "Synchronized hydraulic seat heave, wind, fog, lightning, and scent pods favored by horror and action thrill-seekers."
    }
  ];

  // Concession Share Deals
  const CONCESSION_DEALS = [
    {
      id: "concession_standard",
      name: "Traditional Multiplex (100% Exhibitor Concessions)",
      cutSharePct: 0.0,
      theatricalRentalPct: 0.55,
      desc: "Theaters keep 100% of soda and popcorn receipts; studio receives maximum standard 55% ticket gross."
    },
    {
      id: "concession_split",
      name: "Hybrid Concession Backend (12% Concessions Cut)",
      cutSharePct: 0.12,
      theatricalRentalPct: 0.48,
      desc: "Lower ticket rental to 48% in exchange for receiving 12% of national popcorn and beverage concession gross."
    },
    {
      id: "dine_in_luxury",
      name: "Luxury Dine-In Cinema Bistro Alliance (20% Premium Cut)",
      cutSharePct: 0.20,
      theatricalRentalPct: 0.42,
      desc: "Partner with upscale dine-in cinema chains for a 20% cut of cocktails, appetizers, and gourmet food sales."
    }
  ];

  function initExhibitionPLF(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.exhibitionPLF){
      S.exhibitionPLF = {
        activeConcessionDeal: "concession_standard",
        plfMasteredCount: 0,
        thursdayPreviewGrossTotal: 0,
        reReleasedFilms: []
      };
    }
    return S.exhibitionPLF;
  }

  // Master a Film in Premium Large Format (PLF)
  function masterFilmInPLF(projectId, plfId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initExhibitionPLF(S);

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found." };

    const plf = PLF_FORMATS.find(f => f.id === plfId);
    if(!plf) return { ok: false, msg: "PLF format not found." };

    if(proj.plfFormat){
      return { ok: false, msg: "Picture is already mastered in " + proj.plfFormatName + "." };
    }

    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < plf.masteringCostM){
      return { ok: false, msg: "Insufficient cash ($" + plf.masteringCostM + "M required)." };
    }

    _modCash(S, -plf.masteringCostM);
    proj.plfFormat = plf.id;
    proj.plfFormatName = plf.name;
    proj.plfTicketSurcharge = plf.ticketSurchargePct;
    proj.buzz = Math.min(100, (proj.buzz || 60) + 12);

    S.exhibitionPLF.plfMasteredCount = (S.exhibitionPLF.plfMasteredCount || 0) + 1;

    if(typeof log === "function"){
      log("[PLF MASTERING DELIVERED] Mastered \"" + proj.title + "\" in " + plf.name + " (-$" + plf.masteringCostM + "M). Ticket surcharge: +" + Math.round(plf.ticketSurchargePct * 100) + "%.", "gold");
    }

    return { ok: true, msg: "Mastered in " + plf.name + "!" };
  }

  // Sign a Concession Revenue Share Deal
  function signConcessionDeal(dealId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initExhibitionPLF(S);

    const deal = CONCESSION_DEALS.find(d => d.id === dealId);
    if(!deal) return { ok: false, msg: "Deal not found." };

    S.exhibitionPLF.activeConcessionDeal = deal.id;

    if(typeof log === "function"){
      log("[EXHIBITOR CONCESSION PACT] Signed " + deal.name + ". Studio now receives " + Math.round(deal.cutSharePct * 100) + "% of concessions backend revenue.", "gold");
    }

    return { ok: true, msg: deal.name + " signed!" };
  }

  // Host Thursday Night Midnight Previews
  function activateThursdayPreviews(projectId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initExhibitionPLF(S);

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found." };

    if(proj.thursdayPreviewsActive){
      return { ok: false, msg: "Thursday previews already active." };
    }

    const marketingFee = 1.0; // $1.0M preview marketing blitz
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < marketingFee){
      return { ok: false, msg: "Insufficient cash ($" + marketingFee + "M required)." };
    }

    _modCash(S, -marketingFee);
    proj.thursdayPreviewsActive = true;
    proj.buzz = Math.min(100, (proj.buzz || 60) + 15);

    if(typeof log === "function"){
      log("[THURSDAY MIDNIGHT PREVIEWS] Activated nationwide Thursday previews on \"" + proj.title + "\" (-$1.0M). Opening weekend buzz locked at +" + 15 + "%.", "gold");
    }

    return { ok: true, msg: "Thursday previews locked!" };
  }

  // Theatrical Re-Release Campaign (+10 Minutes Unseen Footage)
  function reReleaseFilmInTheaters(filmTitle, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initExhibitionPLF(S);

    const released = (S.projects || []).find(p => p.title === filmTitle && p.released);
    if(!released) return { ok: false, msg: "Released film not found." };

    const campaignCost = 3.0; // $3.0M prints & advertising
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < campaignCost){
      return { ok: false, msg: "Insufficient cash ($" + campaignCost + "M required)." };
    }

    _modCash(S, -campaignCost);

    // Instant re-release bonus box office
    const bonusGross = Math.round((released.wwGross || 150) * 0.12 * 10) / 10; // +12% gross
    released.wwGross = (released.wwGross || 150) + bonusGross;
    _modCash(S, Math.round(bonusGross * 0.5 * 10) / 10);

    S.exhibitionPLF.reReleasedFilms.push({
      title: released.title,
      bonusGross,
      week: S.week || 1
    });

    if(typeof log === "function"){
      log("[THEATRICAL RE-RELEASE] Expanded \"" + released.title + "\" into 2,000 theaters with 10 min unseen footage (-$3.0M). Grossed +$" + bonusGross + "M in re-release box office!", "gold");
    }

    return { ok: true, bonusGross, msg: "Re-release grossed +$" + bonusGross + "M!" };
  }

  // UI Renderer Section
  function renderExhibitionPLFSection(state){
    const S = _getG(state);
    if(!S) return "";
    initExhibitionPLF(S);

    const activeDeal = CONCESSION_DEALS.find(d => d.id === S.exhibitionPLF.activeConcessionDeal) || CONCESSION_DEALS[0];

    let h = "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>PLF Mastering, Concessions &amp; Screen Scheduling</b><span class='tag gold'>" + S.exhibitionPLF.plfMasteredCount + " PLF Films</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Deliver IMAX 70mm and Dolby Cinema deliverables (+35% ticket surcharges), negotiate concession popcorn splits, and book Thursday midnight fan previews (Cinema Simulator parity).</div>";

    h += "<div class='section-title'>Premium Large Format (PLF) Mastering Suites</div>";
    h += "<div class='grid g3' style='gap:8px;margin-bottom:10px'>";
    PLF_FORMATS.forEach(f => {
      h += "<div style='background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:4px;border-left:3px solid var(--gold)'>" +
        "<div class='spread'><b>" + f.name.split(" ")[0] + "</b><span class='tag gold'>+" + Math.round(f.ticketSurchargePct*100) + "% Gross</span></div>" +
        "<div class='tiny muted' style='margin-top:2px'>" + f.desc + "</div>" +
        "<div class='tiny gold' style='margin-top:4px'>Cost: $" + f.masteringCostM + "M</div>" +
      "</div>";
    });
    h += "</div>";

    h += "<div class='section-title'>Active Exhibitor Concession Deal</div>";
    h += "<div class='card' style='margin-bottom:10px;background:rgba(255,255,255,0.02)'>" +
      "<div class='spread'><b>" + activeDeal.name + "</b><span class='tag " + (activeDeal.cutSharePct > 0 ? "green" : "gold") + "'>" + Math.round(activeDeal.cutSharePct*100) + "% Concessions</span></div>" +
      "<div class='tiny muted' style='margin:4px 0'>" + activeDeal.desc + "</div>" +
      "<div style='display:flex;gap:6px;margin-top:8px;flex-wrap:wrap'>" +
        CONCESSION_DEALS.map(d =>
          "<button class='btn btn-xs " + (d.id === activeDeal.id ? "btn-primary" : "btn-alt") + " btnSelectConcession' data-deal-id='" + d.id + "'>" + d.name.split(" ")[0] + " (" + Math.round(d.cutSharePct*100) + "%)</button>"
        ).join("") +
      "</div>" +
    "</div>";

    h += "<button class='btn btn-sm btn-primary' id='btnOpenPLFModal' style='width:100%'>Manage PLF Mastering &amp; Previews</button>";
    h += "</div>";
    return h;
  }

  // Open Full PLF & Theatrical Modal
  function openPLFModal(state){
    const S = _getG(state);
    if(!S) return;
    initExhibitionPLF(S);

    const unreleased = (S.projects || []).filter(p => !p.released);
    const released = (S.projects || []).filter(p => p.released);

    function renderInner(){
      let h = "<h3>Premium Large Format &amp; Theatrical Scheduling Desk</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Master tentpoles in IMAX 70mm and Dolby Cinema for +35% ticket surcharges, activate Thursday midnight previews, and launch theatrical re-releases.</p>";

      if(unreleased.length){
        h += "<div class='section-title'>Eligible Unreleased Slate Titles</div>";
        unreleased.forEach(p => {
          h += "<div class='card' style='margin-bottom:8px'>" +
            "<div class='spread'><b>" + p.title + "</b><span class='tag " + (p.plfFormat ? "purple" : "gold") + "'>" + (p.plfFormat ? p.plfFormatName : "Standard DCP") + "</span></div>" +
            "<div class='tiny muted' style='margin:4px 0 8px'>Budget: $" + (p.budget || 20) + "M | Thursday Previews: " + (p.thursdayPreviewsActive ? "ACTIVE" : "UNBOOKED") + "</div>" +
            "<div style='display:flex;gap:6px;flex-wrap:wrap'>" +
              (!p.plfFormat ? PLF_FORMATS.map(f =>
                "<button class='btn btn-xs btn-alt btnMasterPLF' data-proj-id='" + p.id + "' data-plf-id='" + f.id + "'>Master " + f.name.split(" ")[0] + " ($" + f.masteringCostM + "M)</button>"
              ).join("") : "<button class='btn btn-xs' disabled>Mastered in " + p.plfFormatName + "</button>") +
              (!p.thursdayPreviewsActive ? "<button class='btn btn-xs btn-primary btnThursdayPreview' data-proj-id='" + p.id + "'>Book Thursday Midnight Previews ($1.0M)</button>" : "<button class='btn btn-xs' disabled>Thursday Previews Booked</button>") +
            "</div>" +
          "</div>";
        });
      }

      if(released.length){
        h += "<div class='section-title' style='margin-top:14px'>Theatrical Re-Release Campaigns (+10 Min Extended Cut)</div>";
        released.slice(-4).forEach(p => {
          h += "<div class='card' style='margin-bottom:8px'>" +
            "<div class='spread'><b>" + p.title + "</b><span class='tag green'>$" + (p.wwGross || 150) + "M Gross</span></div>" +
            "<button class='btn btn-xs btn-alt btnReReleaseFilm' data-film-title='" + p.title + "'>Re-Release in 2,000 Theaters ($3.0M Campaign)</button>" +
          "</div>";
        });
      }

      return h;
    }

    function wireEvents(container){
      container.querySelectorAll(".btnMasterPLF").forEach(btn => {
        btn.onclick = () => {
          const res = masterFilmInPLF(btn.dataset.projId, btn.dataset.plfId, S);
          if(res.ok){
            if(typeof toast === "function") toast(res.msg, "good");
            container.innerHTML = renderInner();
            wireEvents(container);
            if(typeof render === "function") render();
          } else {
            if(typeof toast === "function") toast(res.msg, "bad");
          }
        };
      });

      container.querySelectorAll(".btnThursdayPreview").forEach(btn => {
        btn.onclick = () => {
          const res = activateThursdayPreviews(btn.dataset.projId, S);
          if(res.ok){
            if(typeof toast === "function") toast(res.msg, "good");
            container.innerHTML = renderInner();
            wireEvents(container);
            if(typeof render === "function") render();
          } else {
            if(typeof toast === "function") toast(res.msg, "bad");
          }
        };
      });

      container.querySelectorAll(".btnReReleaseFilm").forEach(btn => {
        btn.onclick = () => {
          const res = reReleaseFilmInTheaters(btn.dataset.filmTitle, S);
          if(res.ok){
            if(typeof toast === "function") toast(res.msg, "good");
            container.innerHTML = renderInner();
            wireEvents(container);
            if(typeof render === "function") render();
          } else {
            if(typeof toast === "function") toast(res.msg, "bad");
          }
        };
      });
    }

    const initialHtml = "<div id='plfModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#plfModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function bindEvents(container, state){
    const root = container || (typeof document !== "undefined" ? document : null);
    if(!root) return;
    const S = _getG(state);

    root.querySelectorAll(".btnSelectConcession").forEach(btn => {
      btn.onclick = (e) => {
        if(e) e.stopPropagation();
        const res = signConcessionDeal(btn.dataset.dealId, S);
        if(res.ok){
          if(typeof toast === "function") toast(res.msg, "good");
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.msg, "bad");
        }
      };
    });

    const bPLF = root.querySelector("#btnOpenPLFModal");
    if(bPLF){
      bPLF.onclick = () => {
        openPLFModal(state);
      };
    }
  }

  const ExhibitionPLFAPI = {
    PLF_FORMATS,
    CONCESSION_DEALS,
    initExhibitionPLF,
    masterFilmInPLF,
    signConcessionDeal,
    activateThursdayPreviews,
    reReleaseFilmInTheaters,
    renderExhibitionPLFSection,
    openPLFModal,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = ExhibitionPLFAPI;
  }
  global.ExhibitionPLF = ExhibitionPLFAPI;
  global.openPLFModal = openPLFModal;
})(typeof window !== "undefined" ? window : global);
