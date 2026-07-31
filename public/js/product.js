// ============================================================
// GRIT 商品詳細 (product.js)
// /shop/product.html?id=xxx
// ============================================================

import { esc, nl2br, yen, getCart, addToCart, toast, BASE } from "./common.js";
import { getProduct, isAvailable } from "./store.js";

const root = document.getElementById("product-root");
const productId = new URLSearchParams(location.search).get("id");

/* ---------- 見つからない / 読み込み失敗 ---------- */

function renderNotFound() {
  root.innerHTML = `
    <div class="pd-missing">
      <div class="empty-note">
        <p class="pd-missing__en">Item Not Found</p>
        <p>お探しの商品が見つかりませんでした。<br>すでに販売を終了した可能性があります。</p>
      </div>
      <div class="pd-missing__actions">
        <a class="btn btn--cream btn--lg" href="${BASE}shop/">SHOPへ戻る</a>
      </div>
    </div>`;
}

function renderLoadError() {
  root.innerHTML = `
    <div class="pd-missing">
      <div class="empty-note">
        <p class="pd-missing__en">Error</p>
        <p>商品の読み込みに失敗しました。<br>通信環境をご確認のうえ、もう一度お試しください。</p>
      </div>
      <div class="pd-missing__actions">
        <button type="button" class="btn btn--cream btn--lg" id="pd-retry">再読み込み</button>
      </div>
    </div>`;
  document.getElementById("pd-retry").addEventListener("click", load);
}

/* ---------- カート導線(追加済み/売り切れで出し分け) ---------- */

function renderCta(p, available) {
  const cta = document.getElementById("pd-cta");
  if (!cta) return;

  if (!available) {
    cta.innerHTML = `
      <button type="button" class="btn btn--lg btn--block" disabled>Sold Out</button>
      <p class="pd-cta__note">この商品は売り切れました。またのご縁をお待ちしています。</p>`;
    return;
  }

  if (getCart().includes(p.id)) {
    cta.innerHTML = `
      <p class="pd-incart"><span class="pd-incart__mark" aria-hidden="true">✓</span>カートに入っています</p>
      <a class="btn btn--lg btn--block" href="${BASE}shop/cart.html">カートへ進む</a>`;
    return;
  }

  cta.innerHTML = `
    <button type="button" class="btn btn--red btn--lg btn--block" id="pd-add">カートに入れる</button>
    <p class="pd-cta__note">全て一点物のため、在庫は1点のみです。</p>`;
  document.getElementById("pd-add").addEventListener("click", () => {
    addToCart(p.id);
    toast("カートに入れました");
    renderCta(p, available);
  });
}

/* ---------- 商品表示 ---------- */

function renderProduct(p) {
  const images = (Array.isArray(p.images) ? p.images : [])
    .filter((u) => typeof u === "string" && u);
  const available = isAvailable(p);

  document.title = `${p.name} | Grit.`;

  const mainMedia = images.length
    ? `<img id="pd-main-img" src="${esc(images[0])}" alt="${esc(p.name)}">`
    : `<span class="pd-noimg">No Image</span>`;

  const thumbs = images.length > 1
    ? `<div class="pd-thumbs" role="group" aria-label="商品画像を切り替え">
        ${images.map((u, i) => `
          <button type="button" class="pd-thumb${i === 0 ? " is-active" : ""}" data-index="${i}" aria-label="${i + 1}枚目の画像を表示">
            <img src="${esc(u)}" alt="" loading="lazy">
          </button>`).join("")}
      </div>`
    : "";

  const tags = [
    p.category ? `<span class="tag tag--dark">${esc(p.category)}</span>` : "",
    p.size ? `<span class="tag tag--dark">SIZE / ${esc(p.size)}</span>` : "",
    p.condition ? `<span class="tag tag--dark">状態 / ${esc(p.condition)}</span>` : "",
  ].join("");

  root.innerHTML = `
    <article class="stitch-box pd-box">
      <div class="pd-layout">
        <div class="pd-gallery">
          <div class="pd-gallery__main${available ? "" : " is-sold"}">
            ${mainMedia}
            ${available ? "" : `<span class="badge-sold pd-gallery__sold">Sold Out</span>`}
          </div>
          ${thumbs}
        </div>
        <div class="pd-info">
          <p class="pd-brand">${esc(p.brand || "no brand")}</p>
          <h1 class="pd-name">${esc(p.name)}</h1>
          <p class="pd-price">${yen(p.price)}<span class="pd-price__tax">税込</span></p>
          <div class="pd-tags">${tags}</div>
          <div class="pd-cta" id="pd-cta"></div>
          <section class="pd-desc">
            <h2 class="pd-desc__head">Item Note</h2>
            <p class="pd-desc__body">${nl2br(esc(p.description || ""))}</p>
          </section>
        </div>
      </div>
    </article>`;

  // サムネイルクリックでメイン画像を切り替え
  if (images.length > 1) {
    const mainImg = document.getElementById("pd-main-img");
    const thumbBtns = Array.from(root.querySelectorAll(".pd-thumb"));
    thumbBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.index);
        if (mainImg && images[i]) mainImg.src = images[i];
        thumbBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });
  }

  renderCta(p, available);
  window.dispatchEvent(new Event("grit:rendered"));
}

/* ---------- 起動 ---------- */

async function load() {
  if (!productId) {
    renderNotFound();
    return;
  }
  try {
    const p = await getProduct(productId);
    if (!p) renderNotFound();
    else renderProduct(p);
  } catch (e) {
    console.error(e);
    renderLoadError();
  }
}

load();
