import { generateAllKeys } from "./theory.js";

async function fetchJsonWithFallback(paths) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        return response.json();
      }
      lastError = new Error(`Failed to load ${path}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Failed to load JSON data.");
}

export async function loadAllData() {
  const [moodBoosts, descriptionsData] = await Promise.all([
    fetchJsonWithFallback(["./moods.json", "./data/moods.json"]),
    fetchJsonWithFallback(["./descriptions.json", "./data/descriptions.json"])
  ]);

  const musicData = generateAllKeys();

  return {
    musicData,
    moodBoosts,
    functionDescriptions: descriptionsData.functionDescriptions,
    moodReasonText: descriptionsData.moodReasonText
  };
}