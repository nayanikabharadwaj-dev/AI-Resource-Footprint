// content.js
// Runs on https://claude.ai/*. Watches the chat UI, estimates the
// electricity/water impact of each exchange, shows a live floating widget,
// and reports session totals to background.js when a session ends. A
// "session" now spans the whole tab's lifetime on claude.ai - switching
// between conversations (new or older chats) does NOT end it or reset the
// widget, only navigating away from claude.ai or closing the tab does.
//
// NOTE ON SELECTORS: the values in SELECTORS below were confirmed against a
// real saved claude.ai page (not guessed) - see README's "If the widget
// stops detecting messages" section for how they were found. Claude's web UI can still change over
// time though; if detection stops working, save a fresh copy of the page
// (Cmd+S -> "Webpage, HTML Only") and search it for data-testid/role/
// aria-label attributes on the composer and message elements, then update
// SELECTORS accordingly.

(function () {
  "use strict";

  const state = {
    conversationKey: null,
    tokensTotal: 0,
    exchanges: 0,
  };

  let widgetEl = null;

  // Verified 2026-07-08 against a saved claude.ai page (real DOM, not a
  // guess): the composer is a contenteditable div with data-testid
  // "chat-input"; each user message's text sits inside an element with
  // data-testid "user-message"; each assistant reply is wrapped in a div
  // with a data-is-streaming="true"/"false" attribute (flips to "false" the
  // moment the reply finishes), with the rendered text inside a
  // ".font-claude-response" descendant. Each message (user or assistant) is
  // wrapped in a div[role="article"] with aria-label "Message N of M".
  const SELECTORS = {
    composer: ['[data-testid="chat-input"]', 'div[contenteditable="true"].ProseMirror'],
    userMessage: '[data-testid="user-message"]',
    assistantText: ".font-claude-response",
    article: 'div[role="article"]',
    // Best-effort guesses: the send button only carries an aria-label while
    // the composer has text (so it wasn't visible in the empty-composer page
    // snapshot used to confirm the other selectors above). If hovering the
    // send button doesn't trigger the estimate, save a fresh "Webpage, HTML
    // Only" copy with text typed into the composer (so the button is in its
    // enabled state) and update this list with whatever attribute it
    // actually has.
    sendButton: [
      'button[aria-label="Send Message"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="send" i]',
    ],
  };

  function querySelectorList(list) {
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // Defers non-urgent work to a browser idle slot when available, so it
  // doesn't compete with rendering/typing on the page.
  function runWhenIdle(fn) {
    if (window.requestIdleCallback) {
      requestIdleCallback(fn, { timeout: 1000 });
    } else {
      setTimeout(fn, 0);
    }
  }

  // ---------------- UI ----------------
  function ensureWidget() {
    if (widgetEl && document.body.contains(widgetEl)) return widgetEl;
    widgetEl = document.createElement("div");
    widgetEl.id = "cre-widget";
    widgetEl.innerHTML = `
      <div class="cre-header">
        <span class="cre-header-title">There&rsquo;s <span class="cre-globe">🌍</span> no Planet B</span>
        <button class="cre-close" title="Hide">×</button>
      </div>
      <div class="cre-body">
        <div class="cre-slogan">Session footprint (est.)</div>
        <div class="cre-row">⚡ <span class="cre-wh">0</span> Wh</div>
        <div class="cre-row">💧 <span class="cre-water">0</span> mL</div>
        <div class="cre-compare"></div>
      </div>
    `;
    document.body.appendChild(widgetEl);
    widgetEl.querySelector(".cre-close").addEventListener("click", () => {
      widgetEl.style.display = "none";
    });
    return widgetEl;
  }

  function updateWidget() {
    const el = ensureWidget();
    el.style.display = "block";
    const impact = creComputeImpact(state.tokensTotal);
    el.querySelector(".cre-wh").textContent = creNiceNumber(impact.wh);
    el.querySelector(".cre-water").textContent = creNiceNumber(impact.waterMl);
    const c = creFormatComparisons(impact);
    el.querySelector(".cre-compare").innerHTML =
      `≈ ${creNiceNumber(c.teaspoons)} teaspoon${c.teaspoons === 1 ? "" : "s"} of water 🥄<br>` +
      `≈ an LED bulb on for ${creDuration(c.bulbSeconds)} 💡`;
  }

  function showToast(text) {
    // Remove any existing toast/backdrop so they don't stack up.
    document.querySelectorAll(".cre-toast, .cre-toast-backdrop").forEach((n) => n.remove());

    const backdrop = document.createElement("div");
    backdrop.className = "cre-toast-backdrop";
    document.body.appendChild(backdrop);

    const t = document.createElement("div");
    t.className = "cre-toast";
    t.innerHTML = `
      <div class="cre-toast-header">
        <span class="cre-toast-triangle">&#9888;</span>
        <span class="cre-toast-title">WARNING</span>
        <button class="cre-toast-close" title="Dismiss">×</button>
      </div>
      <div class="cre-toast-body">
        <span class="cre-toast-text"></span>
      </div>
    `;
    t.querySelector(".cre-toast-text").textContent = text;
    document.body.appendChild(t);

    const DURATION_MS = 9000;
    let hideTimer = null;

    const startHideTimer = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(dismiss, DURATION_MS);
    };
    const dismiss = () => {
      clearTimeout(hideTimer);
      t.classList.remove("cre-toast-show");
      backdrop.classList.remove("cre-toast-show");
      setTimeout(() => {
        t.remove();
        backdrop.remove();
      }, 400);
    };

    t.querySelector(".cre-toast-close").addEventListener("click", dismiss);
    backdrop.addEventListener("click", dismiss);
    // Hovering (reading it) pauses the auto-dismiss timer.
    t.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    t.addEventListener("mouseleave", startHideTimer);

    requestAnimationFrame(() => {
      t.classList.add("cre-toast-show");
      backdrop.classList.add("cre-toast-show");
    });
    startHideTimer();
  }

  // ---------------- estimation ----------------
  function recordExchange(userText, assistantText) {
    const tokens = creEstimateTokens(userText) + creEstimateTokens(assistantText);
    state.tokensTotal += tokens;
    state.exchanges += 1;
    updateWidget();
    persist();
  }

  function estimateBeforeSend(userText) {
    showToast(
      "There is no Planet B. Indiscriminate AI usage can kill your creativity and the planet you live on."
    );
  }

  function persist() {
    chrome.runtime.sendMessage({ type: "CRE_SESSION_UPDATE", session: { ...state } });
  }

  function finalizeSession(reason) {
    if (state.exchanges === 0) return;
    chrome.runtime.sendMessage({ type: "CRE_SESSION_END", session: { ...state }, reason });
    state.tokensTotal = 0;
    state.exchanges = 0;
    if (widgetEl) widgetEl.style.display = "none";
  }

  // ---------------- DOM watching ----------------
  // The composer is a single persistent element for the life of the page,
  // so we only need to find and hook it a handful of times (page load +
  // conversation changes) - no continuous querying needed.
  let hookedComposerNode = null;

  function hookComposer() {
    const composer = querySelectorList(SELECTORS.composer);
    if (!composer || composer === hookedComposerNode) return !!composer;

    composer.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      const text = composer.innerText || composer.textContent || "";
      if (!text.trim()) return;
      estimateBeforeSend(text);
    });
    hookedComposerNode = composer;
    return true;
  }

  // Hovering the send button should also trigger the estimate (covers users
  // who click to send instead of pressing Enter). mouseenter/mouseleave
  // don't bubble, so this uses mouseover/mouseout delegation on document
  // (cheap - only does work when the hovered element is actually the send
  // button) with a guard so re-entering the same button doesn't re-fire
  // repeatedly while the mouse just moves around inside it.
  function findSendButton(target) {
    for (const sel of SELECTORS.sendButton) {
      const btn = target.closest && target.closest(sel);
      if (btn) return btn;
    }
    return null;
  }

  let hoveredSendButton = null;
  document.addEventListener("mouseover", (e) => {
    const btn = findSendButton(e.target);
    if (!btn || btn === hoveredSendButton) return;
    hoveredSendButton = btn;
    const composer = hookedComposerNode || querySelectorList(SELECTORS.composer);
    const text = composer ? composer.innerText || composer.textContent || "" : "";
    if (text.trim()) estimateBeforeSend(text);
  });
  document.addEventListener("mouseout", (e) => {
    if (hoveredSendButton && !hoveredSendButton.contains(e.relatedTarget)) {
      hoveredSendButton = null;
    }
  });

  // Composer may mount slightly after this script runs; a few bounded
  // retries at load time cover that without any ongoing polling.
  (function attemptHookComposer(retriesLeft) {
    if (hookComposer() || retriesLeft <= 0) return;
    setTimeout(() => attemptHookComposer(retriesLeft - 1), 1000);
  })(10);

  // Reads the user message text that precedes a given assistant reply node,
  // using the DOM's own article/message structure rather than guessing
  // timing from composer events.
  function getUserTextForAssistantNode(node) {
    const article = node.closest(SELECTORS.article);
    const prevArticle = article && article.previousElementSibling;
    const userEl = prevArticle && prevArticle.querySelector(SELECTORS.userMessage);
    return userEl ? userEl.innerText || userEl.textContent || "" : "";
  }

  // A reply's wrapper flips data-is-streaming from "true" to "false" the
  // moment it finishes. Watching only that attribute (via attributeFilter)
  // means the observer fires exactly twice per message - not on every
  // token/character inserted while streaming - so this is both more
  // accurate (captures the final text once) and far cheaper than scanning
  // the DOM on every mutation.
  const recordedNodes = new WeakSet();

  function handleStreamingNode(node) {
    const isStreaming = node.getAttribute("data-is-streaming") === "true";
    if (isStreaming) {
      recordedNodes.delete(node); // allow a regenerated reply to be re-recorded
      return;
    }
    if (recordedNodes.has(node)) return;
    if (node.querySelector(SELECTORS.userMessage)) return; // safety: not a user bubble
    recordedNodes.add(node);

    runWhenIdle(() => {
      const textEl = node.querySelector(SELECTORS.assistantText) || node;
      const assistantText = textEl.innerText || textEl.textContent || "";
      const userText = getUserTextForAssistantNode(node);
      recordExchange(userText, assistantText);
    });
  }

  const streamObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "data-is-streaming") {
        handleStreamingNode(m.target);
      }
    }
  });
  streamObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-is-streaming"],
    subtree: true,
  });

  // ---------------- conversation / navigation change detection ----------------
  function getConversationKey() {
    return location.pathname;
  }

  function checkConversationChange() {
    const key = getConversationKey();
    if (state.conversationKey === null) {
      state.conversationKey = key;
      return;
    }
    if (key !== state.conversationKey) {
      // Switching to a new or older conversation no longer ends the
      // session - the widget and running total now persist across
      // conversation switches within the same tab, and only reset when the
      // tab actually navigates away from claude.ai or closes (see
      // pagehide/beforeunload below). Only the composer needs re-hooking,
      // since the new conversation's DOM has its own composer node.
      state.conversationKey = key;
      hookComposer();
    }
  }

  ["pushState", "replaceState"].forEach((m) => {
    const orig = history[m];
    history[m] = function (...args) {
      const ret = orig.apply(this, args);
      setTimeout(checkConversationChange, 200);
      return ret;
    };
  });
  window.addEventListener("popstate", () => setTimeout(checkConversationChange, 200));

  // pushState/replaceState/popstate catch nearly all SPA navigation, so the
  // interval below is just a rare safety net (not the primary detection
  // path) - runs infrequently, and only while the tab is actually visible,
  // so a backgrounded/inactive claude.ai tab doesn't wake up every few
  // seconds for nothing.
  let pollTimer = null;
  function schedulePoll() {
    clearInterval(pollTimer);
    if (!document.hidden) {
      pollTimer = setInterval(checkConversationChange, 15000);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(pollTimer);
    } else {
      checkConversationChange();
      schedulePoll();
    }
  });
  schedulePoll();

  window.addEventListener("pagehide", () => finalizeSession("page-hidden"));
  window.addEventListener("beforeunload", () => finalizeSession("unload"));

  // initial
  checkConversationChange();
})();
