// ============================================================
// GRIT データアクセス層 (store.js)
// Firebase 設定済み → Firestore / Storage / Auth / Functions
// 未設定        → デモモード(demo-data.js のサンプルを表示)
// ページ側は必ずこのモジュール経由でデータに触ること。
// ============================================================

import { DEMO_PRODUCTS, DEMO_POSTS, DEMO_ORDERS } from "./demo-data.js";

const cfg = typeof window !== "undefined" ? window.FIREBASE_CONFIG : null;

export const DEMO_MODE =
  !cfg || !cfg.apiKey || /PASTE|XXXX|000000000000$/.test(String(cfg.apiKey));

// 管理者として許可する Google アカウントのメールアドレス。
// 変更する場合は firestore.rules / storage.rules 内の同じリストも揃えて変更すること。
export const ADMIN_EMAILS = ["playmark0227@gmail.com"];

export const CATEGORIES = ["アウター", "トップス", "ボトムス", "デニム", "小物", "その他"];

const FB_VER = "10.12.2";
const FB_REGION = "asia-northeast1";

/* ---------- 在庫判定(1点物)---------- */

function tsMillis(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = +new Date(v);
  return Number.isNaN(t) ? null : t;
}

/** 購入可能か(reserved でも期限切れなら購入可能扱い) */
export function isAvailable(p) {
  if (!p) return false;
  if (p.status === "available") return true;
  if (p.status === "reserved") {
    const t = tsMillis(p.reservedUntil);
    return t === null ? false : Date.now() > t;
  }
  return false;
}

/* ---------- Firebase 遅延初期化 ---------- */

let fbPromise = null;
function ensureFb() {
  if (DEMO_MODE) throw new Error("DEMO_MODEではFirebaseを初期化できません");
  if (!fbPromise) {
    fbPromise = (async () => {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
      const [appMod, fs, auth, st, fn] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-firestore.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-storage.js`),
        import(`${base}/firebase-functions.js`),
      ]);
      const app = appMod.initializeApp(cfg);
      return {
        fs, auth, st, fn,
        db: fs.getFirestore(app),
        authInst: auth.getAuth(app),
        storage: st.getStorage(app),
        functions: fn.getFunctions(app, FB_REGION),
      };
    })();
  }
  return fbPromise;
}

/* ---------- デモモードの状態(メモリ内・仮保存) ---------- */

let demoProducts = DEMO_PRODUCTS.map((p) => ({ ...p }));
let demoPosts = DEMO_POSTS.map((p) => ({ ...p }));
const demoOrders = DEMO_ORDERS.map((o) => ({ ...o }));
let demoSeq = 1;
const DEMO_USER_KEY = "grit_demo_user";
const demoAuthListeners = new Set();

function getDemoUser() {
  try {
    return JSON.parse(sessionStorage.getItem(DEMO_USER_KEY) || "null");
  } catch {
    return null;
  }
}

function setDemoUser(u) {
  if (u) sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(u));
  else sessionStorage.removeItem(DEMO_USER_KEY);
  demoAuthListeners.forEach((cb) => cb(u));
}

const byNewest = (a, b) => (tsMillis(b.createdAt) ?? 0) - (tsMillis(a.createdAt) ?? 0);

/* ---------- 商品 ---------- */

export async function getProducts({ category = null, includeSold = true } = {}) {
  let items;
  if (DEMO_MODE) {
    items = demoProducts.map((p) => ({ ...p }));
  } else {
    const { fs, db } = await ensureFb();
    const q = fs.query(fs.collection(db, "products"), fs.orderBy("createdAt", "desc"));
    const snap = await fs.getDocs(q);
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  items.sort(byNewest);
  if (category) items = items.filter((p) => p.category === category);
  if (!includeSold) items = items.filter(isAvailable);
  return items;
}

export async function getLatestProducts(n) {
  const items = await getProducts();
  return items.slice(0, n);
}

export async function getProduct(id) {
  if (!id) return null;
  if (DEMO_MODE) {
    const p = demoProducts.find((x) => x.id === id);
    return p ? { ...p } : null;
  }
  const { fs, db } = await ensureFb();
  const snap = await fs.getDoc(fs.doc(db, "products", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addProduct(data) {
  if (DEMO_MODE) {
    const id = `demo-new-${demoSeq++}`;
    demoProducts.unshift({
      status: "available", reservedUntil: null,
      ...data, id, createdAt: new Date(), updatedAt: new Date(),
    });
    return id;
  }
  const { fs, db } = await ensureFb();
  const ref = await fs.addDoc(fs.collection(db, "products"), {
    status: "available",
    reservedUntil: null,
    ...data,
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(id, partial) {
  if (DEMO_MODE) {
    const p = demoProducts.find((x) => x.id === id);
    if (p) Object.assign(p, partial, { updatedAt: new Date() });
    return;
  }
  const { fs, db } = await ensureFb();
  await fs.updateDoc(fs.doc(db, "products", id), { ...partial, updatedAt: fs.serverTimestamp() });
}

export async function deleteProduct(id) {
  if (DEMO_MODE) {
    demoProducts = demoProducts.filter((x) => x.id !== id);
    return;
  }
  const { fs, db } = await ensureFb();
  await fs.deleteDoc(fs.doc(db, "products", id));
}

/* ---------- ブログ ---------- */

export async function getPosts({ publishedOnly = true } = {}) {
  let items;
  if (DEMO_MODE) {
    items = demoPosts.map((p) => ({ ...p }));
  } else {
    const { fs, db } = await ensureFb();
    // 公開側は published==true のみ読める(firestore.rules)。
    // where + orderBy の複合インデックスは firestore.indexes.json に定義済み。
    const col = fs.collection(db, "posts");
    const q = publishedOnly
      ? fs.query(col, fs.where("published", "==", true), fs.orderBy("createdAt", "desc"))
      : fs.query(col, fs.orderBy("createdAt", "desc"));
    const snap = await fs.getDocs(q);
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  items.sort(byNewest);
  if (publishedOnly) items = items.filter((p) => p.published);
  return items;
}

export async function getPost(id) {
  if (!id) return null;
  if (DEMO_MODE) {
    const p = demoPosts.find((x) => x.id === id);
    return p ? { ...p } : null;
  }
  const { fs, db } = await ensureFb();
  const snap = await fs.getDoc(fs.doc(db, "posts", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addPost(data) {
  if (DEMO_MODE) {
    const id = `demo-newpost-${demoSeq++}`;
    demoPosts.unshift({ published: true, coverImage: null, ...data, id, createdAt: new Date(), updatedAt: new Date() });
    return id;
  }
  const { fs, db } = await ensureFb();
  const ref = await fs.addDoc(fs.collection(db, "posts"), {
    published: true,
    coverImage: null,
    ...data,
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
  });
  return ref.id;
}

export async function updatePost(id, partial) {
  if (DEMO_MODE) {
    const p = demoPosts.find((x) => x.id === id);
    if (p) Object.assign(p, partial, { updatedAt: new Date() });
    return;
  }
  const { fs, db } = await ensureFb();
  await fs.updateDoc(fs.doc(db, "posts", id), { ...partial, updatedAt: fs.serverTimestamp() });
}

export async function deletePost(id) {
  if (DEMO_MODE) {
    demoPosts = demoPosts.filter((x) => x.id !== id);
    return;
  }
  const { fs, db } = await ensureFb();
  await fs.deleteDoc(fs.doc(db, "posts", id));
}

/* ---------- 注文(管理者のみ読み取り) ---------- */

export async function getOrders() {
  if (DEMO_MODE) return demoOrders.map((o) => ({ ...o }));
  const { fs, db } = await ensureFb();
  const q = fs.query(fs.collection(db, "orders"), fs.orderBy("createdAt", "desc"));
  const snap = await fs.getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 発送済み/未発送の切り替え(注文で唯一クライアントから変更できる項目) */
export async function setOrderFulfillment(id, fulfillment) {
  if (!["unshipped", "shipped"].includes(fulfillment)) {
    throw new Error("不正な発送ステータスです");
  }
  if (DEMO_MODE) {
    const o = demoOrders.find((x) => x.id === id);
    if (o) o.fulfillment = fulfillment;
    return;
  }
  const { fs, db } = await ensureFb();
  await fs.updateDoc(fs.doc(db, "orders", id), { fulfillment });
}

/* ---------- 認証(管理ページ用・Googleログイン) ---------- */

export function isAdmin(user) {
  return !!user && ADMIN_EMAILS.includes(user.email || "");
}

export function watchAuth(cb) {
  if (DEMO_MODE) {
    demoAuthListeners.add(cb);
    queueMicrotask(() => cb(getDemoUser()));
    return () => demoAuthListeners.delete(cb);
  }
  let unsub = null;
  let cancelled = false;
  ensureFb().then(({ auth, authInst }) => {
    if (cancelled) return;
    unsub = auth.onAuthStateChanged(authInst, cb);
  }).catch((e) => {
    console.error(e);
    cb(null);
  });
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export async function signInWithGoogle() {
  if (DEMO_MODE) {
    const u = { displayName: "デモ管理者", email: ADMIN_EMAILS[0], demo: true };
    setDemoUser(u);
    return u;
  }
  const { auth, authInst } = await ensureFb();
  const provider = new auth.GoogleAuthProvider();
  const res = await auth.signInWithPopup(authInst, provider);
  return res.user;
}

export async function signOutUser() {
  if (DEMO_MODE) {
    setDemoUser(null);
    return;
  }
  const { auth, authInst } = await ensureFb();
  await auth.signOut(authInst);
}

/* ---------- 画像アップロード(スマホ写真を自動圧縮) ---------- */

async function compressImage(file, maxSide = 1600, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob || file;
  } catch {
    // 変換できない形式はそのままアップロード
    return file;
  }
}

/**
 * 画像をアップロードしてURL配列を返す。
 * onProgress(done, total) で進捗通知。
 */
export async function uploadImages(files, onProgress) {
  const list = Array.from(files || []);
  const urls = [];
  let done = 0;
  for (const file of list) {
    const blob = await compressImage(file);
    if (DEMO_MODE) {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      urls.push(dataUrl);
    } else {
      const { st, storage } = await ensureFb();
      const path = `images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const ref = st.ref(storage, path);
      await st.uploadBytes(ref, blob, { contentType: "image/jpeg" });
      urls.push(await st.getDownloadURL(ref));
    }
    done += 1;
    onProgress?.(done, list.length);
  }
  return urls;
}

/* ---------- 決済(Stripe Checkout / Cloud Functions) ---------- */

/**
 * カート内商品のCheckoutセッションを作成し {url} を返す。
 * デモモードでは Error("DEMO") を投げる。
 */
export async function createCheckout(cartIds) {
  if (DEMO_MODE) throw new Error("DEMO");
  const { fn, functions } = await ensureFb();
  const call = fn.httpsCallable(functions, "createCheckoutSession");
  const res = await call({ items: cartIds, origin: location.origin });
  return res.data;
}
