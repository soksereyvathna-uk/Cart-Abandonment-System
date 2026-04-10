/*
 * ================================================================
 * script.js — OneStop Cart Abandonment Prevention System
 * ================================================================
 *
 * SYSTEM SUMMARY
 * ==============
 * OneStop is a two-page e-commerce prototype demonstrating how online
 * stores detect and prevent cart abandonment in real time.
 *
 * PAGES
 *   product.html  — Shop page. Browse and add products to cart.
 *   index.html    — Cart and checkout page. This script runs here.
 *
 * CART SYSTEM
 *   - Fully dynamic. No hardcoded items.
 *   - Products added from product.html with a quantity selector (1–10).
 *   - Cart stored in sessionStorage so it survives Back navigation.
 *   - Each cart item shows: photo, name, unit price, qty +/- controls,
 *     line total, and a Remove link.
 *   - Changing qty or removing items recalculates total instantly.
 *   - Empty cart hides the checkout form and shows an empty state.
 *
 * DISCOUNT CODE SYSTEM
 *   - No static promo code exists. Codes are generated on demand.
 *   - A code is created when an abandonment popup fires on either page.
 *   - Format: SAVExxxx (e.g. SAVEK3M9). Random, unique per session.
 *   - Valid for 5 minutes. After that it expires and is rejected.
 *   - The code is shown inside the popup with a Copy button.
 *   - After closing the popup, the code remains valid — the user
 *     can copy it, close the popup, type it in the promo field,
 *     and click Apply. It will work correctly until it expires.
 *   - Typing any code before a popup has fired → "Invalid promo code".
 *   - A discount can only be applied once per session.
 *
 * CROSS-PAGE CODE FLOW
 *   - If the exit popup fires on product.html and the user copies the
 *     code then navigates (via cart button or "Claim" button), the code
 *     is saved in sessionStorage under "exitDiscountCode".
 *   - index.html initCart() reads it, sets activeDiscountCode, and
 *     either auto-applies it (Claim path) or just pre-fills the field
 *     (copy-then-navigate path).
 *   - Once loaded into activeDiscountCode, the checkout-page popups
 *     will NOT overwrite it with a new code — they reuse the same one.
 *
 * URGENCY BAR
 *   - Thin progress bar just below the header.
 *   - Hidden when cart is empty. Only appears when items are present.
 *   - Drains over 20 seconds of idle time on checkout page.
 *   - Resets on any mouse movement, keypress, or click.
 *   - Turns red and changes label in the final seconds.
 *   - When it hits zero it fires the inactivity popup.
 *
 * 10 ABANDONMENT PREVENTION TRIGGERS
 *
 *  1. EXIT-INTENT
 *     Fires the moment the mouse leaves the browser window (mouseleave).
 *     No clientY check, no delay — completely immediate.
 *     Only fires when the cart has items.
 *     One-time per session.
 *
 *  2. TAB-SWITCH
 *     Page Visibility API fires when user switches tabs, minimises window,
 *     or locks screen. Also starts the title bar flicker.
 *     Same empty-cart guard. One-time per session.
 *
 *  3. SCROLL-AWAY
 *     Fires when the user scrolls back up more than 80px after having
 *     scrolled down at least 150px — a passive disengagement signal.
 *     One-time per session.
 *
 *  4. INACTIVITY BAR
 *     20 seconds of no activity → fires popup.
 *     The draining bar is always visible, creating ambient urgency
 *     without interrupting the user.
 *
 *  5. SESSION-UNIQUE DISCOUNT CODE
 *     Generated when any popup fires. Random, 5-minute expiry.
 *     Cannot be searched online or reused. Prevents deliberate
 *     abandonment to find a discount code.
 *
 *  6. FORM ABANDONMENT NUDGE
 *     If the user starts filling in the checkout form but stops
 *     for 12 seconds, a soft help nudge appears below the form.
 *     Does not show another popup — targets hesitant users gently.
 *
 *  7. LIVE SOCIAL PROOF
 *     "X people viewing this cart right now" — updates every 6–10
 *     seconds with a realistic fluctuation (anchored random walk
 *     between 3 and 11). Creates FOMO.
 *
 *  8. TITLE BAR FLICKER
 *     When user switches tabs, the browser tab title alternates
 *     every 2 seconds between the page title and a cart reminder.
 *     Stops when the user returns to the tab.
 *
 *  9. RAGE-CLICK DETECTION
 *     3+ clicks within 800ms = frustration signal. A small
 *     non-blocking toast slides in offering live chat help.
 *     Auto-dismisses after 6 seconds.
 *
 * 10. MICRO-COMMITMENT MODAL
 *     "No thanks" on the popup opens a secondary modal asking
 *     for an email to save the cart for 24 hours. Captures a
 *     re-marketing channel even when the user declines the discount.
 *     The extra step also prompts some users to reconsider.
 * 
 * References
 * 1. 
 *
 * ================================================================
 */

const ICONS = {
  "Headphones": "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSr_iOnrsZG0AN5e49vfMG3us5zcCtIaDsKsisaQUywcmleS1AhaLrNo7R0ADvOuA8c2ysGd6ojcHil8k0X9UqXwzLbpTVk-406hF_LIY4Bye9KK37pbPR1g6Q",
  "T-Shirt":    "https://www.prada.com/content/dam/pradanux_products/U/UJN/UJN712/1YDPF0124/UJN712_1YDP_F0124_S_211_SLF.png/_jcr_content/renditions/cq5dam.web.hebebed.1000.1000.jpg",
  "Sneakers":   "https://techwear-australia.com/cdn/shop/files/urban-techwear-shoes-black-side-view.jpg?v=1706679591&width=1946",
  "Backpack":   "https://bellroy-product-images.imgix.net/bellroy_dot_com_gallery_image/AUD/BHRB-BLK-243/0?auto=format&fit=crop&w=1920&h=1920"
};

/* ── PRICING STATE ──────────────────────────────────────────── */
let originalTotal = 0;
let total         = 0;

/* ── DISCOUNT CODE STATE (persisted in sessionStorage) ──────── */
/*
  All discount state lives in sessionStorage so it survives:
    - tab switches / minimising the window
    - navigating to product.html and coming back
    - page refreshes

  Keys used:
    discountUsed        — "true" / absent
    activeDiscountCode  — the code string / absent
    codeExpired         — "true" / absent
    discountPct         — "0.1" (10%) / absent  ← discount rate applied
*/
function _ss(k, v) { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); }
function _sg(k)    { return sessionStorage.getItem(k); }

let discountUsed = _sg("discountUsed") === "true";
let activeDiscountCode = _sg("activeDiscountCode") || null;
let codeExpired        = _sg("codeExpired") === "true";

function generateDiscountCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "SAVE" + s;
}

/* ── CART HELPERS ───────────────────────────────────────────── */
function getCartItems() {
  return JSON.parse(sessionStorage.getItem("cartItems") || "[]");
}

function saveCartItems(items) {
  sessionStorage.setItem("cartItems", JSON.stringify(items));
  sessionStorage.setItem("cartTotal", items.reduce((s, i) => s + i.price * i.qty, 0));
  sessionStorage.setItem("cartCount", items.reduce((s, i) => s + i.qty, 0));
}

function cartIsEmpty() {
  return getCartItems().length === 0;
}

/* ── RENDER CART ITEMS ──────────────────────────────────────── */
function renderCartItems(items) {
  const container = document.getElementById("cartItemsContainer");
  container.innerHTML = "";

  items.forEach((item, index) => {
    const lineTotal = (item.price * item.qty).toFixed(2);
    const imgSrc    = item.img || ICONS[item.name] || "";
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img class="item-thumb" src="${imgSrc}" alt="${item.name}">
      <div class="item-meta">
        <div class="item-name">${item.name}</div>
        <div class="item-unit">$${item.price.toFixed(2)} each</div>
      </div>
      <span class="item-price">$${lineTotal}</span>
      <div class="item-actions">
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty(${index}, -1)">−</button>
          <div class="qty-divider"></div>
          <span class="qty-num">${item.qty}</span>
          <div class="qty-divider"></div>
          <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
        </div>
        <button class="btn-remove" onclick="removeItem(${index})">Remove</button>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ── CHANGE QUANTITY ────────────────────────────────────────── */
function changeQty(index, delta) {
  let items = getCartItems();
  items[index].qty += delta;

  if (items[index].qty <= 0) {
    removeItem(index);
    return;
  }

  saveCartItems(items);
  originalTotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  // Reapply the existing discount on the new subtotal rather than wiping it
  if (discountUsed) {
    const pct = parseFloat(_sg("discountPct") || "0.1");
    total = originalTotal * (1 - pct);
    updatePriceUI();
  } else {
    total = originalTotal;
  }

  renderCartItems(items);
  updateCartUI();
}

/* ── REMOVE ITEM ────────────────────────────────────────────── */
function removeItem(index) {
  let items = getCartItems();
  items.splice(index, 1);
  saveCartItems(items);
  originalTotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  // Reapply discount on new subtotal (or reset if cart is now empty)
  if (items.length === 0) {
    total = 0;
    resetDiscount();
    renderCartItems([]);
    showEmptyCart();
  } else {
    if (discountUsed) {
      const pct = parseFloat(_sg("discountPct") || "0.1");
      total = originalTotal * (1 - pct);
      updatePriceUI();
    } else {
      total = originalTotal;
    }
    renderCartItems(items);
    updateCartUI();
  }
}

/* ── RESET DISCOUNT ─────────────────────────────────────────── */
function resetDiscount() {
  discountUsed = false;
  _ss("discountUsed", null);
  _ss("discountPct", null);
  document.getElementById("status").innerText = "";
  const hint = document.getElementById("codeHint");
  if (hint) hint.remove();
  // Note: activeDiscountCode intentionally NOT cleared — code stays valid
}

/* ── UPDATE CART UI ─────────────────────────────────────────── */
function updateCartUI() {
  const items    = getCartItems();
  const count    = items.reduce((s, i) => s + i.qty, 0);
  const hasItems = items.length > 0;

  document.getElementById("cartBadge").textContent        = count + (count === 1 ? " item" : " items");
  document.getElementById("subtotalDisplay").textContent  = "$" + originalTotal.toFixed(2);
  document.getElementById("totalDisplay").textContent     = "$" + total.toFixed(2);

  const bar = document.getElementById("urgencyBarWrap");
  bar.style.display = hasItems ? "flex" : "none";
  if (hasItems && !urgencyInterval) startUrgencyBar();
  if (!hasItems && urgencyInterval) { clearInterval(urgencyInterval); urgencyInterval = null; }

  document.getElementById("discountSection").style.display      = hasItems ? "block" : "none";
  document.getElementById("checkoutFormSection").style.display   = hasItems ? "block" : "none";
  document.getElementById("emptyCartMsg").style.display          = hasItems ? "none"  : "block";
  document.getElementById("checkoutEmptyMsg").style.display      = hasItems ? "none"  : "block";
  document.getElementById("socialProof").style.display           = hasItems ? "flex"  : "none";
}

/* ── SHOW EMPTY CART ────────────────────────────────────────── */
function showEmptyCart() {
  document.getElementById("cartBadge").textContent              = "0 items";
  document.getElementById("cartItemsContainer").innerHTML       = "";
  document.getElementById("emptyCartMsg").style.display         = "block";
  document.getElementById("discountSection").style.display      = "none";
  document.getElementById("checkoutFormSection").style.display  = "none";
  document.getElementById("checkoutEmptyMsg").style.display     = "block";
  document.getElementById("socialProof").style.display          = "none";
  document.getElementById("urgencyBarWrap").style.display        = "none";
  if (urgencyInterval) { clearInterval(urgencyInterval); urgencyInterval = null; }
  stopAllTriggers();
}

/* ── PRICE UI AFTER DISCOUNT ────────────────────────────────── */
function updatePriceUI() {
  document.getElementById("subtotalDisplay").innerHTML =
    `<span class="strike">$${originalTotal.toFixed(2)}</span>`;
  document.getElementById("totalDisplay").innerHTML =
    `<span class="new-price">$${total.toFixed(2)}</span>`;
}

/* ── APPLY DISCOUNT LOGIC (shared) ─────────────────────────── */
function applyDiscountLogic(source) {
  if (discountUsed) {
    document.getElementById("status").innerText = "Discount already applied";
    return;
  }
  const pct = 0.1;
  total = originalTotal * (1 - pct);
  discountUsed = true;
  _ss("discountUsed", "true");
  _ss("discountPct", String(pct));
  updatePriceUI();
  document.getElementById("status").innerText =
    source === "popup"
      ? "🎉 10% discount applied!"
      : "✅ Discount code applied successfully";
}

/* ── MANUAL PROMO CODE ENTRY ────────────────────────────────── */
/*
  Flow:
    - Popup fires → code generated → shown in popup with Copy button
    - User copies code, closes popup (code stays alive in activeDiscountCode)
    - User types code in promo field → clicks Apply → discount applied
    - If 5 minutes pass → codeExpired = true → "This code has expired"
    - If wrong code or no popup yet → "Invalid promo code"
    - Code is NEVER auto-applied from manual entry. User must click Apply.
*/
function applyDiscount() {
  const entered = document.getElementById("discount").value.trim().toUpperCase();

  if (!entered) {
    document.getElementById("status").innerText = "Please enter a promo code";
    return;
  }

  if (discountUsed) {
    document.getElementById("status").innerText = "Discount already applied";
    return;
  }

  if (codeExpired) {
    document.getElementById("status").innerText = "This code has expired";
    return;
  }

  if (activeDiscountCode && entered === activeDiscountCode) {
    applyDiscountLogic("manual");
    return;
  }

  document.getElementById("status").innerText = "Invalid promo code";
}

function autofillCode() {
  if (!activeDiscountCode) return;
  document.getElementById("discount").value = activeDiscountCode;
  applyDiscount();
}

/* ── POPUP DISCOUNT BUTTON ──────────────────────────────────── */
function applyPopupDiscount() {
  applyDiscountLogic("popup");
  stopOfferCountdown();
  closePopup();
}

/* ── FORM SUBMIT ────────────────────────────────────────────── */
document.getElementById("form").addEventListener("submit", function (e) {
  e.preventDefault();
  completePurchase("Purchase Successful! Check your email for confirmation.");
});

function completePurchase(msg) {
  const s = document.getElementById("success");
  s.style.display = "block";
  s.innerHTML = `<div class="success-icon">✅</div><div>${msg}</div>`;
  document.getElementById("checkoutFormSection").style.display = "none";
  const ghost = document.querySelector(".btn-ghost");
  if (ghost) ghost.style.display = "none";
  sessionStorage.removeItem("cartItems");
  sessionStorage.removeItem("cartTotal");
  sessionStorage.removeItem("cartCount");
  sessionStorage.removeItem("discountUsed");
  sessionStorage.removeItem("discountPct");
  sessionStorage.removeItem("activeDiscountCode");
  sessionStorage.removeItem("codeExpired");
  stopAllTriggers();
}

/* ── GUEST CHECKOUT ─────────────────────────────────────────── */
function guestCheckout() {
  completePurchase("Guest Purchase Successful! Your order is being processed.");
}

/* ── SHOW POPUP ─────────────────────────────────────────────── */
function showPopup(triggerType) {
  if (discountUsed || cartIsEmpty()) return;
  const popup = document.getElementById("popup");
  if (!popup.classList.contains("hidden")) return;

  const content = {
    exit:       { icon: "🚪", title: "Wait, leaving so soon?",      msg: "You have great items in your cart. Stay and get 10% off before you go." },
    tab:        { icon: "👀", title: "Still thinking it over?",      msg: "We noticed you stepped away. Your cart is saved — here is 10% off to come back." },
    scroll:     { icon: "🤔", title: "Not quite convinced?",         msg: "Here is an exclusive offer to seal the deal — 10% off, just for this session." },
    inactivity: { icon: "⏳", title: "Your cart is about to expire", msg: "Items in your cart are in high demand. Claim your discount before it is gone." }
  };

  const c = content[triggerType] || content.inactivity;
  document.getElementById("popupIcon").textContent  = c.icon;
  document.getElementById("popupTitle").textContent = c.title;
  document.getElementById("popupMsg").textContent   = c.msg;

  /* Generate a fresh code only if none exists yet.
     If the user already has a valid code (e.g. from the product page
     exit popup, or a previous popup on this page) we reuse it — this
     prevents a race condition where a new popup invalidates the code
     the user just copied. The code is also persisted to sessionStorage
     so it survives tab switches and page navigations. */
  if (!activeDiscountCode || codeExpired) {
    activeDiscountCode = generateDiscountCode();
    codeExpired = false;
    _ss("activeDiscountCode", activeDiscountCode);
    _ss("codeExpired", null);
  }

  const existing = document.getElementById("codeDisplay");
  if (existing) existing.remove();

  const box = document.createElement("div");
  box.id = "codeDisplay";
  box.innerHTML = `
    <div class="code-label">Your exclusive code (valid for 5 min), Please apply it now:</div>
    <div class="code-box">
      <span id="codeText">${activeDiscountCode}</span>
      <button class="btn-copy" onclick="copyCode()">Copy</button>
    </div>
    <div class="code-hint">Copy and enter this in the promo field, or click Claim below</div>
  `;
  popup.insertBefore(box, popup.querySelector(".countdown-wrap"));

  document.getElementById("overlay").classList.remove("hidden");
  popup.classList.remove("hidden");
  startOfferCountdown();
}

function copyCode() {
  if (!activeDiscountCode) return;
  navigator.clipboard.writeText(activeDiscountCode).then(() => {
    const btn = document.querySelector("#codeDisplay .btn-copy");
    if (btn) { btn.textContent = "Copied!"; setTimeout(() => btn.textContent = "Copy", 2000); }
  });
}

/* ── CLOSE POPUP ────────────────────────────────────────────── */
/*
  IMPORTANT: activeDiscountCode is NOT cleared here.
  The code stays alive so the user can close the popup, type the code
  they just copied into the promo field, and still apply it successfully.
  The code only becomes invalid when: it expires (codeExpired = true)
  or the user successfully applies it (discountUsed = true).
*/
function closePopup() {
  document.getElementById("popup").classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
  stopOfferCountdown();
  // Do NOT null activeDiscountCode here — intentional
}

/* ── OFFER COUNTDOWN (5 min) ────────────────────────────────── */
const OFFER_DURATION = 300;
let offerSeconds  = OFFER_DURATION;
let offerInterval = null;

function startOfferCountdown() {
  offerSeconds = OFFER_DURATION;
  updateOfferCd();
  offerInterval = setInterval(() => {
    offerSeconds--;
    if (offerSeconds <= 0) {
      stopOfferCountdown();
      /* Code has expired — only NOW do we invalidate it */
      codeExpired = true;
      activeDiscountCode = null;
      _ss("codeExpired", "true");
      _ss("activeDiscountCode", null);
      document.getElementById("cdMin").textContent = "00";
      document.getElementById("cdSec").textContent = "00";
      document.getElementById("offerBar").style.width = "0%";
      const cd = document.getElementById("codeDisplay");
      if (cd) cd.style.opacity = "0.4";
      const title = document.getElementById("popupTitle");
      if (title) title.textContent = "Offer Expired";
      const msg = document.getElementById("popupMsg");
      if (msg) msg.textContent = "This discount has expired. Complete your purchase at full price.";
      return;
    }
    updateOfferCd();
  }, 1000);
}

function updateOfferCd() {
  document.getElementById("cdMin").textContent = String(Math.floor(offerSeconds / 60)).padStart(2, "0");
  document.getElementById("cdSec").textContent = String(offerSeconds % 60).padStart(2, "0");
  document.getElementById("offerBar").style.width = ((offerSeconds / OFFER_DURATION) * 100) + "%";
}

function stopOfferCountdown() {
  if (offerInterval) { clearInterval(offerInterval); offerInterval = null; }
}

/* ── URGENCY BAR (20s idle) ─────────────────────────────────── */
const URGENCY_TOTAL = 20;
let urgencyLeft     = URGENCY_TOTAL;
let urgencyInterval = null;

function startUrgencyBar() {
  urgencyLeft = URGENCY_TOTAL;
  updateUrgencyBar();
  urgencyInterval = setInterval(() => {
    urgencyLeft--;
    updateUrgencyBar();
    if (urgencyLeft <= 0) {
      clearInterval(urgencyInterval); urgencyInterval = null;
      showPopup("inactivity");
    }
  }, 1000);
}

function resetUrgencyBar() {
  if (cartIsEmpty()) return;
  if (urgencyInterval) { clearInterval(urgencyInterval); urgencyInterval = null; }
  startUrgencyBar();
}

function updateUrgencyBar() {
  const pct = (urgencyLeft / URGENCY_TOTAL) * 100;
  document.getElementById("urgencyBar").style.width = pct + "%";
  const label = document.getElementById("urgencyLabel");
  if (urgencyLeft <= 5) {
    label.textContent = "Items in your cart are in high demand. Please purchase as soon as possible!";
    document.getElementById("urgencyBar").style.background = "linear-gradient(90deg,#ff4444,#ff6b6b)";
  } else if (urgencyLeft <= 10) {
    label.textContent = "Items in your cart are in high demand.";
  } else {
    label.textContent = "🛒 Your cart is reserved";
    document.getElementById("urgencyBar").style.background = "linear-gradient(90deg,#ff6b6b,#ffd93d)";
  }
}

["mousemove", "keydown", "click"].forEach(ev => document.addEventListener(ev, resetUrgencyBar));

/* ── TRIGGER 1: EXIT-INTENT ─────────────────────────────────── */
document.addEventListener("mouseleave", function handler() {
  showPopup("exit");
  document.removeEventListener("mouseleave", handler);
});

/* ── TRIGGER 2: TAB-SWITCH ──────────────────────────────────── */
document.addEventListener("visibilitychange", function handleVis() {
  if (document.visibilityState === "hidden") {
    showPopup("tab");
    startTitleFlicker();
    document.removeEventListener("visibilitychange", handleVis);
  } else {
    stopTitleFlicker();
  }
});

/* ── TRIGGER 3: SCROLL-AWAY ─────────────────────────────────── */
let maxScrollY = 0, scrollTriggered = false;
window.addEventListener("scroll", function () {
  const y = window.scrollY;
  if (y > maxScrollY) maxScrollY = y;
  if ((maxScrollY - y) > 80 && maxScrollY > 150 && !scrollTriggered) {
    scrollTriggered = true;
    showPopup("scroll");
  }
});

/* ── FEATURE 6: FORM ABANDONMENT NUDGE ─────────────────────── */
let formIdleTimer = null;

function onFormActivity() {
  clearTimeout(formIdleTimer);
  formIdleTimer = setTimeout(() => {
    if (!discountUsed && !cartIsEmpty()) {
      document.getElementById("formNudge").classList.remove("hidden");
    }
  }, 12000);
}

function closeFormNudge() {
  document.getElementById("formNudge").classList.add("hidden");
  clearTimeout(formIdleTimer);
}

["fieldName", "fieldEmail", "fieldAddress"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", onFormActivity);
});

const paySelect = document.querySelector("#checkoutCard select");
if (paySelect) paySelect.addEventListener("change", onFormActivity);

/* ── FEATURE 7: SOCIAL PROOF ────────────────────────────────── */
let viewerCount = 6;
function updateViewerCount() {
  viewerCount = Math.min(11, Math.max(3, viewerCount + Math.floor(Math.random() * 5) - 2));
  const el = document.getElementById("viewerCount");
  if (el) el.textContent = viewerCount;
}
function scheduleViewerUpdate() {
  setTimeout(() => { updateViewerCount(); scheduleViewerUpdate(); }, 6000 + Math.random() * 4000);
}

/* ── FEATURE 8: TITLE FLICKER ───────────────────────────────── */
const originalTitle = document.title;
let flickerInterval = null, flickerState = false;

function startTitleFlicker() {
  if (flickerInterval) return;
  flickerInterval = setInterval(() => {
    document.title = flickerState ? originalTitle : "🛒 Your cart is waiting...";
    flickerState = !flickerState;
  }, 2000);
}

function stopTitleFlicker() {
  if (flickerInterval) { clearInterval(flickerInterval); flickerInterval = null; }
  document.title = originalTitle;
  flickerState = false;
}

/* ── FEATURE 9: RAGE-CLICK ──────────────────────────────────── */
let clickTs = [], rageShown = false;
document.addEventListener("click", function () {
  const now = Date.now();
  clickTs.push(now);
  clickTs = clickTs.filter(t => now - t < 800);
  if (clickTs.length >= 3 && !rageShown) {
    rageShown = true;
    const t = document.getElementById("rageToast");
    if (t) { t.classList.remove("hidden"); setTimeout(() => t.classList.add("hidden"), 6000); }
  }
});
function closeRageToast() {
  const t = document.getElementById("rageToast");
  if (t) t.classList.add("hidden");
}

/* ── FEATURE 10: MICRO-COMMITMENT MODAL ────────────────────── */
function openMicroModal() {
  document.getElementById("popup").classList.add("hidden");
  stopOfferCountdown();
  document.getElementById("microModal").classList.remove("hidden");
  /* activeDiscountCode intentionally NOT cleared here either.
     User dismissed the popup but the code is still valid for entry. */
}

function closeMicroModal() {
  document.getElementById("microModal").classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
  /* Again: do NOT clear activeDiscountCode — it stays valid until expiry */
}

function saveCartEmail() {
  const email = document.getElementById("saveEmail").value.trim();
  if (!email || !email.includes("@")) {
    document.getElementById("saveEmail").style.borderColor = "#ff6b6b";
    document.getElementById("saveEmail").placeholder = "Please enter a valid email";
    return;
  }
  document.getElementById("microModalBox").innerHTML = `
    <div class="popup-icon">✅</div>
    <h3>Cart saved!</h3>
    <p>We will email <strong>${email}</strong> your cart and exclusive discount within a few minutes.</p>
    <button class="btn-primary" onclick="closeMicroModal()">Done</button>
  `;
}

/* ── STOP ALL TRIGGERS ──────────────────────────────────────── */
function stopAllTriggers() {
  if (urgencyInterval) { clearInterval(urgencyInterval); urgencyInterval = null; }
  if (formIdleTimer)   clearTimeout(formIdleTimer);
  stopOfferCountdown();
  stopTitleFlicker();
  const b = document.getElementById("urgencyBarWrap");
  if (b) b.style.display = "none";
  const s = document.getElementById("socialProof");
  if (s) s.style.display = "none";
  const f = document.getElementById("formNudge");
  if (f) f.classList.add("hidden");
  const r = document.getElementById("rageToast");
  if (r) r.classList.add("hidden");
}

/* ── INITIALISATION ─────────────────────────────────────────── */
window.addEventListener("load", function () {
  if (!cartIsEmpty()) {
    startUrgencyBar();
    scheduleViewerUpdate();
  }
});
