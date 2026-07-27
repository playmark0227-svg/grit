// ============================================================
// GRIT 管理ページ (admin.js)
// watchAuth で 未ログイン / 権限なし / 管理UI を切り替え。
// 商品・ブログのCRUDはすべて store.js 経由。
// ============================================================

import {
  DEMO_MODE,
  CATEGORIES,
  watchAuth,
  signInWithGoogle,
  signOutUser,
  isAdmin,
  uploadImages,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getPosts,
  addPost,
  updatePost,
  deletePost,
  getOrders,
  setOrderFulfillment,
} from "./store.js";
import { esc, yen, fmtDate, toast } from "./common.js";

const $ = (id) => document.getElementById(id);

/* ============================================================
   小物ユーティリティ
   ============================================================ */

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

function hideError(el) {
  el.hidden = true;
  el.textContent = "";
}

function errMsg(e) {
  return e && e.message ? e.message : String(e);
}

/** ボタン連打防止(処理中はdisabled+ラベル差し替え) */
function setBusy(btn, busy, busyLabel) {
  if (busy) {
    btn.dataset.label = btn.textContent;
    if (busyLabel) btn.textContent = busyLabel;
    btn.disabled = true;
  } else {
    if (btn.dataset.label) btn.textContent = btn.dataset.label;
    btn.disabled = false;
  }
}

/** アップロード進捗「アップロード中 n/m」+バー(prefix: "p" | "b") */
function setProgress(prefix, done, total) {
  $(`${prefix}-progress`).hidden = false;
  $(`${prefix}-progress-text`).textContent = `アップロード中 ${done}/${total}`;
  $(`${prefix}-progress-bar`).style.width =
    total > 0 ? `${Math.round((done / total) * 100)}%` : "0%";
}

/** プレビューサムネ(削除ボタン付き)を container に追加 */
function appendThumb(container, src, label, onDelete) {
  const fig = document.createElement("figure");
  fig.className = "photo-thumb";

  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  fig.appendChild(img);

  if (label) {
    const tag = document.createElement("span");
    tag.className = "photo-thumb__cover";
    tag.textContent = label;
    fig.appendChild(tag);
  }

  const del = document.createElement("button");
  del.type = "button";
  del.className = "photo-thumb__del";
  del.setAttribute("aria-label", "この写真を削除");
  const mark = document.createElement("span");
  mark.textContent = "×";
  del.appendChild(mark);
  del.addEventListener("click", onDelete);
  fig.appendChild(del);

  container.appendChild(fig);
}

/* ============================================================
   認証状態でビューを切り替え
   ============================================================ */

if (DEMO_MODE) $("demo-banner").hidden = false;

const VIEWS = ["loading", "login", "denied", "admin"];
function showView(name) {
  VIEWS.forEach((v) => {
    $(`view-${v}`).hidden = v !== name;
  });
}

// URLのハッシュで開くタブを指定できる(例: /admin/#orders をホーム画面に追加すると注文一覧へ直行)
const HASH_TABS = { "#products": "products", "#posts": "posts", "#orders": "orders" };
const initialTab = HASH_TABS[location.hash] || "products";

watchAuth((user) => {
  const userBox = $("admin-user");
  if (user) {
    $("admin-user-email").textContent = user.email || "";
    userBox.hidden = false;
  } else {
    userBox.hidden = true;
  }

  if (!user) {
    showView("login");
  } else if (!isAdmin(user)) {
    $("denied-email").textContent = user.email || "不明";
    showView("denied");
  } else {
    showView("admin");
    refreshProducts();
    refreshPosts();
    if (initialTab !== "products") {
      selectTab(initialTab);
      if (initialTab === "orders") refreshOrders();
    }
  }
});

/* ---------- ログイン / サインアウト ---------- */

$("btn-login").addEventListener("click", async () => {
  const btn = $("btn-login");
  hideError($("login-error"));
  setBusy(btn, true, "ログイン中…");
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error(e);
    showError($("login-error"), "ログインできませんでした: " + errMsg(e));
  } finally {
    setBusy(btn, false);
  }
});

["btn-signout", "btn-denied-signout"].forEach((id) => {
  $(id).addEventListener("click", async () => {
    const btn = $(id);
    btn.disabled = true;
    try {
      await signOutUser();
    } catch (e) {
      console.error(e);
      toast("サインアウトに失敗しました");
    } finally {
      btn.disabled = false;
    }
  });
});

/* ---------- タブ切り替え ---------- */

function selectTab(name) {
  const map = {
    products: { tab: $("tab-products"), panel: $("panel-products") },
    posts: { tab: $("tab-posts"), panel: $("panel-posts") },
    orders: { tab: $("tab-orders"), panel: $("panel-orders") },
  };
  Object.entries(map).forEach(([key, { tab, panel }]) => {
    const active = key === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    panel.hidden = !active;
  });
}
$("tab-products").addEventListener("click", () => selectTab("products"));
$("tab-posts").addEventListener("click", () => selectTab("posts"));
$("tab-orders").addEventListener("click", () => {
  selectTab("orders");
  refreshOrders();
});

/* ============================================================
   商品タブ
   ============================================================ */

let products = [];
let editingProductId = null;
let productImages = [];   // 既存画像URL(編集時。個別削除可)
let productNewFiles = []; // { file, url } 追加アップロード予定

const productForm = $("product-form");

// カテゴリselectは CATEGORIES 定数から生成(ハードコード禁止)
CATEGORIES.forEach((c) => {
  const opt = document.createElement("option");
  opt.value = c;
  opt.textContent = c;
  $("p-category").appendChild(opt);
});

function renderProductPreviews() {
  const wrap = $("p-previews");
  wrap.textContent = "";
  productImages.forEach((url, i) => {
    appendThumb(wrap, url, i === 0 ? "カバー" : "", () => {
      productImages.splice(i, 1);
      renderProductPreviews();
    });
  });
  productNewFiles.forEach((item, i) => {
    appendThumb(
      wrap,
      item.url,
      productImages.length === 0 && i === 0 ? "カバー" : "",
      () => {
        URL.revokeObjectURL(item.url);
        productNewFiles.splice(i, 1);
        renderProductPreviews();
      }
    );
  });
}

function resetProductForm() {
  productForm.reset();
  editingProductId = null;
  productImages = [];
  productNewFiles.forEach((x) => URL.revokeObjectURL(x.url));
  productNewFiles = [];
  hideError($("p-error"));
  $("p-progress").hidden = true;
}

function openProductForm(p = null) {
  resetProductForm();
  if (p) {
    editingProductId = p.id;
    productImages = Array.isArray(p.images) ? [...p.images] : [];
    $("p-name").value = p.name || "";
    $("p-brand").value = p.brand || "";
    $("p-price").value = p.price ?? "";
    $("p-size").value = p.size || "";
    $("p-category").value = CATEGORIES.includes(p.category) ? p.category : CATEGORIES[0];
    $("p-condition").value = p.condition || "";
    $("p-desc").value = p.description || "";
    $("product-form-title").textContent = "商品を編集";
  } else {
    $("product-form-title").textContent = "新規商品";
  }
  renderProductPreviews();
  productForm.hidden = false;
  $("btn-new-product").hidden = true;
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeProductForm() {
  resetProductForm();
  renderProductPreviews();
  productForm.hidden = true;
  $("btn-new-product").hidden = false;
}

$("btn-new-product").addEventListener("click", () => openProductForm());
$("p-cancel").addEventListener("click", closeProductForm);

$("p-images").addEventListener("change", (e) => {
  Array.from(e.target.files || []).forEach((f) => {
    productNewFiles.push({ file: f, url: URL.createObjectURL(f) });
  });
  e.target.value = ""; // 同じファイルを選び直せるように
  renderProductPreviews();
});

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("p-error");
  hideError(errEl);

  const name = $("p-name").value.trim();
  const priceRaw = $("p-price").value.trim();
  const price = Number(priceRaw);
  if (!name) {
    showError(errEl, "商品名を入力してください");
    $("p-name").focus();
    return;
  }
  if (priceRaw === "" || !Number.isFinite(price) || price < 0) {
    showError(errEl, "価格を正しく入力してください(半角数字)");
    $("p-price").focus();
    return;
  }

  const submitBtn = $("p-submit");
  setBusy(submitBtn, true, "保存中…");
  $("p-cancel").disabled = true;
  try {
    let uploaded = [];
    if (productNewFiles.length > 0) {
      setProgress("p", 0, productNewFiles.length);
      uploaded = await uploadImages(
        productNewFiles.map((x) => x.file),
        (done, total) => setProgress("p", done, total)
      );
    }
    const data = {
      name,
      brand: $("p-brand").value.trim() || "no brand",
      price,
      size: $("p-size").value.trim(),
      category: $("p-category").value,
      condition: $("p-condition").value.trim(),
      description: $("p-desc").value.replace(/\r\n/g, "\n").trim(),
      images: [...productImages, ...uploaded],
    };
    if (editingProductId) {
      await updateProduct(editingProductId, data);
      toast("商品を更新しました");
    } else {
      await addProduct(data);
      toast("商品を登録しました");
    }
    closeProductForm();
    await refreshProducts();
  } catch (err) {
    console.error(err);
    showError(errEl, "保存に失敗しました: " + errMsg(err));
  } finally {
    setBusy(submitBtn, false);
    $("p-cancel").disabled = false;
    $("p-progress").hidden = true;
  }
});

function productStatusBadge(p) {
  if (p.status === "sold") return '<span class="status-badge status-badge--sold">SOLD</span>';
  if (p.status === "reserved") return '<span class="status-badge status-badge--rsv">予約中</span>';
  return '<span class="status-badge status-badge--ok">販売中</span>';
}

async function refreshProducts() {
  const list = $("product-list");
  const errEl = $("product-list-error");
  hideError(errEl);
  if (!list.hasChildNodes()) {
    list.innerHTML = '<p class="admin-list__loading">読み込み中…</p>';
  }
  try {
    products = await getProducts();
  } catch (e) {
    console.error(e);
    list.textContent = "";
    showError(errEl, "商品一覧を読み込めませんでした: " + errMsg(e));
    return;
  }
  $("product-count").textContent = `全${products.length}件`;
  if (products.length === 0) {
    list.innerHTML =
      '<p class="empty-note">商品がまだありません。<br>「+ 新規商品」から登録してください。</p>';
    return;
  }
  list.innerHTML = products
    .map((p) => {
      const img =
        Array.isArray(p.images) && p.images[0]
          ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">`
          : '<span class="admin-item__noimg">NO PHOTO</span>';
      const toggleLabel = p.status === "available" ? "SOLDにする" : "販売中に戻す";
      return `
      <article class="admin-item">
        <div class="admin-item__thumb">${img}</div>
        <div class="admin-item__info">
          <p class="admin-item__name">${esc(p.name)}</p>
          <p class="admin-item__meta">${esc(p.brand || "no brand")} / ${yen(p.price)}</p>
          <p class="admin-item__badges">${productStatusBadge(p)}</p>
        </div>
        <div class="admin-item__actions">
          <button type="button" class="a-btn" data-act="edit" data-id="${esc(p.id)}">編集</button>
          <button type="button" class="a-btn" data-act="toggle" data-id="${esc(p.id)}">${toggleLabel}</button>
          <button type="button" class="a-btn a-btn--danger" data-act="delete" data-id="${esc(p.id)}">削除</button>
        </div>
      </article>`;
    })
    .join("");
}

$("product-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const p = products.find((x) => x.id === btn.dataset.id);
  if (!p) return;
  const errEl = $("product-list-error");
  hideError(errEl);

  if (btn.dataset.act === "edit") {
    openProductForm(p);
    return;
  }

  if (btn.dataset.act === "toggle") {
    btn.disabled = true;
    try {
      if (p.status === "available") {
        await updateProduct(p.id, { status: "sold" });
        toast("SOLDにしました");
      } else {
        await updateProduct(p.id, { status: "available", reservedUntil: null });
        toast("販売中に戻しました");
      }
      await refreshProducts();
    } catch (err) {
      console.error(err);
      showError(errEl, "更新に失敗しました: " + errMsg(err));
      btn.disabled = false;
    }
    return;
  }

  if (btn.dataset.act === "delete") {
    if (!window.confirm(`「${p.name}」を削除します。よろしいですか?\nこの操作は取り消せません。`)) return;
    btn.disabled = true;
    try {
      await deleteProduct(p.id);
      toast("商品を削除しました");
      if (editingProductId === p.id) closeProductForm();
      await refreshProducts();
    } catch (err) {
      console.error(err);
      showError(errEl, "削除に失敗しました: " + errMsg(err));
      btn.disabled = false;
    }
  }
});

/* ============================================================
   ブログタブ
   ============================================================ */

let posts = [];
let editingPostId = null;
let postCoverUrl = null; // 既存カバーURL(削除可)
let postNewCover = null; // { file, url } 新しく選んだカバー

const postForm = $("post-form");

function renderCoverPreview() {
  const wrap = $("b-cover-preview");
  wrap.textContent = "";
  const src = postNewCover ? postNewCover.url : postCoverUrl;
  if (!src) return;
  appendThumb(wrap, src, "カバー", () => {
    if (postNewCover) {
      URL.revokeObjectURL(postNewCover.url);
      postNewCover = null;
    } else {
      postCoverUrl = null;
    }
    renderCoverPreview();
  });
}

function resetPostForm() {
  postForm.reset();
  editingPostId = null;
  postCoverUrl = null;
  if (postNewCover) {
    URL.revokeObjectURL(postNewCover.url);
    postNewCover = null;
  }
  hideError($("b-error"));
  $("b-progress").hidden = true;
}

function openPostForm(p = null) {
  resetPostForm();
  if (p) {
    editingPostId = p.id;
    postCoverUrl = p.coverImage || null;
    $("b-title").value = p.title || "";
    $("b-body").value = p.body || "";
    $("b-published").checked = !!p.published;
    $("post-form-title").textContent = "記事を編集";
  } else {
    $("b-published").checked = true;
    $("post-form-title").textContent = "新規記事";
  }
  renderCoverPreview();
  postForm.hidden = false;
  $("btn-new-post").hidden = true;
  postForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closePostForm() {
  resetPostForm();
  renderCoverPreview();
  postForm.hidden = true;
  $("btn-new-post").hidden = false;
}

$("btn-new-post").addEventListener("click", () => openPostForm());
$("b-cancel").addEventListener("click", closePostForm);

$("b-cover").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) {
    if (postNewCover) URL.revokeObjectURL(postNewCover.url);
    postNewCover = { file: f, url: URL.createObjectURL(f) };
    renderCoverPreview();
  }
  e.target.value = "";
});

postForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("b-error");
  hideError(errEl);

  const title = $("b-title").value.trim();
  const body = $("b-body").value.replace(/\r\n/g, "\n").trim();
  if (!title) {
    showError(errEl, "タイトルを入力してください");
    $("b-title").focus();
    return;
  }
  if (!body) {
    showError(errEl, "本文を入力してください");
    $("b-body").focus();
    return;
  }

  const submitBtn = $("b-submit");
  setBusy(submitBtn, true, "保存中…");
  $("b-cancel").disabled = true;
  try {
    let cover = postCoverUrl;
    if (postNewCover) {
      setProgress("b", 0, 1);
      const urls = await uploadImages([postNewCover.file], (done, total) =>
        setProgress("b", done, total)
      );
      cover = urls[0] || null;
    }
    const data = {
      title,
      body,
      coverImage: cover || null,
      published: $("b-published").checked,
    };
    if (editingPostId) {
      await updatePost(editingPostId, data);
      toast("記事を更新しました");
    } else {
      await addPost(data);
      toast("記事を投稿しました");
    }
    closePostForm();
    await refreshPosts();
  } catch (err) {
    console.error(err);
    showError(errEl, "保存に失敗しました: " + errMsg(err));
  } finally {
    setBusy(submitBtn, false);
    $("b-cancel").disabled = false;
    $("b-progress").hidden = true;
  }
});

async function refreshPosts() {
  const list = $("post-list");
  const errEl = $("post-list-error");
  hideError(errEl);
  if (!list.hasChildNodes()) {
    list.innerHTML = '<p class="admin-list__loading">読み込み中…</p>';
  }
  try {
    posts = await getPosts({ publishedOnly: false });
  } catch (e) {
    console.error(e);
    list.textContent = "";
    showError(errEl, "記事一覧を読み込めませんでした: " + errMsg(e));
    return;
  }
  $("post-count").textContent = `全${posts.length}件`;
  if (posts.length === 0) {
    list.innerHTML =
      '<p class="empty-note">記事がまだありません。<br>「+ 新規記事」から投稿してください。</p>';
    return;
  }
  list.innerHTML = posts
    .map((p) => {
      const img = p.coverImage
        ? `<img src="${esc(p.coverImage)}" alt="${esc(p.title)}" loading="lazy">`
        : '<span class="admin-item__noimg">NO IMAGE</span>';
      const badge = p.published
        ? '<span class="status-badge status-badge--ok">公開</span>'
        : '<span class="status-badge status-badge--off">非公開</span>';
      const toggleLabel = p.published ? "非公開にする" : "公開する";
      return `
      <article class="admin-item">
        <div class="admin-item__thumb">${img}</div>
        <div class="admin-item__info">
          <p class="admin-item__name">${esc(p.title)}</p>
          <p class="admin-item__meta">${esc(fmtDate(p.createdAt))}</p>
          <p class="admin-item__badges">${badge}</p>
        </div>
        <div class="admin-item__actions">
          <button type="button" class="a-btn" data-act="edit" data-id="${esc(p.id)}">編集</button>
          <button type="button" class="a-btn" data-act="toggle" data-id="${esc(p.id)}">${toggleLabel}</button>
          <button type="button" class="a-btn a-btn--danger" data-act="delete" data-id="${esc(p.id)}">削除</button>
        </div>
      </article>`;
    })
    .join("");
}

$("post-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const p = posts.find((x) => x.id === btn.dataset.id);
  if (!p) return;
  const errEl = $("post-list-error");
  hideError(errEl);

  if (btn.dataset.act === "edit") {
    openPostForm(p);
    return;
  }

  if (btn.dataset.act === "toggle") {
    btn.disabled = true;
    try {
      await updatePost(p.id, { published: !p.published });
      toast(p.published ? "非公開にしました" : "公開しました");
      await refreshPosts();
    } catch (err) {
      console.error(err);
      showError(errEl, "更新に失敗しました: " + errMsg(err));
      btn.disabled = false;
    }
    return;
  }

  if (btn.dataset.act === "delete") {
    if (!window.confirm(`記事「${p.title}」を削除します。よろしいですか?\nこの操作は取り消せません。`)) return;
    btn.disabled = true;
    try {
      await deletePost(p.id);
      toast("記事を削除しました");
      if (editingPostId === p.id) closePostForm();
      await refreshPosts();
    } catch (err) {
      console.error(err);
      showError(errEl, "削除に失敗しました: " + errMsg(err));
      btn.disabled = false;
    }
  }
});

/* ============================================================
   注文タブ(閲覧 + 発送済みチェックのみ)
   注文はStripeの決済完了時にCloud Functionsが作成する。
   この画面から作成・削除はできない(ルールでも禁止)。
   ============================================================ */

let orders = [];

async function refreshOrders() {
  const list = $("order-list");
  const errEl = $("order-list-error");
  hideError(errEl);
  if (!list.hasChildNodes()) {
    list.innerHTML = '<p class="admin-list__loading">読み込み中…</p>';
  }
  try {
    orders = await getOrders();
  } catch (e) {
    console.error(e);
    list.textContent = "";
    showError(errEl, "注文一覧を読み込めませんでした: " + errMsg(e));
    return;
  }
  const unshipped = orders.filter((o) => o.fulfillment !== "shipped").length;
  $("order-count").textContent = `全${orders.length}件 / 未発送${unshipped}件`;
  if (orders.length === 0) {
    list.innerHTML =
      '<p class="empty-note">注文はまだありません。<br>お客様のお支払いが完了すると、ここに自動で表示されます。</p>';
    return;
  }
  list.innerHTML = orders.map(orderCardHTML).join("");
}

function orderCardHTML(o) {
  const shipped = o.fulfillment === "shipped";
  const itemRows = (Array.isArray(o.items) ? o.items : [])
    .map(
      (it) =>
        `<li><span class="order-item__name">${esc(it.name || "(名称なし)")}</span><span class="order-item__price">${yen(it.price)}</span></li>`
    )
    .join("");
  const fee = Number(o.shippingFee) || 0;
  return `
  <article class="admin-item order-card${shipped ? " is-shipped" : ""}">
    <div class="order-card__head">
      <p class="order-card__date">${esc(fmtDate(o.createdAt))}</p>
      ${
        shipped
          ? '<span class="status-badge status-badge--ok">発送済み</span>'
          : '<span class="status-badge status-badge--rsv">未発送</span>'
      }
    </div>
    <ul class="order-items">${itemRows}</ul>
    <p class="order-card__total">
      <span>お支払い合計</span>
      <strong>${yen(o.amount)}</strong>
      ${fee > 0 ? `<small>(送料 ${yen(fee)} 込)</small>` : ""}
    </p>
    <dl class="order-ship">
      <div><dt>お名前</dt><dd>${esc(o.shippingName || "-")}</dd></div>
      <div><dt>住所</dt><dd>${esc(o.shippingAddressText || "-")}</dd></div>
      <div><dt>電話</dt><dd>${esc(o.shippingPhone || "-")}</dd></div>
      <div><dt>メール</dt><dd>${esc(o.customerEmail || "-")}</dd></div>
    </dl>
    <div class="admin-item__actions">
      <button type="button" class="a-btn" data-act="copy" data-id="${esc(o.id)}">宛先をコピー</button>
      <button type="button" class="a-btn" data-act="ship" data-id="${esc(o.id)}">${shipped ? "未発送に戻す" : "発送済みにする"}</button>
    </div>
  </article>`;
}

$("btn-reload-orders").addEventListener("click", refreshOrders);

$("order-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const o = orders.find((x) => x.id === btn.dataset.id);
  if (!o) return;
  const errEl = $("order-list-error");
  hideError(errEl);

  if (btn.dataset.act === "copy") {
    const text = [o.shippingName, o.shippingAddressText, o.shippingPhone]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("宛先をコピーしました");
    } catch {
      showError(errEl, "コピーできませんでした。表示されている宛先を手で選択してコピーしてください。");
    }
    return;
  }

  if (btn.dataset.act === "ship") {
    btn.disabled = true;
    try {
      await setOrderFulfillment(o.id, o.fulfillment === "shipped" ? "unshipped" : "shipped");
      toast(o.fulfillment === "shipped" ? "未発送に戻しました" : "発送済みにしました");
      await refreshOrders();
    } catch (err) {
      console.error(err);
      showError(errEl, "更新に失敗しました: " + errMsg(err));
      btn.disabled = false;
    }
  }
});
