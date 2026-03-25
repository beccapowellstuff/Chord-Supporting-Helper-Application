/**
 * dataLoader.js — Application data loader
 *
 * Responsibilities:
 *   - Fetches moods.json and descriptions.json from the data/ folder
 *     (with a fallback path for different server root configurations)
 *   - Calls generateAllKeys() from theory.js to produce musicData in memory
 *     (no JSON file needed for key data — it is derived from theory.js)
 *   - Returns a single appData object containing musicData, moodBoosts,
 *     functionDescriptions, and moodReasonText
 *
 * Exports: loadAllData
 * Depends on: theory
 */
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