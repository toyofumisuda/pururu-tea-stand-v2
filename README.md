# ぷるる茶房（PURURU TEA STAND）見本サイト v2

Web制作の「制作実績」として見せるための見本サイトです。店舗は架空です。

- 1ページのLP（ヒーロー／定番の4つの味／こだわり／メニュー／カスタマイズ／ギャラリー／店舗情報／お問い合わせ）
- Three.js で、コードだけで作ったタピオカドリンクの3D（スクロールで味と色が変わる、指やマウスで傾く）
- 動きを減らす設定の端末や、WebGL が使えない端末では、SVG のイラストに自動で切り替える
- ビルド不要（HTML / CSS / JavaScript のみ）。Three.js は CDN から読み込む

## ファイル

```
index.html          ページ本体（SVGのイラストもここに入っている）
css/style.css       見た目
js/main.js          タブ・シミュレーター・フォームなどの動き
js/three-scene.js   3Dドリンク
favicon.svg         ファビコン
img/ogp.png         SNSで共有したときの画像（1200×630）
img/apple-touch-icon.png
.nojekyll           GitHub Pages でそのまま公開するための空ファイル
```

## 公開前に差し替えるところ

1. **お問い合わせの送信先**：https://formspree.io でフォームを作り、発行されたURLを `js/main.js` の先頭にある `FORMSPREE_ENDPOINT` に入れる（`index.html` の form の action も同じURLにしておく）。
2. **OGP の URL**：`index.html` の `og:url` と `og:image` を、実際に公開したURLに合わせる（今は `https://toyofumisuda.github.io/pururu-tea-stand-v2/` を想定）。

## GitHub Pages で公開する手順

1. GitHub で新しいリポジトリ `pururu-tea-stand-v2` を作る（Public）。
2. このフォルダで次を実行する。

   ```bash
   git init
   git add .
   git commit -m "ぷるる茶房 見本サイト v2"
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/pururu-tea-stand-v2.git
   git push -u origin main
   ```

3. GitHub のリポジトリで **Settings → Pages** を開き、Source を「Deploy from a branch」、Branch を `main` / `(root)` にして Save。
4. 1〜2分後、`https://<ユーザー名>.github.io/pururu-tea-stand-v2/` で見られる。
