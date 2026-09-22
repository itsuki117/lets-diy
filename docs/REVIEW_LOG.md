# レビュー記録

Claude Code による実装レビュー。指摘は Codex が対応し、対応後にこのファイルへ結果を追記する。

---

## 2026-09-22 — Phase 0 / Phase 1 レビュー

対象コミット: `a847fab`（Phase 0）+ 未コミットの Phase 1 作業ツリー

### 確認結果

| 項目 | 結果 |
|------|------|
| `npm run typecheck` | 成功 |
| `npm run lint` | 成功 |
| `npm run test` | 2 件パス |
| Phase 0 完了条件 | すべて充足 |
| Phase 1 完了条件 | 下記 R-01 を除き充足 |
| ブラウザ実機確認 | 3 カラム表示・グリッド床・原点軸・視点ボタン 7 種・軸ジズモを確認 |
| `frameloop="demand"` の実効性 | コンソール出力が `frame 1` のみ。静止時に描画が走っていないことを確認 |

### 指摘

#### R-01 [must] 検証用の `useFrame` ログが残っている

`src/viewport/SceneRoot.tsx`

```ts
let frames = 0;
export function SceneRoot(...) {
  useFrame(() => console.log('frame', ++frames));
```

PHASES_V1 Phase 1「テスト項目」は、このコードで描画停止を確認したうえで**削除する**ことを求めている。
現状は Phase 1 の Definition of Done 7（コンソールがクリーン）にも違反する。
モジュールスコープの `let frames` も併せて削除すること。

- 対応: **済**（2026-09-22、Claude Code が実装）

#### R-02 [must] Phase 1 が未コミット

`src/viewport/` 7 ファイルと `src/ui/common/ErrorBoundary.tsx` が untracked、`src/App.tsx` `src/styles/index.css` `vite.config.ts` `package.json` が変更済みのまま。
R-01 を修正したうえでコミットすること。

- 対応: **済**（2026-09-22。Phase 1〜10 の実装とまとめてコミット）

#### R-03 [must] UI デザイン規則への追従

DESIGN_V1 に **§3.8「UI デザイン規則」** を追加した（本レビューと同時）。

1. 画面に絵文字・幾何記号を出さない。アイコンは `lucide-react` のみ。
2. 色付き `border-left` のカード（警告・注記などのアクセントカード）を作らない。

現行の `AppShell.tsx` / `index.css` は既に両方を満たしている（Lucide 使用、アクセントカードなし）。
**Phase 2 以降で新規に作る UI がこれを破らないよう、Phase 1 のうちに ESLint ルールと CSS 変数を追加すること**（PHASES_V1 Phase 1 の実装内容 12 / 13）。

- 対応: **済**（2026-09-22）
  - `eslint.config.js` に `no-restricted-syntax` で禁止文字ルールを追加。違反コードで発火することを確認済み。
  - `src/ui/__tests__/designRules.test.ts` で CSS も含めて走査（border-left / box-shadow / アイコンライブラリ）。
  - `--warning` / `--success` を CSS 変数に追加。

### Codex からの確認事項への回答

#### §12.4 の `gap` 符号（IMPLEMENTATION_V1.md 記載）

**指摘は正しい。設計書を修正した。**

`nB` は target の外向き法線であり、source は target の面の外側に接する。
目標平面は `pB + nB * gap` なので、

```
d = dot((pB + nB * gap) - pA, nB) = dot(pB - pA, nB) + gap
```

となり `+ gap` が正しい。DESIGN_V1 §12.4 手順 3 を修正済み。
`gap = 0` で密着、正値で隙間、負値でめり込む。Phase 5 のテストではこの符号で検証すること。

---

## 2026-09-22 — Phase 1〜10 実装後のセルフレビュー

ユーザー依頼により Claude Code が Phase 1〜10 を実装した（Codex のクレジット回復までの繋ぎ）。
実装の詳細と設計からの逸脱は [IMPLEMENTATION_V1.md](./IMPLEMENTATION_V1.md) に記録した。

### 実装中に見つけて直した不具合

| # | 内容 |
|---|------|
| B-01 | `NumberField` で Escape を押すと、直後の blur が捨てたはずの値を確定させていた。`skipCommit` フラグで解決。 |
| B-02 | `NumberField` のクランプ表示用 `setTimeout` がアンマウント後に発火し、テスト環境で例外になっていた。unmount 時に `clearTimeout` する。 |
| B-03 | 起動直後に StatusBar が「未保存の変更があります」と出ていた。`savedAt` を初期プロジェクトの `updatedAt` で初期化。 |
| B-04 | 選択アウトラインが CSG の三角形分割線を拾っていた（IMPLEMENTATION_V1 の「既知の事項 1」で方式変更）。 |
| B-05 | `ui` から `viewport` を import しようとして ESLint のレイヤ規則に弾かれた。`cameraCommands` を three 非依存の store 層へ移動。規則が期待どおり機能している。 |

### 残作業（Codex への申し送り）

| # | 内容 | 優先度 |
|---|------|--------|
| T-01 | 性能計測。部材 50 枚・加工 200 件のサンプル生成スクリプトを作り、`docs/PERF_V1.md` に実測値を記録する（PHASES_V1 Phase 10 実装内容 10） | 高 |
| T-02 | 名前付きプロジェクトスロットの UI。`ProjectRepository` と localStorage 実装はあるので、「一覧から開く / 削除」画面を作るだけ | 中 |
| T-03 | `README.md` に起動方法と基本操作を追記（PHASES_V1 Phase 10 実装内容 11） | 中 |
| T-04 | `three-bvh-csg` の非推奨警告。上流の修正を待つか、`CsgEngine` を manifold-3d 実装に差し替える | 低 |
| T-05 | DESIGN_V1 §20.1 の受け入れシナリオ S-1〜S-16 を通しで実施し、詰まる箇所を洗い出す | 高 |

### 実機で確認済みのフロー

生成 → 複製 → 面スナップ（90 度回転の自動整列を含む）→ 加工（丸穴 / 切り欠き）→ プレビュー → CSG 実行 → Undo → Redo → 自動保存。
保存された JSON にメッシュ・頂点データが含まれないことも確認した。

---
