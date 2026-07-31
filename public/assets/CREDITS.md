# 素材のライセンス

このフォルダのデニム生地写真は **Poly Haven** の CC0 素材です。

| ファイル | 元素材 | 用途 |
|---|---|---|
| `denim.jpg` / `denim.webp` | [Denim Fabric 04](https://polyhaven.com/a/denim_fabric_04)(継ぎ目なしタイル) | ECページ全体の背景・INFO・ブログのダミー画像 |
| `denim-seam.jpg` / `denim-seam.webp` | [Denim Fabric](https://polyhaven.com/a/denim_fabric)(縫い目・ステッチ入り) | SHOPのヒーロー背景・HPトップの生地スウォッチ |

- ライセンス: **CC0 1.0(パブリックドメイン)** — 商用利用可、クレジット表記も不要です。
  出典: https://polyhaven.com/license
- 撮影/加工: Poly Haven(Greg Zaal ほか)
- 加工内容: 1K版のカラーマップをWeb用に縮小・JPEG/WebP圧縮しただけで、色味はCSS側で調整しています
  (`background-blend-mode: multiply` + 染め色。`public/css/base.css` の「デニム地」ブロック参照)

`paper.svg` は自作のSVGテクスチャです。

## 差し替えたいとき

もっと好みのデニム生地写真がある場合は、同じファイル名で置き換えるだけで全ページに反映されます。
タイル用(`denim.jpg`)だけは **継ぎ目なし(シームレス)** の画像を使ってください。普通の写真だと
繰り返しの境目が線になって見えます。

## デモ用のサンプル写真(public/assets/demo/)

デモモードで表示される商品・ブログの写真は **Unsplash** のサンプル画像です。

- ライセンス: [Unsplash License](https://unsplash.com/license) — 商用・非商用を問わず無料で利用可、クレジット表記も不要
- 用途: **デザイン確認用のダミー**です。実際に商品を登録すると、管理ページからアップロードした写真に置き換わります
- 差し替え: 同じファイル名で上書きするだけで反映されます(商品は4:5、ブログカバーは16:10が綺麗に収まります)

| ファイル | 表示される場所 |
|---|---|
| p1-denim-jacket.jpg / p1-detail.jpg | 60s デニムジャケット(1枚目・2枚目) |
| p2-flannel.jpg | 70s チェックネルシャツ |
| p3-sweat.jpg | 80s リバースウィーブ スウェット |
| p4-jeans.jpg | 90s ストレートデニム 501 |
| p5-workpants.jpg | 50s ヘリンボーン ワークパンツ |
| p6-bandana.jpg | ヴィンテージバンダナ 赤 |
| p7-belt.jpg | サドルレザーベルト(SOLD表示の見本) |
| p8-military.jpg | 70s M-65 フィールドジャケット |
| b1-store.jpg / b2-jeans-stack.jpg | ブログ記事のカバー画像 |
| hero-store.jpg | **HPトップのヒーロー背景**(店内)。撮影したらここを差し替え |
| store-front.jpg | HPのINFOセクション背景(店舗外観) |
| about-rack.jpg | HPのABOUTセクションの店内写真 |
| detail-hats.jpg / detail-goods.jpg | ルックブック(流れる写真の帯)用 |

本番のFirebaseに商品を登録し始めたら、このフォルダごと削除してかまいません
(デモモードのときだけ使われます)。
