// ============================================================
// GRIT ブログ (blog.js)
// /blog.html(一覧)と /blog-post.html(記事)を1ファイルで処理。
// location.pathname で分岐する。
// ============================================================

import { getPosts, getPost } from "./store.js";
import { esc, nl2br, fmtDate, BASE } from "./common.js";

/* ---------- 共通パーツ ---------- */

const NAV_HTML = `
  <nav class="post__nav" aria-label="記事下ナビゲーション">
    <a class="btn btn--ghost" href="${BASE}blog.html">← ブログ一覧へ</a>
    <a class="btn btn--red" href="${BASE}shop/">SHOPを見る</a>
  </nav>`;

/** 本文冒頭の抜粋(改行・連続空白を潰して n 字+…) */
function excerpt(body, n = 80) {
  const t = String(body ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function emptyNoteHTML(en, jaHTML) {
  // en / jaHTML はこのファイル内の固定文言のみ(ユーザー由来テキストは渡さない)
  return `
    <div class="empty-note b-empty">
      <p class="b-empty__en">${esc(en)}</p>
      <p>${jaHTML}</p>
    </div>`;
}

/* ============================================================
   一覧ページ (/blog.html)
   ============================================================ */

function cardHTML(p) {
  const cover = p.coverImage
    ? `<img src="${esc(p.coverImage)}" alt="${esc(p.title)}" loading="lazy">`
    : `<div class="b-card__dummy bg-denim" aria-hidden="true">
         <span class="b-card__dummy-logo">GRIT</span>
         <span class="b-card__dummy-sub">Vintage &amp; Used</span>
       </div>`;
  return `
  <a class="b-card" href="${BASE}blog-post.html?id=${encodeURIComponent(p.id)}">
    <div class="b-card__img">${cover}</div>
    <div class="b-card__body">
      <p class="b-card__date">${esc(fmtDate(p.createdAt))}</p>
      <h2 class="b-card__title">${esc(p.title)}</h2>
      <p class="b-card__excerpt">${esc(excerpt(p.body))}</p>
      <span class="b-card__more">Read More</span>
    </div>
  </a>`;
}

async function initList() {
  const grid = document.getElementById("blog-grid");
  if (grid) grid.setAttribute("data-reveal", "stagger");
  if (!grid) return;

  let posts = [];
  let failed = false;
  try {
    posts = await getPosts();
  } catch {
    failed = true;
  }

  grid.removeAttribute("aria-busy");

  if (failed) {
    grid.innerHTML = emptyNoteHTML(
      "Load Error",
      "記事を読み込めませんでした。<br>通信状況をご確認のうえ、時間をおいてもう一度お試しください。"
    );
    return;
  }
  if (posts.length === 0) {
    grid.innerHTML = emptyNoteHTML(
      "Coming Soon",
      "まだ記事がありません。<br>入荷情報や読みものを、これから綴っていきます。"
    );
    return;
  }
  grid.innerHTML = posts.map(cardHTML).join("");
  window.dispatchEvent(new Event("grit:rendered"));
}

/* ============================================================
   記事ページ (/blog-post.html?id=xxx)
   ============================================================ */

function postHTML(p) {
  const cover = p.coverImage
    ? `<figure class="post__cover"><img src="${esc(p.coverImage)}" alt="${esc(p.title)}"></figure>`
    : "";
  return `
    <header class="post__head">
      <p class="post__eyebrow"><span class="red-tab">GRIT</span><span>Blog</span></p>
      <h1 class="post__title">${esc(p.title)}</h1>
      <p class="post__date">${esc(fmtDate(p.createdAt))}</p>
    </header>
    ${cover}
    <div class="post__body">${nl2br(esc(p.body))}</div>
    <footer class="post__foot">
      <div class="selvedge" aria-hidden="true"></div>
      ${NAV_HTML}
    </footer>`;
}

function missingHTML(failed) {
  const ja = failed ? "記事を読み込めませんでした" : "記事が見つかりませんでした";
  const note = failed
    ? "通信状況をご確認のうえ、時間をおいてもう一度お試しください。"
    : "記事が削除されたか、URLが間違っている可能性があります。";
  return `
    <div class="post-missing">
      <p class="post-missing__en">Not Found</p>
      <p class="post-missing__ja">${ja}</p>
      <p class="post-missing__note">${note}</p>
      ${NAV_HTML}
    </div>`;
}

async function initPost() {
  const root = document.getElementById("post-root");
  if (!root) return;

  const id = new URLSearchParams(location.search).get("id");
  let post = null;
  let failed = false;
  if (id) {
    try {
      post = await getPost(id);
    } catch {
      // 非公開記事はFirestoreルールでpermission-deniedになるため、ここに落ちる
      failed = true;
    }
  }

  root.removeAttribute("aria-busy");

  if (failed || !post || post.published === false) {
    document.title = "記事が見つかりません | GRIT";
    root.innerHTML = missingHTML(failed);
    return;
  }

  document.title = `${post.title} | GRIT`;
  root.innerHTML = postHTML(post);
}

/* ---------- 分岐 ---------- */

if (location.pathname.includes("blog-post")) {
  initPost();
} else {
  initList();
}
