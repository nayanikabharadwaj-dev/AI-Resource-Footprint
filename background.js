// background.js - MV3 service worker
// Receives running/final session totals from content.js and fires a
// notification with an easy-to-understand summary when a session ends
// (tab closed, or navigated away from claude.ai).

importScripts("utils.js");

const NOTIF_PREFIX = "cre-notif-";

function buildSummaryText(session) {
  const impact = creComputeImpact(session.tokensTotal || 0);
  const c = creFormatComparisons(impact);
  const exchangeWord = session.exchanges === 1 ? "exchange" : "exchanges";
  return (
    `~${creNiceNumber(impact.wh)} Wh electricity, ~${creNiceNumber(impact.waterMl)} mL water ` +
    `across ${session.exchanges} ${exchangeWord}.\n` +
    `About ${creNiceNumber(c.teaspoons)} teaspoon(s) of water and an LED bulb on for ` +
    `${creDuration(c.bulbSeconds)}. Estimate only - see the extension popup for sources.`
  );
}

function notifySessionEnd(session, title) {
  if (!session || !session.exchanges) return;
  chrome.storage.local.set({ creLastSession: session });
  chrome.notifications.create(NOTIF_PREFIX + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: buildSummaryText(session),
    priority: 1,
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab) return;
  const tabId = sender.tab.id;

  if (msg.type === "CRE_SESSION_UPDATE") {
    chrome.storage.local.set({ [`cre-live-${tabId}`]: msg.session });
  }

  if (msg.type === "CRE_SESSION_END") {
    notifySessionEnd(msg.session, "Claude.ai session ended - resource estimate");
    chrome.storage.local.remove(`cre-live-${tabId}`);
  }
});

// tabs.onRemoved does not need the "tabs" permission.
chrome.tabs.onRemoved.addListener((tabId) => {
  const key = `cre-live-${tabId}`;
  chrome.storage.local.get([key], (result) => {
    notifySessionEnd(result[key], "Claude.ai tab closed - resource estimate");
    chrome.storage.local.remove(key);
  });
});
