# Ver.1 実装記録

## Phase 0（Codex）

- React 19.2 / Vite 7 / TypeScript strict / Tailwind 4 を導入。React Three Fiber 9.7 の peer dependency が React `<19.3` のため19.2系列に固定。
- DESIGN_V1 §8 の型定義と付録Aの定数を収録。
- UI と viewport の依存境界を守るため、App が AppShell の中央スロットに Viewport を渡す構成。
- typecheck / lint / test (2件) / build 成功。
- ESLint API に違反コードを入力し、core→three、store→fiber、ui→CSGがすべて拒否されることを確認。
- ブラウザ表示・コンソール警告0件を確認。幅1092px/1440pxの両方で左右280px/320px、中央492px/840px。

## 設計の確認事項（Claude Codeへのレビュー引き継ぎ）

- §12.4 の `d = dot(pB - pA, nB) - gap` は、正のgapを「隙間」とする完了条件と符号が逆になる。法線が外向きのため、離すには `+ gap` が必要。Phase 5着手時に仕様の整合を確認する。
  - **回答: 指摘は正しい。DESIGN_V1 §12.4 を `+ gap` に修正済み**（詳細は [REVIEW_LOG.md](./REVIEW_LOG.md)）。実装もこの符号で入っており、`faceSnap.test.ts` が gap 0 / 正 / 負 の 3 ケースを検証している。

---

## Phase 1〜10（Claude Code / 2026-09-22）

Codex のクレジット回復までの繋ぎとして、ユーザー依頼により Claude Code が実装した。
Codex が引き継ぐ前提で、設計書の構成・命名にそのまま従っている。

### Phase 1 — ビューポート

- R-01（検証用 `useFrame` ログ）を削除。`frameloop="demand"` が効いていることを再確認（静止時にフレームが進まない）。
- DESIGN_V1 §3.8 規則 1 を強制する ESLint ルール `no-restricted-syntax` を追加。違反コードで実際に発火することを確認済み。
- CSS 変数に `--warning` / `--success` / `--surface-hi` / `--border-hi` / `--accent-soft` を追加。
- 表示オプション（グリッド / 影）を TopBar から切り替え可能に。

### Phase 2 — 木材生成

- `core/part/`（createPart / localFrame / partBounds / partFaces / partHash）と `core/math/`（vec3 / angle / axis / matrix / box）。
- `matrix.ts` の回転行列は three.js の Euler order `'XYZ'` と完全一致させた。ここがずれると core の計算と画面がずれるため、`matrix.test.ts` で往復と既知の値を固定している。
- `GeometryCache` は CSG 導入前から完全な形で入れた（設計書 §19.1-2）。
- 材料プリセット 7 種、配置先オプション（原点 / 選択部材の右隣）。

### Phase 3 — 選択とプロパティ

- `pickFace` はクリック点をローカル座標に変換して最寄り面を返すため、加工でメッシュが変形しても安定する。
- Outliner に表示 / ロックのトグル。Shift+クリックで複数選択。

### Phase 4 — 移動・回転・複製・削除

- `TransformControls` のドラッグは Transient 扱い。マウスアップで 1 履歴に確定する。
- ドラッグ中はストアからの行列書き戻しを止める（`partObjects.dragging`）。
- `F` キー / ［寄る］ボタンで選択部材にカメラを寄せる。`cameraCommands` は three 非依存のため store 層に置いた（ui → viewport の import は ESLint が禁止するため）。

### Phase 5 — スナップ

- グリッド（OFF/1/5/10mm）、角度（OFF/15/45/90°）、面スナップウィザード、整列（軸 × min/center/max）。
- 面スナップは 90 度単位の軸整列回転 + 法線方向の平行移動。`gap` の符号は `+ gap`。
- 実機確認: 板 A の Z+ 面を板 B の Y+ 面にスナップ → 90 度回転が自動で入り、Y=309（300 + 18/2）に着地。

### Phase 6 — 加工プレビュー

- `toolSolidSpec` は純粋関数。プレビューと CSG が同じ 1 本を使うので結果が必ず一致する。
- 貫通穴は `OVERCUT`(0.5mm) ぶん部材の外へ出す。コプラナー面を作らせないため。

### Phase 7 — CSG

- `CsgEngine` インターフェース越しに `three-bvh-csg` を使用。直接 import しているのは `BvhCsgEngine.ts` のみ。
- `three-bvh-csg` を 0.0.17 → 0.0.18 に更新。
- 実機計測: 600x300x18 の板に貫通丸穴 1 件で 13ms、切り欠き 1 件で 4ms。
- 加工 → Undo → 加工の繰り返しでジオメトリを確実に dispose している。

### Phase 8 — Undo / Redo

- immer の `produceWithPatches` が返す `inversePatches` をそのまま使う。逆コマンドを自前で書かない。
- `historyCoverage` 相当のテストで、全コマンドについて「実行 → undo で元の Project と deep equal」を検証している。
- Transient は 10 回更新しても履歴 1 件。abort で完全に巻き戻る。

### Phase 9 — 保存 / 読み込み

- zod スキーマ、`migrate`（枠のみ・Ver.1 では変換なし）、`ProjectRepository` インターフェース + localStorage 実装。
- 自動保存は 1 秒 debounce + `beforeunload` で同期保存。起動時は自動復元せず確認ダイアログを出す。
- 実機確認: 保存された JSON にメッシュ・頂点データが一切含まれないことを確認（`hasMesh: false`）。

### Phase 10 — 仕上げ（一部）

- HintBar（状況に応じた 1 行ガイド）、StatusBar、Toast、ErrorBoundary（app / viewport の 2 段）、空状態の案内。
- デザイン規則の自動チェック（`designRules.test.ts`）で CSS も含めて走査。

### 品質ゲート（2026-09-22 時点）

| 項目 | 結果 |
|------|------|
| `npm run typecheck` | エラー 0 |
| `npm run lint` | エラー 0 |
| `npm run test` | 175 件すべてパス |
| `npm run build` | 成功。JS 1,421kB / gzip 404kB（上限 1.5MB） |
| ブラウザのコンソール | 下記の既知事項 1 件を除きクリーン |

---

## 既知の事項・設計からの意図的な逸脱

### 1. 選択アウトラインをバウンディングボックスに変更した

**設計書 §3.6 / §9.2**: 加工後メッシュの `EdgesGeometry` で輪郭を描く想定だった。

**実装**: 部材の現在のバウンディングボックスの枠（常に 12 本）を描く。

**理由**: CSG の出力には T 字接合（辺の途中に他の三角形の頂点が乗る）が避けられない。
頂点を位置だけで統合しても、T 字接合の辺は 2 枚の三角形に共有されないため `EdgesGeometry` が拾ってしまい、
面の中に分割線が残って見た目が汚くなる（実測 70 本）。
バウンディングボックス方式なら常に 12 本で、切断すれば枠も縮む。穴や切り欠きの形までは追わないが、
「どれを選んでいるか」「どこを占めているか」を伝えるという目的には足りる。
形に沿った輪郭が必要になったら Ver.2 で検討する。

### 2. 穴の位置入力は面内の 2 軸だけ表示する

**設計書 §3.4**: X / Y / Z の 3 つを表示するモックだった。

**実装**: 方向軸に直交する 2 軸だけ表示する。

**理由**: 方向軸の成分は「どの面から掘るか」で決まるため `toolSolidSpec` が上書きする。
無視される値を入力させるとユーザーが混乱する。切り欠きは 3 軸すべて表示する。

### 3. 切断プレビューは表示用に部材範囲へ切り詰める

**設計書 §13.1 / §13.5**: プレビューと CSG はどちらも `toolSolidSpec` の 1 本を使う。

**実装**: 原則はそのまま。ただし切断だけは、表示専用の `previewSolidSpec` で部材の範囲に切り詰める。

**理由**: 切断のツール立体は「残さない側の半空間を覆う巨大ボックス」なので、そのまま描くと
画面が赤一色になって何が削られるのか分からない。CSG に渡すのは常に `toolSolidSpec` の方であり、
形状の真実は 1 本のまま保たれている。`previewSolidSpec` は切断以外では `toolSolidSpec` をそのまま返す
（`toolSolid.test.ts` で検証）。

### 4. `three-bvh-csg` の非推奨警告（上流の問題）

初回の CSG 実行時にコンソールへ 2 行出る:

```
MeshBVH: "maxLeafTris" option has been deprecated. Use "targetLeafSize", instead.
```

`three-bvh-csg` 0.0.18 が `three-mesh-bvh` 0.9.x に旧オプション名を渡しているため。
アプリ側から抑止できない。動作には影響しない。

対応の選択肢: 上流の修正を待つ / `CsgEngine` の実装を manifold-3d に差し替える（インターフェースを切ってあるので差し替えは容易）。

### 5. Ver.1 スコープとして実装していないもの

- 名前付きプロジェクトスロットの UI（`ProjectRepository` と localStorage 実装はあるが、「一覧から開く」画面は未作成。現状はファイル入出力 + 自動保存 1 枠）
- 複数選択時の移動 / 回転ギズモ（設計どおり単一選択のみ）
- 性能計測（部材 50 枚・加工 200 件のサンプル生成スクリプトと `docs/PERF_V1.md`）
- `README.md` への操作説明の追記

---

## Codex への引き継ぎメモ

- 新しいコマンドを `store/commands/` に足したら、`src/store/__tests__/history.test.ts` の「全コマンドの undo 網羅」に必ず 1 行足すこと。
- 新しい UI を作るときは DESIGN_V1 §3.8 に従う。違反は `npm run lint`（絵文字・記号）と `npm run test`（CSS の border-left / box-shadow）で落ちる。
- `core/` は three にも React にも依存しない。テストの主戦場はここ。
- CSG を触るときは `BvhCsgEngine.ts` だけ。`evaluate()` の戻り値は必ず `clone()` する（使い回しバッファのため）。
