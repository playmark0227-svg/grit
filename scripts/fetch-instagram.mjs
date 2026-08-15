#!/usr/bin/env node
// ============================================================
// Instagram の最新投稿を取り込むスクリプト
//
//   node scripts/fetch-instagram.mjs
//     → public/data/instagram.json と public/assets/instagram/*.jpg を書き出す
//   node scripts/fetch-instagram.mjs --refresh-token
//     → 長期トークンを延長し、新しいトークンだけを標準出力に出す
//
// 必要な環境変数: IG_ACCESS_TOKEN(Instagram の長期アクセストークン)
// GitHub Actions から呼ばれる想定。手順は INSTAGRAM.md を参照。
//
// 方針:
//  ・画像は Instagram の CDN URL をそのまま使わず、必ず手元に落とす。
//    CDN URL は時間が経つと失効し、サイト側で画像切れになるため。
//  ・トークンはログに絶対出さない(公開リポジトリのログは誰でも読める)。
//  ・投稿が取れなくてもサイトは壊さない。空の JSON を書いて終わる。
// ============================================================

import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = path.join(ROOT, "public", "data", "instagram.json");
const IMG_DIR = path.join(ROOT, "public", "assets", "instagram");
const IMG_HREF = "assets/instagram"; // public/ から見た相対パス(JSONに入れる値)

const TOKEN = (process.env.IG_ACCESS_TOKEN || "").trim();
const COUNT = Number(process.env.IG_COUNT || 6);
const API_VERSION = process.env.IG_API_VERSION || "v23.0";
const CAPTION_MAX = 200; // 代替テキストにしか使わないので短く切る

const FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
  "children{media_type,media_url,thumbnail_url}",
].join(",");

/* ---------- ログ(トークンを必ず伏せる) ---------- */

function scrub(text) {
  const s = String(text ?? "");
  return TOKEN ? s.split(TOKEN).join("<TOKEN>") : s;
}

const log = (msg) => process.stderr.write(`${scrub(msg)}\n`);

/* ---------- API ---------- */

async function getJSON(url) {
  const res = await fetch(url);
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`APIの応答を解釈できませんでした (HTTP ${res.status})`);
  }
  if (!res.ok || body?.error) {
    const e = body?.error || {};
    throw new Error(
      `Instagram API エラー (HTTP ${res.status}): ${e.message || "不明"}` +
        (e.code ? ` [code ${e.code}]` : "")
    );
  }
  return body;
}

/** バージョン付きで叩き、そのバージョンが無ければバージョン無しで叩き直す */
async function callGraph(pathname, params) {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN });
  try {
    return await getJSON(`https://graph.instagram.com/${API_VERSION}/${pathname}?${qs}`);
  } catch (err) {
    if (!/Unsupported|unknown path|version/i.test(err.message)) throw err;
    log(`※ APIバージョン ${API_VERSION} が使えないため、バージョン指定なしで再試行します`);
    return await getJSON(`https://graph.instagram.com/${pathname}?${qs}`);
  }
}

/* ---------- 投稿1件から表示用の画像URLを選ぶ ---------- */

function pickImage(media) {
  // 動画・リールはサムネイル。静止画は本体。
  if (media.media_type === "VIDEO") return media.thumbnail_url || media.media_url || null;
  if (media.media_url) return media.media_url;
  // 複数枚投稿(カルーセル)で media_url が返らないことがあるので1枚目で代用する
  const first = media.children?.data?.[0];
  if (!first) return null;
  return first.media_type === "VIDEO"
    ? first.thumbnail_url || first.media_url || null
    : first.media_url || null;
}

const EXT_BY_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function download(url, id) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`画像を取得できませんでした (HTTP ${res.status})`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  const ext = EXT_BY_TYPE[type] || ".jpg";
  const name = `${String(id).replace(/[^0-9A-Za-z_-]/g, "")}${ext}`;
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(IMG_DIR, name), buf);
  return { href: `${IMG_HREF}/${name}`, bytes: buf.length };
}

/* ---------- 書き出し ---------- */

async function writeFeed(posts) {
  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  const data = {
    updatedAt: new Date().toISOString(),
    posts,
  };
  await writeFile(OUT_JSON, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/* ============================================================
   トークン延長モード
   長期トークン(60日)は、24時間以上経っていれば何度でも延長できる。
   定期実行のたびに延長するので、運用が続くかぎり期限切れにならない。
   ============================================================ */

async function refreshToken() {
  if (!TOKEN) {
    log("IG_ACCESS_TOKEN が設定されていません。");
    process.exit(1);
  }
  const qs = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: TOKEN });
  const body = await getJSON(`https://graph.instagram.com/refresh_access_token?${qs}`);
  if (!body?.access_token) throw new Error("延長後のトークンが返りませんでした");
  const days = Math.round(Number(body.expires_in || 0) / 86400);
  log(`トークンを延長しました(あと約 ${days} 日)`);
  process.stdout.write(body.access_token); // 呼び出し側が拾えるよう、これだけを stdout に出す
}

/* ============================================================
   取得モード
   ============================================================ */

async function fetchFeed() {
  if (!TOKEN) {
    // 未設定はエラーにしない。設定前でもサイトのデプロイは通す。
    log("IG_ACCESS_TOKEN が未設定のため、Instagram欄は空のまま公開します。");
    log("設定手順は INSTAGRAM.md を参照してください。");
    await writeFeed([]);
    return;
  }

  const res = await callGraph("me/media", { fields: FIELDS, limit: String(COUNT * 2) });
  const media = Array.isArray(res?.data) ? res.data : [];
  log(`投稿を ${media.length} 件受け取りました`);

  // 画像を入れ直すので、いったん空にする(消えた投稿の画像を残さない)
  await rm(IMG_DIR, { recursive: true, force: true });
  await mkdir(IMG_DIR, { recursive: true });

  const posts = [];
  for (const m of media) {
    if (posts.length >= COUNT) break;
    const src = pickImage(m);
    if (!src || !m.permalink) {
      log(`- ${m.id}: 表示できる画像が無いため飛ばします`);
      continue;
    }
    try {
      const { href, bytes } = await download(src, m.id);
      posts.push({
        id: String(m.id),
        permalink: m.permalink,
        mediaType: m.media_type || "IMAGE",
        caption: String(m.caption || "").slice(0, CAPTION_MAX),
        timestamp: m.timestamp || null,
        image: href,
      });
      log(`- ${m.id}: ${href} (${Math.round(bytes / 1024)}KB)`);
    } catch (err) {
      log(`- ${m.id}: ${err.message}`);
    }
  }

  if (!posts.length) throw new Error("表示できる投稿が1件もありませんでした");

  await writeFeed(posts);
  log(`public/data/instagram.json に ${posts.length} 件を書き出しました`);
}

/* ---------- 実行 ---------- */

try {
  if (process.argv.includes("--refresh-token")) {
    await refreshToken();
  } else {
    await fetchFeed();
  }
} catch (err) {
  log(`失敗しました: ${scrub(err.message)}`);
  // 取得モードでは、サイトが壊れないよう空の JSON を残してから終わる
  if (!process.argv.includes("--refresh-token")) {
    await writeFeed([]).catch(() => {});
  }
  process.exit(1);
}
