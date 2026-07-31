// ============================================================
// デモモード用サンプルデータ
// Firebase設定前でもデザイン・動作確認ができるようにするためのもの。
// 本番では使われません(管理ページから登録した実データに置き換わります)。
//
// 写真は public/assets/demo/ に置いたサンプル画像(Unsplash)。
// ライセンスと差し替え方法は public/assets/CREDITS.md を参照。
// ============================================================

/** demo画像のURL。サブディレクトリ配信でも壊れないよう自分の位置から解決する */
function img(name) {
  return new URL(`../assets/demo/${name}`, import.meta.url).href;
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

export const DEMO_PRODUCTS = [
  {
    id: "demo-p1",
    name: "60s デニムジャケット 3rd type",
    brand: "Levi's",
    price: 24800,
    size: "M(実寸 肩42 身幅50 着丈58)",
    category: "アウター",
    condition: "B(全体的に良好・色落ち良し)",
    description: "60年代のデニムジャケット。\n程よく色落ちしたインディゴが美しい一着です。\n袖口にわずかなリペアあり(写真参照)。",
    images: [img("p1-denim-jacket.jpg"), img("p1-detail.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: "demo-p2",
    name: "70s チェックネルシャツ",
    brand: "no brand",
    price: 6800,
    size: "L(実寸 肩46 身幅56 着丈74)",
    category: "トップス",
    condition: "A(美品)",
    description: "70年代のヘビーネルシャツ。\n黒×グレーのバッファローチェック。肉厚でアウター使いもおすすめです。",
    images: [img("p2-flannel.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-p3",
    name: "80s リバースウィーブ スウェット",
    brand: "Champion",
    price: 9800,
    size: "XL(実寸 肩50 身幅60 着丈68)",
    category: "トップス",
    condition: "B(良好・多少の使用感)",
    description: "80年代のリバースウィーブ。\nブラックの定番カラー。目の詰まった生地でこれからの季節に活躍します。",
    images: [img("p3-sweat.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "demo-p4",
    name: "90s ストレートデニム 501",
    brand: "Levi's",
    price: 12800,
    size: "W32 L30",
    category: "デニム",
    condition: "B(良好)",
    description: "90年代のストレートデニム。\nUSA製。濃いめのインディゴでこれから育てがいのある一本です。",
    images: [img("p4-jeans.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: "demo-p5",
    name: "50s ヘリンボーン ワークパンツ",
    brand: "no brand",
    price: 15800,
    size: "W34 L31",
    category: "ボトムス",
    condition: "C(使用感あり・雰囲気良し)",
    description: "50年代のワークパンツ。\nヘリンボーンツイル生地。経年の風合いがたまらない一本。\n膝に小さなリペアあり。",
    images: [img("p5-workpants.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },
  {
    id: "demo-p6",
    name: "ヴィンテージバンダナ 赤",
    brand: "no brand",
    price: 1800,
    size: "約53×53cm",
    category: "小物",
    condition: "B(良好)",
    description: "ヴィンテージのコットンバンダナ。\n首元やバッグのアクセントに。",
    images: [img("p6-bandana.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
  },
  {
    id: "demo-p7",
    name: "サドルレザーベルト",
    brand: "no brand",
    price: 3800,
    size: "85cm(表記)",
    category: "小物",
    condition: "B(良好)",
    description: "厚手のサドルレザーベルト。\n使い込まれた艶と、深く入ったシワが良い表情です。",
    images: [img("p7-belt.jpg")],
    status: "sold",
    reservedUntil: null,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-p8",
    name: "70s M-65 フィールドジャケット",
    brand: "U.S. ARMY",
    price: 19800,
    size: "S-R(実寸 肩46 身幅56 着丈74)",
    category: "アウター",
    condition: "B(良好)",
    description: "70年代のM-65フィールドジャケット。\nオリーブの色味が抜けて良い雰囲気です。\nライナーは付属しません。",
    images: [img("p8-military.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
  },
];

// 管理ページの「注文」タブ表示確認用。本番の注文はStripeの決済完了時に
// Cloud Functions が自動で作成します(この画面から作ることはできません)。
export const DEMO_ORDERS = [
  {
    id: "cs_demo_0001",
    sessionId: "cs_demo_0001",
    items: [{ id: "demo-p7", name: "サドルレザーベルト", price: 3800 }],
    amount: 3800,
    shippingFee: 0,
    customerEmail: "sample-customer@example.com",
    shippingName: "見本 太郎",
    shippingPhone: "090-0000-0000",
    shippingAddressText: "〒150-0001 東京都 渋谷区 神宮前1-2-3 サンプルビル101",
    fulfillment: "unshipped",
    status: "paid",
    createdAt: daysAgo(1),
  },
  {
    id: "cs_demo_0002",
    sessionId: "cs_demo_0002",
    items: [
      { id: "demo-p3", name: "80s リバースウィーブ スウェット", price: 9800 },
      { id: "demo-p6", name: "ヴィンテージバンダナ 赤", price: 1800 },
    ],
    amount: 11600,
    shippingFee: 0,
    customerEmail: "sample2@example.com",
    shippingName: "見本 花子",
    shippingPhone: "080-0000-0000",
    shippingAddressText: "〒530-0001 大阪府 大阪市北区梅田4-5-6",
    fulfillment: "shipped",
    status: "paid",
    createdAt: daysAgo(4),
  },
];

export const DEMO_POSTS = [
  {
    id: "demo-b1",
    title: "オンラインストアをオープンしました",
    body: "Grit.のオンラインストアをオープンしました。\n\n店頭に並んでいる一点物を、少しずつオンラインにも掲載していきます。\n気になるアイテムがあれば、売り切れる前にぜひチェックしてください。\n\n今後は入荷情報やスタイリングのヒントもこのJournalでお知らせしていきます。",
    coverImage: img("b1-store.jpg"),
    published: true,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-b2",
    title: "デニムジャケット、まとめて入荷しました",
    body: "60s〜90sのデニムジャケットをまとめて入荷しました。\n\n色落ちの表情はどれも一点ごとに違います。\n実寸サイズを載せているので、手持ちの一着と比べてみてください。\n\nオンライン掲載分はSHOPページからどうぞ。",
    coverImage: img("b2-jeans-stack.jpg"),
    published: true,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-b3",
    title: "古着との付き合い方 — 洗い方について",
    body: "古着を長く楽しむための、洗い方の話です。\n\nデニムは洗いすぎない。洗うときは裏返して、ネットに入れて、陰干し。\nニットは手洗いか、信頼できるクリーニングへ。\n\n一点物だからこそ、丁寧に付き合っていきましょう。",
    coverImage: null,
    published: true,
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12),
  },
];
