import { test, expect } from "@playwright/test";

test("legacy career keeps its name and resumes the saved week", async ({ page }) => {
  await page.goto("/game/index.html");
  await page.fill("#studioName", "E2E Studio");
  await page.click('[data-action="pick-origin"][data-origin="veteran"]');
  await expect(page.locator("#studioName")).toHaveValue("E2E Studio");
  await page.click('[data-action="start-game"]');
  await expect(page.locator("#hudStudio")).toContainText("E2E Studio");
  await page.getByRole("button", { name: "Advance one week" }).click();
  await page.getByRole("button", { name: "Close summary" }).click();
  const week = await page.locator("#hudWeek").textContent();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#hudStudio")).toContainText("E2E Studio");
  await expect(page.locator("#hudWeek")).toHaveText(week);
});

test("portrait launch choices keep focus and protect occupied save slots", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const launch = page.locator("#btnStart");
  await expect(launch).toBeInViewport({ ratio: 1 });
  await page.fill("#studioName", "Parallax First Career");

  for (const selector of ['[data-origin="auteur"]', '[data-scen="standard"]', '[data-diff="hard"]', '#slotRow [data-slot="1"]']) {
    const choice = page.locator(selector);
    await choice.press("Enter");
    await expect(choice).toBeFocused();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
  }
  await launch.click();
  await expect(page.locator("#brandName")).toHaveText("Parallax First Career");
  expect(await page.evaluate(() => [G.studio.archId, G.scenario, G.difficulty, G.slot])).toEqual(["auteur", "standard", "hard", 1]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('#slotRow [data-slot="2"]')).toHaveAttribute("aria-pressed", "true");
  const occupied = page.locator('#slotRow [data-slot="1"]');
  await expect(occupied).toContainText("Parallax First Career");
  await occupied.click();
  const save = await page.evaluate(() => localStorage.getItem("bow_slot1"));
  page.once("dialog", dialog => dialog.dismiss());
  await launch.click();
  await expect(page.locator("#startScreen")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bow_slot1"))).toBe(save);
});

test("portrait career reaches the market and its live weekend chart", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#app")).toBeHidden();
  await expect(page.locator(".welcome-lot")).toBeVisible();
  await expect(page.locator(".welcome-lot")).toHaveJSProperty("complete", true);
  await page.fill("#studioName", "Portrait Studio");
  await page.locator("#btnStart").click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "vertical");
  await expect(page.locator("#brandName")).toHaveText("Portrait Studio");
  await expect(page.locator("#fabWeekMeta")).toContainText("Overhead");
  await expect(page.locator('#bottomNav [data-tab="dashboard"]')).toHaveText("Home");
  await expect(page.locator(".nw-guide-milestones .nw-step")).toHaveCount(3);
  await page.locator(".nw-guide-milestones .nw-step").first().click();
  await expect(page.locator(".develop-script-market")).toBeVisible();

  const market = page.locator('#bottomNav [data-tab="boxoffice"]');
  await market.click();
  await expect(page.getByText("The multiplex is dark.")).toBeVisible();
  await page.evaluate(() => {
    G.rivals[0].slate.push({ title: "Saturday Matinee", genre: "drama", opening: 18, live: true, week: G.week, weeksOut: 1, quality: 70 });
    render();
  });
  await expect(page.locator(".bo-chart-summary strong")).toHaveText("Saturday Matinee leads a $18.0M frame.");
  await expect(page.locator(".bo-chart-summary dd").last()).toHaveText("0.0%");
  await expect(page.locator(".bo-chart-row")).toHaveCount(1);
  await page.locator('#bottomNav [data-tab="develop"]').click();
  await expect(page.locator(".command-develop-nav")).toBeVisible();

  for (const tab of ["studio", "dashboard"]) {
    await page.locator(`#bottomNav [data-tab="${tab}"]`).click();
    await expect(page.locator("#view")).toHaveAttribute("data-screen", tab);
  }
  await page.locator("#btnBell").click();
  await expect(page.locator(".command-inbox-modal")).toBeVisible();
  await page.getByRole("button", { name: "Close modal" }).click();

  for (const tab of ["productions", "fans", "ott", "live", "empire", "library", "games", "finance"]) {
    await page.locator("#btabMore").click();
    const destination = page.locator(`.more-destinations [data-more-tab="${tab}"]`);
    if (!(await destination.isVisible())) await page.getByText("More game desks", { exact: true }).click();
    await destination.click();
    await expect(page.locator("#app")).toHaveAttribute("data-active-tab", tab);
    await expect(page.locator("#view")).toHaveAttribute("data-screen", tab);
    expect(await page.locator("#view").evaluate(view => view.scrollWidth - view.clientWidth), tab).toBeLessThanOrEqual(1);
  }
});

test("portrait chrome leaves room for the desk at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.locator("#btnStart").click();
  await expect(page.locator(".command-dashboard")).toBeVisible();

  for (const tab of ["dashboard", "develop", "boxoffice"]) {
    await page.locator(`#bottomNav [data-tab="${tab}"]`).click();
    await expect(page.locator("#view")).toHaveAttribute("data-screen", tab);
    const layout = await page.evaluate(() => {
      const view = document.querySelector("#view");
      const action = document.querySelector("#fabWeek").getBoundingClientRect();
      const nav = document.querySelector("#bottomNav").getBoundingClientRect();
      const buttons = [...document.querySelectorAll("#bottomNav button")];
      return {
        width: view.clientWidth,
        scrollWidth: view.scrollWidth,
        viewHeight: view.clientHeight,
        viewBottom: view.getBoundingClientRect().bottom,
        actionTop: action.top,
        actionBottom: action.bottom,
        navTop: nav.top,
        navBottom: nav.bottom,
        minTargetHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height))
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
    expect(layout.viewHeight).toBeGreaterThan(350);
    expect(layout.viewBottom).toBeLessThanOrEqual(layout.actionTop + 1);
    expect(layout.actionBottom).toBeLessThanOrEqual(layout.navTop + 1);
    expect(layout.navBottom).toBeLessThanOrEqual(569);
    expect(layout.minTargetHeight).toBeGreaterThanOrEqual(44);
    if (tab === "dashboard") {
      const primary = await page.locator(".command-brief .command-primary").boundingBox();
      expect(primary.y + primary.height).toBeLessThanOrEqual(layout.actionTop);
    }
  }
});

test("every Studio, Create and Market subtab stays reachable on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();

  for (const [tab, attribute, count] of [
    ["studio", "data-studiosub", 8],
    ["develop", "data-devsub", 8],
    ["boxoffice", "data-bosub", 7]
  ]) {
    await page.locator(`#bottomNav [data-tab="${tab}"]`).click();
    const rail = page.locator(`#view .command-section-nav .command-nav-items [${attribute}]`);
    await expect(rail).toHaveCount(count);
    for (const key of await rail.evaluateAll((buttons, attr) => buttons.map(button => button.getAttribute(attr)), attribute)) {
      const button = rail.and(page.locator(`[${attribute}="${key}"]`));
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "page");
      const overflow = await page.locator("#view").evaluate(view => view.scrollWidth - view.clientWidth);
      expect(overflow, `${tab}/${key} horizontal overflow`).toBeLessThanOrEqual(1);
    }
  }

  await page.locator("#btabMore").click();
  const sheet = page.getByRole("dialog", { name: "More Desks", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".more-destinations button").first()).toContainText("Empire");
  expect(await sheet.evaluate(modal => modal.scrollWidth - modal.clientWidth)).toBeLessThanOrEqual(1);
  await sheet.getByText("Specialist tools", { exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Territory Licensing", exact: false })).toBeVisible();
});

for (const width of [320, 390]) {
  test(`Create script actions fit and open their dialogs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await page.locator("#btnStart").click();
    await page.locator('#bottomNav [data-tab="develop"]').click();
    const card = page.locator(".develop-script").first();
    await expect(card).toBeVisible();

    const clipped = await page.locator(".develop-script").evaluateAll(cards =>
      cards.flatMap(card => {
        const bounds = card.getBoundingClientRect();
        const footer = card.querySelector("footer");
        return [...footer.querySelectorAll("button")].filter(button => {
          const rect = button.getBoundingClientRect();
          return rect.left < bounds.left || rect.right > bounds.right || footer.scrollWidth > footer.clientWidth + 1;
        }).map(button => button.textContent);
      })
    );
    expect(clipped).toEqual([]);

    for (const action of ["Pitch", "Develop this film"]) {
      await card.getByRole("button", { name: action, exact: true }).click();
      const dialog = page.locator("#modalRoot .modal");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Close modal", exact: true }).click();
    }
  });
}

test("Studio Industry and Next Wave use the portrait cards and keep their actions", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();
  await page.locator('#bottomNav [data-tab="studio"]').click();

  for (const [subtab, selector] of [["industry", ".industry-hero"], ["nextwave", ".nw-hero"]]) {
    await page.locator(`.command-studio-nav [data-studiosub="${subtab}"]`).click();
    const card = page.locator(selector);
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS("background-image", "none");
    await expect(card).toHaveCSS("border-top-left-radius", "12px");
    await expect(page.locator("#view h1")).toHaveCount(1);
    expect(await page.locator("#view").evaluate(view => view.scrollWidth - view.clientWidth)).toBeLessThanOrEqual(1);

    if (subtab === "industry") {
      const invest = page.locator("[data-esg-program]").first();
      await invest.click();
      await expect(invest).toBeDisabled();
      await expect(invest).toContainText("Installed");
    } else {
      await page.locator("#nwBuildCampaign").click();
      await expect(page.locator("#modalRoot .modal")).toBeVisible();
    }
  }
});

test("older Studio panels and the Create pitch cards use the Parallax surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();
  await page.locator('#bottomNav [data-tab="studio"]').click();
  for (const [subtab, selector] of [
    ["csuite", ".leadership-brief"], ["board", ".strategy-mandate"],
    ["operations", ".workforce-signals > article"], ["crisis", ".studio-reputation-card"],
    ["heritage", ".studio-legacy-card"]
  ]) {
    await page.locator(`.command-studio-nav [data-studiosub="${subtab}"]`).click();
    const card = page.locator(selector).first();
    await expect(card).toHaveCSS("border-top-left-radius", "12px");
    await expect(card).toHaveCSS("background-image", "none");
  }
  await page.locator("#btnRestorationVault").click();
  await expect(page.locator("#modalRoot .modal")).toBeVisible();
  await page.getByRole("button", { name: "Close modal", exact: true }).click();

  await page.locator('#bottomNav [data-tab="develop"]').click();
  await page.locator('.command-develop-nav [data-devsub="pitch"]').click();
  for (const id of ["btnHubFilm", "btnHubSeries"]) {
    const card = page.locator("#" + id);
    await expect(card).toHaveCSS("background-image", "none");
    await card.click();
    await expect(page.locator("#modalRoot .modal")).toBeVisible();
    await page.getByRole("button", { name: "Close modal", exact: true }).click();
  }
});

test("More opens every specialist desk on a 320px phone", async ({ page }) => {
  test.setTimeout(75000);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();
  const more = page.getByRole("dialog", { name: "More Desks", exact: true });
  const openMore = async () => {
    await page.locator("#btabMore").click();
    await expect(more).toBeVisible();
  };

  for (const id of [
    "qaAwards", "qaFestivals", "moreSet", "moreHelp",
    "qaTerritory", "qaAgency", "qaContracts", "qaFacilities", "qaTestScreens",
    "qaScouting", "qaInsurance", "qaCrisis", "qaSpy", "qaMerch", "qaBonds",
    "qaConventions", "qaDynasty", "qaSandbox", "moreAch", "moreHall", "moreFinanceLedger"
  ]) {
    await openMore();
    const tile = more.locator("#" + id);
    if (!(await tile.isVisible())) await more.getByText("Specialist tools", { exact: true }).click();
    await tile.click();
    const dialog = page.locator("#modalRoot .parallax-more-dialog");
    await expect(dialog, id).toBeVisible();
    await expect(dialog).toHaveCSS("border-top-left-radius", "16px");
    expect(await dialog.evaluate(modal => modal.scrollWidth - modal.clientWidth), id).toBeLessThanOrEqual(1);
    if (id === "qaInsurance") await expect(dialog.getByText("No active productions to insure.", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Close modal", exact: true }).click();
  }

  for (const [id, destination] of [["qaClash", "boxoffice"], ["qaOtt", "ott"], ["qaLiveTv", "live"], ["qaGames", "games"]]) {
    await openMore();
    const tile = more.locator("#" + id);
    if (!(await tile.isVisible())) await more.getByText("Specialist tools", { exact: true }).click();
    await tile.click();
    await expect(page.locator("#view")).toHaveAttribute("data-screen", destination);
    if (id === "qaClash") await expect(page.locator('[data-bosub="clash"]')).toHaveAttribute("aria-current", "page");
  }

  await openMore();
  await more.getByText("Specialist tools", { exact: true }).click();
  await more.locator("#moreSave").click();
  await expect(more.getByRole("status")).toHaveText("Saved successfully");
});

test("More tiles share a text edge and use a neutral backdrop", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();
  await page.locator("#btabMore").click();
  const more = page.getByRole("dialog", { name: "More Desks", exact: true });
  await expect(more.locator("..")).toHaveCSS("background-color", "rgba(8, 8, 8, 0.72)");

  await more.getByText("More game desks", { exact: true }).click();
  await more.getByText("Specialist tools", { exact: true }).click();
  const offsets = await more.locator(".more-destinations button").evaluateAll(buttons =>
    buttons.map(button => {
      const left = button.getBoundingClientRect().left;
      return [...button.querySelectorAll("b, small")].map(text => {
        const range = document.createRange();
        range.selectNodeContents(text);
        return Math.round(range.getBoundingClientRect().left - left);
      });
    })
  );
  expect(new Set(offsets.flat()).size).toBe(1);

  await more.locator("#qaFacilities").click();
  const dialog = page.locator("#modalRoot .parallax-more-dialog");
  await expect(dialog.locator("..")).toHaveCSS("background-color", "rgba(8, 8, 8, 0.72)");
});

test("portrait desk tiles align their copy and direct dialogs use the neutral backdrop", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();

  for (const [destination, subtab, tiles] of [
    ["dashboard", '.command-nav-items [data-dashsub="actions"]', ".command-desk-grid > button"],
    ["develop", null, ".develop-tools > button"]
  ]) {
    await page.locator(`#bottomNav [data-tab="${destination}"]`).click();
    if (subtab) await page.locator(subtab).click();
    await expect(page.locator(tiles).first()).toBeVisible();
    const alignment = await page.locator(tiles).evaluateAll(buttons => buttons.map(button => {
      const left = button.getBoundingClientRect().left;
      return [...button.children].filter(label => /^(B|SMALL|SPAN)$/.test(label.tagName)).map(label => {
        const range = document.createRange();
        range.selectNodeContents(label);
        return Math.round(range.getBoundingClientRect().left - left);
      });
    }));
    expect(alignment.length).toBeGreaterThan(0);
    expect(alignment.every(offsets => offsets.length > 1 && new Set(offsets).size === 1)).toBe(true);
  }

  await page.locator('#bottomNav [data-tab="studio"]').click();
  await page.locator("#btnBell").click();
  const inbox = page.locator("#modalRoot .command-inbox-modal");
  await expect(inbox).toBeVisible();
  await expect(inbox.locator("..")).toHaveCSS("background-color", "rgba(8, 8, 8, 0.72)");
  await inbox.getByRole("button", { name: "Close modal", exact: true }).click();

  await page.locator('#bottomNav [data-tab="develop"]').click();
  await page.locator('.command-develop-nav [data-devsub="pitch"]').click();
  await page.locator("#btnHubFilm").click();
  const pitch = page.locator("#modalRoot .modal");
  await expect(pitch).toBeVisible();
  await expect(pitch.locator("..")).toHaveCSS("background-color", "rgba(8, 8, 8, 0.72)");
});

test("portrait Studio Lot keeps all six room tabs and primary actions within reach", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();
  await page.locator('#bottomNav [data-tab="studio"]').click();
  await page.getByRole("button", { name: /Enter Studio Lot/ }).click();
  const rooms = page.getByRole("group", { name: "Studio Lot rooms" });

  for (const room of ["Campus", "Stage", "Writers", "Post & VFX", "Cinema", "Executive"]) {
    const button = rooms.getByRole("button", { name: room, exact: true });
    await expect(button.locator(":scope > span")).toBeVisible();
    await expect(button).toBeInViewport({ ratio: 1 });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  for (const action of ["Locate Set", "Room interiors", "Build Facility"]) {
    await expect(page.getByRole("group", { name: "Room actions" }).getByRole("button", { name: action })).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole("button", { name: "Expand" }).click();
  await expect(page.locator("#studiolotGlobalStage")).toHaveClass(/lot-immersive/);
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.locator("#studiolotGlobalStage")).not.toHaveClass(/lot-immersive/);
});

test("portrait desk and dialog controls fit their rails at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.locator("#btnStart").click();
  const expectRailToFit = async (buttons) => {
    await expect(buttons.first()).toBeVisible();
    expect(await buttons.evaluateAll(items => items.every(button => {
      const rail = button.parentElement.getBoundingClientRect();
      const bounds = button.getBoundingClientRect();
      return bounds.left >= rail.left - 1 && bounds.right <= rail.right + 1;
    }))).toBe(true);
  };
  for (const tab of ["dashboard", "studio", "develop", "boxoffice", "productions", "fans", "ott", "live", "empire", "library", "games", "finance"]) {
    await page.evaluate(tab => switchTab(tab), tab);
    const selector = tab === "productions" ? "#subTabs .subtab-btn" :
      tab === "fans" ? "#view [data-mail-cat]" : "#view .command-nav-items > button";
    const subtabs = page.locator(selector);
    await expectRailToFit(subtabs);
    await expect(subtabs.locator('.section-emoji[aria-hidden="true"]')).toHaveCount(await subtabs.count());
    if (tab === "boxoffice") {
      await expectRailToFit(page.locator("#view .command-nav-tools > button"));
      await page.locator("#btnBoCollection").click();
      const collection = page.locator("#modalRoot .boc-desk");
      const title = collection.getByRole("heading", { name: "Collection Command", exact: true });
      await expect(title).toBeVisible();
      await expect(title.locator(".dialog-emoji")).toHaveAttribute("aria-hidden", "true");
      await expect(collection.locator(".boc-stats > .stat")).toHaveCount(4);
      await collection.getByRole("button", { name: "Close modal" }).click();
    }
    if (tab === "ott") {
      await expect(page.locator(".command-ott .command-date")).toHaveCSS("display", "grid");
    }
    if (tab === "develop") await expectRailToFit(page.locator("#view [data-filter-genre]"));
  }
  await page.evaluate(() => switchTab("live"));
  await page.locator('#view [data-livesub="shows"]').click();
  const fields = page.locator(".live-show-form :is(input,select)");
  await expectRailToFit(fields);

  for (const [id, nav] of [["moreSet", ".preferences-nav"], ["moreHelp", ".guide-nav"]]) {
    await page.locator("#btabMore").click();
    await page.locator(`.studio-destination-modal #${id}`).click();
    const buttons = page.locator(`#modalRoot ${nav} > button`);
    await expectRailToFit(buttons);
    await buttons.last().click();
    await expect(buttons.last()).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Close modal", exact: true }).click();
  }
  await page.evaluate(() => { switchTab("develop"); openCastDirectory(); });
  const roster = page.locator("#modalRoot .cast-directory-modal");
  await expect(roster).toBeVisible();
  await expect(roster.locator(".cast-row-id small").first()).toHaveCSS("white-space", "normal");
  await roster.locator(".cast-scout > summary").click();
  await expectRailToFit(roster.locator(".cast-scout-grid > .cast-scout-card"));
});
