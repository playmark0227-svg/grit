// ============================================================
// GRIT — ECトップ (shop.js)
// 商品一覧の描画 + カテゴリのクライアント側絞り込み
// データは store.js 経由。ユーザー由来テキストは必ず esc()。
// ============================================================

import { getProducts, CATEGORIES, isAvailable } from "./store.js";
import { esc, yen, shortSize, BASE } from "./common.js";

const grid = document.getElementById("product-grid");
const filterEl = document.getElementById("category-filter");
const countEl = document.getElementById("item-count");

const ALL = "ALL";
const SKELETON_COUNT = 6;
const EAGER_IMAGES = 4; // ファーストビュー分のみ eager、それ以降 lazy

let allProducts = [];
let activeCategory = ALL;

// 画像未設定の商品用プレースホルダ(生成り地 + ステッチ枠)
const NO_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600">` +
      `<rect width="480" height="600" fill="#b3ab99"/>` +
      `<rect x="14" y="14" width="452" height="572" fill="none" stroke="#96683c" stroke-width="1" opacity="0.3"/>` +
      `<text x="240" y="308" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" letter-spacing="6" fill="#6b6355" text-anchor="middle" opacity="0.7">NO IMAGE</text>` +
      `</svg>`
  );

buildFilter();
showSkeleton();
loadProducts();

/* ---------- カテゴリフィルタ ---------- */

function buildFilter() {
  const frag = document.createDocumentFragment();
  for (const cat of [ALL, ...CATEGORIES]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag" + (cat === activeCategory ? " tag--active" : "");
    btn.dataset.category = cat;
    btn.setAttribute("aria-pressed", String(cat === activeCategory));
    btn.textContent = cat;
    btn.addEventListener("click", () => setCategory(cat));
    frag.append(btn);
  }
  filterEl.append(frag);
}

function setCategory(cat) {
  if (cat === activeCategory) return;
  activeCategory = cat;
  filterEl.querySelectorAll(".tag").forEach((btn) => {
    const on = btn.dataset.category === cat;
    btn.classList.toggle("tag--active", on);
    btn.setAttribute("aria-pressed", String(on));
  });
  renderProducts();
}

/* ---------- 読み込み ---------- */

function showSkeleton() {
  countEl.textContent = "Loading";
  grid.innerHTML = Array.from(
    { length: SKELETON_COUNT },
    () => `<div class="skeleton skeleton-card" aria-hidden="true"></div>`
  ).join("");
}

async function loadProducts() {
  try {
    allProducts = await getProducts(); // 新着順(SOLD込み)
    renderProducts();
  } catch {
    countEl.textContent = "0 items";
    grid.innerHTML = `<p class="empty-note">読み込みに失敗しました。<br>時間をおいて再度お試しください。</p>`;
  }
}

/* ---------- 描画 ---------- */

function renderProducts() {
  const items =
    activeCategory === ALL
      ? allProducts
      : allProducts.filter((p) => p.category === activeCategory);

  countEl.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;

  if (items.length === 0) {
    grid.innerHTML =
      allProducts.length === 0
        ? `<p class="empty-note">アイテム準備中です</p>`
        : `<p class="empty-note">このカテゴリのアイテムはただいま準備中です</p>`;
    return;
  }

  grid.innerHTML = items.map(cardHTML).join("");
  window.dispatchEvent(new Event("grit:rendered"));
}

function cardHTML(p, index) {
  const sold = !isAvailable(p);
  const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : NO_IMAGE;
  const loading = index < EAGER_IMAGES ? "eager" : "lazy";
  return `
  <a class="p-card${sold ? " p-card--sold" : ""}" href="${BASE}shop/product.html?id=${encodeURIComponent(p.id)}">
    <div class="p-card__img"><img src="${esc(img)}" alt="${esc(p.name || "商品画像")}" loading="${loading}">
      <span class="p-card__sold"${sold ? "" : " hidden"}>SOLD</span></div>
    <div class="p-card__body">
      <p class="p-card__brand">${esc(p.brand || "no brand")}</p>
      <p class="p-card__name">${esc(p.name || "")}</p>
      <p class="p-card__meta"><span class="p-card__size">${p.size ? `size ${esc(shortSize(p.size))}` : ""}</span><span class="p-card__price">${yen(p.price)}</span></p>
    </div>
  </a>`;
}
