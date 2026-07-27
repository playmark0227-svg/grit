// ============================================================
// GRIT カート (cart-page.js)
// /shop/cart.html
// 描画時に getProduct で最新在庫を取り直し、
// 売り切れ(SOLD/reserved)は「売り切れました」表示のうえ自動でカートから外す。
// ============================================================

import { esc, yen, getCart, removeFromCart, toast, BASE } from "./common.js";
import { getProduct, isAvailable, createCheckout } from "./store.js";

const root = document.getElementById("cart-root");

function productHref(id) {
  return `${BASE}shop/product.html?id=${encodeURIComponent(id)}`;
}

/* ---------- 行テンプレート ---------- */

function itemRowHTML(p) {
  const img = Array.isArray(p.images) && typeof p.images[0] === "string" && p.images[0]
    ? p.images[0] : "";
  return `
    <li class="cart-item">
      <a class="cart-item__thumb" href="${productHref(p.id)}" tabindex="-1" aria-hidden="true">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}
      </a>
      <div class="cart-item__body">
        <p class="cart-item__brand">${esc(p.brand || "no brand")}</p>
        <a class="cart-item__name" href="${productHref(p.id)}">${esc(p.name)}</a>
        <p class="cart-item__price">${yen(p.price)}</p>
      </div>
      <button type="button" class="cart-item__remove" data-remove="${esc(p.id)}" aria-label="${esc(p.name)} をカートから削除">&times;</button>
    </li>`;
}

function goneRowHTML(entry) {
  const p = entry.product;
  const img = p && Array.isArray(p.images) && typeof p.images[0] === "string" && p.images[0]
    ? p.images[0] : "";
  return `
    <li class="cart-item cart-item--gone">
      <div class="cart-item__thumb">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}
      </div>
      <div class="cart-item__body">
        ${p && p.brand ? `<p class="cart-item__brand">${esc(p.brand)}</p>` : ""}
        <p class="cart-item__name">${esc(p ? p.name : "販売終了した商品")}</p>
        <p class="cart-item__soldnote">売り切れました</p>
      </div>
    </li>`;
}

/* ---------- 描画 ---------- */

function renderEmpty(goneRows = "") {
  root.innerHTML = `
    ${goneRows ? `<div class="stitch-box cart-box cart-box--gone"><ul class="cart-list">${goneRows}</ul></div>` : ""}
    <div class="empty-note cart-empty">
      <p class="cart-empty__en">Your Cart Is Empty</p>
      <p>カートに商品は入っていません。<br>一点物との出会いは一度きり。気になる一着を探しに行きましょう。</p>
    </div>
    <div class="cart-actions">
      <a class="btn btn--cream btn--lg" href="${BASE}shop/">SHOPを見る</a>
    </div>`;
}

function renderCart(live, gone) {
  const goneRows = gone.map(goneRowHTML).join("");
  if (!live.length) {
    renderEmpty(goneRows);
    return;
  }
  const total = live.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  root.innerHTML = `
    <div class="stitch-box cart-box">
      <ul class="cart-list">
        ${goneRows}
        ${live.map(itemRowHTML).join("")}
      </ul>
      <div class="cart-total">
        <span class="cart-total__label">合計(税込・${live.length}点)</span>
        <span class="cart-total__price">${yen(total)}</span>
      </div>
      <p class="cart-error" id="cart-error" role="alert" hidden></p>
      <button type="button" class="btn btn--red btn--lg btn--block" id="cart-checkout">レジへ進む(Stripe)</button>
      <p class="cart-note">決済はStripeの安全なページで行います。<br>全て一点物のため、お会計完了をもって売約となります。</p>
    </div>`;
}

function renderLoadError() {
  root.innerHTML = `
    <div class="empty-note cart-empty">
      <p class="cart-empty__en">Error</p>
      <p>カートの読み込みに失敗しました。<br>通信環境をご確認のうえ、もう一度お試しください。</p>
    </div>
    <div class="cart-actions">
      <button type="button" class="btn btn--cream btn--lg" id="cart-retry">再読み込み</button>
    </div>`;
  document.getElementById("cart-retry").addEventListener("click", load);
}

function showError(msg) {
  const el = document.getElementById("cart-error");
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    toast(msg);
  }
}

/* ---------- 決済 ---------- */

async function checkout(btn) {
  const ids = getCart();
  if (!ids.length) return;
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "お手続きの準備中…";
  try {
    const { url } = await createCheckout(ids);
    location.href = url;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = original;
    if (e && e.message === "DEMO") {
      toast("デモモードでは決済できません。SETUP.mdの手順で公開すると使えます");
      return;
    }
    // 売り切れ等のエラーメッセージはユーザーに見せる
    const msg = (e && e.message) || "決済ページへ進めませんでした。時間をおいてもう一度お試しください。";
    await load(); // 在庫状況を取り直す(売り切れをカートへ反映)
    showError(msg);
  }
}

/* ---------- 読み込み ---------- */

async function load() {
  const ids = getCart();
  if (!ids.length) {
    renderEmpty();
    return;
  }
  let entries;
  try {
    entries = await Promise.all(
      ids.map(async (id) => ({ id, product: await getProduct(id) }))
    );
  } catch (e) {
    console.error(e);
    renderLoadError();
    return;
  }
  const live = [];
  const gone = [];
  for (const entry of entries) {
    if (entry.product && isAvailable(entry.product)) {
      live.push(entry.product);
    } else {
      // 1点物: 売り切れ・販売終了は自動でカートから外す
      gone.push(entry);
      removeFromCart(entry.id);
    }
  }
  renderCart(live, gone);
  if (gone.length) toast("売り切れた商品をカートから外しました");
}

/* ---------- イベント(委譲) ---------- */

root.addEventListener("click", (e) => {
  const removeBtn = e.target.closest("[data-remove]");
  if (removeBtn) {
    removeFromCart(removeBtn.dataset.remove);
    toast("カートから削除しました");
    load();
    return;
  }
  const checkoutBtn = e.target.closest("#cart-checkout");
  if (checkoutBtn) checkout(checkoutBtn);
});

load();
