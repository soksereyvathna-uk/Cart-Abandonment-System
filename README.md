# OneStop -- Cart Abandonment Prevention Prototype

A two-page e-commerce checkout prototype built for a university project, demonstrating **10 real-time cart abandonment prevention techniques** used by modern online retailers.

---

## Overview

Cart abandonment is one of the biggest challenges in e-commerce, with industry averages sitting above 70%. This prototype simulates how stores detect and respond to abandonment signals in real time using urgency cues, personalised discount codes, behavioural triggers, and re-engagement flows all without a backend.

The prototype has two pages:

| Page | Purpose |
|---|---|
| `product.html` | Shop page — browse products and add them to cart |
| `index.html` | Smart checkout — cart management, discount codes, and all 10 abandonment triggers |

---

## Features

### Cart system
- Fully dynamic cart driven by `sessionStorage` — no hardcoded items
- Quantity controls (+/−) with live line-total recalculation
- Cart state persists across page navigation and tab switches
- Empty cart state gracefully hides the checkout form

### Discount code system
- No static promo codes — codes are generated on demand when a trigger fires
- Format: `SAVExxxx` (e.g. `SAVEK3M9`) — random, unique per session
- 5-minute expiry; rejected once expired
- Codes survive popup dismissal — users can copy, close, and apply manually
- Discount can only be applied once per session

### 10 abandonment prevention triggers

| # | Trigger | How it works |
|---|---|---|
| 1 | **Exit-intent** | Fires immediately when the mouse leaves the browser window |
| 2 | **Tab switch** | Page Visibility API fires when the user switches tabs or minimises |
| 3 | **Scroll-away** | Fires when the user scrolls back up after scrolling down — a passive disengagement signal |
| 4 | **Inactivity bar** | A visible progress bar drains over 20 seconds; fires a popup on timeout |
| 5 | **Session-unique discount** | Codes generated per session prevent deliberate abandonment to find discount codes |
| 6 | **Form abandonment nudge** | A soft help prompt appears after 12 seconds of form idle time |
| 7 | **Live social proof** | "X people viewing this cart" — realistically fluctuates every 6–10 seconds |
| 8 | **Title bar flicker** | Tab title alternates with a cart reminder while the user is on another tab |
| 9 | **Rage-click detection** | 3+ clicks within 800ms triggers a non-blocking help toast |
| 10 | **Micro-commitment modal** | Declining the popup opens a secondary email capture to save the cart |

---

## Tech stack

- Vanilla HTML, CSS, and JavaScript — no frameworks or libraries
- `sessionStorage` for cart and discount state persistence
- Google Fonts (Syne + DM Sans)
- No backend required — runs entirely in the browser

---

## Getting started

1. Clone or download this repository
2. Open `product.html` in your browser
3. Add items to your cart and navigate to checkout to see the abandonment triggers in action

No build step or server required — just open the file directly.

---

## Project structure

```
├── product.html      # Shop / product listing page
├── index.html        # Cart and checkout page
├── style.css         # All styles
└── script.js         # Cart logic and all 10 abandonment triggers
```

---

## Academic context

This prototype was built as part of a university assignment exploring user behaviour, conversion optimisation, and front-end web development. The abandonment prevention techniques implemented are based on patterns observed in real-world e-commerce platforms and research into checkout friction.

---

## References

- Google Fonts — https://fonts.google.com/
- Anthropic Claude (development assistance) — https://claude.ai/
- Visual Studio Code — https://code.visualstudio.com/

---

## Disclaimer

This is a university prototype. No real transactions, payments, or data collection occur. All cart data is stored locally in the browser's `sessionStorage` and is cleared when the browser session ends.
