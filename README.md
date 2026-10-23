# Nayanika's AI Resource Footprint Extension

A Chrome extension that estimates the electricity and water your Claude.ai
conversations use, as a sourced estimate with everyday comparisons (teaspoons of water, minutes of an LED bulb, % of a phone
charge). Not affiliated with Anthropic.

- **When you send a message** (Enter, or hovering the send button), it shows
  a "There is no Planet B" warning toast.
- **While you chat**, a small floating widget in the corner keeps a running
  estimate for the session. The total persists across conversations in the
  same tab.
- **When the session ends** (you navigate away from claude.ai or close the
  tab), it fires a browser notification with the session's estimate, and the
  toolbar popup keeps the last session's summary, with a link to the
  methodology page.

## Install (unpacked, for local/personal use)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Visit [claude.ai](https://claude.ai) and start chatting - watch the
   bottom-right corner for the live widget.

## Methodology (an estimate, not measured data)

No AI company publishes per-message figures for Claude, so the extension
shows a **best estimate** built from the most recent public measurements of
comparable models. Full write-up with sources: [`methodology.html`](methodology.html)
(also linked from the toolbar popup).

- **Reference exchange:** ~600 tokens (short question + ~500-token answer).
  Each real exchange is scaled by its length. Tokens are estimated as
  `characters / 4`.
- **Electricity:** 0.3 Wh per reference exchange, the centre of Google's
  0.24 Wh (Aug 2025), Epoch AI's ~0.3 Wh (Feb 2025) and OpenAI's 0.34 Wh
  (Jun 2025).
- **Water:** 3.7 mL per Wh (Li et al., *Making AI Less "Thirsty"*: on-site
  cooling plus off-site water for electricity generation, US average), so
  about 1.1 mL per reference exchange.

All constants live in [`utils.js`](utils.js), in the `CRE_CONFIG` object, so
they can be updated as better data becomes available.

### On "resources used to make the estimate"

The estimate itself is computed with plain JavaScript running locally in
your browser - no extra AI model calls are made to produce it, so its own
footprint is negligible compared to the conversation it's measuring.

## Privacy

Message text is read on claude.ai only to count characters. Nothing leaves
your browser; only token counts and exchange counts are stored locally. See
[`PRIVACY.md`](PRIVACY.md).

## Efficiency

Watching a live chat page for changes can easily become wasteful if it's not
careful, since a streaming response mutates the DOM many times per second.
This extension is designed to stay cheap:

- Assistant replies are detected via a single `data-is-streaming` attribute
  on the reply's wrapper element, which flips from `"true"` to `"false"`
  exactly once, the moment the reply finishes. The `MutationObserver` uses
  `attributeFilter: ['data-is-streaming']`, so it only fires on that specific
  change - not on every character/token inserted while a response is
  streaming in. This is both cheaper *and* more accurate than scanning the
  DOM repeatedly, since it reads each message's full final text exactly once.
- The composer is looked up a handful of times at page load (bounded
  retries) and again on conversation change - not on every DOM mutation -
  since it's a single persistent element for the life of the page.
- Text extraction after a reply completes runs inside `requestIdleCallback`
  when available, so it's scheduled into browser idle time instead of
  competing with page rendering.
- The SPA-navigation fallback poll (`checkConversationChange`) runs every 15s
  (down from an earlier 3s) and is **paused entirely while the tab is
  hidden** (`visibilitychange`) - navigation is caught immediately anyway via
  patched `pushState`/`replaceState`/`popstate`, so this timer is just a rare
  safety net, not the primary detection path.
- The floating widget only re-renders when a full exchange is recorded (not
  continuously), and `chrome.storage` writes only happen once per exchange.

## If the widget stops detecting messages

The selectors in `content.js` were confirmed against a real saved claude.ai
page (not guessed) - see the DOM notes below - but Claude's web UI can still
change over time. If detection stops working:

1. Open claude.ai, get at least one reply from Claude on screen, then press
   `Cmd+S` and save it as "Webpage, HTML Only".
2. Search the saved `.html` file for `data-testid=`, `role=`, and
   `aria-label=` attributes on the composer and message elements (these tend
   to be far more stable across redesigns than CSS class names, which are
   often auto-generated utility classes).
3. Open [`content.js`](content.js) and update the `SELECTORS` object near
   the top with whatever changed.
4. Reload the extension from `chrome://extensions`.

**Confirmed DOM structure (as of 2026-07-08):**
- Composer: `div[data-testid="chat-input"][contenteditable="true"]`
- User message text: `[data-testid="user-message"]`
- Assistant reply wrapper: `div[data-is-streaming="true"|"false"]`, with
  rendered text inside a `.font-claude-response` descendant
- Each message (user or assistant) sits in `div[role="article"]`, with
  `aria-label="Message N of M"`

## Files

- `manifest.json` - extension config (Manifest V3).
- `utils.js` - shared estimation math + config, loaded by the content,
  background and popup scripts.
- `content.js` - runs on claude.ai, detects messages, shows the live widget
  and toasts, reports totals to the background script.
- `content.css` - styling for the floating widget/toast.
- `background.js` - service worker; stores running totals per tab and fires
  the "session ended" notification.
- `popup.html` / `popup.js` / `popup.css` - toolbar popup showing the last
  completed session's summary.
- `methodology.html` - sources and assumptions, opened from the popup.
- `icons/` - placeholder icons (generated by `make_icons.py`, safe to
  replace with your own artwork).
