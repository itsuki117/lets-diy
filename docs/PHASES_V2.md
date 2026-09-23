# Let's DIY — Ver.2 実装フェーズ

- ステータス: **M0〜M12 実装済み**（2026-09-23）
- 対応設計書: [DESIGN_V2.md](./DESIGN_V2.md)
- 最終更新: 2026-09-23

---

## 共通ルール（全フェーズ）

### ブランチ

| Phase | ブランチ名 |
|-------|-----------|
| M0 | `feat/v2-m0-schema` |
| M1 | `feat/v2-m1-kinematics` |
| M2 | `feat/v2-m2-joint-commands` |
| M3 | `feat/v2-m3-pose-render` |
| M4 | `feat/v2-m4-motion-ui` |
| M5 | `feat/v2-m5-arrange-guard` |
| M6 | `feat/v2-m6-motion-scan` |
| M7 | `feat/v2-m7-hardware` |
| M8 | `feat/v2-m8-hardware-holes` |
| M9 | `feat/v2-m9-bom-hardware` |
| M10 | `feat/v2-m10-nesting` |
| M11 | `feat/v2-m11-drawing-stl` |
| M12 | `feat/v2-m12-miter-cut` |

### Definition of Done（すべて MUST）

Ver.1 の [PHASES_V1.md](./PHASES_V1.md) の 10 項目をそのまま適用したうえで、Ver.2 では次を追加する。

11. **Ver.1 のテスト 328 件が通り続けている**
12. **`hashPartShape` と `GeometryCache` を変更していない**（変更が要るなら設計を先に見直す）
13. **joint を動かして `[geometry] build` のログが出ない**（M3 以降）
14. schemaVersion 1 / 2 / 3 のサンプルが読み込める（M0 以降）

> 12 と 13 が Ver.2 の健全性の目印。ここが崩れたら設計から外れている。

### 着手前の確認

Phase M0 に入る前に [DESIGN_V2.md](./DESIGN_V2.md) §19 のチェックリストを上から読むこと。
特に「`Part.transform` が rest pose になる」という前提（§2）を理解していないと、
M3 以降で必ず詰まる。

---

## Phase M0 — 型と保存形式

### 実装内容

1. `core/types.ts` に Ver.2 の型を追加（DESIGN_V2 §6 のとおり）
   - `JointId` / `HardwareId`
   - `FixedJoint` / `RevoluteJoint` / `PrismaticJoint` / `Joint` / `MovableJoint` / `isMovableJoint`
   - `HardwarePreset` / `HardwareHole` / `Hardware`
   - `GasSpringMount`
2. `Project` に `joints` / `hardware` / `gasSprings` を追加
3. **`Part.transform` の JSDoc を「rest pose」に書き換える**
4. `SCHEMA_VERSION` を 4 へ。`MIGRATIONS[3]` で 3 配列を空で足す
5. `core/project/projectSchema.ts` に zod スキーマを追加
6. `core/constants.ts` に付録 A の定数を追加
7. `createProject` が 3 配列を空で初期化する
8. **互換検体を `samples/compat/` に置く**
   - `v1.ldiy.json`（既存の `samples/performance-50-200.json` を流用可）
   - `v2.ldiy.json`（アーチを含む）
   - `v3.ldiy.json`（角丸を含む。Ver.1 公開版の形式）

### 完了条件

- v1 / v2 / v3 のファイルを読むと、3 配列が空で入った v4 相当になる
- joint・金物を含む v4 のファイルが往復一致する
- Ver.1 のテスト 328 件が通り続ける
- `npm run build` が通る

### テスト項目

| ファイル | テスト |
|----------|--------|
| `migrate.test.ts` | v1 / v2 / v3 のいずれからでも v4 になる / 3 配列が空で足される / v5 は `UNSUPPORTED_VERSION` |
| `compat.test.ts`（新規） | `samples/compat/` の 3 ファイルがすべて読め、部材数と加工数が期待どおり |
| `serialize.test.ts` | joint・金物・ガススプリングを含む往復一致 |
| `projectSchema.test.ts` | 未知の `kind` を拒否 / `basePartId === movingPartId` を拒否 / `range.min > range.max` を拒否 / `quantity` が 0 以下を拒否 |

### 手動確認

- Ver.1 で保存した自動保存（localStorage）が読み込めること（実機）

---

## Phase M1 — 運動学（UI に触らない）

### 実装内容

1. `core/motion/kinematics.ts` — `solvePoses`（DESIGN_V2 §7.1）
2. `core/motion/jointValidate.ts` — 閉路検査・多重駆動検査・自己参照検査
3. `core/motion/jointDefaults.ts` — 種類ごとの初期値

**この Phase では画面に一切触らない。数式だけを固める。**

### 完了条件

- すべての joint の値が 0 のとき、全部材の pose が `part.transform` と完全一致する
- ヒンジを 90 度回すと、扉の姿勢が手計算と一致する
- 閉路のある構成を渡すと `problems` に理由が入り、**例外を投げない**
- `solvePoses` が three にも React にも依存していない（ESLint のレイヤ規則で確認）

### テスト項目

| テスト |
|--------|
| 値 0 で rest pose と完全一致（joint あり / なし混在の 5 部材） |
| revolute: 軸 [0,1,0]・原点 [0,0,0] で 90 度 -> 既知の座標 |
| revolute: 原点を端にずらした軸まわりの回転（実際の扉の蝶番） |
| revolute: 軸が単位ベクトルでなくても正規化される |
| revolute: 負の角度 |
| prismatic: 軸方向へ value mm だけ動く / 軸が正規化される |
| fixed: 親を動かすと子が同じだけ動く |
| 2 段（本体 -> 扉 -> 取っ手）で姿勢が伝播する |
| 3 段以上でも正しい |
| 閉路 A->B->A を検出する |
| 自己参照 A->A を検出する |
| 1 部材が 2 つの joint の movingPart になっている場合を検出する |
| 壊れた joint があっても、他の部材の pose は正しく計算される |
| `enabled: false` の joint は無視され、その部材は rest pose のまま |
| 存在しない部材を指す joint があっても落ちない |

---

## Phase M2 — joint のコマンド

### 実装内容

1. `store/commands/jointCommands.ts`
   - `addJoint` / `removeJoint` / `setJointValue` / `setJointRange` / `renameJoint` / `setJointEnabled`
2. `addJoint` は追加前に `jointValidate` を通し、閉路・多重駆動なら**拒否して Toast**
3. `partCommands.removeParts` を拡張し、関係する joint も**同じ Undo ステップ**で消す
4. `store/useMotionStore.ts` の器だけ作る（`solvePoses` の結果を持つ。表示反映は M3）

### 完了条件

- joint の追加・削除が Undo で完全に戻る
- 部材を消すと、その部材を使う joint も消え、Undo で両方戻る
- 閉路を作る joint は追加できず、理由が Toast に出る
- 1 部材を 2 つの joint の movingPart にしようとすると拒否される

### テスト項目

| ファイル | テスト |
|----------|--------|
| `history.test.ts` | **「全コマンドの undo 網羅」に joint 系 6 コマンドを追加**（必須） |
| `jointCommands.test.ts` | 閉路になる追加を拒否 / 多重駆動を拒否 / 値が範囲にクランプされる |
| `partCommands.test.ts` | 部材削除で joint が道連れになる / Undo で両方戻る / 1 履歴エントリで済んでいる |

---

## Phase M3 — 表示への反映

### 実装内容

1. `useMotionStore` が `solvePoses` の結果を保持し、`project` の変化で再計算する
2. `PartMesh` が `poses.get(part.id) ?? part.transform` を使う
3. `viewport/JointGizmo.tsx` — 回転軸（線 + 円弧）/ 移動方向（両矢印）/ 固定（リンク記号）の表示
4. joint を選択中のときだけギズモを出す

### 完了条件

- joint の値を store から直接変えると、3D の扉が回る
- **扉を開閉しても `[geometry] build` のログが出ない**（最重要）
- joint を無効化すると閉じた状態に戻る
- `fixed` joint で親を動かすと子が付いてくる

### 手動確認

- 静止時に描画が止まっている（Ver.1 の `frameloop="demand"` が効き続けている）
- joint を 10 本作っても操作が重くならない

---

## Phase M4 — スライダー UI

### 実装内容

1. `ui/left/JointPanel.tsx` — joint の一覧・追加ウィザード（固定側 -> 動く側 -> 軸）
2. `ui/right/MotionSection.tsx` — スライダー・範囲入力・［開く］［閉じる］
3. スライダーのドラッグは **Transient**（Ver.1 の `beginTransient` / `commitTransient`）
4. `O` キーで開閉トグル（ボタンと 1:1）
5. モードタブに `[金物] [可動]` を追加

### 完了条件

- スライダーを 1 回ドラッグすると、Undo 1 回で元の角度に戻る
- 範囲外の値を入力するとクランプされる
- 60fps を維持する（`solvePoses` が毎フレーム走らないこと）
- ［閉じる］で値が 0 に戻る

### テスト項目

- `MotionSection.test.tsx` — 範囲外入力のクランプ / `fixed` joint にはスライダーが出ない
- `history.test.ts` — Transient で 10 回更新しても履歴 1 件

---

## Phase M5 — 配置モードとの整合

### 実装内容

DESIGN_V2 §7.5 のとおり。

1. `TransformGizmo` は、選択部材が「値 != 0 の joint の movingPart」なら出さない
2. 代わりに右パネルへ案内と［閉じる］ボタンを出す
3. 値が 0 に戻ったらギズモが復活する

### 完了条件

- 扉を 45 度開けた状態でギズモが出ない
- 閉じるとギズモが戻り、動かした結果が rest pose として保存される
- `fixed` joint の movingPart は常にギズモで動かせる（値を持たないため）

### テスト項目

- `TransformGizmo` の表示条件を純粋関数に切り出してテストする
  （`canEditRestPose(part, joints): boolean`）

---

## Phase M6 — 可動範囲の干渉走査

### 実装内容

1. `core/collision/interference.ts` の `findInterferences` が
   **pose 適用済みの部材**を受け取れるようにする（既存シグネチャは維持）
2. `core/motion/motionScan.ts` — `scanJointMotion`（DESIGN_V2 §9.1）
3. 結果表示（区間の一覧 + ［該当を表示］）
4. スライダーの目盛りに干渉区間を警告色で描く

### 完了条件

- 扉が側板にぶつかる設計で、ぶつかり始める角度が出る
- 部材 50 枚・36 ステップで 1 秒以内
- ［該当を表示］でその角度へ移動し、該当部材が選択されてカメラが寄る

### テスト項目

| テスト |
|--------|
| 干渉しない構成で `blocked` が空・`usable` が `range` と一致 |
| 途中からぶつかる構成で `usable.max` が正しい |
| 最初からぶつかっている構成で `usable` が null |
| 区間が 2 つに分かれる構成（開き始めと開ききりでぶつかる） |
| `steps` を増やすと境界の精度が上がる |
| 非表示の部材は判定に含まれない |

---

## Phase M7 — 金物プリセットと取り付け

### 実装内容

1. `core/hardware/presets.ts` — DESIGN_V2 §10.1 の 5 種類（**データのみ。コードで分岐しない**）
2. `store/commands/hardwareCommands.ts` — `addHardware` / `removeHardware` / `moveHardware`
3. `addHardware` は joint も同時に作る（1 Undo ステップ）
4. `ui/left/HardwarePanel.tsx` — DESIGN_V2 §4.3 の画面
5. `viewport/HardwareLayer.tsx` — 簡易形状（箱と円柱）で表示
6. 取付位置は Ver.1 の 3 点セット（ドラッグ / 微調整ボタン / 座標入力）を再利用する

### 完了条件

- スライド丁番を選び、側板と扉をクリックして取り付けると、ヒンジ joint ができる
- 金物を消すと joint も消え、Undo で両方戻る
- 部材を消すと、その部材を使う金物も消える
- 金物パネルに「軌跡は回転で近似しています」の注記が出る（§7.4）

### テスト項目

- `hardwareCommands.test.ts` — 金物追加で joint ができる / 削除で joint も消える / 1 履歴エントリ
- `history.test.ts` の網羅テストに金物系コマンドを追加
- `presets.test.ts` — 全プリセットの `holes` が妥当（深さ > 0、`target` が正しい）

---

## Phase M8 — 金物からの自動加工

### 実装内容

1. `core/hardware/hardwareOperations.ts` — `hardwareOperations()`（DESIGN_V2 §10.2）
2. 金物追加時に穴を生成し、**金物追加と同じ Undo ステップ**で入れる
3. 生成した `Operation` の `note` に `hardwareId` を書く
4. 金物を動かしたら穴も追従する（古い穴を消して作り直す。1 履歴エントリ）
5. 加工リストで金物由来の加工に `Wrench` アイコンを付け、**編集させない**（§10.3）
6. 金物パネルの［必要な穴を自動であける］チェックで ON / OFF できる

### 完了条件

- スライド丁番を置くと、扉にカップ穴（φ35 深さ 11.5 非貫通）が入る
- 側板にネジ穴が入る
- 金物を消すと穴も消え、Undo で両方戻る
- 金物を 10mm 動かすと穴も 10mm 動く
- **`GeometryCache` は変更していない**（穴が増えれば当然 CSG は走る。これは正しい）

### テスト項目

| テスト |
|--------|
| プリセットの穴が正しい位置・向き・深さに変換される |
| `target: 'moving'` の穴が扉側に、`'base'` の穴が側板側に入る |
| 金物の `rotation` が穴の向きに反映される |
| 生成した Operation の `note` に hardwareId が入る |
| 金物削除で対応する Operation だけが消え、手で入れた加工は残る |

---

## Phase M9 — 部品表への金物追加

### 実装内容

1. `core/bom/buildBom.ts` に `hardware` 行を追加（DESIGN_V2 §12）
2. `core/bom/bomCsv.ts` に「金物」ブロックを追加
3. `ui/bom/BomPanel.tsx` に金物の表を追加

**木材側の集計ロジックは変更しない。**

### 完了条件

- 金物が `presetId` でまとまり、数量が合計される
- CSV に金物ブロックが出る
- **Ver.1 の `bom.test.ts` がそのまま通る**（木材側を壊していない証拠）

### テスト項目

- 同じ presetId の金物がまとまる / 違う presetId は別行
- `quantity` が正しく合計される（ヒンジ 2 個 x 扉 2 枚 = 4）
- 金物なしのプロジェクトで `hardware` が空配列
- CSV に品名・型番・数量が出る

---

## Phase M10 — 木取り図

> **M0 さえ済めば、可動の実装と並行して進められる。**

### 実装内容

1. `core/nesting/stockSheets.ts` — 定尺板プリセット
2. `core/nesting/nestParts.ts` — 棚積み法（FFDH）+ kerf（DESIGN_V2 §13.2）
3. `core/drawing/nestingDrawing.ts` — SVG 生成（純粋。文字列を返す）
4. `ui/output/NestingPanel.tsx` — 定尺板の選択・結果表示・SVG 書き出し

### 完了条件

- 部材 10 枚で板取りが出て、必要枚数と歩留まりが表示される
- 定尺より大きい部材が `unplaced` に入り、理由が出る
- kerf を 0 と 3mm で比べると、必要枚数が変わりうる
- SVG が印刷して読める（線は黒、文字は 3mm 相当以上）

### テスト項目

| テスト |
|--------|
| 1 枚に収まる構成で `sheets` が 1 枚 |
| 収まらない構成で 2 枚目ができる |
| 定尺より大きい部材が `unplaced` に入る |
| kerf がピースの間に入っている（座標で検証） |
| 90 度回して入る部材が `rotated: true` で置かれる |
| 材質・厚みが違う部材は別の板に分かれる |
| 歩留まりが 0..1 に収まる |
| SVG が XML として parse できる |

---

## Phase M11 — 加工図と STL 出力

> **M0 さえ済めば独立して進められる。**

### 実装内容

1. `core/drawing/partDrawing.ts` — 部材ごとの加工図 SVG（DESIGN_V2 §14.1）
2. `geometry/exporters/stlExporter.ts` — STL 出力（three 依存なので `geometry/` に置く）
3. `ui/output/DrawingPanel.tsx` — 部材を選んでプレビュー・書き出し
4. `ui/topbar/ExportMenu.tsx` — 出力メニュー（DESIGN_V2 §4.2）

### 完了条件

- 扉の加工図にカップ穴の位置が「端からの距離」で出る
- 非貫通の加工に深さが併記される
- 裏面から加工するものに「裏」が付く
- STL をスライサで開くと、寸法が mm で正しい
- アセンブリ全体の STL が pose 適用済みで出る

### テスト項目

- 加工 6 種類すべてで寸法線が出る
- 裏面加工に「裏」が付く
- SVG が XML として parse できる
- STL のバイナリ長が三角形数と整合する（`80 + 4 + 50 * n`）

---

## Phase M12 — 留め加工（任意角の切断）

> **M0 さえ済めば独立して進められる。**

### 実装内容

1. `core/types.ts` の `CutOperation` に `tiltAbout?` / `tiltDeg?` を追加
2. `core/operation/toolSolid.ts` の切断に傾きを反映（DESIGN_V2 §11.1）
3. `core/operation/operationValidate.ts` に §11.2 の検証を追加
4. `core/operation/operationLabel.ts` に傾きを表示
5. `core/part/partHash.ts` に `tiltAbout` / `tiltDeg` を追加（**形状に影響するため必須**）
6. `ui/left/OperationForm.tsx` の切断フォームに傾きと［留め 45 度］［直角に戻す］

### 完了条件

- 45 度に傾けた切断で、断面が斜めになる
- `tiltDeg` が 0 のとき **Ver.1 と完全に同じ形状**になる
- 2 枚の板を 45 度ずつ切って突き合わせると、直角のコーナーになる

### テスト項目

| テスト |
|--------|
| **`tiltDeg` 0 で Ver.1 と同じ spec（回帰テスト。最重要）** |
| 45 度で平面が傾く（頂点座標で検証） |
| `tiltAbout` が `axis` と同じならエラー |
| `tiltDeg` が -89..89 の外ならエラー |
| 傾けた結果、残りが 1mm 未満なら警告 |
| `partHash` が `tiltDeg` の違いを拾う |
| CSG が通る（6 方向 x 傾き 3 種類） |

---

## 進捗チェックリスト

```
[x] M0  型と保存形式                Claude  2026-09-23
[x] M1  運動学（UI なし）           Claude  2026-09-23
[x] M2  joint のコマンド            Claude  2026-09-23
[x] M3  表示への反映                Claude  2026-09-23
[x] M4  スライダー UI               Claude  2026-09-23
[x] M5  配置モードとの整合          Claude  2026-09-23
[x] M6  可動範囲の干渉走査          Claude  2026-09-23
[x] M7  金物プリセットと取り付け    Codex   2026-09-23
[x] M8  金物からの自動加工          Codex   2026-09-23
[x] M9  部品表への金物追加          Codex   2026-09-23
[x] M10 木取り図                    Codex   2026-09-23
[x] M11 加工図と STL 出力           Codex   2026-09-23
[x] M12 留め加工                    Codex   2026-09-23
```

M0〜M12 が揃い、金物・自動加工・部品表・木取り図・加工図・STL・留め加工まで
Ver.2 の設計範囲を実装した。検証結果は [PERF_V2.md](./PERF_V2.md) を参照。

### 最小の到達点

**M0〜M6 + M9** で Ver.2 として成立する。
扉が開閉でき、可動域の干渉が分かり、部品表が出る。
M8（自動加工）と M10〜M12（出力・留め）はそこから積み増す。

### 並行して進められるもの

```
M0 ─┬─ M1 ─ M2 ─ M3 ─ M4 ─┬─ M5
    │                      └─ M6
    │         └─ M7 ─┬─ M8
    │                └─ M9
    ├─ M10（木取り図）
    ├─ M11（加工図・STL）
    └─ M12（留め加工）
```

---

## Ver.3 以降の候補

実装中に「これもやりたい」と思ったものはここに追記し、Ver.2 のスコープから外す。

- スライド丁番の 4 節リンク（厳密な軌跡）
- 物理演算（重力・摩擦による自然な動き）
- 構造解析・強度計算・たわみ
- 市販金物のカタログ連携・価格取得
- AI 設計支援 / AI による 3D プリント部品生成
- クラウド保存・アカウント・共同編集
- 木取りの最適化（Guillotine / MaxRects / 遺伝的アルゴリズム）
- 三面図・断面図・組立説明書の自動生成
- エッジスナップ / 頂点スナップ（Ver.1 から持ち越し）
- CSG の Worker 化（Ver.1 から持ち越し）
- 曲面・自由形状の素材
