# Rename Implementation Plan: Fumen Mobile Branch

## Purpose

フォーク元との機能剥離と混同防止のため、このフォークの表示名・公開URL・ローカル配信パス・共有リンクを以下に揃える。

- 表示名: `Fumen Mobile Branch`
- repo名: `fumen-mobile-branch`
- 想定GitHub Pages URL: `https://61bi-234469.github.io/fumen-mobile-branch/`

## Basic Policy

- `fumen` は譜面ドメイン用語として広く使われているため、単純な全置換はしない。
- `src/lib/fumen/**`、`state.fumen`、`v115@...` のテストデータ、UI文言の `Open fumen` などは原則として変更しない。
- `knewjade.github.io/fumen-for-mobile` は本家参照として扱い、意図を確認せず一括置換しない。
- このフォーク自身を指す `61bi-234469.github.io/fumen-for-mobile-ts` は新repo名へ変更する。
- `serve.js` の配信パスとCypressのvisit先は必ず同時に変更する。

## Source Changes

### 1. Display Name and PWA Metadata

対象:

- `resources/index.html`
- `resources/manifest.json`
- `resources/help.html`

変更内容:

- `resources/index.html` の `<title>` を `Fumen Mobile Branch` に変更する。
- `resources/manifest.json` の `short_name` / `name` を `Fumen Mobile Branch` に変更する。
- `resources/help.html` の `<title>` を `Fumen Mobile Branch` に変更する。

注意:

- `resources/help.html` は保存HTML由来で文字化けや `Fumen for mobile_files/` 参照を含む。動作に必要な最小箇所だけ変更する。
- `Fumen for mobile_files/` のような保存HTML由来のローカルアセット名は、実体確認なしに機械置換しない。

### 2. Self URL and Share Link

対象:

- `src/components/modals/clipboard.tsx`

変更内容:

- `https://61bi-234469.github.io/fumen-for-mobile-ts/#?d=`
- `https://61bi-234469.github.io/fumen-for-mobile-ts/#?d=v115@vhAAgH`

を以下へ変更する。

- `https://61bi-234469.github.io/fumen-mobile-branch/#?d=`
- `https://61bi-234469.github.io/fumen-mobile-branch/#?d=v115@vhAAgH`

確認観点:

- `THIS SITE` ボタンが新URLをコピーすること。
- TinyURL生成用hidden inputも新URLになっていること。

### 3. Local Serve Path and Cypress Path

対象:

- `serve.js`
- `cypress/support/common.js`
- `cypress/integration/cold_clear_spec.js`
- `cypress/integration/url_behavior_spec.js`

変更内容:

- ローカル配信パスを `/fumen-for-mobile` から `/fumen-mobile-branch` に変更する。
- Cypressのvisit先も同じパスへ変更する。
- ローカル開発で既存URLを踏んだ場合の障害を避けるため、`serve.js` には `/fumen-for-mobile` も互換エイリアスとして残す。

確認観点:

- `yarn serve` 後、`http://localhost:8080/fumen-mobile-branch` で開けること。
- `http://localhost:8080/fumen-for-mobile` もローカル互換エイリアスとして開けること。
- Cypressのbase URLとアプリ配信パスが一致していること。

### 4. Service Worker Cache ID

対象:

- `webpack.config.js`

変更内容:

- `cacheId = 'fumen-for-mobile'` を `cacheId = 'fumen-mobile-branch'` に変更する。

注意:

- 旧URLで利用済みのユーザ環境には旧Service Workerキャッシュが残る可能性がある。
- 混同防止が目的なので、cacheIdは変更する方針とする。
- 旧キャッシュの明示削除までは今回のrename作業には含めない。

### 5. Package and README

対象:

- `package.json`
- `README.md`

変更内容:

- `package.json` の `"name": "tetfu-sp"` を `"fumen-mobile-branch"` に変更する。
- `README.md` の見出しを `# fumen-mobile-branch` に変更する。

判断ポイント:

- `README.md` 内のbookmarklet URLを新URLに変えるか、本家向けメモとして残すかを決める。
- フォーク利用者向けREADMEにするなら新URLへ変更する。
- 本家参照として残すなら「本家向けbookmarklet例」と明記する。

推奨:

- 混同防止を優先し、READMEのbookmarklet URLも `https://61bi-234469.github.io/fumen-mobile-branch/#?d=` に変更する。

### 6. Help and Bookmarklet Assets

対象:

- `resources/help.html`
- `resources/jump.js`

判断ポイント:

- このフォークから配るブックマークレットなら新URLへ変更する。
- 本家への導線として残すなら、その意図をREADMEまたはhelp内で明示する。

推奨:

- `resources/jump.js` はフォークの配布物なので、新URLへ変更する。
- `resources/help.html` 内のbookmarklet URLも新URLへ変更する。
- `resources/help.html` の本家説明リンクや `fumen.zui.jp` へのリンクは変更しない。

### 7. CI/CD

対象:

- `.github/workflows/deploy.yml`
- `.github/workflows/dev-workflow.yaml`

変更内容:

- `.github/workflows/deploy.yml` はGitHub Pagesへのdeployなので基本的にそのまま使う。
- `.github/workflows/dev-workflow.yaml` の `knewjade/fumen-for-mobile-dev` へのdeploy jobは削除する。
- dev workflowはtest jobだけ残す。

理由:

- フォーク側から `knewjade/fumen-for-mobile-dev` へdeployする権限は通常ない。
- 誤deployや本家向け設定の混入を避ける。

## External Operations

GitHub側で行う作業:

1. repository名を `fumen-mobile-branch` に変更する。
2. GitHub Pagesを再デプロイする。
3. 公開URLが `https://61bi-234469.github.io/fumen-mobile-branch/` になっていることを確認する。
4. 必要ならlocal remote URLを更新する。
5. 旧URL互換のため、`fumen-for-mobile-ts` をリダイレクト用のGitHub Pagesとして残す。

想定コマンド:

```bash
git remote set-url origin https://github.com/61bi-234469/fumen-mobile-branch
```

任意作業:

- ローカル作業ディレクトリ名 `C:\Users\user\fumen-for-mobile-ts` を変更する。
- 旧URL利用者向けの案内文や移行猶予期間をREADMEなどに明記する。

## Old URL Redirect Plan

既存の公開URL `https://61bi-234469.github.io/fumen-for-mobile-ts/` から新URL `https://61bi-234469.github.io/fumen-mobile-branch/` へ誘導するため、旧repo名をリダイレクト専用のGitHub Pagesとして維持する。

目的:

- 既に共有済みの譜面URLやブックマークのリンク切れを避ける。
- フォーク元との混同を避けつつ、既存利用者を新URLへ移行させる。

推奨手順:

1. 現repoを `fumen-mobile-branch` にrenameする。
2. GitHub上で新しく `fumen-for-mobile-ts` repoを作成する。
3. `fumen-for-mobile-ts` repoのGitHub Pagesを有効化する。
4. 旧repoのPagesには、クエリとハッシュを維持して新URLへ転送する最小HTMLを置く。

リダイレクトHTML案:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to Fumen Mobile Branch</title>
  <script>
    const target = 'https://61bi-234469.github.io/fumen-mobile-branch/';
    const next = target + window.location.search + window.location.hash;
    window.location.replace(next);
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0; url=https://61bi-234469.github.io/fumen-mobile-branch/">
  </noscript>
</head>
<body>
  <a href="https://61bi-234469.github.io/fumen-mobile-branch/">Fumen Mobile Branch</a>
</body>
</html>
```

注意:

- 既存URLは `/#?d=...` のようにハッシュ側へ譜面データを持つため、`window.location.hash` を必ず引き継ぐ。
- GitHub Pagesのリポジトリプロジェクトページでは、旧URLのサブパスも来る可能性がある。必要なら `404.html` にも同じリダイレクトHTMLを置く。
- rename直後はGitHubのrepository redirectが効く場合があるが、GitHub Pages URLの恒久的な互換性としては専用repoを置く方が確実。
- 旧repoはアプリ本体を配信せず、転送ページだけを管理する。

## Do Not Change

以下はrename対象外とする。

- `src/lib/fumen/**`
- `src/**/*.ts` 内の状態名・型名・関数名としての `fumen`
- テストデータ中の `v115@...`
- `fumen.zui.jp` と `harddrop.com/fumen` への外部エディタ連携URL
- `LICENSE` の本家著作権表記
- `third_party/**`
- `src/lib/cold_clear_wasm/**`
- `dest/**`

## Verification Plan

最低限:

```bash
yarn test
yarn webpack-prod
```

ローカル表示確認:

```bash
yarn serve
```

確認URL:

```text
http://localhost:8080/fumen-mobile-branch
```

E2E確認:

```bash
yarn cy-run
```

確認項目:

- ブラウザタイトルが `Fumen Mobile Branch` になっている。
- manifestのアプリ名が `Fumen Mobile Branch` になっている。
- `THIS SITE` のコピーURLが `fumen-mobile-branch` を指している。
- ローカル配信パスとCypressのvisit先が一致している。
- production buildで `dest/manifest.json` と `dest/index.html` に変更が反映される。

## Implementation Order

1. 表示名とmanifestを変更する。
2. 自サイトURLと共有リンクを変更する。
3. `serve.js` とCypressのパスを同時に変更する。
4. WorkboxのcacheIdを変更する。
5. `package.json` と `README.md` を変更する。
6. help/bookmarklet系のURLを方針に沿って変更する。
7. dev workflowの本家deploy jobを削除する。
8. `yarn test` と `yarn webpack-prod` を実行する。
9. 必要に応じて `yarn cy-run` を実行する。

## Risks

- 旧GitHub Pages URL `fumen-for-mobile-ts` は、リダイレクト用repoを用意するまで利用者の共有リンクが切れる可能性がある。
- Service Workerの旧キャッシュはユーザ環境に残る可能性がある。
- `knewjade.github.io/fumen-for-mobile` を誤って置換すると、本家参照やテスト意図を壊す可能性がある。
- `resources/help.html` は文字化けを含むため、大きく整形すると不要な差分や表示崩れが起きやすい。

## Open Decisions

- README内のbookmarkletをフォーク向けに更新するか、本家向けメモとして残すか。
- `resources/help.html` の本家backリンクを新URLに変えるか、外部参照として残すか。
- 旧URLリダイレクト用repoに `404.html` も置くか。
- ローカルディレクトリ名も `fumen-mobile-branch` に変更するか。
