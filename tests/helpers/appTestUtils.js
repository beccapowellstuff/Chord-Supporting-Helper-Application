import { expect } from "@playwright/test";

const TONE_STUB = `
  window.Tone = {
    version: "test-stub",
    start: async () => {},
    now: () => 0,
    Limiter: class {
      toDestination() { return this; }
      connect() { return this; }
    },
    Reverb: class {
      constructor() {}
      connect() { return this; }
      async generate() {}
    },
    Filter: class {
      constructor() {}
      connect() { return this; }
    },
    Sampler: class {
      constructor(options = {}) {
        this.volume = { value: 0 };
        setTimeout(() => {
          if (typeof options.onload === "function") {
            options.onload();
          }
        }, 0);
      }
      connect() { return this; }
      triggerAttackRelease() {}
    }
  };
`;

export async function stubToneJs(page) {
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js", route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: TONE_STUB
    })
  );
}

export async function gotoApp(page) {
  await stubToneJs(page);
  await page.goto("/");
  await page.waitForFunction(() => {
    return Boolean(window.appState && Array.isArray(window.appState.keyChordSet) && window.appState.keyChordSet.length === 7);
  });
  await expect(page.locator(".app-brand-image")).toBeVisible();
}

export async function selectMode(page, modeId) {
  await page.locator("#styleSelect").selectOption(modeId);
  await page.waitForFunction(
    expectedModeId => {
      const select = document.getElementById("styleSelect");
      return Boolean(select && select.value === expectedModeId);
    },
    modeId
  );
}

export async function selectRoot(page, root) {
  await page.locator(`.circle-root-btn[data-root="${root}"]`).click();
  await page.waitForFunction(
    expectedRoot => {
      return Boolean(
        window.appState &&
        typeof window.appState.selectedKey === "string" &&
        window.appState.selectedKey.startsWith(expectedRoot + " ")
      );
    },
    root
  );
}

export async function openTool(page, toolName) {
  await page.getByRole("button", { name: toolName }).click();
}

export async function getChordButtonStates(page, groupSlug) {
  return page.locator(`.chord-group-${groupSlug} .chord-btn`).evaluateAll(buttons =>
    buttons.map(button => ({
      label: button.textContent.replace(/\s+/g, " ").trim(),
      matchLevel: button.dataset.matchLevel,
      comparisonChord: button.dataset.comparisonChord,
      scaleFeel: button.dataset.scaleFeel
    }))
  );
}
