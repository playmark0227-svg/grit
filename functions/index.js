// ============================================================
// GRIT Cloud Functions (firebase-functions v2 API / Node 20)
//
// - createCheckoutSession (onCall):
//     カート内の全商品を Firestore トランザクションで「予約」してから
//     Stripe Checkout セッションを作成し、決済ページの URL を返す。
// - stripeWebhook (onRequest):
//     Stripe からの Webhook を署名検証して受け取り、
//     決済完了 → 商品を sold に確定 + orders に記録(冪等)
//     期限切れ → 予約中の商品を available に戻す。
//
// region: asia-northeast1
// secrets: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
//   (設定方法は SETUP.md を参照)
// ============================================================

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

// 予約(reservedUntil)と Stripe セッション(expires_at)の保持時間。
// Stripe の expires_at は「セッション作成時刻から30分後」が最小値なので、
// 予約トランザクション等の処理時間で 30 分を割り込んで API エラーに
// ならないよう、+2 分の余裕を持たせた約30分としている。
const HOLD_MINUTES = 32;

// 一度に購入できる商品数の上限(全商品1点物のため現実的な上限で十分)
const MAX_ITEMS = 20;

// ------------------------------------------------------------
// 送料(円)。ここを書き換えるだけで送料の設定を変えられます。
//   0     → 送料無料(お客様の支払いは商品代金のみ)
//   800   → 全国一律800円が決済画面で加算される
// 変更したら functions を再デプロイしてください(SETUP.md 手順6)。
// ------------------------------------------------------------
const SHIPPING_FEE_YEN = 0;

/* ------------------------------------------------------------
 * helpers
 * ---------------------------------------------------------- */

function toMillis(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return null;
}

/**
 * 購入可能か。public/js/store.js の isAvailable() と同じ判定。
 * - status "available" → OK
 * - status "reserved" かつ reservedUntil を過ぎている → OK(予約切れ)
 * - それ以外(sold / 予約が生きている / reservedUntil 不明)→ NG
 */
function isPurchasable(p, nowMs) {
  if (!p) return false;
  if (p.status === "available") return true;
  if (p.status === "reserved") {
    const t = toMillis(p.reservedUntil);
    return t !== null && nowMs > t;
  }
  return false;
}

/**
 * Checkout セッションから配送先(氏名・住所・電話)を取り出す。
 * Stripe の API バージョンによって配送先の入り口が
 * session.collected_information.shipping_details と
 * session.shipping_details の2通りあるため、両方を見る。
 */
function extractShipping(session) {
  const sd =
    (session.collected_information && session.collected_information.shipping_details) ||
    session.shipping_details ||
    null;
  const cd = session.customer_details || {};
  const a = (sd && sd.address) || cd.address || null;

  // 日本の宛名書きの順(郵便番号 → 都道府県 → 市区町村 → 番地 → 建物)で1行に
  const oneLine = a
    ? [
        a.postal_code ? `〒${a.postal_code}` : "",
        a.state || "",
        a.city || "",
        a.line1 || "",
        a.line2 || "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return {
    shippingName: (sd && sd.name) || cd.name || null,
    shippingPhone: cd.phone || null,
    shippingAddress: a
      ? {
          postalCode: a.postal_code || null,
          state: a.state || null,
          city: a.city || null,
          line1: a.line1 || null,
          line2: a.line2 || null,
          country: a.country || null,
        }
      : null,
    shippingAddressText: oneLine || null,
  };
}

/** metadata.productIds (JSON文字列) を安全に配列へ戻す */
function parseProductIds(metadata) {
  try {
    const arr = JSON.parse((metadata && metadata.productIds) || "[]");
    return Array.isArray(arr)
      ? arr.filter((x) => typeof x === "string" && x.length > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * 予約中(reserved)の商品を available に戻す。
 * - onlyIfExpired=true : reservedUntil が過ぎているものだけ戻す
 *   (Webhook の expired 用。別の購入者が予約し直していた場合は触らない)
 * - onlyIfExpired=false: reserved なら無条件で戻す
 *   (セッション作成失敗時のロールバック用。予約した直後で他者は予約できない)
 * sold の商品には決して触らない。
 */
async function releaseReservedProducts(ids, { onlyIfExpired }) {
  await Promise.all(
    ids.map(async (id) => {
      const ref = db.collection("products").doc(id);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const p = snap.data();
          if (p.status !== "reserved") return; // sold / available は触らない(冪等)
          if (onlyIfExpired) {
            const t = toMillis(p.reservedUntil);
            // 期限が未来 = 別のセッションが予約し直している → 触らない
            if (t !== null && t > Date.now()) return;
          }
          tx.update(ref, {
            status: "available",
            reservedUntil: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      } catch (err) {
        console.error(`商品 ${id} の予約解除に失敗:`, err);
      }
    })
  );
}

/* ------------------------------------------------------------
 * createCheckoutSession (onCall)
 * 入力: { items: string[] (商品IDの配列), origin: string }
 * 返値: { url: string } — Stripe Checkout の決済ページ URL
 * ---------------------------------------------------------- */

exports.createCheckoutSession = onCall(
  { region: "asia-northeast1", secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const data = request.data || {};

    // ---- 入力バリデーション ----
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new HttpsError("invalid-argument", "カートが空です。");
    }
    if (!data.items.every((x) => typeof x === "string" && x.length > 0 && x.length <= 128)) {
      throw new HttpsError("invalid-argument", "商品IDが不正です。");
    }
    const ids = [...new Set(data.items)]; // 1点物なので重複は除去
    if (ids.length > MAX_ITEMS) {
      throw new HttpsError("invalid-argument", `一度に購入できるのは${MAX_ITEMS}点までです。`);
    }
    const origin = data.origin;
    // https:// のオリジンのみ許可(success/cancel URL への注入防止)
    if (typeof origin !== "string" || !/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(origin)) {
      throw new HttpsError("invalid-argument", "不正なオリジンです。https:// のサイトからのみ購入できます。");
    }

    const holdUntilMs = Date.now() + HOLD_MINUTES * 60 * 1000;

    // ---- トランザクションで全商品を確認して予約 ----
    const productRefs = ids.map((id) => db.collection("products").doc(id));
    const products = await db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...productRefs);
      const nowMs = Date.now();
      const result = [];
      for (const snap of snaps) {
        if (!snap.exists) {
          throw new HttpsError("failed-precondition", "売り切れの商品が含まれています: (削除済みの商品)");
        }
        const p = snap.data();
        if (!isPurchasable(p, nowMs)) {
          throw new HttpsError(
            "failed-precondition",
            `売り切れの商品が含まれています: ${p.name || snap.id}`
          );
        }
        if (!Number.isInteger(p.price) || p.price <= 0) {
          throw new HttpsError(
            "failed-precondition",
            `商品の価格が正しく設定されていません: ${p.name || snap.id}`
          );
        }
        result.push({ id: snap.id, name: p.name, price: p.price, images: p.images });
      }
      // 全部OKなら30分予約(1点でもNGなら上のthrowでトランザクション全体が中断)
      const until = Timestamp.fromMillis(holdUntilMs);
      for (const ref of productRefs) {
        tx.update(ref, {
          status: "reserved",
          reservedUntil: until,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return result;
    });

    // ---- Stripe Checkout セッション作成 ----
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const lineItems = products.map((p) => {
      const cover =
        Array.isArray(p.images) &&
        typeof p.images[0] === "string" &&
        p.images[0].startsWith("http")
          ? [p.images[0]]
          : undefined; // デモのdataURL等はStripeに渡さない
      return {
        quantity: 1, // 全商品1点物
        price_data: {
          currency: "jpy",
          // JPY はゼロ小数通貨(zero-decimal currency)。
          // 12800円 → unit_amount: 12800 とそのまま渡す(×100しない)。
          unit_amount: p.price,
          product_data: {
            name: p.name || "GRIT vintage item",
            ...(cover ? { images: cover } : {}),
          },
        },
      };
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        locale: "ja",
        line_items: lineItems,
        // 現物を発送するので、決済画面で氏名・配送先住所・電話番号を必ず受け取る。
        shipping_address_collection: { allowed_countries: ["JP"] },
        phone_number_collection: { enabled: true },
        ...(SHIPPING_FEE_YEN > 0
          ? {
              shipping_options: [
                {
                  shipping_rate_data: {
                    type: "fixed_amount",
                    display_name: "全国一律送料",
                    fixed_amount: { amount: SHIPPING_FEE_YEN, currency: "jpy" },
                  },
                },
              ],
            }
          : {}),
        success_url: `${origin}/shop/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/shop/cancel.html`,
        // 約30分で失効(reservedUntil と同じ時刻)。最小値制約は HOLD_MINUTES 参照。
        expires_at: Math.floor(holdUntilMs / 1000),
        metadata: { productIds: JSON.stringify(ids) },
      });
    } catch (err) {
      console.error("Stripe セッション作成に失敗:", err);
      // 予約したままだと30分売れなくなるので、ベストエフォートで即解除する
      await releaseReservedProducts(ids, { onlyIfExpired: false });
      throw new HttpsError(
        "internal",
        "決済ページの作成に失敗しました。時間をおいて再度お試しください。"
      );
    }

    if (!session.url) {
      await releaseReservedProducts(ids, { onlyIfExpired: false });
      throw new HttpsError("internal", "決済ページのURLを取得できませんでした。");
    }

    return { url: session.url };
  }
);

/* ------------------------------------------------------------
 * stripeWebhook (onRequest)
 * Stripe ダッシュボードに登録するイベント:
 *   - checkout.session.completed → 商品を sold に確定 + orders に記録
 *   - checkout.session.expired   → 予約を解放して available に戻す
 * ---------------------------------------------------------- */

/** 決済完了: 商品を sold に + orders/{sessionId} に記録(冪等) */
async function handleCheckoutCompleted(session) {
  const ids = parseProductIds(session.metadata);
  if (ids.length === 0) {
    console.error(`session ${session.id}: metadata.productIds が空です`);
    return;
  }
  const orderRef = db.collection("orders").doc(session.id); // sessionId をdoc IDに=冪等
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (orderSnap.exists) return; // 既に処理済み(Stripeの再送・重複配信対策)

    const refs = ids.map((id) => db.collection("products").doc(id));
    const snaps = await tx.getAll(...refs);

    const items = [];
    for (const snap of snaps) {
      if (!snap.exists) {
        console.error(`session ${session.id}: 商品 ${snap.id} が見つかりません`);
        continue;
      }
      const p = snap.data();
      items.push({ id: snap.id, name: p.name || "", price: p.price ?? null });
      if (p.status !== "sold") {
        // すでに sold なら上書きしない(冪等)
        tx.update(snap.ref, {
          status: "sold",
          reservedUntil: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    tx.set(orderRef, {
      sessionId: session.id,
      items,
      amount: session.amount_total ?? null,
      shippingFee:
        (session.total_details && session.total_details.amount_shipping) ?? 0,
      customerEmail:
        (session.customer_details && session.customer_details.email) || null,
      ...extractShipping(session),
      // 発送作業の進捗管理用。管理ページから "shipped" に更新できる。
      fulfillment: "unshipped",
      status: "paid",
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

/** セッション期限切れ: reserved のまま期限を過ぎた商品を available に戻す */
async function handleCheckoutExpired(session) {
  const ids = parseProductIds(session.metadata);
  if (ids.length === 0) return;
  await releaseReservedProducts(ids, { onlyIfExpired: true });
}

exports.stripeWebhook = onRequest(
  { region: "asia-northeast1", secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // ---- 署名検証(rawBody を使うこと。パース後のbodyでは検証に失敗する)----
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error("Webhook 署名検証に失敗:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event.data.object);
          break;
        case "checkout.session.expired":
          await handleCheckoutExpired(event.data.object);
          break;
        default:
          // 登録外のイベントは何もしない(200を返してStripeの再送を止める)
          break;
      }
      res.status(200).send("ok");
    } catch (err) {
      // 500 を返すと Stripe が自動で再送してくれる(処理は冪等なので安全)
      console.error(`Webhook 処理に失敗 (${event.type}):`, err);
      res.status(500).send("internal error");
    }
  }
);
