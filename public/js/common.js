// ============================================================
// GRIT 共通スクリプト
// ヘッダー/フッター注入・カート(localStorage)・共通ユーティリティ
// ============================================================

/* ---------- サイトのルートURL ----------
   GitHub Pages のようにサブディレクトリ配信されても正しく動くよう、
   このファイル(/js/common.js)の位置から逆算する。
   ローカル/Firebase では "/"、Pages では "/<リポジトリ名>/" になる。 */
export const BASE = new URL("../", import.meta.url).pathname;

/* ---------- utilities ---------- */

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function nl2br(s) {
  return String(s ?? "").split("\n").join("<br>");
}

const yenFmt = new Intl.NumberFormat("ja-JP");
export function yen(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `¥${yenFmt.format(v)}` : "¥-";
}

/**
 * 一覧カード用の短いサイズ表記。
 * 管理画面では「M(実寸 肩42 身幅50 着丈58)」のように実寸まで入力するので、
 * カードでは括弧の前("M")だけを出す。実寸は商品詳細ページで全文表示する。
 */
export function shortSize(size) {
  const s = String(size ?? "").trim();
  if (!s) return "";
  return s.split(/[(（]/)[0].trim() || s;
}

export function fmtDate(v) {
  if (!v) return "";
  let d;
  if (typeof v.toDate === "function") d = v.toDate();
  else if (typeof v.seconds === "number") d = new Date(v.seconds * 1000);
  else d = new Date(v);
  if (Number.isNaN(+d)) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/* ---------- cart (localStorage / 1点物なのでIDの集合) ---------- */

const CART_KEY = "grit_cart";

export function getCart() {
  try {
    const a = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveCart(ids) {
  localStorage.setItem(CART_KEY, JSON.stringify(ids));
  updateCartBadge();
}

export function addToCart(id) {
  const c = getCart();
  if (c.includes(id)) return false;
  c.push(id);
  saveCart(c);
  return true;
}

export function removeFromCart(id) {
  saveCart(getCart().filter((x) => x !== id));
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

export function cartCount() {
  return getCart().length;
}

export function updateCartBadge() {
  const el = document.querySelector("[data-cart-count]");
  if (!el) return;
  const n = cartCount();
  el.textContent = String(n);
  el.hidden = n === 0;
}

/* ---------- toast ---------- */

let toastEl = null;
let toastTimer = null;
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2800);
}

/* ---------- header / footer 注入 ---------- */

const CART_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 8h12l-1.2 12.2a1.5 1.5 0 0 1-1.5 1.3H8.7a1.5 1.5 0 0 1-1.5-1.3L6 8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></svg>`;

function headerHTML() {
  return `
  <header class="site-header">
    <div class="selvedge-strip" aria-hidden="true"></div>
    <div class="site-header__bar container">
      <a class="site-logo" href="${BASE}" aria-label="GRIT ホーム">
        <span class="site-logo__text">GRIT</span>
        <span class="red-tab">Vintage</span>
      </a>
      <nav class="site-nav" id="site-nav" aria-label="サイトメニュー">
        <a href="${BASE}" data-nav="home">Home</a>
        <a href="${BASE}shop/" data-nav="shop">Shop</a>
        <a href="${BASE}blog.html" data-nav="blog">Blog</a>
        <a href="${BASE}#info" data-nav="info">Info</a>
      </nav>
      <div class="site-header__right">
        <a class="cart-link" href="${BASE}shop/cart.html" aria-label="カートを見る">
          ${CART_SVG}
          <span class="cart-link__count" data-cart-count hidden>0</span>
        </a>
        <button class="nav-toggle" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="site-nav">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>`;
}

function footerHTML() {
  const y = new Date().getFullYear();
  return `
  <footer class="site-footer">
    <div class="selvedge-strip" aria-hidden="true"></div>
    <div class="container site-footer__inner">
      <div class="site-footer__top">
        <div class="site-footer__brand">
          <span class="site-logo__text">GRIT</span>
          <p class="site-footer__lead">一点物と、暮らす。<br>ヴィンテージ&古着 GRIT</p>
        </div>
        <nav class="site-footer__nav" aria-label="フッターメニュー">
          <a href="${BASE}">Home</a>
          <a href="${BASE}shop/">Shop</a>
          <a href="${BASE}blog.html">Blog</a>
          <a href="${BASE}#info">Info</a>
        </nav>
      </div>
      <p class="site-footer__copy">&copy; ${y} GRIT — Vintage &amp; Used Clothing</p>
    </div>
  </footer>`;
}

function injectChrome() {
  const headerSlot = document.getElementById("site-header");
  const footerSlot = document.getElementById("site-footer");
  if (headerSlot) headerSlot.outerHTML = headerHTML();
  if (footerSlot) footerSlot.outerHTML = footerHTML();

  // active nav
  const page = document.body.dataset.page;
  if (page) {
    document.querySelectorAll(`.site-nav a[data-nav="${page}"]`).forEach((a) => a.classList.add("is-active"));
  }

  // mobile toggle
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  updateCartBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectChrome);
} else {
  injectChrome();
}

// 他タブでカートが変わったら追従
window.addEventListener("storage", (e) => {
  if (e.key === CART_KEY) updateCartBadge();
});
