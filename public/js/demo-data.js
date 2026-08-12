// ============================================================
// デモモード用サンプルデータ
// Firebase設定前でもデザイン・動作確認ができるようにするためのもの。
// 本番では使われません(管理ページから登録した実データに置き換わります)。
//
// 写真は撮影いただいた Grit. 店舗の実写(public/assets/demo/)。
// 商品名・価格・サイズはデモ用の仮データで、管理ページから登録すると置き換わる。
// ============================================================

/** demo画像のURL。サブディレクトリ配信でも壊れないよう自分の位置から解決する */
function img(name) {
  return new URL(`../assets/demo/${name}`, import.meta.url).href;
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

export const DEMO_PRODUCTS = [
  {
    id: "demo-p1",
    name: "コットンジャケット ブラウン",
    brand: "no brand",
    price: 12800,
    size: "M",
    category: "アウター",
    condition: "B(良好)",
    description: "羽織りやすい厚みのコットンジャケット。\n落ち着いたブラウンで合わせを選びません。\n※商品情報はデモ用の仮データです。",
    images: [img("p1-jacket.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: "demo-p2",
    name: "ボーダー Tシャツ",
    brand: "no brand",
    price: 4800,
    size: "L",
    category: "トップス",
    condition: "B(良好)",
    description: "太めのボーダーが効いた一枚。\n身幅にゆとりがあり、一枚でも重ねても。\n※商品情報はデモ用の仮データです。",
    images: [img("p2-stripe.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-p3",
    name: "オープンカラーシャツ 白",
    brand: "no brand",
    price: 6800,
    size: "M",
    category: "トップス",
    condition: "A(美品)",
    description: "襟の開いた半袖シャツ。\n一枚で決まる清潔感のある白。\n※商品情報はデモ用の仮データです。",
    images: [img("p3-shirt.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "demo-p4",
    name: "ハイカットスニーカー",
    brand: "no brand",
    price: 8800,
    size: "27cm",
    category: "小物",
    condition: "B(良好)",
    description: "履き口を折り返して色を覗かせるタイプ。\nソールの減りは少なめです。\n※商品情報はデモ用の仮データです。",
    images: [img("p4-sneaker.jpg")],
    status: "sold",
    reservedUntil: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(4),
  },
  {
    id: "demo-p5",
    name: "ケーブルニット オフホワイト",
    brand: "no brand",
    price: 9800,
    size: "L",
    category: "トップス",
    condition: "B(良好)",
    description: "編み地の表情が豊かなケーブルニット。\n目が詰まっていて暖かい一枚です。\n※商品情報はデモ用の仮データです。",
    images: [img("p5-knit.jpg")],
    status: "available",
    reservedUntil: null,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
  },
];

// 管理ページの「注文」タブ表示確認用。本番の注文はStripeの決済完了時に
// Cloud Functions が自動で作成します(この画面から作ることはできません)。
export const DEMO_ORDERS = [
  {
    id: "cs_demo_0001",
    sessionId: "cs_demo_0001",
    items: [{ id: "demo-p4", name: "ハイカットスニーカー", price: 8800 }],
    amount: 8800,
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
      { id: "demo-p5", name: "ケーブルニット オフホワイト", price: 9800 },
      { id: "demo-p2", name: "ボーダー Tシャツ", price: 4800 },
    ],
    amount: 14600,
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
    title: "夏物、店頭に並びはじめました",
    body: "Tシャツやシャツを中心に、夏物が店頭に並びはじめました。\n\n一点ずつ状態を確かめて値付けしています。\n実際に手に取って、生地の感じを確かめてみてください。\n\nオンライン掲載分はShopページからどうぞ。",
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
