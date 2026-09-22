# Let's DIY — Ver.1 実装フェーズ

- 対応設計書: [DESIGN_V1.md](./DESIGN_V1.md)
- 最終更新: 2026-09-22（DoD に UI デザイン規則を追加）

---

## 共通ルール（全フェーズ）

### ブランチとコミット

| Phase | ブランチ名 |
|-------|-----------|
| 0 | `chore/phase-0-scaffold` |
| 1 | `feat/phase-1-viewport` |
| 2 | `feat/phase-2-part-creation` |
| 3 | `feat/phase-3-selection` |
| 4 | `feat/phase-4-transform` |
| 5 | `feat/phase-5-snap` |
| 6 | `feat/phase-6-operation-preview` |
| 7 | `feat/phase-7-csg` |
| 8 | `feat/phase-8-history` |
| 9 | `feat/phase-9-persistence` |
| 10 | `feat/phase-10-polish` |

Conventional Commits を使い、1 コミットは 1 つの意味のある単位にする。

### 各フェーズの Definition of Done（すべて MUST）

1. そのフェーズの「完了条件」を全て満たす
2. そのフェーズの「テスト項目」が自動テストとして存在し、パスする
3. `npm run typecheck` がエラー 0
4. `npm run lint` がエラー 0
5. `npm run test` が全パス
6. `npm run build` が成功
7. ブラウザのコンソールにエラー・警告が出ない
8. 「手動確認」の項目を実際に操作して確認した
9. **DESIGN_V1 §3.8「UI デザイン規則」に違反していない**
   - 画面に絵文字・幾何記号を出していない（アイコンは `lucide-react` のみ）
   - 色付き `border-left` のカードを作っていない
   - 確認コマンド: `npm run lint`（§3.8 の禁止文字は ESLint ルールで検出する）
10. 設計書と実装が食い違う場合、**実装を変える前に該当箇所を引用して報告する**

### テストの置き場所

```
src/core/**/__tests__/*.test.ts        ← 主戦場。純粋関数のユニットテスト
src/geometry/**/__tests__/*.test.ts    ← three 依存。jsdom + 頂点数/BoundingBox の検証
src/store/**/__tests__/*.test.ts       ← コマンドと履歴
src/ui/**/__tests__/*.test.tsx         ← Testing Library。重要フォームのみ
```

`viewport/` の R3F コンポーネントは Ver.1 では自動テスト対象外（手動確認とする）。

---

## Phase 0 — プロジェクト初期化

### 実装内容

1. Vite + React 19 + TypeScript（`strict: true`, `noUncheckedIndexedAccess: true`）
2. 依存追加:
   `three` `@react-three/fiber` `@react-three/drei` `three-bvh-csg` `zustand` `immer` `zod` `lucide-react`
   dev: `vite` `typescript` `vitest` `@testing-library/react` `@testing-library/jest-dom` `jsdom` `eslint` `prettier` `tailwindcss` `@tailwindcss/vite`
3. `npm scripts`（DESIGN_V1 §4.6）
4. ESLint flat config。**レイヤ依存ルールを設定する（DESIGN_V1 §5.1）**
   ```js
   // core は three / react / zustand を import 禁止
   // store は three / react-three を import 禁止
   // ui は three / three-bvh-csg を import 禁止
   ```
   `no-restricted-imports` の `patterns` で実現する。
5. `src/core/types.ts` を **DESIGN_V1 §8 のとおり完全に作成**
6. `src/core/constants.ts` を **DESIGN_V1 付録 A のとおり作成**
7. `src/core/ids.ts`（`crypto.randomUUID().slice(0, 8)` を使った短い ID）
8. `src/core/result.ts`（`AppError` / `Result`）
9. `src/ui/AppShell.tsx` — TopBar / LeftPanel / 中央（空の div）/ RightPanel / StatusBar の 3 カラム骨組み。CSS Grid で構成し、中央は `flex: 1`
10. Tailwind のダーク基調テーマ（CAD らしい低彩度の配色）を `styles/index.css` の CSS 変数で定義

### 完了条件

- `npm run dev` でブラウザに 3 カラムのレイアウトが表示される
- ウィンドウをリサイズしても左 280px / 右 320px が固定され、中央が伸縮する
- `src/core/types.ts` に §8 の全型が存在し、他ファイルから import できる
- ESLint がレイヤ違反 import を実際にエラーにする（意図的に違反コードを書いて確認し、消す）

### テスト項目

| テスト | 内容 |
|--------|------|
| `ids.test.ts` | ID が接頭辞つきで、1000 回生成して重複しない |
| `result.test.ts` | `AppError` が `code` と日本語 `message` を保持する |

### 手動確認

- レイアウトが崩れない
- コンソールがクリーン

---

## Phase 1 — Three.js ビューポート

### 実装内容

1. `viewport/Viewport.tsx` — `<Canvas frameloop="demand" shadows dpr={[1,2]}>`（DESIGN_V1 §10.1）
2. `viewport/SceneRoot.tsx`
3. `viewport/Lighting.tsx`（§10.3）
4. `viewport/GridFloor.tsx` — `drei <Grid>`。主線 1000mm / 副線 100mm、フェード距離 8000
5. 原点軸ヘルパー（X 赤 / Y 緑 / Z 青、長さ 200mm）
6. `viewport/CameraRig.tsx` — `OrbitControls`（`makeDefault`、`enableDamping` は false にして CAD らしい即応性にする）
7. `viewport/ViewCube.tsx` — 右下に「正面 / 背面 / 上 / 下 / 左 / 右 / 等角」ボタン。押すとカメラ位置を切り替える
8. `drei <GizmoHelper>` + `<GizmoViewport>` を左下に配置
9. `AppShell` の中央に `Viewport` を差し込む
10. `ErrorBoundary`（`ui/common/ErrorBoundary.tsx`）で Viewport を包む
11. WebGL2 非対応時のフォールバック表示（§18.5）
12. **DESIGN_V1 §3.8 規則 1 の禁止文字を検出する ESLint ルールを追加する**
    - `no-restricted-syntax` で JSX テキスト・文字列リテラル中の絵文字／幾何記号を拒否する
    - 対象は `src/**/*.tsx` と `src/**/*.css`（CSS は `content:` の値）
    - `src/core/**` の日本語メッセージは対象だが、禁止文字を含まないので影響しない
13. `--warning` / `--success` を `styles/index.css` の CSS 変数に追加する（§3.8 規則 3）

### 完了条件

- グリッド床と原点軸が表示される
- 左ドラッグで回転、右ドラッグ（または中ドラッグ）でパン、ホイールでズームができる
- 視点ボタンで 7 方向に切り替わる
- 左下の軸ジズモがカメラの向きに追従する
- **マウスを動かしていないとき、描画が止まっている**（下記で検証）
- **検証用の `useFrame` ログを削除済みである**（`SceneRoot.tsx` に `console.log('frame', ...)` が残っていない）
- `npm run lint` が §3.8 の禁止文字ルールを実際に検出する（違反コードを入れて確認し、消す）

### テスト項目

自動テストなし（3D 表示）。代わりに **描画停止の検証コードを一時的に入れて確認する**:

```ts
// 確認後に削除すること
let n = 0;
useFrame(() => { console.log('frame', ++n); });
```

静止 5 秒でログが増えないことを確認し、コードを削除する。

### 手動確認

- カメラ操作が滑らかで、フレーム落ちしない
- ウィンドウリサイズでキャンバスが追従し、歪まない
- コンソールに three.js の警告が出ない

---

## Phase 2 — 木材生成

### 実装内容

1. `core/part/createPart.ts` — 既定値つき `Part` 生成
2. `core/part/localFrame.ts` — `cornerToLocal` / `localToCorner`
3. `core/part/partBounds.ts` — ローカル AABB、ワールド 8 頂点、ワールド AABB
4. `core/part/partHash.ts` — 形状ハッシュ（DESIGN_V1 §17.3）
5. `core/project/createProject.ts`
6. `geometry/boxGeometry.ts` — `createBoxGeometry(size)`（中心原点）
7. `geometry/transformUtils.ts` — `applyTransform(object3d, transform)`（度 → ラジアン）
8. `geometry/GeometryCache.ts` — **この時点で完全な形で作る**。ただし構築処理は `createBoxGeometry` を返すだけ（CSG は Phase 7 で差し込む）
9. `store/useProjectStore.ts` — `project` 保持。この時点では素の `set` でよい（Phase 8 で `applyCommand` に移行）
10. `store/useEditorStore.ts` — `mode`, `selectedIds`, `hoveredId`, `snap`
11. `store/commands/partCommands.ts` — `addPart`
12. `viewport/PartsLayer.tsx` / `viewport/PartMesh.tsx`（DESIGN_V1 §10.4）
13. `viewport/hooks/usePartGeometry.ts`
14. `viewport/materials/materialLibrary.ts`
15. `viewport/hooks/useInvalidateOnStore.ts`
16. `ui/common/NumberField.tsx`（DESIGN_V1 §9.6 の仕様を完全に実装）
17. `ui/left/ModeTabs.tsx` / `ui/left/LeftPanel.tsx` / `ui/left/CreatePanel.tsx`
18. 材料プリセットボタン（付録 A の `MATERIAL_PRESETS`）
19. 配置先オプション（原点 / 選択部材の右隣 / カメラ注視点）
20. 空状態の案内テキスト

### 完了条件

- 幅 600 / 高さ 300 / 厚み 18 を入力して「生成する」を押すと、3D 空間に直方体が現れる
- 生成された部材が `useProjectStore` の `project.parts` に正しい `Part` として入っている（React DevTools で確認）
- プリセットボタンで寸法フィールドが即座に埋まる
- 複数回生成すると、それぞれ別位置に重ならず並ぶ
- `NumberField` が §9.6 の挙動を全て満たす
- 生成された直方体の寸法が実測（`geometry.boundingBox`）で入力値と一致する

### テスト項目

| ファイル | テスト |
|----------|--------|
| `createPart.test.ts` | 既定値が入る / `id` が一意 / `operations` が空配列 |
| `localFrame.test.ts` | `cornerToLocal(size, [100,50,0])` が `[-200,-100,-9]` になる（size 600×300×18）/ 往復変換で元に戻る / 8 頂点すべてで検証 |
| `partBounds.test.ts` | 回転 0 の AABB / Y 軸 90° 回転した部材の AABB が X と Z が入れ替わる / 45° 回転で AABB が拡大する |
| `partHash.test.ts` | transform を変えてもハッシュ不変 / size を変えると変化 / name・visible を変えても不変 |
| `boxGeometry.test.ts` | `boundingBox` が `[-x/2, x/2]` 等になる / 頂点数 24 / index 長 36 |
| `GeometryCache.test.ts` | 同じ Part を 2 回 `get` して同一インスタンスが返る / hash 変化で新インスタンス / `release` で dispose が呼ばれる |
| `NumberField.test.tsx` | 入力中は `onCommit` が呼ばれない / Enter で呼ばれる / blur で呼ばれる / min・max でクランプ / 空文字で直前値に戻る / ↑↓ と Shift+↑↓ |

### 手動確認

- 生成した部材に影が落ちる
- 部材を 10 枚生成してもフレーム落ちしない
- 生成後も静止時に描画が止まっている

---

## Phase 3 — 選択とプロパティ表示

### 実装内容

1. `viewport/hooks/usePointerPick.ts` — クリック → `partId`、`pickFace`（DESIGN_V1 §10.5）
2. `PartMesh` の `onPointerDown` / `onPointerOver` / `onPointerOut`
3. `Canvas` の `onPointerMissed` で選択解除
4. `Shift+クリック` で選択に追加 / 解除（複数選択）
5. `geometry/edgesGeometry.ts` + `viewport/SelectionOutline.tsx`
6. ホバー時のハイライト（`emissive` を微加算した専用マテリアルに差し替え）
7. `store/selectors.ts` — `useSelectedPart`, `useSelectedParts`, `usePartById`
8. `ui/left/PartOutliner.tsx` — 部材一覧。行クリックで選択、目アイコンで `visible`、鍵アイコンで `locked`
9. `ui/right/PropertyPanel.tsx` + `PartInfoSection` + `SizeSection` + `TransformSection`
   - この時点では **表示のみ**（編集は Phase 4）でもよいが、`SizeSection` は編集可にしてよい
10. `ui/common/Section.tsx`（折りたたみ見出し）
11. `ui/statusbar/StatusBar.tsx` — 選択数・スナップ設定・単位を表示
12. 選択が 0 / 1 / 複数 のそれぞれで右パネルの表示を切り替える

### 完了条件

- 3D 上の部材をクリックすると選択され、オレンジのアウトラインが出る
- 何もない場所をクリックすると選択が解除される
- Outliner の行をクリックしても同じ選択になり、3D 側とハイライトが同期する
- Shift+クリックで複数選択でき、StatusBar の選択数が変わる
- ホバーで部材がわずかに明るくなる
- 右パネルに名前・材質・寸法・位置・回転が正しい値で表示される
- 寸法を変更すると 3D の形状が即座に変わる
- 目アイコンで非表示にでき、鍵アイコンでロックできる

### テスト項目

| ファイル | テスト |
|----------|--------|
| `pickFace.test.ts` | 回転 0 の部材で 6 面すべてが正しく判定される / Y 軸 90° 回転した部材でも正しい / 面の境界付近（角）でも例外を投げない |
| `selectors.test.ts` | 選択 0/1/複数 の各ケース / 存在しない id を含む場合に落ちない |
| `partCommands.test.ts` | `setPartSize` が size を更新し、他フィールドを変えない / 0 以下の寸法を拒否する |
| `PropertyPanel.test.tsx` | 選択 0 件で案内文 / 1 件で全セクション / 複数件で一括操作のみ |

### 手動確認

- 重なった部材をクリックしたとき、手前の部材が選択される
- Outliner を 30 行にしてもスクロールが破綻しない

---

## Phase 4 — 移動・回転・複製・削除

### 実装内容

1. `store/commands/transformCommands.ts` — `setPartPosition`, `setPartRotation`, `translateParts`
2. `store/commands/partCommands.ts` に `duplicateParts`, `removeParts`, `renamePart`, `setPartMaterial` を追加
3. `viewport/TransformGizmo.tsx` — `drei <TransformControls>`（DESIGN_V1 §11.2）
   - ドラッグ中は `OrbitControls` を無効化
   - 選択 1 件かつ `!locked` かつ配置モードのときのみ表示
4. `ui/left/ArrangePanel.tsx` — ギズモモード切替、複製、削除
5. `ui/common/Vec3Field.tsx` — X/Y/Z 3 つの `NumberField`
6. `TransformSection` を編集可能にする
7. `ui/hooks/useKeyboardShortcuts.ts` — `1/2/3`, `G`, `R`, `Ctrl+D`, `Delete`, `Esc`, `F`
   - **入力欄にフォーカスがあるときはショートカットを無効化する**
8. `CameraRig` に `focusOnParts(ids)` を実装し、`F` キーとボタンから呼ぶ
9. `duplicateParts` の仕様（DESIGN_V1 §11.3）を実装
10. `removeParts` の仕様（§11.4）を実装。ロック部材はスキップして Toast

### 完了条件

- 右パネルで位置 X に `300` と入力すると、部材がその位置へ移動する
- 回転 Y に `90` と入力すると、部材が 90° 回る
- ギズモをドラッグして移動・回転でき、右パネルの数値がリアルタイムに追従する
- ギズモのドラッグ中にカメラが回らない
- `G` / `R` でギズモが切り替わる
- `Ctrl+D` で複製され、元と重ならない位置に配置され、複製側が選択される
- `Delete` で削除され、`GeometryCache` から dispose される
- ロックした部材はギズモが出ず、削除もされない
- 数値入力欄にフォーカスがある状態で `1` を打っても、モードが切り替わらない

### テスト項目

| ファイル | テスト |
|----------|--------|
| `transformCommands.test.ts` | `setPartPosition` が position のみ更新 / `setPartRotation` が正規化される（370 → 10）/ ロック部材を変更しない |
| `partCommands.test.ts` | `duplicateParts`: id と全 operation id が新規採番される / 元の Part が変わらない / 名前に「(コピー)」が付く / 位置が X に `size.x + 20` ずれる |
| 同上 | `removeParts`: 指定 id のみ削除 / ロック部材はスキップ / 存在しない id を無視 |
| `useKeyboardShortcuts.test.tsx` | input にフォーカス中はハンドラが発火しない |

### 手動確認

- ギズモのドラッグ中もフレームレートが落ちない
- ドラッグ中に CSG や `buildPartGeometry` が呼ばれない（`console.debug` で確認）
- 部材 20 枚で快適に操作できる

---

## Phase 5 — スナップ

### 実装内容

1. `core/snap/gridSnap.ts` — `snapValue`, `snapVec3`
2. `core/math/angle.ts` — `normalizeDeg`, `snapAngle`, `degToRad`, `radToDeg`
3. `core/math/matrix.ts` — `transformToMatrix`, `worldToLocalPoint`, `localToWorldPoint`, `localToWorldDir`
4. `core/math/axis.ts` — DESIGN_V1 付録 B
5. `core/part/partFaces.ts` — `worldFace(part, dir)` が法線・中心・面内 2 軸・半寸法を返す
6. `core/snap/faceSnap.ts` — `computeFaceSnapTransform`（DESIGN_V1 §12.4）
7. `core/snap/align.ts` — `computeAlignedPositions`（§11.5）
8. `store/commands/transformCommands.ts` に `applyFaceSnap`, `alignParts` を追加
9. `ArrangePanel` にスナップ設定 UI（グリッド OFF/1/5/10、角度 OFF/15/45/90）
10. `TransformControls` に `translationSnap` / `rotationSnap` を接続
11. `setPartPosition` / `setPartRotation` にもスナップを適用
12. `ui/left/FaceSnapWizard.tsx` — 2 段階の面選択 UI + 隙間入力 + 中心合わせ
13. `viewport/FacePickOverlay.tsx` — 面スナップ中の面ハイライトとクリック判定
14. `ui/common/HintBar.tsx` — ビューポート上部中央のヒント表示
15. `ui/left/AlignTools.tsx` — 軸 × 基準の整列ボタン
16. スナップ設定を `letsdiy.editorPrefs` に保存（設計データとは別）

### 完了条件

- グリッド 10mm でギズモをドラッグすると、位置が 10mm 刻みになる
- グリッド 10mm で数値に `137` を入力すると `140` に丸められる
- グリッド OFF で自由に動かせる
- 角度 90° で回転ギズモが 90° 刻みになる
- 面スナップウィザードで 2 つの面を選ぶと、部材がぴったり接触する
- 隙間に `5` を入れると 5mm の隙間が空く
- 「面の中心を合わせる」で面中心が一致する
- 回転している部材でも面スナップが正しく動く
- 同じ部材の面を 2 つ選ぶとエラーメッセージが出て適用できない
- 2 部材以上選択して整列ボタンを押すと、指定軸で揃う
- Esc でウィザードが中断される

### テスト項目

| ファイル | テスト |
|----------|--------|
| `gridSnap.test.ts` | `snapValue(137, 10) === 140` / `snapValue(135, 10) === 140`（`Math.round` の挙動を明記）/ `snapValue(-137, 10) === -140` / `step 0` で素通し |
| `angle.test.ts` | `normalizeDeg(370) === 10` / `normalizeDeg(-10) === 350` / `snapAngle(47, 45) === 45` / `snapAngle(68, 45) === 90` |
| `matrix.test.ts` | `localToWorldPoint → worldToLocalPoint` の往復で元に戻る（回転あり）/ 90° 回転での既知の値 |
| `partFaces.test.ts` | 回転 0 で 6 面の法線が単位ベクトル / Y 軸 90° 回転で `+x` 面の法線が `[0,0,-1]` になる |
| `faceSnap.test.ts` | **DESIGN_V1 §12.4 の必須ケース 5 件すべて** / 適用後に 2 面の距離が `gap` と 0.001mm 以内で一致することを数値で検証 |
| `align.test.ts` | min/center/max × X/Y/Z の 9 通り / 回転した部材を含む場合の AABB 基準 / 1 件のみ選択で何も変わらない |

### 手動確認

- 面スナップのヒント文言が各ステップで正しく変わる
- 面ホバーのハイライトが分かりやすい
- 面スナップで箱組み（側板 2 枚 + 底板）が 1 分以内に作れる

---

## Phase 6 — 加工プレビュー（CSG なし）

### 実装内容

1. `core/operation/operationDefaults.ts` — 種類別の初期値（部材サイズに応じた妥当な既定位置）
2. `core/operation/toolSolid.ts` — **DESIGN_V1 §13.2 のとおり 4 種類すべて実装**
3. `core/operation/operationValidate.ts` — §13.3 の全ルール
4. `core/operation/operationLabel.ts` — 一覧表示用の文字列
5. `geometry/toolGeometry.ts` — `ToolSolidSpec → BufferGeometry`（`position`/`rotation` を焼き込む）
6. `useEditorStore` に `operationDraft: OperationDraft | null` を追加
7. `ui/left/MachinePanel.tsx` — 対象表示、加工種類ボタン、既存加工リスト
8. `ui/left/OperationForm.tsx` — 種類別のパラメータ入力
   - 位置の基準トグル（中心 / コーナー）
   - `direction` の選択（`DIRECTION_LABELS` を使う）
   - エラー・警告の表示
   - `onPreview` でリアルタイムに draft を更新
9. `viewport/OperationPreview.tsx` — 半透明のツール立体（§13.5）
10. 加工モードで部材未選択のときの案内表示

### 完了条件

- 加工モードで丸穴を選び、径・深さ・位置を入力すると、**半透明の赤い円柱が部材上の正しい位置に表示される**
- 貫通にチェックを入れると、円柱が部材を突き抜ける長さになる
- `direction` を 6 方向すべてに切り替えると、円柱の向きと位置が正しく変わる
- 角穴・切り欠き・切断でも同様にプレビューが出る
- 切断のプレビューは「削り取られる側」を覆うボックスとして表示される
- 径に `0` を入れると赤いエラーが出て、実行ボタンが無効になる
- 穴が端から近すぎると黄色の警告が出るが、実行ボタンは有効のまま
- 位置の基準をコーナーに切り替えると、値が `600×300×18` の板で `(100, 50, 0)` のように表示される
- **パラメータを連打してもフレーム時間が 16ms を超えない**（CSG が走っていない証拠）

### テスト項目

| ファイル | テスト |
|----------|--------|
| `toolSolid.test.ts` | 丸穴・貫通: 高さ ≥ `size[axis] + 2*OVERCUT` / 円柱の中心が正しい / 6 方向すべて |
| 同上 | 丸穴・非貫通: 深さ `d` の穴が、指定面から `d` だけ入った位置で終わる |
| 同上 | 角穴: 断面の 2 辺が `width`/`height` に一致し、深さ軸が `direction` の軸 |
| 同上 | 切り欠き: `size`/`position` がそのまま反映される |
| 同上 | 切断: `keep: 'negative'` のとき、ツールボックスが `offset` より正側を完全に覆う（境界を数値で検証） |
| 同上 | 切断: `keep: 'positive'` で逆側を覆う |
| `operationValidate.test.ts` | §13.3 の表の各行に対応するケース |
| `operationLabel.test.ts` | 「丸穴 φ8 貫通 @ (100, 50)」形式になる |
| `toolGeometry.test.ts` | 生成ジオメトリの `boundingBox` が `spec` の寸法・位置と一致する |

### 手動確認

- プレビューが部材と一緒に回転する（部材の子として配置されている）
- 加工モードを抜けるとプレビューが消える
- Esc でキャンセルできる

---

## Phase 7 — CSG 加工

### 実装内容

1. `geometry/csg/CsgEngine.ts` — インターフェース（DESIGN_V1 §8.1）
2. `geometry/csg/BvhCsgEngine.ts` — 実装（§14.2）。**`clone()` 忘れに注意**
3. `geometry/csg/index.ts` — `getCsgEngine()` シングルトン
4. `geometry/geometryBuilder.ts` — 逐次減算（§14.3）
5. `GeometryCache` の構築処理を `buildPartGeometry` に差し替え（非同期化、`buildToken` 競合対策）
6. `usePartGeometry` を非同期構築に対応（構築中は直前のジオメトリを表示）
7. `store/commands/operationCommands.ts` — `addOperation`, `updateOperation`, `removeOperation`, `setOperationEnabled`, `reorderOperation`
8. `MachinePanel` の「加工を実行」「更新」ボタンを接続
9. 加工リストの [編集] [削除] [有効/無効チェック] を接続
10. `ui/right/OperationListSection.tsx` — 右パネルにも加工リストを表示
11. 失敗した加工への警告アイコン（Lucide `AlertTriangle`）表示
12. `ui/common/Toast.tsx` + `ToastHost` + `useToast`
13. 構築中インジケータ（StatusBar に「計算中…」）

### 完了条件

- 丸穴を実行すると、実際に穴が開いたメッシュになる
- 穴がプレビューと同じ位置・同じ径になっている
- 貫通穴が本当に貫通している（裏から見て穴が見える）
- 切断を実行すると、指定側だけが残る
- 角穴・切り欠きも動作する
- 加工を 5 件重ねても正しい形状になる
- **既存加工の径 8 → 6 に変更して更新すると、6mm の穴になる**（非破壊の証明）
- 加工を無効化すると、その加工がなかった形状に戻る
- 加工を削除すると、元の直方体 + 残り加工から再構築される
- 加工の順序を入れ替えても正しい形状になる
- **部材を移動・回転しても CSG が走らない**（`[geometry] build` ログが出ない）
- **A に加工したとき、B・C のジオメトリが再構築されない**
- 加工 10 件の部材の再構築が 300ms 以内
- 加工 → Undo（Phase 8 前なので削除で代替）を 50 回繰り返しても `renderer.info.memory.geometries` が増え続けない

### テスト項目

| ファイル | テスト |
|----------|--------|
| `BvhCsgEngine.test.ts` | ボックスから小ボックスを引いた結果の `boundingBox` が元と同じ / 体積が減っている（近似でよい）/ 同じ engine で 2 回減算しても 1 回目の結果が壊れない（`clone` の検証） |
| `geometryBuilder.test.ts` | 加工 0 件で素のボックスと同じ頂点数 / 貫通丸穴 1 件で頂点数が増える / `enabled: false` の加工が無視される / 形状消滅する加工が `failedOperationIds` に入り、直前形状が維持される / 例外を投げる加工があっても他の加工が適用される |
| 同上 | **順序依存**: 同じ 2 加工を順序を変えて適用しても、この 4 種類では結果の `boundingBox` が一致する |
| `GeometryCache.test.ts` | 構築中に hash が変わったら、古い構築結果が破棄される（`buildToken`）/ `syncWith` で消えた部材が dispose される |
| `operationCommands.test.ts` | `addOperation` が末尾に追加 / `updateOperation` が id 一致のもののみ更新 / `removeOperation` / `setOperationEnabled` / `reorderOperation` が順序を正しく入れ替える |

### 手動確認

- 穴の断面が正しく閉じている（穴の中が真っ黒／裏返しに見えない）
- 穴のエッジが Z-fighting でちらつかない（`OVERCUT` が効いている証拠）
- 部材 20 枚 × 加工 3 件 で操作が重くならない

---

## Phase 8 — Undo / Redo

### 実装内容

1. `store/history.ts` — `produceWithPatches` ベースの履歴（DESIGN_V1 §15）
2. `useProjectStore` を `applyCommand` 経由の書き込みに **全面移行**
   - `store/commands/**` の全関数を `applyCommand(label, recipe)` に書き換える
   - **直接 `set({ project })` する箇所を 0 にする**（`loadProject` を除く）
3. `beginTransient` / `updateTransient` / `commitTransient` / `abortTransient`
4. `TransformGizmo` を Transient に対応（ドラッグ開始 → 終了で 1 エントリ）
5. `reconcileAfterHistory()`（§15.3）
6. `ui/topbar/UndoRedoButtons.tsx` — `disabled` と `title`（直前操作ラベル）
7. `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` ショートカット
8. StatusBar に「最後の操作: <操作ラベル>」
9. 履歴上限 100 件（`HISTORY_LIMIT`）

### 完了条件

- 全ての編集操作（DESIGN_V1 §15.5 の「記録する」行すべて）が Undo できる
- Undo 後に Redo で完全に元に戻る
- ギズモで 1 回ドラッグしたら、Undo 1 回で移動前に戻る（何十回も押す必要がない）
- 削除した部材を Undo すると、加工履歴ごと完全に復活する
- Undo で部材が消えたとき、選択が自動的に解除される（右パネルが壊れない）
- Undo で形状ハッシュが変わらない部材は再構築されない
- 選択・モード切替・カメラ操作は Undo されない
- 新しい操作をすると Redo スタックが破棄される
- 101 回操作すると最古の履歴が捨てられ、メモリが増え続けない
- Undo/Redo ボタンが適切に `disabled` になる

### テスト項目

| ファイル | テスト |
|----------|--------|
| `history.test.ts` | `applyCommand → undo` で完全に元の Project に戻る（deep equal）/ `redo` で再適用される / 変化なしのコマンドは履歴に積まれない / 新規操作で future が空になる / 上限 100 を超えると最古が捨てられる |
| 同上 | Transient: `begin → update×10 → commit` で履歴が 1 件だけ増える / `abort` で元に戻り履歴が増えない |
| `historyCoverage.test.ts` | **`store/commands/**` の全コマンドについて**、実行 → undo で元の Project と deep equal になることを網羅的に検証（新しいコマンドを追加したら必ずここに足す） |
| `reconcile.test.ts` | Undo で消えた部材が `selectedIds` から除かれる / `operationDraft` がクリアされる |

### 手動確認

- 「生成 → 移動 → 加工 → 加工編集 → 削除」を行い、Undo 5 回で最初に戻る
- そこから Redo 5 回で最後の状態に戻る
- StatusBar のラベルが毎回正しい

---

## Phase 9 — 保存 / 読み込み

### 実装内容

1. `core/project/projectSchema.ts` — zod スキーマ（`Operation` は `z.discriminatedUnion('type', [...])`）
2. `core/project/serialize.ts` — `toDocument` / `fromDocument`
3. `core/project/migrate.ts` — 移行の仕組み（DESIGN_V1 §16.3）。Ver.1 時点で `MIGRATIONS` は空でよいが**枠は作る**
4. `io/ProjectRepository.ts` — インターフェース（§16.4）
5. `io/LocalStorageRepository.ts` — 実装。`QuotaExceededError` を `AppError('STORAGE_QUOTA')` に変換
6. `io/fileDownload.ts` / `io/fileOpen.ts` — `.ldiy.json` の入出力
7. `io/autosave.ts` — 1000ms debounce + `beforeunload` 同期保存
8. `useProjectStore.loadProject(project)` — 履歴クリア、`GeometryCache.clear()`、全部材の再構築、カメラフィット
9. `ui/topbar/FileMenu.tsx` — 新規 / 開く / 保存 / 名前を付けて保存 / JSON 書き出し / JSON 読み込み
10. プロジェクト名の編集（TopBar）
11. 未保存変更がある状態での「新規」「開く」の確認ダイアログ（§16.7）
12. 起動時の「前回の続きから再開しますか？」
13. StatusBar に保存状態（「保存しました hh:mm」/「未保存の変更」）

### 完了条件

- 「保存」で `.ldiy.json` がダウンロードされる
- その JSON に **メッシュ・頂点データが一切含まれていない**（ファイルを開いて目視確認）
- リロード後にそのファイルを読み込むと、部材の形状・位置・回転・加工が完全に復元される
- 加工を編集した状態も保存・復元される
- 壊れた JSON を読み込むと「ファイルが壊れています」と出て、アプリは動作を継続する
- スキーマに合わない JSON（`size` が負、`type` が未知）でフィールド名つきエラーが出る
- `schemaVersion: 999` のファイルで「新しいバージョンで作成されています」と出る
- 編集を止めて 1 秒後に自動保存され、リロード時に復元確認が出る
- 「新規」で未保存の変更があるときだけ確認が出る
- 読み込み後、Undo スタックが空になっている

### テスト項目

| ファイル | テスト |
|----------|--------|
| `serialize.test.ts` | `Project → Document → Project` の往復で deep equal / 4 種類の加工すべてを含むプロジェクトで往復 |
| `projectSchema.test.ts` | 正常な Document をパースできる / `size.x` が 0 以下で失敗 / 未知の `operation.type` で失敗 / 必須フィールド欠落で失敗 / エラーメッセージにフィールドパスが含まれる |
| 同上 | ID 重複の検出（zod の `superRefine`） |
| `migrate.test.ts` | 現行バージョンは素通し / `schemaVersion` が未来で `UNSUPPORTED_VERSION` / 移行手順がない古い版で `MIGRATION_MISSING` |
| `LocalStorageRepository.test.ts` | save → load の往復 / list が正しい `ProjectSummary` を返す / remove / 容量超過で `STORAGE_QUOTA` |
| `autosave.test.ts` | 連続 10 回変更で保存が 1 回にまとまる（フェイクタイマー） |
| **`roundTrip.test.ts`** | **統合: 部材 3 枚・加工 6 件のプロジェクトを保存 → 読み込み → 全部材のジオメトリを再構築し、頂点数と boundingBox が元と一致する** |

### 手動確認

- DESIGN_V1 §20.1 の S-14 〜 S-16 を実際に通す
- 保存した JSON が人間に読める（整形して出力する）

---

## Phase 10 — UI 仕上げ・エラー処理・性能検証

### 実装内容

1. `ui/common/HintBar.tsx` の文言をモード・状態ごとに整備
   - 部材 0 件: 「左の［生成］から木材を作りましょう」
   - 配置モード・未選択: 「部材をクリックするか、左の一覧から選んでください」
   - 面スナップ ①: 「動かす部材の面をクリックしてください」
   - 面スナップ ②: 「接触させる相手の面をクリックしてください」
   - 加工モード・未選択: 「加工する部材を選んでください」
   - 加工モード・draft 中: 「数値を入力して［加工を実行］を押してください」
2. 全ての空状態（部材 0 件、選択なし、加工 0 件）に案内文を入れる
3. 全ボタンに `title`（ショートカット表記入り）と `aria-label`
4. `ErrorBoundary` を app / viewport の 2 箇所に配置（DESIGN_V1 §18.4）
5. `AppError` の日本語メッセージを全コードパスで整備
6. Toast の種類分け（info / success / warning / error）と自動消去（error は手動で閉じる）
7. WebGL 非対応フォールバック（§18.5）
8. ログ接頭辞の統一（§18.6）。本番ビルドで `console.debug` を落とす
9. キーボードフォーカスリング、タブ順序の整理
10. 性能計測とプロファイリング
    - 部材 50 枚・加工 200 件のサンプルプロジェクトを生成するスクリプト（`scripts/genSample.ts`）
    - フレームレート、CSG 時間、メモリの計測結果を `docs/PERF_V1.md` に記録
11. `README.md` に起動方法・操作方法の簡潔な説明を追加

### 完了条件

- DESIGN_V1 §20.1 の **S-1 〜 S-16 をマニュアルなし・ショートカットなしで完遂できる**
- DESIGN_V1 §20.2 の品質ゲートを全て満たす
- 意図的に CSG を失敗させたとき（例: 極端な寸法）、アプリが落ちずに警告表示で継続する
- ビューポートで例外を起こしても、左右のパネルが生きていて保存できる
- 全ての操作でコンソールにエラー・警告が出ない
- `docs/PERF_V1.md` に実測値が記録されている

### テスト項目

| ファイル | テスト |
|----------|--------|
| `ErrorBoundary.test.tsx` | 子が throw してもフォールバックが表示される |
| `useToast.test.ts` | info/success は自動消去、error は残る |
| `AppError` | 全 `AppErrorCode` に対応する日本語メッセージが存在する（テーブル駆動テスト） |
| `HintBar.test.tsx` | 各状態で正しい文言が出る |

### 手動確認（受け入れシナリオ）

DESIGN_V1 §20.1 の S-1 〜 S-16 を上から順に実施し、各ステップの結果を記録する。
**1 つでも詰まる・迷う箇所があれば、それは UI の不備として修正対象とする。**

---

## 進捗チェックリスト

```
[x] Phase 0  プロジェクト初期化              Codex        2026-09-22
[x] Phase 1  Three.js ビューポート           Codex/Claude 2026-09-22
[x] Phase 2  木材生成                        Claude       2026-09-22
[x] Phase 3  選択とプロパティ表示            Claude       2026-09-22
[x] Phase 4  移動・回転・複製・削除          Claude       2026-09-22
[x] Phase 5  スナップ                        Claude       2026-09-22
[x] Phase 6  加工プレビュー                  Claude       2026-09-22
[x] Phase 7  CSG 加工                        Claude       2026-09-22
[x] Phase 8  Undo / Redo                     Claude       2026-09-22
[x] Phase 9  保存 / 読み込み                 Claude       2026-09-22
[~] Phase 10 UI 仕上げ・エラー処理・性能検証  Claude       一部のみ
```

Phase 10 の残り（性能計測・PERF_V1.md・README 追記・受け入れシナリオ通し）は
[REVIEW_LOG.md](./REVIEW_LOG.md) の T-01 / T-03 / T-05 を参照。

---

## Ver.2 以降の候補（Ver.1 では実装しない）

実装中に「これもやりたい」と思ったものは、ここに追記して Ver.1 のスコープから外すこと。

- 任意角の穴・切断（45° 留め）
- ドラッグ中の自動面吸着・エッジスナップ・頂点スナップ
- CSG の Worker 化（`CsgEngine` を差し替えるだけ）
- 断面を別色にする（`Evaluator.useGroups = true`）
- STL / OBJ 出力
- 部品表（BOM）生成・木取り図
- 寸法線表示
- ヒンジ・スライドレール・可動シミュレーション
- 干渉判定
- サーバー保存（`HttpProjectRepository` を追加）
- AI 設計支援
