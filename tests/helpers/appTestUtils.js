import { expect } from "@playwright/test";

function buildToneStub(options = {}) {
  const samplerOutcomes = Array.isArray(options.samplerOutcomes) && options.samplerOutcomes.length
    ? options.samplerOutcomes
    : ["load"];
  const startFailures = Math.max(0, Number(options.startFailures) || 0);

  return `
    (() => {
      const samplerOutcomes = ${JSON.stringify(samplerOutcomes)};
      let remainingStartFailures = ${startFailures};

      window.__toneTestState = {
        samplerConstructCount: 0,
        samplerLoadCount: 0,
        samplerErrorCount: 0,
        startCallCount: 0,
        triggerAttackReleaseCount: 0,
        lastTriggerAttackReleaseArgs: [],
        lastTriggeredNotes: [],
        triggerAttackCount: 0,
        triggerReleaseCount: 0,
        releaseAllCount: 0,
        disposeCount: 0
      };

      window.Tone = {
        version: "test-stub",
        start: async () => {
          window.__toneTestState.startCallCount += 1;
          if (remainingStartFailures > 0) {
            remainingStartFailures -= 1;
            throw new Error("Tone.start failed");
          }
        },
        now: () => 0,
        Limiter: class {
          toDestination() { return this; }
          connect() { return this; }
          dispose() { window.__toneTestState.disposeCount += 1; }
        },
        Reverb: class {
          constructor() {}
          connect() { return this; }
          async generate() {}
          dispose() { window.__toneTestState.disposeCount += 1; }
        },
        Filter: class {
          constructor() {}
          connect() { return this; }
          dispose() { window.__toneTestState.disposeCount += 1; }
        },
        Sampler: class {
          constructor(options = {}) {
            this.volume = { value: 0 };
            window.__toneTestState.samplerConstructCount += 1;

            const outcome = samplerOutcomes.length ? samplerOutcomes.shift() : "load";
            setTimeout(() => {
              if (outcome === "error") {
                window.__toneTestState.samplerErrorCount += 1;
                if (typeof options.onerror === "function") {
                  options.onerror(new Error("Sampler load failed"));
                }
                return;
              }

              window.__toneTestState.samplerLoadCount += 1;
              if (typeof options.onload === "function") {
                options.onload();
              }
            }, 0);
          }

          connect() { return this; }
          triggerAttackRelease(...args) {
            window.__toneTestState.triggerAttackReleaseCount += 1;
            window.__toneTestState.lastTriggerAttackReleaseArgs = args;
            const playedNotes = Array.isArray(args[0]) ? args[0] : [args[0]];
            window.__toneTestState.lastTriggeredNotes = playedNotes;
          }
          triggerAttack() { window.__toneTestState.triggerAttackCount += 1; }
          triggerRelease() { window.__toneTestState.triggerReleaseCount += 1; }
          releaseAll() { window.__toneTestState.releaseAllCount += 1; }
          dispose() { window.__toneTestState.disposeCount += 1; }
        }
      };
    })();
  `;
}

export async function stubToneJs(page, options = {}) {
  const toneStub = buildToneStub(options);
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js", route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: toneStub
    })
  );
}

export async function gotoApp(page, options = {}) {
  await stubToneJs(page, options.toneStubOptions);
  await page.goto("/");
  await page.waitForFunction(() => {
    return Boolean(window.appState && Array.isArray(window.appState.keyChordSet) && window.appState.keyChordSet.length === 7);
  });
  await expect(page.locator(".app-brand-logo")).toBeVisible();
}

export async function selectMode(page, modeId) {
  await page.evaluate(expectedModeId => {
    const select = document.getElementById("styleSelect");
    if (!select) {
      throw new Error("styleSelect not found");
    }

    select.value = expectedModeId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, modeId);

  await page.waitForFunction(
    expectedModeId => {
      const select = document.getElementById("styleSelect");
      return Boolean(select && select.value === expectedModeId);
    },
    modeId
  );
}

export async function setProgressionText(page, value) {
  await page.evaluate(nextValue => {
    const input = document.getElementById("progression");
    if (!input) {
      throw new Error("progression input not found");
    }

    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
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
