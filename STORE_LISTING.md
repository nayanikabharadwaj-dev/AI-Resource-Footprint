# Chrome Web Store listing — copy to paste

**Name:** Nayanika's AI Resource Footprint Extension

**Summary (max 132 characters):**
Estimates the electricity and water your Claude.ai chats use, based on 2025 published figures, with everyday comparisons.

**Category:** Productivity (or Tools)

**Description:**

How much electricity and water does a conversation with an AI actually use? This extension gives you a running estimate while you chat on claude.ai.

A small widget in the corner of the page tracks your session as you go, translating the numbers into things you can picture: teaspoons of water, minutes of an LED bulb, a share of a phone charge. When you close the tab or leave claude.ai, you get a summary notification, and the toolbar button keeps your last session's footprint. Before each message, a short reminder appears to prompt a moment's thought about whether you need to send it.

The figures are estimates, because no AI company publishes per-message data for Claude. Electricity is based on three closely matching 2025 figures from Google, Epoch AI and OpenAI. Water follows academic research that counts both data-centre cooling and the water used to generate the electricity. Full sources are linked inside the extension.

Private by design: everything is calculated in your browser. The extension reads message text on claude.ai only to count characters, stores nothing but running totals, and sends no data anywhere.

Independent project, not affiliated with Anthropic.

---

## Privacy practices tab — suggested answers

**Single purpose:** Estimate and display the electricity and water used by the user's Claude.ai conversations.

**Permission justifications:**
- `storage`: keeps running session totals and the last session's summary on the user's device.
- `notifications`: shows a summary when a session ends.
- Host permission `https://claude.ai/*`: reads message length on claude.ai to estimate usage and shows the on-page widget.

**Remote code:** No.

**Data usage:** Tick "Website content" (message text is read to count characters). Certify that data is not sold, not used for unrelated purposes, and not used for creditworthiness. Note that it never leaves the device.

**Privacy policy URL:** host PRIVACY.md publicly (for example a GitHub repo or a page on your site) and paste the link.
