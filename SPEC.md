# Grit — 古着屋 HP + EC + 管理ページ 設計書

これは実装者(人間・エージェント共通)向けの設計契約書。**ここに書かれた規約から外れないこと。**

## 0. 確定済みの要件

- 店名/ブランド名: **Grit**(表記は `GRIT` 大文字で使うことが多い)
- サイト: HP(店紹介+ブログ)/ EC(デニム背景・カート+Stripe決済)/ 管理ページ(商品・ブログ投稿)
- インフラ: Firebase(Hosting / Firestore / Storage / Auth / Cloud Functions)+ Stripe Checkout
- 管理ログイン: Google ログイン(許可メールアドレスのみ)。初期管理者: `playmark0227@gmail.com`
- ブログは **HPのみ** に表示(ECには出さない)
- デザイン: **ヴィンテージ・アメカジ**(インディゴ×生成り、デニムのステッチ・赤タブ・セルビッジをモチーフに)
- 古着なので **全商品1点物**(数量という概念はない。売れたら SOLD)
- UI言語: 日本語(見出しなどに英語アクセント可)
- Firebase未設定でも動く **デモモード** あり(後述)

## 1. ファイル構成と担当

```
Grit/
  SPEC.md                     ← このファイル
  SETUP.md                    ← 公開手順書(日本語)         [担当: backend]
  firebase.json               [backend]
  .firebaserc                 [backend]
  firestore.rules             [backend]
  firestore.indexes.json      [backend]
  storage.rules               [backend]
  functions/
    package.json              [backend]
    index.js                  [backend]
  public/
    index.html                ← HPトップ                    [hp]
    blog.html                 ← ブログ一覧                  [blog]
    blog-post.html            ← ブログ記事 (?id=xxx)        [blog]
    shop/
      index.html              ← ECトップ(商品グリッド)     [shop]
      product.html            ← 商品詳細 (?id=xxx)          [product]
      cart.html               ← カート                      [product]
      success.html            ← 決済完了                    [product]
      cancel.html             ← 決済キャンセル              [product]
    admin/
      index.html              ← 管理ページ(SPA的な1枚)     [admin]
    css/
      base.css                ← デザインシステム(既存・変更禁止)
      home.css                [hp]
      blog.css                [blog]
      shop.css                ← デニム背景ここ              [shop]
      product.css             [product]
      admin.css               [admin]
    js/
      firebase-config.js      ← 設定プレースホルダ(既存・変更禁止)
      store.js                ← データアクセス層(既存・変更禁止)
      common.js               ← ヘッダー/フッター注入・共通util(既存・変更禁止)
      demo-data.js            ← デモデータ(既存・変更禁止)
      blog.js                 [blog]
      shop.js                 [shop]
      product.js              [product]
      cart-page.js            [product]
      admin.js                [admin]
    assets/
      denim.svg               ← デニム地テクスチャ(既存)
      paper.svg               ← 生成り紙テクスチャ(既存)
```

**自分の担当ファイル以外は絶対に作成・編集しないこと。**「既存」printは土台として先に作成済み。読むのはOK。

## 2. パスとHTMLの規約

- CSS/JS/アセット参照は **ルート絶対パス**(例 `/css/base.css`, `/js/store.js`)。ページの階層に関わらず同じ。
- ページ間リンクもルート絶対(例 `/shop/`, `/blog.html`, `/shop/product.html?id=xxx`)。ECトップは `/shop/`(index.html省略形)でリンク。
- 各ページの `<head>` に必ず(この順で):
  ```html
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ページ名 | GRIT</title>
  <meta name="description" content="...">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Shippori+Mincho:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/(自分のページ用).css">
  ```
- `<body>` の規約:
  ```html
  <body data-page="home|shop|blog|admin|...">
    <div id="site-header"></div>   <!-- common.js が注入 -->
    <main> ... ページ内容 ... </main>
    <div id="site-footer"></div>   <!-- common.js が注入 -->
    <script src="/js/firebase-config.js"></script>
    <script type="module" src="/js/common.js"></script>
    <script type="module" src="/js/(自分のページ用).js"></script>
  </body>
  ```
  - EC系ページ(shop配下)は `<body data-page="shop" class="theme-denim">` — ヘッダーがデニム調になる。
  - 管理ページはヘッダー/フッター注入を使わず独自レイアウトでよい(ただし base.css のトークンは使う)。
- JSは全て `type="module"`。ライブラリはFirebase CDN以外禁止(jQuery等不可)。
- **ユーザー入力由来のテキストは必ず `esc()`(common.jsのescapeHTML)を通すか `textContent` で挿入**(商品名・説明・ブログ本文など全て)。XSS厳禁。
- ブログ本文・商品説明はプレーンテキスト。表示時は改行を `<br>` 化(common.jsの `nl2br(esc(text))` を使う)。

## 3. デザインシステム(base.css 抜粋リファレンス)

**方向性: 白を基調にしたミニマル。ギャラリーのように服と写真を主役にする。**
(2026年7月、クライアント要望により旧「ヴィンテージ・アメカジ」から全面変更)

- 面は白。**アクセントカラーを持たない**(無彩色のみ)
- 線は1pxのヘアラインだけ。枠・影・テクスチャ・破線は使わない
- 余白を大きく取る。要素を詰めない
- **写真に色補正をかけない**(暗幕・フィルタ禁止)。写真をそのまま見せる

### パレット(CSS変数)
| 変数 | 値 | 用途 |
|---|---|---|
| `--bg` | #ffffff | 基本の面 |
| `--bg-soft` | #f7f7f6 | セクションを切り替えるわずかな灰 |
| `--line` | #e6e6e3 | ヘアライン |
| `--line-strong` | #cfcfca | 少し強い線 |
| `--ink` | #111111 | 見出し・本文 |
| `--ink-mid` | #6a6a68 | 補助テキスト |
| `--ink-soft` | #9a9a97 | キャプション・日付 |
| `--sold` | #b0342a | **SOLDの判別にだけ**色を許可 |

### フォント
- `--font-display`: 'Poppins'(英字見出し・価格・ラベル)
- `--font-body`: 'Noto Sans JP'(和文・本文)。和文は大きくせず、字間を広めに静かに置く

### レイアウト変数
`--gutter`(左右余白) / `--sec-pad`(セクション上下余白) / `--header-h`

### 主要クラス(base.cssに実装済み。再定義しない)
`.container` / `.container--narrow` / `.section` / `.bg-soft` /
`.section-head__en` `.section-head__ja` / **`.link-arrow`(主役の導線。矢印つき下線リンク)** /
`.btn`(黒塗り。購入導線など最小限) / `.stitch-box`(白い面+ヘアライン) /
`.tag` `.tag--active` `.tag--dark` / `.badge-sold` / `.grid-products` `.p-card`(枠なし) /
`.form-field` / `.empty-note` / `.skeleton` / `.toast` / `[data-reveal]`

`.selvedge` `.red-tab` は旧デザインの名残で、base.css で非表示にしてある。

### サイト構成(クライアント合意済み)
ナビ: About / Shop / Journal / Access + Online Store。ブログの呼称は **Journal**。
ブランド表記は **Grit.**(末尾のピリオドまで含む)。

### 店舗情報(実データ)
〒063-0804 北海道札幌市西区二十四軒4条2丁目9-28 栄光ビル 203 / Tel 090-3892-4583
営業 13:00–20:00 / 月曜定休

## 4. データモデル(Firestore)

### `products` コレクション
```
{
  name: string,          // 商品名 例 "50s デニムジャケット"
  brand: string,         // ブランド 例 "Levi's" (無ければ "no brand")
  price: number,         // 税込・円 例 12800
  size: string,          // 例 "M" "W32 L30" フリーテキスト
  category: string,      // "アウター"|"トップス"|"ボトムス"|"デニム"|"小物"|"その他"
  condition: string,     // 例 "A(美品)" フリーテキスト
  description: string,   // 説明(プレーンテキスト・改行あり)
  images: string[],      // Storage DL URL。images[0] がカバー
  status: string,        // "available" | "reserved" | "sold"
  reservedUntil: Timestamp|null,  // reserved時の期限
  createdAt: Timestamp, updatedAt: Timestamp
}
```
- **有効在庫の判定は必ず `isAvailable(product)`(store.js)を使う**(reserved期限切れ=available扱い)。
- カテゴリ一覧は store.js の `CATEGORIES` 定数(`["アウター","トップス","ボトムス","デニム","小物","その他"]`)を使う。ハードコード禁止。

### `posts` コレクション(ブログ)
```
{
  title: string,
  body: string,          // プレーンテキスト(改行で段落)
  coverImage: string|null,
  published: boolean,
  createdAt: Timestamp, updatedAt: Timestamp
}
```

### `orders` コレクション(作成はFunctionsのみ。管理者は読み取り+fulfillmentの更新だけ可)
```
{
  sessionId, items: [{id, name, price}],
  amount,              // Stripeの支払総額(送料込み)
  shippingFee,         // 送料(0なら送料無料)
  customerEmail,
  shippingName, shippingPhone,
  shippingAddress: {postalCode, state, city, line1, line2, country},
  shippingAddressText, // 「〒150-0001 東京都 渋谷区 …」1行表記(宛先コピー用)
  fulfillment,         // "unshipped" | "shipped"(管理ページから切替)
  status: "paid", createdAt
}
```
配送先は Stripe Checkout の入力欄(氏名・住所・電話・メール)から取得する。
`shipping_address_collection` を日本に限定し、`phone_number_collection` を有効化している。
送料は `functions/index.js` の `SHIPPING_FEE_YEN`(初期値 0=送料無料)を書き換えて再デプロイで変更する。

## 5. store.js API(実装済み。この契約どおりに呼ぶ)

```js
import {
  DEMO_MODE,            // boolean。firebase-config.js が未設定なら true
  CATEGORIES,           // ["アウター",...]
  isAvailable,          // (product) => boolean
  getProducts,          // async ({category=null, includeSold=true} = {}) => [{id, ...data}] 新着順
  getProduct,           // async (id) => {id, ...data} | null
  getLatestProducts,    // async (n) => 新着n件(available優先ではなく単純新着)
  getPosts,             // async ({publishedOnly=true} = {}) => [{id, ...data}] 新着順
  getPost,              // async (id) => {id, ...data} | null
  // --- 管理用 ---
  watchAuth,            // (cb) => unsubscribe。cb(user|null)。DEMOではnull即時
  signInWithGoogle,     // async () => user
  signOutUser,          // async () => void
  isAdmin,              // (user) => boolean(許可メール判定)
  uploadImages,         // async (FileList|File[], onProgress?) => string[](URL)。canvasで長辺1600px/JPEG圧縮してからアップロード
  addProduct,           // async (data) => id
  updateProduct,        // async (id, partialData) => void
  deleteProduct,        // async (id) => void
  addPost, updatePost, deletePost,  // 同様
  getOrders,            // async () => [{id, ...data}] 新着順(管理者のみ)
  setOrderFulfillment,  // async (id, "unshipped"|"shipped") => void
  createCheckout,       // async (cartIds) => {url}。Functionsを呼ぶ。DEMOでは throw new Error("DEMO")
} from "/js/store.js";
```
- DEMO_MODE時: 読み取り系はデモデータを返す。書き込み系は成功したフリ(メモリ内)。`createCheckout` はエラー。
- 価格表示は common.js の `yen(number)` → `"¥12,800"` を使う。
- 日付表示は common.js の `fmtDate(tsOrDate)` → `"2026.07.25"` を使う。

## 6. common.js(実装済み)

```js
import { esc, nl2br, yen, fmtDate, shortSize, getCart, addToCart, removeFromCart,
         clearCart, cartCount, updateCartBadge, toast } from "/js/common.js";
```
- `shortSize("M(実寸 肩42…)")` → `"M"`。一覧カードのサイズ表記に使う(詳細ページは全文表示)。
- 読み込むだけで `#site-header` / `#site-footer` に共通ヘッダー・フッターを注入し、カートバッジを更新する。
- `toast(msg)` — 画面下に小さな通知。カート追加時などに使う。
- カートは `localStorage["grit_cart"]` に商品IDの配列(1点物なので数量なし・重複なし)。

## 7. 各ページ仕様

### HPトップ `/index.html` [hp]
- ヒーロー: 生成り紙背景。特大 `GRIT` タイポ(Oswald)+赤タブ、和文キャッチ「一点物と、暮らす。」+サブコピー(ヴィンテージ古着屋らしい短文を数行)。CTAボタン「SHOPを見る」(→ /shop/)。セルビッジ線で区切る。
- ABOUT: `.section-head`(EN: ABOUT / JA: グリットについて)+ 店のこだわり文(アメカジ・ヴィンテージへの想い。3段落程度、実在の嘘情報は書かない=創業年や実店舗住所などは「(準備中)」プレースホルダにする)+ `.stitch-box` で世界観カード3つ(例: 一点物のみ / 状態にこだわる / 経年変化を楽しむ)。
- NEW ARRIVALS: `getLatestProducts(4)` を `.p-card` グリッドで。 「すべて見る →」(→ /shop/)。
- BLOG: `getPosts()` 最新3件をカードで(カバー画像+日付+タイトル)。「ブログ一覧 →」(→ /blog.html)。
- INFO: 営業時間・住所・SNSは「(準備中)」プレースホルダを stitch-box で。Instagramリンクはダミー `#`。
- JSはインラインでなく home用に小さく index.html 内 `<script type="module">` でOK(専用jsファイル不要。NEW ARRIVALS/BLOG描画のみ)。

### ブログ一覧 `/blog.html`・記事 `/blog-post.html` [blog]
- 一覧: 生成り背景。カード(カバー画像 or 画像なしならデニム地ダミー)、日付・タイトル・本文冒頭80字。
- 記事: `?id=` で取得。タイトル(Shippori Mincho大きめ)、日付、カバー画像、本文は `nl2br(esc(body))`。見つからなければ「記事が見つかりません」+一覧へ戻るリンク。
- 記事下に「← ブログ一覧へ」「SHOPを見る」導線。

### ECトップ `/shop/index.html` [shop]
- **全面 `.bg-denim`(超かっこよく!)**。ヒーローは控えめ高さ: 生成り文字で `SHOP` 大見出し+「全て一点物。出会いは一度きり。」
- カテゴリフィルタ: `.tag` チップ横スクロール(ALL + CATEGORIES)。クリックでクライアント側絞り込み。
- 商品グリッド: `.p-card`(生成りカード)2列(モバイル)/3〜4列(PC)。SOLDも表示(グレー+SOLDスタンプ)が、新着順でavailableが自然に上に来る並びのまま(単純新着順でOK)。
- 0件時: 「アイテム準備中です」表示。
- ローディング中はスケルトン(シンプルでOK)。

### 商品詳細 `/shop/product.html` [product]
- `.bg-denim` 全面。中身は生成りの大きな `.stitch-box` 内に: 画像ギャラリー(メイン+サムネ切替、JSで)、ブランド/商品名/価格(大きく)/size/状態/カテゴリtag/説明(nl2br)。
- 「カートに入れる」`.btn--red .btn--lg`。追加済みなら「カートに入っています」表示に切替。SOLD/reservedなら `badge-sold` +ボタン無効「SOLD OUT」。
- 戻る導線「← SHOPへ」。見つからない場合の表示も。

### カート `/shop/cart.html` [product]
- `.bg-denim`。カート内商品リスト(サムネ・名前・価格・削除ボタン)。**描画時に `getProduct` で最新を取得し、SOLD/reservedになっていたら「売り切れました」表示で自動除外**(1点物なので重要)。
- 合計金額。「レジへ進む(Stripe)」ボタン → `createCheckout(ids)` → 返ってきた `url` へ `location.href`。
- DEMO_MODEでは決済ボタン押下時に toast「デモモードでは決済できません。SETUP.mdを見て公開してください」。
- 空カート表示+SHOPへの導線。

### success.html / cancel.html [product]
- success: 「ご購入ありがとうございます」+注文の流れの説明(発送連絡など)+ `clearCart()` 実行。HPとSHOPへの導線。
- cancel: 「決済がキャンセルされました」+カートへ戻る導線。カートは維持。

### 管理ページ `/admin/index.html` [admin]
- **スマホ最優先UI**(店主が店頭でスマホから投稿する)。base.cssトークン使用、生成り背景の実用画面。
- 未ログイン: 中央に `GRIT ADMIN` +「Googleでログイン」ボタンのみ。
- ログイン済みだが `isAdmin()` false: 「権限がありません」+サインアウト。
- 管理UI: 上部タブ「商品」「ブログ」「注文」。URLハッシュで初期タブ指定可(`/admin/#orders`)。
  - 注文タブ: 閲覧+「発送済み/未発送」の切替+宛先コピーのみ。注文の作成・削除はできない(ルールで禁止)。
  - 商品タブ: 「+ 新規商品」ボタン → フォーム(写真複数選択(`<input type="file" accept="image/*" multiple>`、プレビュー表示)、名前、ブランド、価格、サイズ、カテゴリselect、状態、説明textarea)。アップロード進捗表示。既存商品リスト(サムネ・名前・価格・status)から編集/SOLDに切替/available戻し/削除(削除はconfirm)。
  - ブログタブ: 「+ 新規記事」→ フォーム(タイトル、カバー画像1枚(任意)、本文textarea、公開チェック)。既存記事リストから編集/公開切替/削除。
- 保存成功で toast。失敗はエラーメッセージ表示(握りつぶさない)。
- DEMO_MODEでは黄色いバナー「デモモード: 保存はこの画面内だけの仮保存です」を表示しつつ、一通り操作は試せる。

### バックエンド [backend]
- `functions/index.js`(Node 20, firebase-functions v2, CommonJSでもESMでも可):
  - `createCheckoutSession`(onCall): 入力 `{items: [productId,...], origin: string}`。Firestoreトランザクションで全商品が isAvailable か確認 → `status:"reserved", reservedUntil: now+30min` に更新 → Stripe Checkout Session作成(currency jpy, 商品名・価格・画像、`success_url: origin+"/shop/success.html?session_id={CHECKOUT_SESSION_ID}"`, `cancel_url: origin+"/shop/cancel.html"`, `expires_at`: 30分後, metadata.productIds=JSON)→ `{url}` を返す。1点でも売切れなら `HttpsError("failed-precondition", "売り切れの商品が含まれています: <商品名>")`。
  - `stripeWebhook`(onRequest): 署名検証(`STRIPE_WEBHOOK_SECRET`)。`checkout.session.completed` → 対象productsを `sold` に+ordersに記録。`checkout.session.expired` → `reserved` を `available` に戻す。
  - Stripeキーは `defineSecret("STRIPE_SECRET_KEY")` / `defineSecret("STRIPE_WEBHOOK_SECRET")`。region: `asia-northeast1`。
- `firestore.rules`: products/posts は公開read(postsは published==true のみ公開read、管理者は全read)。write は管理者メール(`request.auth.token.email in ['playmark0227@gmail.com']`)のみ。orders はクライアント read/write 不可(Functionsはadmin SDKなのでルール対象外)。
- `storage.rules`: 公開read、write は管理者メールのみ。パスは `images/{allPaths=**}`。
- `firebase.json`: hosting(public: "public", ignore標準, cleanUrls: false)+ functions設定。
- `SETUP.md`: 日本語で、(1)Firebaseプロジェクト作成(コンソールのスクショ的な丁寧さで手順を文章化)、(2)Webアプリ登録して firebase-config.js に貼る、(3)Auth(Google)有効化と管理者メール変更箇所、(4)Firestore/Storage有効化、(5)Blazeプラン(Functionsに必要)、(6)firebase CLIインストール〜deploy、(7)Stripeアカウント作成、テストキー設定(`firebase functions:secrets:set`)、webhook登録手順、(8)本番切替チェックリスト、(9)よくあるエラー。管理者メールの変更箇所一覧(store.js内 ADMIN_EMAILS / firestore.rules / storage.rules)も明記。

## 8. 品質基準

- スマホ(375px)で全ページ崩れないこと。タップ領域44px以上。
- 画像は `loading="lazy"`(ファーストビュー除く)。alt必須。
- 空状態(商品0件・記事0件・404的なid不一致)を必ずデザインすること。
- console.error が出ない状態で完成とする。
