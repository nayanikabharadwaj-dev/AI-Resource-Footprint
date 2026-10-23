// utils.js
// Shared estimation logic used by content.js (runs on claude.ai),
// background.js (service worker) and popup.js. Loaded as a plain script in
// all three (no import/export) so it works with `importScripts` in the
// service worker.
//
// ---------------------------------------------------------------------------
// METHODOLOGY / SOURCES  (full write-up: methodology.html)
// ---------------------------------------------------------------------------
// No AI company publishes per-message figures for Claude, so every number
// here is an ESTIMATE: a single best estimate from the most recent public
// measurements of comparable models.
//
// Reference exchange: ~600 tokens (a short question plus a ~500-token
// answer, the answer length Epoch AI assumed in its 2025 estimate). Each
// real exchange is scaled by its estimated length relative to this.
//
// ELECTRICITY: 0.3 Wh per reference exchange. The centre of three 2025
// figures that agree closely: Google's measured median Gemini Apps text
// prompt (0.24 Wh, Aug 2025), Epoch AI's GPT-4o estimate (~0.3 Wh, Feb
// 2025) and OpenAI's stated average ChatGPT query (0.34 Wh, Jun 2025).
//
// WATER: 3.7 mL per Wh. Li et al., "Making AI Less Thirsty" (2023/2025):
// ~0.55 L/kWh on-site data-centre cooling + ~3.14 L/kWh off-site water used
// to generate the electricity (US average). This counts both cooling and
// power generation; Google's 0.26 mL per prompt counts cooling only.
//
// All constants are kept here so they can be updated as better data
// appears.
// ---------------------------------------------------------------------------

const CRE_CONFIG = {
  REFERENCE_TOKENS: 600, // tokens in one "typical" exchange (input + output)
  WH_PER_REF: 0.3, // 2025 consensus: Google 0.24, Epoch ~0.3, OpenAI 0.34
  ML_PER_WH: 0.55 + 3.142, // Li et al.: on-site + off-site (~3.7 mL/Wh)

  CHARS_PER_TOKEN: 4, // rough heuristic; no real tokenizer in the browser

  // Comparison baselines
  LIGHTBULB_WATTS: 10, // typical LED bulb
  PHONE_CHARGE_WH: 12, // full smartphone charge, roughly
  TEASPOON_ML: 5,
};

// Rough chars/4 heuristic for token estimation.
function creEstimateTokens(text) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.round(trimmed.length / CRE_CONFIG.CHARS_PER_TOKEN));
}

// Electricity (Wh) and water (mL) for a number of tokens.
function creComputeImpact(tokens) {
  const wh = (tokens / CRE_CONFIG.REFERENCE_TOKENS) * CRE_CONFIG.WH_PER_REF;
  return { wh, waterMl: wh * CRE_CONFIG.ML_PER_WH };
}

// Everyday comparisons for a computed impact.
function creFormatComparisons(impact) {
  return {
    bulbSeconds: (impact.wh / CRE_CONFIG.LIGHTBULB_WATTS) * 3600,
    phonePct: (impact.wh / CRE_CONFIG.PHONE_CHARGE_WH) * 100,
    teaspoons: impact.waterMl / CRE_CONFIG.TEASPOON_ML,
  };
}

function creNiceNumber(n) {
  if (!isFinite(n) || n === 0) return "0";
  if (n < 0.01) return "<0.01";
  if (n < 1) return n.toFixed(2);
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}

// "45 sec", "3.2 min", "1.5 hr"
function creDuration(seconds) {
  if (seconds < 60) return `${creNiceNumber(seconds)} sec`;
  if (seconds < 3600) return `${creNiceNumber(seconds / 60)} min`;
  return `${creNiceNumber(seconds / 3600)} hr`;
}
