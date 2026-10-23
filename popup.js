// popup.js - shows the last completed session's summary in the toolbar popup.

function render(session) {
  const el = document.getElementById("content");
  if (!session || !session.exchanges) {
    el.textContent = "No completed session yet. Start chatting on claude.ai!";
    return;
  }
  const impact = creComputeImpact(session.tokensTotal || 0);
  const c = creFormatComparisons(impact);
  el.innerHTML = `
    <div class="row"><span>⚡ Electricity</span><span>~${creNiceNumber(impact.wh)} Wh</span></div>
    <div class="row"><span>💧 Water</span><span>~${creNiceNumber(impact.waterMl)} mL</span></div>
    <div class="row"><span>💬 Exchanges</span><span>${session.exchanges}</span></div>
    <div class="compare">
      ≈ ${creNiceNumber(c.teaspoons)} teaspoon(s) of water 🥄<br/>
      ≈ LED bulb on for ${creDuration(c.bulbSeconds)} 💡<br/>
      ≈ ${creNiceNumber(c.phonePct)}% of a phone charge 🔋
    </div>
  `;
}

chrome.storage.local.get(["creLastSession"], (result) => {
  render(result.creLastSession);
});
