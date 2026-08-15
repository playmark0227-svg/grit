// ============================================================
// GRIT Instagram (instagram.js)
// トップページの Instagram セクションに、最新投稿を並べる。
//
// ブラウザから Instagram API は叩かない。アクセストークンを公開ページに
// 置けないため、GitHub Actions が定期的に取得して書き出した
// data/instagram.json を読むだけにしている。
// 仕組みと初期設定は INSTAGRAM.md を参照。
//
// 読み込めなかったときは何も表示しない(アカウントへの導線だけ残る)。
// 入荷情報が見えないより、崩れたセクションが出る方が困るため。
// ============================================================

import { esc, BASE } from "./common.js";

const FEED_URL = `${BASE}data/instagram.json`;
const MAX = 6; // CSSの列数(スマホ3列 / PC6列)にちょうど収まる枚数

const PLAY_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.6 6.2v11.6a.7.7 0 0 0 1.07.6l9.1-5.8a.7.7 0 0 0 0-1.18l-9.1-5.8a.7.7 0 0 0-1.07.58Z"/></svg>`;

/** https のURLだけ通す(万一おかしな値が混ざっても href に入れない) */
function safeUrl(u) {
  return /^https:\/\//i.test(String(u ?? "")) ? String(u) : "";
}

/** 画像パス。JSONには public/ からの相対パスが入るが、
    取得元を外部サービスに替えたときのために絶対URLも通す */
function imageSrc(src) {
  const s = String(src ?? "");
  return /^https:\/\//i.test(s) ? s : BASE + s;
}

/** 代替テキスト。キャプションの1行目だけを短く使う */
function label(caption) {
  const first = String(caption ?? "")
    .split("\n")
    .find((line) => line.trim());
  const s = (first || "").trim();
  if (!s) return "Instagramの投稿";
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

function cardHTML(post) {
  const badge =
    post.mediaType === "VIDEO"
      ? `<span class="insta-card__badge" aria-hidden="true">${PLAY_SVG}</span>`
      : "";
  return `
  <a class="insta-card" href="${esc(safeUrl(post.permalink))}" target="_blank" rel="noopener"
     aria-label="${esc(label(post.caption))}(Instagramで開く)">
    <img src="${esc(imageSrc(post.image))}" alt="" loading="lazy">
    ${badge}
  </a>`;
}

async function init() {
  const grid = document.getElementById("insta-grid");
  if (!grid) return;

  let posts = [];
  try {
    const res = await fetch(FEED_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    posts = Array.isArray(data?.posts) ? data.posts : [];
  } catch {
    return; // 未設定・取得失敗。セクションはボタンだけのまま
  }

  posts = posts.filter((p) => p && safeUrl(p.permalink) && p.image).slice(0, MAX);
  if (!posts.length) return;

  grid.innerHTML = posts.map(cardHTML).join("");
  grid.setAttribute("data-reveal", "stagger");
  grid.hidden = false;
  window.dispatchEvent(new Event("grit:rendered"));
}

init();
