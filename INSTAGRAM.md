# Instagram の投稿をトップページに自動表示する

トップページの Instagram セクションに、[@grit._vintage_sapporo](https://www.instagram.com/grit._vintage_sapporo/)
の最新投稿6件を自動で並べます。**投稿すれば、あとは何もしなくてもサイトに出ます。**

設定は最初の1回だけ。所要 20〜30分ほどです。

---

## しくみ

```
Instagram に投稿
      ↓
GitHub Actions が定期実行(公開のたび + 6時間おき)
  scripts/fetch-instagram.mjs
      ↓  Instagram の公式APIから最新投稿を取得
      ↓  画像も一緒にダウンロードして public/ に保存
  public/data/instagram.json
  public/assets/instagram/*.jpg
      ↓
GitHub Pages に公開
      ↓
ブラウザで js/instagram.js が JSON を読んで並べる
```

ポイントが2つあります。

- **アクセストークンはブラウザに置きません。** 公開されるJSに書くと誰でも読めてしまうため、
  GitHub Secrets に保管し、GitHub Actions の中だけで使います。
- **画像はダウンロードして自前で持ちます。** Instagram が返す画像URLは時間が経つと失効するので、
  そのまま貼ると数日で画像切れになります。

設定が終わっていない間・取得に失敗した間は、Instagram セクションは
**今までどおりボタンだけの表示**になります。サイトが崩れることはありません。

---

## 手順

### 0. 前提の確認

Instagram アカウントが**プロアカウント(ビジネス または クリエイター)**である必要があります。
個人アカウントでは公式APIが使えません。

確認方法: Instagramアプリ → プロフィール → 右上のメニュー → 「アカウントの種類とツール」
（すでにプロアカウントの場合はこの手順は不要です）

### 1. Meta for Developers でアプリを作る

1. https://developers.facebook.com/apps/ を開き、Instagram の運用に使っている
   Facebook アカウントでログイン
2. **「アプリを作成」**
3. アプリ名は何でも構いません（例: `Grit HP Instagram`）
4. ユースケースの選択で **「Instagramアカウントの管理」/「Instagram」** を選ぶ
5. 作成後、左メニューの **Instagram → API setup with Instagram login** を開く

> アプリは**開発モードのまま**で構いません。自分のアカウントを表示するだけなら
> アプリレビュー（審査）は不要です。

### 2. アクセストークンを発行する

「API setup with Instagram login」画面の
**Step 1: Generate access tokens** で、

1. **「Add account」** をクリック
2. Instagram のログイン画面が出るので、`grit._vintage_sapporo` でログイン
3. 権限の許可を求められるので許可する
4. アカウントが一覧に出たら、その行の **「Generate token」** をクリック
5. 表示された長い文字列（`IGAA...` で始まります）をコピー

> これがそのまま**長期トークン（有効期限60日）**です。
> このあと GitHub Actions が自動で延長し続けるので、通常は二度と発行し直す必要はありません。

### 3. GitHub にトークンを登録する

1. https://github.com/playmark0227-svg/grit/settings/secrets/actions を開く
2. **「New repository secret」**
3. Name: `IG_ACCESS_TOKEN`
4. Secret: 手順2でコピーした文字列を貼り付け
5. **「Add secret」**

### 4.〈推奨〉トークンを自動延長できるようにする

これを設定すると、トークンの期限切れを気にしなくてよくなります。
省略しても動きますが、その場合は**60日ごとに手順2〜3をやり直す**必要があります。

1. https://github.com/settings/personal-access-tokens/new を開く
   （Fine-grained personal access token の作成画面）
2. Token name: `grit-instagram`
3. Expiration: **No expiration**（無期限）
4. Repository access: **Only select repositories** → `playmark0227-svg/grit` を選択
5. Permissions → Repository permissions → **Secrets** を **Read and write** に変更
6. 「Generate token」を押し、表示されたトークン（`github_pat_...`）をコピー
7. 手順3と同じ画面（リポジトリの Secrets）に戻り、**Name: `GH_PAT`** として登録

### 5. 動作確認

1. https://github.com/playmark0227-svg/grit/actions を開く
2. 左の **「Deploy preview to GitHub Pages」** を選ぶ
3. 右上の **「Run workflow」** → 緑のボタンで実行
4. 2〜3分待って緑のチェックが付いたら、公開ページを開いて Instagram セクションを確認

うまくいっていれば、投稿6件が正方形で並びます。

---

## 運用について

| | |
|---|---|
| 更新のタイミング | 6時間おき（0時/6時/12時/18時 UTC = 日本時間 9時/15時/21時/3時）と、サイトを更新するたび |
| 表示件数 | 6件 |
| すぐ反映したいとき | Actions → Deploy preview to GitHub Pages → Run workflow |
| 動画・リール | サムネイルを表示し、右上に再生マークが付きます |
| クリック時 | Instagram の該当投稿が別タブで開きます |

**表示件数を変えるには** 2ファイルを揃えて直します。

- `public/js/instagram.js` の `MAX`
- `public/css/home.css` の `.home-insta__grid`（列数）

**60日以上サイトを更新しないと**、GitHub の仕様で定期実行が自動停止することがあります。
その場合は Actions 画面に「Enable workflow」のボタンが出るので、押せば再開します。

---

## うまく表示されないとき

まず https://github.com/playmark0227-svg/grit/actions で直近の実行を開き、
**「Instagram の最新投稿を取り込む」** ステップのログを見てください。エラー文が出ています。
（ログにトークンが出ることはありません。伏字になります）

| 症状・エラー | 原因と対処 |
|---|---|
| `Error validating access token` / `Session has expired` | トークンの期限切れ。手順2〜3をやり直す。手順4を設定していれば起きません |
| `IG_ACCESS_TOKEN が未設定` | 手順3ができていない。Secret名のスペルを確認 |
| `表示できる投稿が1件もありませんでした` | アカウントに投稿が無いか、権限の許可が外れている。手順2をやり直す |
| ワークフローは緑なのにサイトに出ない | ブラウザのキャッシュ。スーパーリロード（Mac: ⌘+Shift+R） |
| 「アクセストークンを延長」が失敗する | `GH_PAT` の権限不足。手順4-5の Secrets: Read and write を確認 |

---

## 手元で確認する

トークンを持っていれば、ローカルでも同じものが作れます。

```bash
IG_ACCESS_TOKEN='ここにトークン' node scripts/fetch-instagram.mjs && python3 serve.py
```

`public/data/instagram.json` が実データで上書きされますが、公開時には作り直されるので
そのままコミットしても、`git checkout public/data/instagram.json` で戻しても構いません。
ダウンロードした画像（`public/assets/instagram/`）は `.gitignore` 済みです。

Firebase Hosting へ手動デプロイする場合は、`firebase deploy` の前に上のコマンドを実行してください。
（GitHub Pages では自動で実行されます）

---

## 関係するファイル

| ファイル | 役割 |
|---|---|
| `scripts/fetch-instagram.mjs` | Instagram API から投稿と画像を取得して書き出す |
| `.github/workflows/pages.yml` | 定期実行・公開・トークンの自動延長 |
| `public/js/instagram.js` | JSON を読んでトップページに並べる |
| `public/css/home.css` | `.home-insta__grid` / `.insta-card` の見た目 |
| `public/index.html` | Instagram セクションの土台（`#insta-grid`） |
| `public/data/instagram.json` | 取得結果（公開のたびに作り直される） |
