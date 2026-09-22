# Let's DIY — Ver.1 設計書

- ステータス: 確定（Codex 実装開始可）
- 対象バージョン: Ver.1
- 最終更新: 2026-09-22（§3.8 UI デザイン規則を追加、§12.4 の符号を修正）
- 関連: [PHASES_V1.md](./PHASES_V1.md)（実装フェーズ・完成条件）

---

## 0. このドキュメントの読み方

- **§1–§8** が「何を作るか」（要件・UI・データ）
- **§9–§18** が「どう作るか」（モジュール責務・アルゴリズム・非機能）
- **フェーズ分割・受け入れ条件は [PHASES_V1.md](./PHASES_V1.md)**

実装中に本書と矛盾する事情が見つかった場合、Codex は独断で設計を変えず、**該当箇所を引用して報告**すること（`AGENTS.md` の Boundaries に従う）。

本書で `MUST` / `SHOULD` / `MAY` は RFC 2119 の意味で使う。

---

## 1. Ver.1 の要件定義

### 1.1 プロダクトゴール

ブラウザ上で **木材を生成 → 3D空間に配置 → 加工** できる最小完成品を作る。

Ver.1 の成功条件は「**初心者が、マニュアルなしで、板を3枚作って箱状に並べ、穴を開けて、保存して、翌日開き直せる**」こと。

### 1.2 機能要件（Ver.1 スコープ）

| ID | 要件 | 優先度 |
|----|------|--------|
| F-01 | 横幅・高さ・厚みを mm で入力して直方体の木材を生成できる | MUST |
| F-02 | 生成した木材は設計データ（ID/種類/寸法/位置/回転/加工履歴）として保持される | MUST |
| F-03 | 3Dビューポートで木材を表示・視点操作（回転/パン/ズーム）できる | MUST |
| F-04 | クリック、またはパーツ一覧から木材を選択できる | MUST |
| F-05 | 選択中の木材を X/Y/Z 方向に移動できる（数値入力 + ギズモ） | MUST |
| F-06 | 選択中の木材を X/Y/Z 軸まわりに回転できる（数値入力 + ギズモ） | MUST |
| F-07 | 木材を複製・削除できる | MUST |
| F-08 | グリッドスナップ（OFF/1/5/10mm）が効く | MUST |
| F-09 | 角度スナップ（OFF/15/45/90°）が効く | MUST |
| F-10 | 面スナップ：2つの面を選んで接触配置できる（隙間指定可） | MUST |
| F-11 | 整列（Align）：選択部材を軸ごとに min/center/max で揃えられる | MUST |
| F-12 | 丸穴加工（径・深さ・貫通・位置・方向）ができる | MUST |
| F-13 | 切断加工（軸平行・位置・残す側）ができる | MUST |
| F-14 | 角穴加工ができる | SHOULD |
| F-15 | 切り欠き加工ができる | SHOULD |
| F-16 | 加工は非破壊：元寸法 + 加工履歴 + 表示メッシュが分離されている | MUST |
| F-17 | 既存の加工パラメータを後から編集・無効化・削除できる | MUST |
| F-18 | 加工位置・寸法の調整中は半透明プレビューを表示し、CSG は実行しない | MUST |
| F-19 | Undo / Redo が全編集操作に効く（100 段） | MUST |
| F-20 | プロジェクトを JSON で保存・読み込みできる（ローカル） | MUST |
| F-21 | 自動保存（localStorage）され、リロードで復帰する | MUST |
| F-22 | 数値入力だけで全ての編集操作が完結する（マウスは補助） | MUST |

### 1.3 非機能要件

| ID | 要件 |
|----|------|
| N-01 | 部材 50 枚・加工 200 件までで、視点操作が 60fps を維持する |
| N-02 | 1 部材の CSG 再計算（加工 10 件程度）が 300ms 以内に完了する |
| N-03 | 視点も編集も動いていないとき、描画ループは停止している（`frameloop="demand"`） |
| N-04 | 1 部材を編集したとき、他の部材のジオメトリを再計算しない |
| N-05 | 設計データ（JSON）だけから 3D 形状を完全に再構築できる |
| N-06 | 型は `strict: true`。`any` は外部ライブラリ境界のみ許容 |
| N-07 | デスクトップ Chrome / Edge / Firefox 最新版で動作する（モバイル・タブレットは対象外） |
| N-08 | オフラインで動作する（外部 API 依存なし） |

### 1.4 Ver.1 非スコープ（実装しない）

AI設計支援 / AI部品生成 / STL・STEP出力 / 物理演算 / 可動シミュレーション / ヒンジ・スライドレール・ガススプリング / ネジ・釘 / 接合強度・構造解析 / 材料強度 / 市販部品検索 / 部品表(BOM)生成 / 干渉判定 / クラウド保存 / ユーザーアカウント / 複数ユーザー同時編集 / 曲面・自由形状 / テクスチャ・木目レンダリング / 寸法線・図面出力 / モバイル対応

**ただし §5.3 の拡張ポイントを必ず用意すること。**

### 1.5 Ver.1 の意図的な割り切り（レビュー時の判断基準）

| 項目 | Ver.1 の決定 | 理由 |
|------|--------------|------|
| 部材形状 | 直方体のみ | 木材の 9 割は矩形材。曲線は Ver.3 |
| 加工の向き | ローカル軸 6 方向のみ（`+x/-x/+y/-y/+z/-z`） | 斜め穴は木工では稀。任意角は Ver.2 |
| 切断面 | ローカル軸に平行のみ | 45°留めは Ver.1.1 で `cut` を拡張 |
| エッジスナップ | **実装しない**。代わりに整列(Align)を実装 | §12.5 参照 |
| マルチ選択 | 整列・削除・複製のみ対応。移動/回転ギズモは単一選択のみ | 実装コスト対効果 |
| CSG 実行場所 | メインスレッド（`CsgEngine` 越し） | Worker 化は Ver.2 で差し替え可能な設計にする |
| 材質 | 色のみ（テクスチャなし） | 見た目より操作性を優先 |

---

## 2. ユーザー操作フロー

### 2.1 メインフロー（初回利用）

```
アプリ起動
  └─ 空のシーン + 床グリッド + 「左の[生成]から木材を作りましょう」ガイド
       │
       ▼
[生成] タブ
  └─ プリセット選択 or 横幅/高さ/厚み入力 → [生成する]
       └─ 原点付近に木材が1枚生成され、自動で選択される
            └─ モードが自動的に [配置] へ切り替わる
       │
       ▼
[配置] タブ
  ├─ 右パネルで position/rotation を数値入力  ← 主操作
  ├─ ビューポートでギズモをドラッグ            ← 補助操作
  ├─ [複製] で同じ板を増やす
  ├─ スナップ設定（グリッド 10mm / 角度 90°）
  ├─ [面スナップ] → 自分の面 → 相手の面 → 隙間入力 → [適用]
  └─ [整列] → 軸と基準を選んで [揃える]
       │
       ▼
[加工] タブ
  └─ 対象部材を選択（未選択ならガイド表示）
       └─ 加工種類を選ぶ（丸穴 / 角穴 / 切り欠き / 切断）
            └─ パラメータ入力（入力するたび半透明プレビューが更新）
                 └─ [加工を実行]
                      └─ CSG 実行 → メッシュ更新 → 加工リストに追加
       │
       ▼
いつでも Undo / Redo / 保存
```

### 2.2 加工パラメータの後編集フロー（非破壊の証明）

```
[加工] タブ or 右パネルの「加工」セクション
  └─ 加工リストから既存の加工をクリック
       └─ 編集フォームに現在値が入る（穴径 8mm）
            └─ 値を変更（穴径 6mm）→ 半透明プレビューが 6mm で表示
                 └─ [更新] → 元寸法 + 更新後の全加工履歴から形状を再構築
```

- **加工は「メッシュへの破壊的変更」ではなく「履歴リストの編集」である。**
- 加工を削除しても、元の直方体 + 残りの加工から形状が再生成される。
- 加工には `enabled` フラグがあり、OFF にすると一時的に無効化できる（削除せず比較できる）。

### 2.3 エラー・警告時のフロー

```
パラメータ入力
  └─ 不正値（径 ≤ 0 など）→ 入力欄が赤 + 理由表示、[実行]ボタンは無効
  └─ 警告（穴が部材外にはみ出す等）→ 黄色の警告表示、[実行]は可能
  └─ CSG 失敗 → Toast「加工に失敗しました」+ 該当加工にエラーバッジ
                 形状は「その加工をスキップした状態」で表示され、編集を継続できる
```

### 2.4 キーボードショートカット（すべて GUI からも実行可能）

| キー | 動作 |
|------|------|
| `1` / `2` / `3` | 生成 / 配置 / 加工 モード切替 |
| `Ctrl+Z` / `Ctrl+Y`(`Ctrl+Shift+Z`) | Undo / Redo |
| `Ctrl+D` | 選択部材を複製 |
| `Delete` / `Backspace` | 選択部材を削除 |
| `G` / `R` | ギズモを移動 / 回転に切替 |
| `F` | 選択部材にカメラをフォーカス |
| `Esc` | 選択解除 / 進行中のウィザードを中断 |
| `Ctrl+S` | 保存 |

**原則: ショートカットは必ず画面上のボタンと 1:1 対応させ、ボタンに `title` でキー表示を出す。** ショートカットを知らなくても全機能が使えること。

---

## 3. 画面構成

### 3.1 全体レイアウト

```
┌─────────────────────────────────────────────────────────────────────┐
│ TopBar (48px)                                                        │
│ [Let's DIY] [新規][開く][保存][JSON書出] │ [元に戻す][やり直す] │        │
│                              [表示:グリッド/影/ワイヤー] │ プロジェクト名 │
├───────────────┬─────────────────────────────────┬───────────────────┤
│ LeftPanel     │  Viewport                        │ RightPanel        │
│ 280px         │  (flex: 1)                       │ 320px             │
│               │                                  │                   │
│ ┌───────────┐ │  ┌────────────────────────────┐ │ 選択: 側板 A      │
│ │生成│配置│加工│ │  │ モードヒントバー(上部中央)  │ │ ─────────────    │
│ └───────────┘ │  └────────────────────────────┘ │ > 基本情報        │
│               │                                  │   名前 / 材質     │
│  モード別      │         3D シーン                 │ > 寸法 (mm)      │
│  フォーム      │                                  │   幅/高さ/厚み    │
│               │                                  │ > 位置 (mm)      │
│               │  [視点: 正面/上/右/等角] (右下)    │   X / Y / Z      │
│               │  [軸ジズモ] (左下)                │ > 回転 (°)       │
├───────────────┤                                  │   X / Y / Z      │
│ パーツ一覧     │                                  │ > 加工 (3)       │
│ [x] 側板 A      │                                  │   - 丸穴 φ8 貫通  │
│ [x] 側板 B      │                                  │   - 丸穴 φ8 貫通  │
│ [ ] 天板        │                                  │   - 切断 X=450   │
│ (flex:1,スクロール)│                              │   [+ 加工を追加]  │
├───────────────┴─────────────────────────────────┴───────────────────┤
│ StatusBar (28px)  選択 1 / 3 ｜ グリッド 10mm ｜ 角度 90° ｜ 単位 mm   │
│                                          ｜ 最後の操作: 丸穴を追加     │
└─────────────────────────────────────────────────────────────────────┘
```

**原案からの変更点と理由**

1. **StatusBar を追加** — スナップ設定・選択数・直前操作が常に見える。初心者が「今どういう状態か」を見失わないため。
2. **パーツ一覧（Outliner）を左パネル下部に常設** — 3D 上のクリックだけが選択手段だと、重なった部材や画面外の部材を選べず詰む。Ver.1 の操作性で最重要。
3. **モードヒントバーをビューポート上部中央に配置** — 「次に何をすればいいか」を1行で常時表示（例:「動かす面をクリックしてください」）。これが「Blender 化しない」ための中核。

### 3.2 LeftPanel: 生成モード

```
材料プリセット
  [合板 t12] [合板 t15] [合板 t18] [合板 t21]
  [SPF 1x4] [SPF 2x4] [集成材 t25] [カスタム]

寸法
  横幅 (X)   [  600 ] mm
  高さ (Y)   [  300 ] mm
  厚み (Z)   [   18 ] mm

材質  [ 合板         v ]
名前  [ 側板 A          ]   ← 空なら「木材 1」を自動採番

配置先
  ( ) 原点
  (*) 選択中の部材の右隣
  ( ) カメラ注視点

          [ 木材を生成する ]
```

### 3.3 LeftPanel: 配置モード

```
ギズモ        [ 移動 (G) ] [ 回転 (R) ]

スナップ
  グリッド   [OFF] [1] [5] [*10] mm
  角度       [OFF] [15] [45] [*90] °

面スナップ
  [ 面スナップを開始 ]
  ① 動かす部材の面をクリック  → 側板A / +X 面 [選択済み]
  ② 接触させる相手の面をクリック → 天板 / -X 面 [選択済み]
  隙間 [ 0 ] mm   [ ] 面の中心を合わせる
  [ 適用 ]  [ やめる ]

整列（2つ以上選択時）
  軸  [X] [Y] [Z]
  基準 [ 最小 ] [ 中心 ] [ 最大 ]
  [ 揃える ]

編集
  [ 複製 (Ctrl+D) ]  [ 削除 (Del) ]
```

### 3.4 LeftPanel: 加工モード

```
対象: 側板 A            （未選択時:「部材を選択してください」）

加工を追加
  [ 丸穴 ] [ 角穴 ] [ 切り欠き ] [ 切断 ]

── 丸穴 ──────────────────
  直径     [  8 ] mm
  [x] 貫通させる
  深さ     [ 18 ] mm   （貫通時は無効化）
  方向     [ -Z 面から   v ]
  位置の基準 ( ) 中心原点  (*) コーナー原点(X-,Y-,Z-)
  X [ 100 ]  Y [  50 ]  Z [   0 ] mm

  [!] 穴の中心が部材の端から 4mm しかありません

  [ プレビュー中 ]      [ 加工を実行 ]  [ キャンセル ]

この部材の加工 (3)
  [x] 丸穴 φ8 貫通 @ (100, 50)      [編集] [削除]
  [x] 丸穴 φ8 貫通 @ (500, 50)      [編集] [削除]
  [ ] 切断 X = 450 / 左を残す        [編集] [削除]
```

### 3.5 RightPanel: プロパティ

- 選択が 0 件: 「部材を選択するとここに詳細が表示されます」
- 選択が 1 件: 基本情報 / 寸法 / 位置 / 回転 / 加工リスト（すべて編集可）
- 選択が 2 件以上: 件数と一括操作（整列・削除・複製）のみ

数値入力は全て `NumberField`（§9.6）を使い、以下を共通化する:

- 単位サフィックス表示（mm / °）
- `↑` `↓` キーで ±1、`Shift+↑↓` で ±10、`Alt+↑↓` で ±0.1
- フォーカスアウト or `Enter` で確定（= 1 Undo ステップ）
- 入力途中の不正文字列は確定させない（ローカル state で保持）

### 3.6 ビューポートの表示要素

| 要素 | 内容 |
|------|------|
| 床グリッド | 1000mm 主線 / 100mm 副線。`drei <Grid>` |
| 原点軸 | X=赤 / Y=緑 / Z=青 の 200mm 軸線 |
| 部材メッシュ | `MeshStandardMaterial`、材質ごとの色 |
| 選択ハイライト | `EdgesGeometry` によるアウトライン（オレンジ 2px） |
| ホバーハイライト | マテリアルの `emissive` を微加算 |
| 面ハイライト | 面スナップ中、対象面に半透明の板を重ねる |
| 加工プレビュー | ツール立体を半透明赤（`opacity 0.35`, `depthWrite false`）で表示 |
| 視点ボタン | 右下に 正面 / 背面 / 上 / 下 / 左 / 右 / 等角 |
| 軸ジズモ | 左下に `drei <GizmoHelper>` |

### 3.7 カラー・材質

```ts
// src/viewport/materials/materialLibrary.ts
export const MATERIAL_COLORS: Record<MaterialKind, number> = {
  plywood: 0xd9b382,
  pine:    0xe6c79a,
  lauan:   0xc99b6e,
  mdf:     0xbfa98c,
  generic: 0xd0c0a8,
};
export const SELECTION_COLOR = 0xff8c32;
export const PREVIEW_COLOR   = 0xff4444;
```

`MeshStandardMaterial` はマテリアル種別ごとに **1 インスタンスを共有**する（部材ごとに new しない）。選択状態はマテリアル差し替えではなくアウトライン追加で表現し、マテリアル再生成を避ける。

### 3.8 UI デザイン規則（拘束力あり）

本節は Ver.1 全 Phase に適用される。**§3.1〜§3.4 のワイヤーフレーム内の記号は、レイアウトを示すための代用表記であり、実装時にそのまま画面へ出してはならない。**

#### 規則 1: 絵文字・記号文字を UI に出さない（MUST NOT）

アイコンが必要な箇所は **すべて `lucide-react` のコンポーネント**で描く。
以下の文字を JSX・CSS の `content`・文字列リテラルとして画面に出すことを禁止する。

```
禁止: ✅ ❌ ⚠️ ⚠ ★ ☆ ● ○ ☑ ☐ ▸ ▾ ► ✓ ✗ ↶ ↷ 🔒 👁 📁 💾 ⚙ ℹ️ など一切の絵文字・幾何記号
```

代替の対応表（Lucide のコンポーネント名）:

| 用途 | Lucide |
|------|--------|
| チェックボックス | ネイティブ `<input type="checkbox">`（記号文字で描かない） |
| チェック済み・成功 | `Check` / `CircleCheck` |
| エラー | `CircleAlert` |
| 警告 | `TriangleAlert` |
| 情報 | `Info` |
| 元に戻す / やり直す | `Undo2` / `Redo2` |
| 折りたたみ見出し | `ChevronRight` / `ChevronDown` |
| 表示 / 非表示 | `Eye` / `EyeOff` |
| ロック / 解除 | `Lock` / `LockOpen` |
| 部材・パーツ | `Box` |
| 生成 / 配置 / 加工モード | `Plus` / `Move3d` / `Drill` |
| 複製 / 削除 | `Copy` / `Trash2` |
| 保存 / 開く / 新規 | `Save` / `FolderOpen` / `FilePlus2` |
| 加工の種類（丸穴 / 角穴 / 切り欠き / 切断） | `Circle` / `Square` / `SquareDashedBottom` / `Scissors` |
| 整列 | `AlignStartVertical` / `AlignCenterVertical` / `AlignEndVertical` |
| 面スナップ | `Magnet` |
| リスト行のドラッグ | `GripVertical` |

**アイコン単独のボタンには必ず `aria-label` と `title` を付ける。** テキストラベルが併記されている場合、アイコンは `aria-hidden` にする。
サイズは 14 / 16 / 21 / 30 px のいずれかに揃え、`strokeWidth` は既定（2）を使う。

#### 規則 2: 左縁アクセントボーダーのカードを使わない（MUST NOT）

警告・エラー・ヒント・注記などを、色付きの `border-left` を持つカードで表現してはならない。

```css
/* 禁止 */
.warning { border-left: 3px solid var(--accent); background: #3a3229; padding: 12px; }
```

状態は次の 3 要素だけで伝える。

1. **Lucide アイコン**（`TriangleAlert` / `CircleAlert` / `Info`）
2. **文字色**（`--warning` / `--error` / `--muted`）
3. 必要なら **全周 1px ボーダー**（`border: 1px solid var(--border)`）

```css
/* 可 */
.notice { display: flex; gap: 8px; align-items: flex-start; color: var(--warning); font-size: 12px; }
.notice-boxed { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; }
```

背景色での塗り分けは、**アクティブなタブ 1 箇所のみ**に留める（現行の `.mode-tabs .active`）。
入力欄のエラー表示は枠線の色変更（全周）とし、左縁だけを着色しない。

#### 規則 3: 付随ルール

- 区切りとしての `border-left`（トップバーの仕切り、パネルの外周）は規則 2 の対象外。**「カード状のまとまりの左端を着色する」パターンだけを禁止する。**
- 状態色は CSS 変数に集約する: `--accent` `--error` `--warning` `--success` `--muted`。ハードコードした hex を新規に増やさない。
- 角丸は `5px`（コントロール）と `6px`（パネル・カード）の 2 種類のみ。
- 影（`box-shadow`）は使わない。境界はすべて 1px ボーダーで表現する（CAD らしい平坦な見た目を保つ）。

---

## 4. 技術スタック

### 4.1 採用構成

| 領域 | 採用 | バージョン目安 |
|------|------|----------------|
| 言語 | TypeScript（`strict: true`） | 5.9+ |
| ビルド | Vite | 7.x |
| UI | React | 19.x |
| 3D | three.js | r18x（最新安定） |
| 3D/React 統合 | @react-three/fiber | 9.x |
| 3D ヘルパー | @react-three/drei | 10.x |
| CSG | three-bvh-csg（+ three-mesh-bvh） | 0.0.17+ |
| 状態管理 | zustand + immer | 5.x / 10.x |
| スキーマ検証 | zod | 4.x |
| スタイル | Tailwind CSS | 4.x |
| アイコン | lucide-react | 最新 |
| テスト | Vitest + @testing-library/react | 最新 |
| Lint/Format | ESLint (flat config) + Prettier | 最新 |

> バージョンは実装開始時点の最新安定版でよい。ピン留めは `package-lock.json` に任せる。

### 4.2 決定1: React Three Fiber を採用する（素の Three.js ではなく）

**比較**

| 観点 | 素の Three.js | React Three Fiber |
|------|---------------|-------------------|
| React 状態との同期 | 手動で `useEffect` 同期コードを大量に書く | パーツ配列 → JSX で宣言的に対応 |
| 追加/削除の管理 | `scene.add/remove` と dispose を自前管理 | reconciler が対応（dispose は要注意） |
| ピッキング | Raycaster を自前実装 | `onClick`/`onPointerOver` が使える |
| TransformControls | three/examples から手動組込 | `drei` の `<TransformControls>` |
| 毎フレーム再描画の懸念 | 制御しやすい | `frameloop="demand"` で解決可能 |
| React 再レンダリングでシーンが壊れる懸念 | なし | `React.memo` + geometry 参照の安定化で回避 |
| 学習・保守コスト | 3D 連携コードが肥大化 | UI と同じメンタルモデル |

**結論: R3F を採用。** 本アプリの本質は「設計データ配列 → 3D 表示」という宣言的な写像であり、R3F が最も素直。CAD で懸念される「毎フレーム再計算」は、以下の 3 つの規律で完全に回避する（これは **MUST**）:

1. **ジオメトリ生成は React の外**。`src/geometry/` の純粋モジュールで行い、`GeometryCache` に持つ。R3F コンポーネントは完成済み `BufferGeometry` を `<mesh geometry={...}>` に渡すだけ。
2. **`<Canvas frameloop="demand">`**。視点操作・ドラッグ・データ変更のときだけ `invalidate()` で描画する。
3. **`useFrame` の中で CSG・ジオメトリ生成・重い計算を絶対に呼ばない。** `useFrame` はギズモのドラッグ追従など、行列更新だけに使う。

### 4.3 決定2: CSG は three-bvh-csg を採用する

| 候補 | 評価 |
|------|------|
| **three-bvh-csg** | **採用**。three.js 専用で `BufferGeometry` を直に扱える。BVH による高速化。矩形＋円筒の減算という Ver.1 の用途に十分。API が `Evaluator.evaluate(brushA, brushB, SUBTRACTION)` と単純 |
| manifold-3d | 幾何学的堅牢性は最高（WASM）。ただし WASM ロード・型変換のオーバーヘッドと学習コストが Ver.1 には過剰。**Ver.2 で堅牢性が問題になった場合の差し替え先**として想定する |
| three-csg-ts / ThreeCSG | メンテナンス停滞・大きなメッシュで破綻しやすい。不採用 |

**MUST: CSG ライブラリは `CsgEngine` インターフェース（§14.1）の背後に隠す。** アプリコードが `three-bvh-csg` を直接 import してよいのは `src/geometry/csg/BvhCsgEngine.ts` のみ。これにより Ver.2 で manifold-3d / Worker へ差し替えられる。

### 4.4 決定3: 状態管理は zustand + immer patches

- Redux Toolkit は本規模には重い。React Context は再レンダリング範囲の制御が困難。
- zustand は「ストア外（Three.js 側）から購読する」ことが `store.subscribe` で容易。CAD と相性が良い。
- Undo/Redo は immer の `produceWithPatches` が返す `inversePatches` をそのまま使う（§15）。自前の逆コマンド実装が不要になり、バグが激減する。

### 4.5 決定4: 単位・座標系

| 項目 | 決定 |
|------|------|
| 内部単位 | **mm**（`number`）。全てのデータ・計算は mm |
| Three.js シーン単位 | **1 unit = 1 mm**。`src/core/constants.ts` の `SCENE_SCALE = 1` を介す |
| 上方向 | **Y-up**（Three.js 既定）。床は XZ 平面 (y=0) |
| カメラ | `PerspectiveCamera` fov 45, near 1, far 100000 |
| 回転の保持形式 | **度（degree）** で保存。Euler order は `'XYZ'` 固定。ラジアン変換は Three.js 境界でのみ行う |
| 部材ローカル原点 | **直方体の中心**（回転が直感的になるため） |
| 部材ローカル軸 | `size.x` → ローカル X（横幅）、`size.y` → ローカル Y（高さ）、`size.z` → ローカル Z（厚み） |
| 加工位置の保存形式 | **部材ローカル・中心原点 mm** |
| 加工位置の UI 既定表示 | **コーナー原点（X-, Y-, Z- 側の角）**。`cornerToLocal` / `localToCorner` で相互変換（トグルで中心原点表示にも切替可） |

> **設計判断の注記**: 依頼文の JSON 例では加工位置が `[100, 50, 0]`（＝コーナー原点）だった。しかしローカル原点をコーナーにすると `TransformControls` の回転がコーナー中心になり著しく直感に反する。そこで **保存は中心原点・UI 表示はコーナー原点** とし、変換を `src/core/part/localFrame.ts` の 2 関数に閉じ込める。UI 上のユーザー体験は依頼文の意図（端から 100mm）どおりになる。

### 4.6 npm scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

---

## 5. システム構成

### 5.1 レイヤ構造

```
┌──────────────────────────────────────────────────────┐
│ ui/            React UI（パネル・フォーム・トップバー）  │
│                three.js を import してはならない       │
├──────────────────────────────────────────────────────┤
│ viewport/      R3F コンポーネント（表示・ピッキング）    │
│                設計データを読み、ストアへコマンドを送る   │
├──────────────────────────────────────────────────────┤
│ store/         zustand ストア + コマンド + 履歴         │
│                three.js を import してはならない       │
├──────────────────────────────────────────────────────┤
│ geometry/      three.js 依存・React 非依存             │
│                ジオメトリ生成・CSG・キャッシュ           │
├──────────────────────────────────────────────────────┤
│ core/          純粋 TypeScript（three も React もなし）  │
│                型・数学・スナップ・検証・シリアライズ     │
└──────────────────────────────────────────────────────┘
        io/  永続化（localStorage / ファイル）
```

**依存方向のルール（MUST・ESLint の `import/no-restricted-paths` で強制する）**

- `core/` → 何にも依存しない（`three` も `react` も import 禁止）
- `geometry/` → `core/`, `three` のみ
- `store/` → `core/`, `io/` のみ（`three` 禁止、`react` 禁止）
- `viewport/` → 全部 OK
- `ui/` → `core/`, `store/`, `io/` のみ（`three` 直接 import 禁止）
- `io/` → `core/` のみ

この規律により、**`core/` はブラウザなしで Vitest から直接テストできる**。Ver.1 のテストの主戦場はここ。

### 5.2 データフロー

```
      ユーザー操作
          │
          ▼
   ui/ or viewport/  ── dispatch ──▶  store/commands/*
                                          │
                                          ▼
                              history.applyCommand()
                              （immer produceWithPatches）
                                          │
                     ┌────────────────────┴───────────────────┐
                     ▼                                         ▼
           useProjectStore 更新                        patches/inversePatches
                     │                                   を履歴スタックへ
                     ▼
        viewport/usePartGeometry (購読)
                     │
                     ▼
        GeometryCache.get(part)
          ├─ hash 一致 → キャッシュ返却（再計算なし）
          └─ hash 不一致 → geometryBuilder.build(part)  [async]
                              ├─ 基本ボックス生成
                              ├─ 各 Operation → ツール立体
                              └─ CsgEngine.subtract() を順次適用
                                       │
                                       ▼
                              新 BufferGeometry をキャッシュ
                              旧ジオメトリを dispose
                                       │
                                       ▼
                              invalidate() → 1 フレーム描画
```

**重要:** `transform`（位置・回転）の変更は **ジオメトリのハッシュに含まれない**。つまり移動・回転しても CSG は一切走らず、`Object3D` の行列だけが更新される。CSG が走るのは `size` か `operations` が変わったときだけ。

### 5.3 将来拡張の受け口（Ver.1 で「穴」だけ空けておくもの）

| 将来機能 | Ver.1 で用意する受け口 |
|----------|----------------------|
| 金物・3Dプリント部品 | `Part.kind: 'wood'` を union 型にしておく（`'wood' \| ...` と書ける形に） |
| 可動部品・ヒンジ | `Project` に `joints?: Joint[]` を将来追加できるよう、`Project` はオブジェクト（配列直置きにしない） |
| STL 出力 | `geometry/` が `BufferGeometry` を返す純関数なので、`io/exporters/stlExporter.ts` を足すだけ |
| BOM 生成 | `Part` に `material` と `size` があるため、`core/bom/` を足すだけ |
| サーバー保存 | `io/ProjectRepository.ts` インターフェース（§16.4）を Ver.1 から通す |
| Worker CSG | `CsgEngine` が `Promise` を返す非同期インターフェース（§14.1） |
| 任意角の穴・切断 | `Operation` が discriminated union。`direction` を `AxisDirection` から `Vec3` へ広げる移行を `migrate.ts` で吸収 |
| 干渉判定 | `core/math/box.ts` に OBB を用意（面スナップで既に必要） |

**逆に、Ver.1 で作ってはいけないもの（過剰抽象の禁止）**

- プラグインシステム、DI コンテナ、イベントバス
- `Part` の継承階層、抽象基底クラス
- 汎用的な「ノードグラフ」「パラメトリック式エンジン」
- Operation を実行する Strategy クラス群（単なる `switch` で十分）

---

## 6. ディレクトリ構成

```
lets-diy/
├─ docs/
│  ├─ DESIGN_V1.md              ← 本書
│  ├─ PHASES_V1.md              ← フェーズ・受け入れ条件
│  └─ README.md
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ eslint.config.js
├─ tailwind.config.ts
└─ src/
   ├─ main.tsx                       # React エントリ
   ├─ App.tsx                        # AppShell のみを描画
   │
   ├─ core/                          # 純粋 TS（three/react 禁止）
   │  ├─ types.ts                    # * 全ドメイン型（§8）
   │  ├─ constants.ts                # SCENE_SCALE, EPS, 既定値, 上限値
   │  ├─ ids.ts                      # createPartId / createOperationId
   │  ├─ result.ts                   # Result<T, E> / Validation 型
   │  ├─ math/
   │  │  ├─ vec3.ts                  # add/sub/scale/dot/cross/len/eq
   │  │  ├─ angle.ts                 # degToRad/radToDeg/normalizeDeg/snapAngle
   │  │  ├─ matrix.ts                # Transform → 4x4（three 非依存の自前実装）
   │  │  └─ box.ts                   # AABB / OBB / 面法線 / 面中心 / 面の投影
   │  ├─ part/
   │  │  ├─ createPart.ts            # 既定値つき Part 生成
   │  │  ├─ localFrame.ts            # cornerToLocal / localToCorner / faceOf
   │  │  ├─ partBounds.ts            # ローカル/ワールド AABB・OBB・8頂点
   │  │  ├─ partFaces.ts             # 6面の法線・中心・寸法をワールドで取得
   │  │  └─ partHash.ts              # 形状ハッシュ（size + enabled operations）
   │  ├─ operation/
   │  │  ├─ operationDefaults.ts     # 種類ごとの初期パラメータ
   │  │  ├─ operationLabel.ts        # 「丸穴 φ8 貫通 @ (100, 50)」の表示文字列
   │  │  ├─ operationValidate.ts     # errors / warnings を返す
   │  │  └─ toolSolid.ts             # * Operation → ToolSolidSpec（純粋・数値のみ）
   │  ├─ snap/
   │  │  ├─ gridSnap.ts              # snapValue / snapVec3
   │  │  ├─ faceSnap.ts              # * 面スナップの Transform 計算
   │  │  └─ align.ts                 # 整列（min/center/max）
   │  └─ project/
   │     ├─ createProject.ts
   │     ├─ projectSchema.ts         # zod スキーマ
   │     ├─ serialize.ts             # Project ⇄ ProjectDocument
   │     └─ migrate.ts               # schemaVersion 移行
   │
   ├─ geometry/                      # three 依存・React 非依存
   │  ├─ boxGeometry.ts              # 中心原点の BoxGeometry 生成
   │  ├─ toolGeometry.ts             # ToolSolidSpec → BufferGeometry（配置済み）
   │  ├─ geometryBuilder.ts          # * Part → BufferGeometry（CSG 適用）
   │  ├─ edgesGeometry.ts            # アウトライン用 EdgesGeometry 生成
   │  ├─ GeometryCache.ts            # * partId → {hash, geometry} + dispose 管理
   │  ├─ transformUtils.ts           # Transform → THREE.Matrix4 / Euler
   │  └─ csg/
   │     ├─ CsgEngine.ts             # * インターフェース定義
   │     ├─ BvhCsgEngine.ts          # three-bvh-csg 実装（唯一の直接 import）
   │     └─ index.ts                 # getCsgEngine() シングルトン
   │
   ├─ store/                         # zustand（three/react 禁止）
   │  ├─ useProjectStore.ts          # * Project 本体 + 履歴
   │  ├─ useEditorStore.ts           # * モード/選択/スナップ/プレビュー（履歴対象外）
   │  ├─ history.ts                  # * patches ベースの Undo/Redo
   │  ├─ selectors.ts               # getSelectedPart など派生値
   │  └─ commands/
   │     ├─ partCommands.ts          # addPart/removeParts/duplicateParts/renamePart/resizePart
   │     ├─ transformCommands.ts     # setPosition/setRotation/translateBy/applyFaceSnap/alignParts
   │     └─ operationCommands.ts     # addOperation/updateOperation/removeOperation/toggleOperation/reorderOperation
   │
   ├─ viewport/                      # R3F
   │  ├─ Viewport.tsx                # <Canvas> とその設定
   │  ├─ SceneRoot.tsx               # ライト/グリッド/パーツ層/ギズモを束ねる
   │  ├─ CameraRig.tsx               # OrbitControls + 視点プリセット + focus
   │  ├─ Lighting.tsx
   │  ├─ GridFloor.tsx
   │  ├─ PartsLayer.tsx              # parts.map → <PartMesh>
   │  ├─ PartMesh.tsx                # * 1部材の表示・ピッキング（React.memo）
   │  ├─ SelectionOutline.tsx
   │  ├─ TransformGizmo.tsx          # * drei TransformControls のラップ
   │  ├─ OperationPreview.tsx        # * 半透明ツール立体
   │  ├─ FacePickOverlay.tsx         # 面スナップ用の面ハイライト＆ピック
   │  ├─ ViewCube.tsx                # 右下の視点ボタン群
   │  ├─ hooks/
   │  │  ├─ usePartGeometry.ts       # * GeometryCache と React を繋ぐ
   │  │  ├─ useInvalidateOnStore.ts  # ストア変化で invalidate()
   │  │  └─ usePointerPick.ts        # クリック→partId/面 の解決
   │  └─ materials/
   │     └─ materialLibrary.ts       # 共有マテリアル
   │
   ├─ ui/
   │  ├─ AppShell.tsx                # 3カラム + TopBar + StatusBar
   │  ├─ topbar/
   │  │  ├─ TopBar.tsx
   │  │  ├─ FileMenu.tsx
   │  │  └─ UndoRedoButtons.tsx
   │  ├─ statusbar/StatusBar.tsx
   │  ├─ left/
   │  │  ├─ LeftPanel.tsx            # モードタブ + 本体 + Outliner
   │  │  ├─ ModeTabs.tsx
   │  │  ├─ CreatePanel.tsx          # 生成モード
   │  │  ├─ ArrangePanel.tsx         # 配置モード
   │  │  ├─ FaceSnapWizard.tsx
   │  │  ├─ AlignTools.tsx
   │  │  ├─ MachinePanel.tsx         # 加工モード
   │  │  ├─ OperationForm.tsx        # * 種類別パラメータ入力
   │  │  └─ PartOutliner.tsx
   │  ├─ right/
   │  │  ├─ PropertyPanel.tsx
   │  │  ├─ PartInfoSection.tsx
   │  │  ├─ SizeSection.tsx
   │  │  ├─ TransformSection.tsx
   │  │  └─ OperationListSection.tsx
   │  ├─ common/
   │  │  ├─ NumberField.tsx          # * 数値入力の共通実装
   │  │  ├─ Vec3Field.tsx
   │  │  ├─ SegmentedControl.tsx
   │  │  ├─ Section.tsx              # 折りたたみ見出し
   │  │  ├─ Button.tsx / IconButton.tsx
   │  │  ├─ Checkbox.tsx / Select.tsx
   │  │  ├─ HintBar.tsx
   │  │  ├─ Toast.tsx / ToastHost.tsx
   │  │  └─ ErrorBoundary.tsx
   │  └─ hooks/
   │     ├─ useKeyboardShortcuts.ts
   │     └─ useToast.ts
   │
   ├─ io/
   │  ├─ ProjectRepository.ts        # * 保存先の抽象（将来サーバー化の受け口）
   │  ├─ LocalStorageRepository.ts
   │  ├─ fileDownload.ts             # JSON 書き出し
   │  ├─ fileOpen.ts                 # JSON 読み込み
   │  └─ autosave.ts                 # debounce 自動保存
   │
   └─ styles/
      └─ index.css                   # Tailwind エントリ + CSS 変数
```

`*` が付いたファイルは本設計の中核。実装時に迷ったら §9 の責務表と該当章を参照すること。

---

## 7. データモデル

### 7.1 概念モデル

```
Project 1 ──* Part 1 ──* Operation
              │
              └─ Transform（値オブジェクト、1対1）
```

- **Project**: 1 つの設計ファイル。パーツの集合。
- **Part**: 1 枚の木材。**「元寸法（size）」と「加工履歴（operations）」だけが真実**であり、表示メッシュは派生物。
- **Operation**: 1 つの加工。順序を持つリスト。すべて「ツール立体を減算する」という単一の意味に統一されている。
- **Transform**: 部材のワールド配置。ジオメトリとは完全に独立。

### 7.2 不変条件（Invariants）

| # | 不変条件 |
|---|----------|
| I-1 | `Part.size` の各成分 > 0（最小 0.1mm、最大 5000mm） |
| I-2 | `Part.id` はプロジェクト内で一意 |
| I-3 | `Operation.id` は部材内で一意 |
| I-4 | `operations` の順序は減算の適用順であり、保存・復元で保たれる |
| I-5 | `Part.size` と `operations` が同じなら、生成されるジオメトリは必ず同一 |
| I-6 | メッシュは `Part` から常に再生成可能。JSON にメッシュを保存しない |
| I-7 | `rotation` は度。`[-360, 360]` に正規化して保存 |
| I-8 | 加工後に形状が空（全部削り取った）になる操作は **実行を拒否**する |

### 7.3 保存 JSON の実例

```json
{
  "app": "lets-diy",
  "schemaVersion": 1,
  "savedAt": "2026-09-22T12:34:56.789Z",
  "project": {
    "id": "prj-8f2a1c40",
    "name": "小物棚",
    "unit": "mm",
    "createdAt": "2026-09-22T10:00:00.000Z",
    "updatedAt": "2026-09-22T12:34:56.789Z",
    "parts": [
      {
        "id": "part-0a1b2c3d",
        "kind": "wood",
        "name": "側板 A",
        "size": { "x": 600, "y": 300, "z": 18 },
        "transform": {
          "position": [0, 150, 0],
          "rotation": [0, 0, 0]
        },
        "material": "plywood",
        "visible": true,
        "locked": false,
        "createdAt": "2026-09-22T10:01:00.000Z",
        "operations": [
          {
            "id": "op-11aa22bb",
            "type": "roundHole",
            "enabled": true,
            "diameter": 8,
            "depth": 18,
            "through": true,
            "position": [-200, -100, 0],
            "direction": "-z"
          },
          {
            "id": "op-33cc44dd",
            "type": "cut",
            "enabled": true,
            "axis": "x",
            "offset": 150,
            "keep": "negative"
          }
        ]
      }
    ]
  }
}
```

> `position: [-200, -100, 0]` は中心原点。UI では「コーナーから X=100, Y=50」と表示される（600/2 - 200 = 100、300/2 - 100 = 50）。

---

## 8. TypeScript 型定義案

> **これをそのまま `src/core/types.ts` に置くこと。** 他のファイルはここから import する。

```ts
// ============================================================
// src/core/types.ts
// 純粋型定義。three.js / React を import しないこと。
// ============================================================

/** ミリメートル。全ての長さはこの単位。 */
export type Millimeter = number;
/** 度。ラジアンへの変換は three.js 境界でのみ行う。 */
export type Degree = number;

export type Vec3 = readonly [number, number, number];

export type AxisKey = 'x' | 'y' | 'z';
export type AxisDirection = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface Size3 {
  x: Millimeter;
  y: Millimeter;
  z: Millimeter;
}

// ------------------------------------------------------------
// ID
// ------------------------------------------------------------
export type ProjectId = string;   // "prj-xxxxxxxx"
export type PartId = string;      // "part-xxxxxxxx"
export type OperationId = string; // "op-xxxxxxxx"

// ------------------------------------------------------------
// Transform
// ------------------------------------------------------------
/**
 * 部材ローカル原点（= 直方体の中心）のワールド配置。
 * scale は Ver.1 では扱わない（寸法変更は size で行う）。
 */
export interface Transform {
  /** ワールド座標 mm */
  position: Vec3;
  /** Euler 角（度）。order は 'XYZ' 固定。 */
  rotation: Vec3;
}

// ------------------------------------------------------------
// Operation（加工）
// ------------------------------------------------------------
interface OperationBase {
  id: OperationId;
  /** false のとき形状計算から除外される（削除せず一時無効化） */
  enabled: boolean;
  /** 任意のメモ。UI の補足表示用 */
  note?: string;
}

/** 丸穴。direction の面から掘る。 */
export interface RoundHoleOperation extends OperationBase {
  type: 'roundHole';
  diameter: Millimeter;
  /** through=true のときは無視される */
  depth: Millimeter;
  through: boolean;
  /** 部材ローカル（中心原点）mm。穴の中心軸が通る点 */
  position: Vec3;
  /** 掘り進む向き。'-z' なら Z- 面から Z+ 方向へ掘る */
  direction: AxisDirection;
}

/** 角穴。direction 軸に直交する断面が width × height の矩形。 */
export interface RectHoleOperation extends OperationBase {
  type: 'rectHole';
  width: Millimeter;
  height: Millimeter;
  depth: Millimeter;
  through: boolean;
  position: Vec3;
  direction: AxisDirection;
  /** direction 軸まわりの断面の回転（度）。既定 0 */
  rotation: Degree;
}

/** 切り欠き。指定した直方体を丸ごと削り取る。 */
export interface NotchOperation extends OperationBase {
  type: 'notch';
  /** 削り取る直方体のローカル寸法 */
  size: Size3;
  /** 削り取る直方体の中心（部材ローカル、中心原点）mm */
  position: Vec3;
}

/** 切断。ローカル軸に垂直な平面で切り、片側を残す。 */
export interface CutOperation extends OperationBase {
  type: 'cut';
  /** 切断面の法線となるローカル軸 */
  axis: AxisKey;
  /** ローカル原点（中心）から測った切断位置 mm */
  offset: Millimeter;
  /** 残す側。'negative' = axis の負方向側を残す */
  keep: 'negative' | 'positive';
}

export type Operation =
  | RoundHoleOperation
  | RectHoleOperation
  | NotchOperation
  | CutOperation;

export type OperationType = Operation['type'];

// ------------------------------------------------------------
// Part（部材）
// ------------------------------------------------------------
/** Ver.2 で 'hardware' | 'printed' を追加する想定 */
export type PartKind = 'wood';

export type MaterialKind = 'plywood' | 'pine' | 'lauan' | 'mdf' | 'generic';

export interface Part {
  id: PartId;
  kind: PartKind;
  name: string;
  /** 加工前の素材寸法。これと operations が形状の真実 */
  size: Size3;
  transform: Transform;
  material: MaterialKind;
  /** 適用順に並んだ加工履歴 */
  operations: Operation[];
  visible: boolean;
  locked: boolean;
  /** ISO 8601 */
  createdAt: string;
}

// ------------------------------------------------------------
// Project / 保存フォーマット
// ------------------------------------------------------------
export interface Project {
  id: ProjectId;
  name: string;
  /** Ver.1 は mm 固定。将来 'inch' 表示を追加する余地 */
  unit: 'mm';
  parts: Part[];
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 1 as const;

export interface ProjectDocument {
  app: 'lets-diy';
  schemaVersion: number;
  savedAt: string;
  project: Project;
}

// ------------------------------------------------------------
// ツール立体（加工の実体。プレビューと CSG で共有する）
// ------------------------------------------------------------
export type ToolShape = 'box' | 'cylinder';

/**
 * Operation から導出される「減算する立体」の仕様。
 * 部材ローカル座標系（中心原点）で表現される。three.js に依存しない。
 */
export interface ToolSolidSpec {
  shape: ToolShape;
  /**
   * box:      [x, y, z] の 3 辺長
   * cylinder: x = 直径, y = 高さ（軸は +Y）, z = 直径（x と同値）
   */
  size: Size3;
  /** ツール立体の中心（部材ローカル mm） */
  position: Vec3;
  /** ツール立体の姿勢（度、Euler 'XYZ'、部材ローカル） */
  rotation: Vec3;
}

// ------------------------------------------------------------
// 検証結果
// ------------------------------------------------------------
export interface ValidationIssue {
  /** 対象フィールド（UI のハイライトに使う）例: 'diameter' */
  field?: string;
  message: string;
}

export interface ValidationResult {
  /** 1 件でもあれば実行を禁止する */
  errors: ValidationIssue[];
  /** 実行は許可するが UI で警告表示する */
  warnings: ValidationIssue[];
}

// ------------------------------------------------------------
// エディタ状態（保存対象外・Undo 対象外）
// ------------------------------------------------------------
export type EditorMode = 'create' | 'arrange' | 'machine';
export type GizmoMode = 'translate' | 'rotate';

/** 0 = スナップ OFF */
export type GridSnapValue = 0 | 1 | 5 | 10;
export type AngleSnapValue = 0 | 15 | 45 | 90;

export interface SnapSettings {
  grid: GridSnapValue;
  angle: AngleSnapValue;
}

/** 部材の 6 面のうち 1 つを指す参照 */
export interface FaceRef {
  partId: PartId;
  /** 部材ローカルでの面の外向き法線方向 */
  face: AxisDirection;
}

export interface FaceSnapSession {
  /** 動かす側の面 */
  source: FaceRef | null;
  /** 接触先の面 */
  target: FaceRef | null;
  /** 面と面の隙間 mm（負値も可 = めり込み） */
  gap: Millimeter;
  /** true のとき、法線に直交する 2 軸で面中心を揃える */
  centerAlign: boolean;
}

/** 加工モードで編集中の下書き。確定するまで Part には入らない。 */
export interface OperationDraft {
  partId: PartId;
  /** 既存加工の編集なら その id、新規なら null */
  editingId: OperationId | null;
  operation: Operation;
  /** UI での位置入力基準 */
  originMode: 'center' | 'corner';
}

export type AlignAxis = AxisKey;
export type AlignAnchor = 'min' | 'center' | 'max';

// ------------------------------------------------------------
// ジオメトリ構築結果（geometry/ 層が返す）
// ------------------------------------------------------------
export interface GeometryBuildWarning {
  operationId: OperationId;
  message: string;
}
```

### 8.1 ジオメトリ層のインターフェース（`three` 依存）

```ts
// src/geometry/csg/CsgEngine.ts
import type { BufferGeometry } from 'three';

export interface CsgEngine {
  /**
   * base から tool を減算した新しいジオメトリを返す。
   * 引数のジオメトリは変更しない（呼び出し側が dispose 責任を持つ）。
   * 非同期インターフェースにしてあるのは、Ver.2 で Worker 実装へ
   * 差し替えられるようにするため。Ver.1 実装は同期処理を Promise で包む。
   */
  subtract(base: BufferGeometry, tool: BufferGeometry): Promise<BufferGeometry>;
  dispose(): void;
}
```

```ts
// src/geometry/geometryBuilder.ts
import type { BufferGeometry } from 'three';
import type { Part, GeometryBuildWarning, OperationId } from '../core/types';

export interface GeometryBuildResult {
  geometry: BufferGeometry;
  /** 実行できなかった加工（形状には反映されていない） */
  failedOperationIds: OperationId[];
  warnings: GeometryBuildWarning[];
  /** 計測値（開発用。StatusBar に出してもよい） */
  durationMs: number;
}

export function buildPartGeometry(part: Part): Promise<GeometryBuildResult>;
```

---

## 9. 各モジュールの責務

### 9.1 `core/` — ドメインロジック

| ファイル | 責務 | 主な公開 API |
|----------|------|--------------|
| `types.ts` | 全ドメイン型の単一の定義元 | §8 のとおり |
| `constants.ts` | 定数の単一の定義元 | `SCENE_SCALE`, `EPS`, `OVERCUT`, `MIN_SIZE_MM`, `MAX_SIZE_MM`, `HISTORY_LIMIT`, `DEFAULT_SNAP` |
| `ids.ts` | ID 採番 | `createPartId()`, `createOperationId()`, `createProjectId()` |
| `math/vec3.ts` | ベクトル演算（配列 Vec3 のまま扱う） | `add/sub/scale/dot/cross/length/normalize/equals` |
| `math/angle.ts` | 角度変換・正規化・スナップ | `degToRad`, `radToDeg`, `normalizeDeg`, `snapAngle` |
| `math/matrix.ts` | Transform → 4x4 行列、逆変換 | `transformToMatrix`, `applyMatrix`, `worldToLocalPoint`, `localToWorldPoint`, `localToWorldDir` |
| `math/box.ts` | AABB/OBB、8 頂点、面情報 | `aabbFromPoints`, `boxCorners`, `FACE_NORMALS`, `faceCenterLocal` |
| `part/createPart.ts` | 既定値つき Part 生成 | `createPart(input): Part` |
| `part/localFrame.ts` | **中心原点 ⇄ コーナー原点** の変換 | `cornerToLocal(size, p)`, `localToCorner(size, p)` |
| `part/partBounds.ts` | 部材のローカル/ワールド境界 | `localAabb(part)`, `worldCorners(part)`, `worldAabb(part)` |
| `part/partFaces.ts` | 6 面の法線・中心をワールドで返す | `worldFace(part, dir): { normal, center, u, v, halfU, halfV }` |
| `part/partHash.ts` | **形状ハッシュ**（transform は含めない） | `hashPartShape(part): string` |
| `operation/operationDefaults.ts` | 加工種類ごとの初期値 | `defaultOperation(type, part): Operation` |
| `operation/operationLabel.ts` | 一覧表示用の文字列 | `operationLabel(op, part): string` |
| `operation/operationValidate.ts` | 検証（エラー/警告の分離） | `validateOperation(op, part): ValidationResult` |
| `operation/toolSolid.ts` | **Operation → ToolSolidSpec**（純粋） | `toolSolidSpec(op, size): ToolSolidSpec` |
| `snap/gridSnap.ts` | グリッド量子化 | `snapValue(v, step)`, `snapVec3(v, step)` |
| `snap/faceSnap.ts` | **面スナップの Transform 計算** | `computeFaceSnapTransform(args): Transform` |
| `snap/align.ts` | 整列 | `computeAlignedPositions(parts, axis, anchor): Map<PartId, Vec3>` |
| `project/projectSchema.ts` | zod スキーマ | `projectDocumentSchema` |
| `project/serialize.ts` | 直列化・復元 | `toDocument(project)`, `fromDocument(raw): Result<Project>` |
| `project/migrate.ts` | スキーマ移行 | `migrate(raw): unknown` |

### 9.2 `geometry/` — 形状生成

| ファイル | 責務 |
|----------|------|
| `boxGeometry.ts` | `createBoxGeometry(size): BufferGeometry`（中心原点） |
| `toolGeometry.ts` | `createToolGeometry(spec): BufferGeometry`。`spec.position/rotation` を **ジオメトリに焼き込んで**返す（`applyMatrix4`）。シリンダーは半径方向 24 分割 |
| `geometryBuilder.ts` | `buildPartGeometry(part)`。基本ボックスに対し、`enabled` な `operations` を順に `CsgEngine.subtract` する。1 件失敗しても続行し `failedOperationIds` に積む |
| `GeometryCache.ts` | `partId → { hash, geometry, edges }` を保持。`get(part)` はキャッシュヒットなら同期返却、ミスなら `pending` を返して非同期構築。`invalidate(partId)`, `release(partId)`, `clear()` で dispose |
| `edgesGeometry.ts` | アウトライン用 `EdgesGeometry` 生成（しきい値 15°） |
| `transformUtils.ts` | `applyTransform(object3d, transform)`。度 → ラジアン変換をここに閉じ込める |
| `csg/CsgEngine.ts` | インターフェース（§8.1） |
| `csg/BvhCsgEngine.ts` | `three-bvh-csg` を使った実装。`Evaluator` と `Brush` の生成・使い回し。**このファイル以外で `three-bvh-csg` を import してはならない** |
| `csg/index.ts` | `getCsgEngine(): CsgEngine` シングルトン |

### 9.3 `store/` — 状態とコマンド

| ファイル | 責務 |
|----------|------|
| `history.ts` | `applyCommand(label, recipe)` で immer patches を記録。`undo()`, `redo()`, `canUndo`, `canRedo`, `beginTransient()`, `commitTransient(label)`, `abortTransient()` |
| `useProjectStore.ts` | `project: Project` と履歴スタックを保持。**唯一の書き込み口は `applyCommand`** |
| `useEditorStore.ts` | `mode`, `selectedIds`, `hoveredId`, `gizmoMode`, `snap`, `faceSnapSession`, `operationDraft`, `viewOptions`, `toasts`。**履歴・保存の対象外** |
| `selectors.ts` | `useSelectedPart()`, `useSelectedParts()`, `usePartById(id)` など |
| `commands/partCommands.ts` | `addPart`, `removeParts`, `duplicateParts`, `renamePart`, `setPartSize`, `setPartMaterial`, `setPartVisible`, `setPartLocked` |
| `commands/transformCommands.ts` | `setPartPosition`, `setPartRotation`, `translateParts`, `applyFaceSnap`, `alignParts` |
| `commands/operationCommands.ts` | `addOperation`, `updateOperation`, `removeOperation`, `setOperationEnabled`, `reorderOperation` |

**コマンド関数の規約（MUST）**

- コマンドは `store/commands/` にのみ置く。UI から `useProjectStore.setState` を直接呼ばない。
- 1 コマンド = 1 Undo ステップ。
- コマンドは `void` または `Result` を返し、**three.js を触らない**。
- コマンドは `project.updatedAt` を更新する。

### 9.4 `viewport/` — 3D 表示

| ファイル | 責務 |
|----------|------|
| `Viewport.tsx` | `<Canvas frameloop="demand" shadows dpr={[1,2]}>`。ErrorBoundary で包む |
| `SceneRoot.tsx` | `<Lighting/> <GridFloor/> <PartsLayer/> <TransformGizmo/> <OperationPreview/> <FacePickOverlay/> <CameraRig/>` |
| `CameraRig.tsx` | `OrbitControls`（ドラッグ中は `invalidate` が drei 側で走る）+ 視点プリセット + `focusOnParts(ids)` |
| `PartsLayer.tsx` | `project.parts` を map。**key は `part.id`**（index 禁止） |
| `PartMesh.tsx` | `usePartGeometry(part)` でジオメトリ取得 → `<mesh>`。`onPointerDown` で選択、`onPointerOver` でホバー。`React.memo` + カスタム比較（id/size/operations/transform/visible/selected のみ比較） |
| `SelectionOutline.tsx` | 選択中部材の `<lineSegments>` を重ねる |
| `TransformGizmo.tsx` | 選択が 1 件かつ配置モードのときのみ描画。`translationSnap` / `rotationSnap` をスナップ設定から与える。`dragging-changed` で `beginTransient` / `commitTransient` |
| `OperationPreview.tsx` | `editorStore.operationDraft` から `toolSolidSpec` → `createToolGeometry` → 半透明メッシュ。**`useMemo` で draft 変更時のみ再生成** |
| `FacePickOverlay.tsx` | 面スナップ中、ホバー中の面に半透明の板を出す。クリックで `FaceRef` を確定 |
| `hooks/usePartGeometry.ts` | `GeometryCache` を購読。非同期構築中は直前のジオメトリ（なければ素のボックス）を返す |
| `hooks/usePointerPick.ts` | 交点のローカル座標・法線 → `AxisDirection` を解決（`pickFace`） |

### 9.5 `ui/` — パネル

各パネルは「ストアを読む・コマンドを呼ぶ」だけ。計算ロジックを持たない。
計算が必要なら `core/` に関数を作り、パネルはそれを呼ぶ。

### 9.6 `ui/common/NumberField.tsx`（仕様を固定する）

```ts
interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;   // 確定時のみ発火（= 1 Undo ステップ）
  onPreview?: (value: number) => void; // 入力中に呼ぶ（プレビュー更新用・履歴に残さない）
  unit?: 'mm' | '°';
  min?: number;
  max?: number;
  step?: number;        // 既定 1
  precision?: number;   // 既定 1（小数第1位）
  disabled?: boolean;
  error?: string;
  warning?: string;
}
```

**挙動（MUST）**

1. 入力中は文字列をローカル state で保持。`onCommit` は `Enter` / `blur` でのみ発火。
2. `↑↓` = `step`、`Shift+↑↓` = `step*10`、`Alt+↑↓` = `step/10`。
3. `min`/`max` でクランプ。クランプしたら枠を一瞬黄色にして気づかせる。
4. 空文字 / `NaN` は確定させず、直前値に戻す。
5. `error` があれば枠を赤くしメッセージを下に出す。

### 9.7 `io/`

| ファイル | 責務 |
|----------|------|
| `ProjectRepository.ts` | 保存先の抽象インターフェース（§16.4） |
| `LocalStorageRepository.ts` | localStorage 実装。キー接頭辞 `letsdiy.` |
| `fileDownload.ts` | `Blob` + `URL.createObjectURL` で `.ldiy.json` をダウンロード |
| `fileOpen.ts` | `<input type="file">` で読み込み → `fromDocument` で検証 |
| `autosave.ts` | `useProjectStore.subscribe` を 1000ms debounce して保存 |

---

## 10. 3D 表示処理

### 10.1 Canvas 設定

```tsx
// src/viewport/Viewport.tsx
<Canvas
  frameloop="demand"              // * 変化があるときだけ描画
  shadows
  dpr={[1, 2]}
  gl={{ antialias: true, preserveDrawingBuffer: false }}
  camera={{ fov: 45, near: 1, far: 100000, position: [800, 600, 1200] }}
  onPointerMissed={() => editorStore.clearSelection()}
>
  <SceneRoot />
</Canvas>
```

### 10.2 `frameloop="demand"` 運用ルール（MUST）

`invalidate()` を呼ぶべきタイミング:

| タイミング | 呼ぶ場所 |
|-----------|---------|
| ストアの project が変わった | `useInvalidateOnStore`（`useProjectStore.subscribe`） |
| 選択・ホバー・プレビューが変わった | 同上（`useEditorStore.subscribe`） |
| ジオメトリ構築が完了した | `GeometryCache` のコールバック |
| OrbitControls / TransformControls のドラッグ中 | drei が自動で呼ぶ |
| ウィンドウリサイズ | R3F が自動で呼ぶ |

**禁止**: `useFrame(() => invalidate())` のような常時描画化。これをやると `frameloop="demand"` が無意味になる。

### 10.3 ライティング

```tsx
<hemisphereLight args={[0xffffff, 0x666666, 1.2]} />
<directionalLight
  position={[1500, 2500, 1000]}
  intensity={1.6}
  castShadow
  shadow-mapSize={[2048, 2048]}
  shadow-camera-left={-2000} shadow-camera-right={2000}
  shadow-camera-top={2000}  shadow-camera-bottom={-2000}
  shadow-camera-near={1}    shadow-camera-far={8000}
/>
<ambientLight intensity={0.35} />
```

影のカメラ範囲はシーン単位が mm であることを踏まえて大きめに取る。

### 10.4 PartMesh の実装骨子

```tsx
// src/viewport/PartMesh.tsx（骨子）
export const PartMesh = memo(function PartMesh({ part }: { part: Part }) {
  const geometry = usePartGeometry(part);           // BufferGeometry | null
  const material = useMaterial(part.material);      // 共有インスタンス
  const selected = useEditorStore(s => s.selectedIds.includes(part.id));
  const ref = useRef<THREE.Mesh>(null!);

  // transform は行列だけ更新（ジオメトリ再生成なし）
  useLayoutEffect(() => {
    applyTransform(ref.current, part.transform);
    invalidate();
  }, [part.transform]);

  if (!geometry || !part.visible) return null;

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      userData={{ partId: part.id }}
      onPointerDown={(e) => { e.stopPropagation(); handlePick(e, part.id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(part.id); }}
      onPointerOut={() => setHovered(null)}
    >
      {selected && <SelectionOutline geometry={geometry} />}
    </mesh>
  );
}, arePartPropsEqual);
```

**注意点（MUST）**

- `geometry` / `material` は **JSX の子要素として `<boxGeometry/>` のように書かない**。props で渡す。子要素として書くと R3F がアンマウント時に自動 dispose し、キャッシュ中のジオメトリを破壊する。
- dispose は `GeometryCache` が一元管理する。

### 10.5 ピッキングと面判定

```ts
// src/viewport/hooks/usePointerPick.ts
// 交点のワールド座標 → 部材ローカル座標へ変換し、
// 6 面のうち最も近い面を返す。加工でメッシュが変形していても
// 「元の直方体のどの面か」を安定して返せる。
export function pickFace(part: Part, worldPoint: Vec3): AxisDirection {
  const p = worldToLocalPoint(part.transform, worldPoint);
  const h = [part.size.x / 2, part.size.y / 2, part.size.z / 2];
  const dist: Array<[AxisDirection, number]> = [
    ['+x', Math.abs(h[0] - p[0])], ['-x', Math.abs(p[0] + h[0])],
    ['+y', Math.abs(h[1] - p[1])], ['-y', Math.abs(p[1] + h[1])],
    ['+z', Math.abs(h[2] - p[2])], ['-z', Math.abs(p[2] + h[2])],
  ];
  return dist.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}
```

---

## 11. 配置システム

### 11.1 数値入力による配置（主操作）

右パネルの位置・回転フィールドは `NumberField` の `onCommit` で `setPartPosition` / `setPartRotation` を呼ぶ。スナップ設定が ON なら値を `snapValue` に通してから適用する。

### 11.2 ギズモによる配置（補助操作）

```tsx
// src/viewport/TransformGizmo.tsx（骨子）
<TransformControls
  object={targetObject}
  mode={gizmoMode}                                  // 'translate' | 'rotate'
  translationSnap={snap.grid || null}               // 0 は null（= スナップ無効）
  rotationSnap={snap.angle ? degToRad(snap.angle) : null}
  space="world"
  size={0.8}
  onMouseDown={() => { setOrbitEnabled(false); beginTransient(); }}
  onMouseUp={() => {
    setOrbitEnabled(true);
    commitTransient(gizmoMode === 'translate' ? '部材を移動' : '部材を回転');
  }}
  onObjectChange={() => {
    // ドラッグ中: ストアを「一時更新」する。履歴には積まない
    updateTransientTransform(partId, readTransform(targetObject));
  }}
/>
```

**MUST**

- ギズモ操作中は `OrbitControls` を無効化する（`dragging-changed` イベント）。
- ドラッグ中の連続更新は **履歴に積まない**。マウスアップ時に 1 ステップとして確定する（§15.4）。
- 選択が複数、または `part.locked === true` のときギズモを表示しない。

### 11.3 複製

`duplicateParts(ids)`:

1. 各 Part をディープコピー、`id` と全 `operations[].id` を再採番。
2. `name` に ` (コピー)` を付ける（重複時は ` (コピー 2)`）。
3. 位置を **X 方向に「元部材の X 寸法 + 20mm」ずらす**（重なって見えなくなるのを防ぐ）。
4. 複製後の部材を選択状態にする。

### 11.4 削除

`removeParts(ids)`:

1. `locked` な部材はスキップし、Toast で知らせる。
2. ストアから削除 → `GeometryCache.release(id)` で dispose。
3. 選択から除去。
4. Undo で完全復元できる（patches に全内容が入る）ので確認ダイアログは出さない。

### 11.5 整列（Align）

```ts
// src/core/snap/align.ts
export function computeAlignedPositions(
  parts: Part[], axis: AxisKey, anchor: AlignAnchor,
): Map<PartId, Vec3>;
```

- 各部材のワールド AABB（回転を考慮した 8 頂点から算出）を求める。
- `anchor` に応じて基準値を決める:
  - `min`: 全部材の AABB min の最小値
  - `max`: 全部材の AABB max の最大値
  - `center`: 全部材を含む AABB の中心
- 各部材を、その AABB の対応点が基準値に一致するよう **その軸方向にのみ平行移動**する。

回転は変更しない。1 回の整列 = 1 Undo ステップ。

---

## 12. スナップシステム

### 12.1 Ver.1 スコープの判断

| 機能 | Ver.1 | 判断根拠 |
|------|-------|----------|
| グリッドスナップ | 実装する | 実装コスト極小、効果大。TransformControls が標準対応 |
| 角度スナップ | 実装する | 同上。90° があると箱組みが一気に楽になる |
| 面スナップ | 実装する | 家具設計の中核。ただし「面を 2 つ選ぶウィザード」に限定し、ドラッグ中の自動吸着は Ver.2 |
| 整列（Align） | 実装する | エッジスナップの実用ニーズの大半を、はるかに安い実装で満たす |
| エッジスナップ | 実装しない | ドラッグ中に全部材のエッジを毎フレーム評価する必要があり、空間インデックスと吸着 UI の設計が必要。Ver.1 のコスト対効果が悪い |
| 頂点スナップ | 実装しない | 同上 |
| ドラッグ中の自動面吸着 | 実装しない | Ver.2。Ver.1 はウィザード方式で同じ結果を得られる |

**この判断が本設計の最大のトレードオフである。** 「選択 → 数値入力 → 実行」という本アプリの操作哲学に、ウィザード方式の面スナップは完全に一致しており、ドラッグ吸着より初心者に分かりやすい。

### 12.2 グリッドスナップ

```ts
// src/core/snap/gridSnap.ts
export function snapValue(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}
export function snapVec3(v: Vec3, step: number): Vec3 {
  return [snapValue(v[0], step), snapValue(v[1], step), snapValue(v[2], step)];
}
```

適用箇所:
- `TransformControls.translationSnap`
- `setPartPosition` コマンド内（数値入力にも効かせる）
- 生成時の初期配置

### 12.3 角度スナップ

```ts
// src/core/math/angle.ts
export function snapAngle(deg: number, step: number): number {
  if (step <= 0) return normalizeDeg(deg);
  return normalizeDeg(Math.round(deg / step) * step);
}
```

### 12.4 面スナップ

#### UI フロー

```
[面スナップを開始] を押す
  → faceSnapSession = { source: null, target: null, gap: 0, centerAlign: false }
  → ヒントバー「動かす部材の面をクリックしてください」
  → 面ホバーで半透明ハイライト

面 A をクリック → session.source = { partId: A, face: '+x' }
  → ヒントバー「接触させる相手の面をクリックしてください」

面 B をクリック → session.target = { partId: B, face: '-x' }
  → プレビュー: A を移動先に半透明表示
  → 隙間 / 中心合わせ を変更するとプレビューが即更新（CSG は不要なので軽い）

[適用] → applyFaceSnap() コマンド（1 Undo ステップ）
[やめる] / Esc → session をクリア
```

#### 計算アルゴリズム

```ts
// src/core/snap/faceSnap.ts
export interface FaceSnapArgs {
  source: Part;            // 動かす部材
  sourceFace: AxisDirection;
  target: Part;            // 固定側
  targetFace: AxisDirection;
  gap: Millimeter;
  centerAlign: boolean;
}

export function computeFaceSnapTransform(args: FaceSnapArgs): Transform;
```

**手順**

1. `nA` = source の面法線（ワールド、単位ベクトル）、`nB` = target の面法線（ワールド）。
2. **姿勢合わせ**: `nA` を `-nB` に一致させる最小回転を求める。
   - Ver.1 では **90° 単位の軸整列回転に限定**する（`alignAxisRotation(nA, negate(nB))`）。
   - `nA` と `-nB` が既に平行（dot > 0.999）なら回転なし。
   - それ以外は、回転軸 = `cross(nA, -nB)` を最も近い主軸に丸め、回転角 = 90° or 180° に丸める。
   - 求めた回転を source の既存回転に合成し、度に戻して `rotation` とする。
3. **平行移動**: 姿勢合わせ後の source について、
   - `pA` = source 面の中心（ワールド）、`pB` = target 面の中心（ワールド）
   - 法線方向の移動量 `d = dot(pB - pA, nB) + gap`
   - `position += nB * d`

   > **符号について（2026-09-22 修正）**: `nB` は target の**外向き**法線である。
   > source は target の面の外側に接するので、目標平面は `pB + nB * gap`。
   > したがって `d = dot((pB + nB * gap) - pA, nB) = dot(pB - pA, nB) + gap` となり、
   > 正の `gap` がそのまま「隙間」になる。`gap = 0` で密着、負値でめり込む。
   > （初版は `- gap` と記載していたが符号が逆だった。Codex の指摘により修正。）
4. **中心合わせ**（`centerAlign === true` のとき）: `nB` に直交する 2 軸方向についても `pB - pA` の成分だけ移動する。
   - `false` のときは法線方向のみ動かし、他 2 軸は保持する（ユーザーが決めた位置を壊さない）。
5. 結果の `position` を、グリッドスナップが ON なら `snapValue` に通す。ただし **法線方向の接触がずれないよう、スナップは中心合わせ軸のみに適用**する。

**テスト必須ケース（§19 / PHASES_V1 Phase 5）**

- 回転 0° の板 A(+X 面) と板 B(-X 面) → A の右面と B の左面が `gap` だけ離れて接する
- `gap = 0` のとき、A の面と B の面のワールド座標上の距離が `< 0.001mm`
- A が Y 軸 90° 回転している場合でも接触する
- `centerAlign = true` で面中心が一致する
- 同一部材の面同士を選んだ場合は **エラーにして適用させない**

### 12.5 エッジスナップを実装しない代替（整列）

§11.5 の整列で、次の実用ケースを全てカバーできる:

- 「複数の棚板の左端を揃える」→ X / min
- 「側板 2 枚の上端を揃える」→ Y / max
- 「部材を中心線に揃える」→ X / center

---

## 13. 加工システム

### 13.1 設計の核: 全ての加工は「ツール立体の減算」

Ver.1 の 4 種類の加工は、すべて次の 1 本の流れに帰着する。

```
Operation ──(純粋関数 toolSolidSpec)──▶ ToolSolidSpec ──┬──▶ プレビュー（半透明メッシュ）
                                                        └──▶ CSG 減算（実行時のみ）
```

**この統一により、プレビューと実行結果が必ず一致する**（別々に実装すると必ずズレる）。

### 13.2 各加工の ToolSolidSpec 変換

```ts
// src/core/operation/toolSolid.ts
import { OVERCUT } from '../constants';  // = 0.5 (mm)

export function toolSolidSpec(op: Operation, size: Size3): ToolSolidSpec {
  switch (op.type) {
    case 'roundHole':   return roundHoleSolid(op, size);
    case 'rectHole':    return rectHoleSolid(op, size);
    case 'notch':       return notchSolid(op, size);
    case 'cut':         return cutSolid(op, size);
  }
}
```

#### 丸穴 (`roundHole`)

```
axis      = direction の軸（'x'|'y'|'z'）
sign      = direction の符号（+1 / -1）
halfExtent= size[axis] / 2
depth     = through ? size[axis] + 2*OVERCUT : op.depth + OVERCUT

// 穴の入口は「direction の面」。そこから内側（-sign 方向）へ掘る。
entry     = sign * halfExtent + sign * OVERCUT   // 面より OVERCUT だけ外
center[axis] = entry - sign * depth / 2
center[他2軸] = op.position の該当成分

shape    = 'cylinder'
size     = { x: diameter, y: depth, z: diameter }   // 円柱の軸は +Y
rotation = 円柱の +Y 軸を axis に向ける回転
           axis==='y' → [0, 0, 0]
           axis==='x' → [0, 0, 90]
           axis==='z' → [90, 0, 0]
position = center
```

> `OVERCUT`（0.5mm）を必ず入れること。ツール立体の端面と部材の面がぴったり同一平面だと、CSG が不安定な面（コプラナー）を作り、Z-fighting や穴が開かない不具合の原因になる。

#### 角穴 (`rectHole`)

丸穴と同じ軸計算で `shape = 'box'`、`size = { [幅軸]: width, [axis]: depth, [高さ軸]: height }`。
`op.rotation` は `axis` まわりの回転として `rotation` に加算する。

#### 切り欠き (`notch`)

そのまま `shape = 'box'`, `size = op.size`, `position = op.position`, `rotation = [0,0,0]`。
（ユーザーは部材からはみ出す位置に置いてよい。はみ出した部分は単に何も削らない。）

#### 切断 (`cut`)

「残さない側の半空間を覆う巨大ボックス」を減算する。

```
plane     = op.offset                       // ローカル axis 座標
removeSign= op.keep === 'negative' ? +1 : -1  // 残さない側の向き
big       = max(size.x, size.y, size.z) * 2 + 100

shape = 'box'
size  = { x: big, y: big, z: big } を、axis 方向だけ big、他軸も big（立方体で十分）
position[axis]  = plane + removeSign * big / 2
position[他2軸] = 0
rotation = [0, 0, 0]
```

### 13.3 検証ルール（`operationValidate.ts`）

| 加工 | エラー（実行不可） | 警告（実行可） |
|------|-------------------|---------------|
| 共通 | 対象部材が存在しない / `locked` | — |
| roundHole | `diameter <= 0` / `!through && depth <= 0` / `!through && depth >= size[axis]`（貫通になる → 「貫通に変更してください」） | 穴が部材の外に完全に出ている / 穴の縁から部材端までが `diameter/2` 未満（割れやすい） |
| rectHole | `width <= 0` / `height <= 0` / 深さ条件は roundHole と同様 | 同上 |
| notch | `size` のいずれかが `<= 0` | 部材と全く交差しない（何も削られない） |
| cut | `abs(offset) >= size[axis] / 2`（切断面が部材の外 → 全部残るか全部消える） | 切り落とす側が `1mm` 未満 |
| 全体 | **結果の頂点数が 0 になる**（形状が消滅する） | — |

「結果の形状が消滅する」は CSG 実行後にしか分からないため、`geometryBuilder` が空ジオメトリを検出したら **その加工をスキップして `failedOperationIds` に入れ**、UI が「この加工は形状を消してしまうため適用できません」と表示する。

### 13.4 加工モードの状態遷移

```
idle ──[種類ボタン]──▶ drafting
                          │  パラメータ変更 → プレビュー更新（CSG なし）
                          │
                          ├──[加工を実行]──▶ (validate OK) ──▶ addOperation コマンド
                          │                                      └─▶ ハッシュ変化 → CSG 1回 → 表示更新
                          │                                           └─▶ idle へ
                          └──[キャンセル / Esc]──▶ idle

idle ──[既存加工の編集]──▶ editing
                              │  パラメータ変更 → プレビュー更新
                              │  （編集中は、その加工を一時的に enabled=false にした
                              │    形状をベースに表示してもよい = MAY。Ver.1 は
                              │    現形状のまま + プレビュー重ね表示で十分）
                              └──[更新]──▶ updateOperation コマンド → CSG 1回
```

### 13.5 プレビューの実装規約（MUST）

- プレビューメッシュは `OperationPreview.tsx` が 1 つだけ作る。
- `useMemo(() => createToolGeometry(spec), [specHash])` で、draft が変わったときだけ再生成する。
- **`useFrame` の中でジオメトリを作らない。**
- マテリアル: `MeshBasicMaterial({ color: PREVIEW_COLOR, transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide })`
- プレビューメッシュは対象部材の `Object3D` の子として配置し、部材の transform を自動で継承させる。
- draft が `null` になったらジオメトリを `dispose()` する。

---

## 14. CSG 処理

### 14.1 インターフェース

§8.1 の `CsgEngine`。**非同期（`Promise`）にしてあるのは Ver.2 で Worker 実装へ差し替えるため。** Ver.1 の実装は同期処理を `Promise.resolve` で包むだけでよいが、呼び出し側は必ず `await` すること。

### 14.2 `BvhCsgEngine` の実装骨子

```ts
// src/geometry/csg/BvhCsgEngine.ts
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { Mesh, BufferGeometry } from 'three';
import type { CsgEngine } from './CsgEngine';

export class BvhCsgEngine implements CsgEngine {
  private evaluator = new Evaluator();

  constructor() {
    // Ver.1 は単一マテリアル。グループ分割しない（Ver.2 で断面を別色にする際に true へ）
    this.evaluator.useGroups = false;
    this.evaluator.attributes = ['position', 'normal'];
  }

  async subtract(base: BufferGeometry, tool: BufferGeometry): Promise<BufferGeometry> {
    const a = new Brush(base);
    const b = new Brush(tool);
    a.updateMatrixWorld(true);
    b.updateMatrixWorld(true);

    const result = this.evaluator.evaluate(a, b, SUBTRACTION);
    // evaluate はターゲット Brush を再利用するため、必ずクローンして返す
    const geometry = result.geometry.clone();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  dispose(): void { /* Evaluator の内部バッファ解放 */ }
}
```

**実装上の必須注意点**

1. `evaluate()` の戻り値のジオメトリは Evaluator が再利用するバッファなので、**必ず `clone()` してから返す**。これを忘れると、次の加工で前の形状が壊れる。
2. `Brush` に渡すジオメトリは `index` を持ち、`position` 属性が必須。`BoxGeometry` / `CylinderGeometry` はそのまま使える。
3. 中間結果のジオメトリは、次の減算に渡した後に `dispose()` する（リーク防止）。
4. `three-bvh-csg` は非多様体（non-manifold）なメッシュで結果が壊れることがある。Ver.1 では入力が常に「直方体 − 凸立体」なので実用上問題ないが、**失敗を前提にした `try/catch`（§18.3）を必ず入れる**。

### 14.3 `geometryBuilder` の逐次減算

```ts
// src/geometry/geometryBuilder.ts（骨子）
export async function buildPartGeometry(part: Part): Promise<GeometryBuildResult> {
  const t0 = performance.now();
  const engine = getCsgEngine();
  const failedOperationIds: OperationId[] = [];
  const warnings: GeometryBuildWarning[] = [];

  let current = createBoxGeometry(part.size);

  for (const op of part.operations) {
    if (!op.enabled) continue;
    const spec = toolSolidSpec(op, part.size);
    const tool = createToolGeometry(spec);
    try {
      const next = await engine.subtract(current, tool);
      if (isEmptyGeometry(next)) {
        next.dispose();
        failedOperationIds.push(op.id);
        warnings.push({ operationId: op.id, message: '形状が消滅するため適用できません' });
        continue;                    // current を維持して次へ
      }
      current.dispose();             // * 中間結果を解放
      current = next;
    } catch (e) {
      failedOperationIds.push(op.id);
      warnings.push({ operationId: op.id, message: '加工の計算に失敗しました' });
      console.error('[csg] operation failed', { partId: part.id, op }, e);
    } finally {
      tool.dispose();                // * ツール立体は毎回解放
    }
  }

  return { geometry: current, failedOperationIds, warnings, durationMs: performance.now() - t0 };
}
```

**「1 部材 = 1 回の逐次減算」であり、他の部材には一切触れない。** これが N-04 の担保。

### 14.4 CSG を実行しない条件（MUST）

以下のときに CSG が走ってはならない:

- 部材の移動・回転（`transform` のみの変化）
- 選択・ホバー・カメラ操作
- 加工パラメータの入力中（プレビュー段階）
- 加工リストの表示・スクロール
- Undo/Redo で **形状ハッシュが変わらなかった** 部材

---

## 15. Undo / Redo 設計

### 15.1 方式: immer patches

```ts
// src/store/history.ts（骨子）
import { produceWithPatches, applyPatches, enablePatches, type Patch } from 'immer';
enablePatches();

interface HistoryEntry {
  label: string;               // 「丸穴を追加」など UI 表示用
  patches: Patch[];
  inversePatches: Patch[];
  at: number;
}

const HISTORY_LIMIT = 100;
```

**利点**: 各コマンドが「逆操作」を自前で実装する必要がない。`addPart` の逆は `removeParts` ではなく、immer が生成した `inversePatches` である。バグの温床が消える。

### 15.2 コマンド適用

```ts
// useProjectStore 内
applyCommand(label: string, recipe: (draft: Project) => void): void {
  const [next, patches, inversePatches] = produceWithPatches(get().project, (draft) => {
    recipe(draft);
    draft.updatedAt = new Date().toISOString();
  });
  if (patches.length === 0) return;                 // 変化なしなら履歴を汚さない
  set({
    project: next,
    past: [...get().past, { label, patches, inversePatches, at: Date.now() }].slice(-HISTORY_LIMIT),
    future: [],                                     // 新規操作で redo スタックを破棄
  });
}
```

### 15.3 Undo / Redo

```ts
undo(): void {
  const entry = last(get().past);
  if (!entry) return;
  set({
    project: applyPatches(get().project, entry.inversePatches),
    past: get().past.slice(0, -1),
    future: [entry, ...get().future],
  });
  reconcileAfterHistory();
}

redo(): void {
  const entry = first(get().future);
  if (!entry) return;
  set({
    project: applyPatches(get().project, entry.patches),
    past: [...get().past, entry],
    future: get().future.slice(1),
  });
  reconcileAfterHistory();
}
```

`reconcileAfterHistory()` の責務:

1. 存在しない `partId` を `selectedIds` から除去する。
2. 進行中の `faceSnapSession` / `operationDraft` が参照する部材が消えていたらクリアする。
3. `GeometryCache.syncWith(project.parts)` を呼び、消えた部材のジオメトリを dispose する。
4. `invalidate()`。

### 15.4 連続操作のまとめ（Transient）

ギズモのドラッグやスライダー操作は 1 秒間に何十回も値が変わるため、そのまま履歴に積むと Undo が壊れる。

```ts
beginTransient(): void {
  // 現在の project をスナップショットとして保持し、以降の更新は履歴に積まない
  set({ transientBase: get().project });
}

updateTransient(recipe: (draft: Project) => void): void {
  set({ project: produce(get().project, recipe) });   // 履歴に積まない
}

commitTransient(label: string): void {
  const base = get().transientBase;
  if (!base) return;
  const final = get().project;
  // base → final の差分を 1 エントリとして記録する
  const [, patches, inversePatches] = produceWithPatches(base, (draft) => {
    Object.assign(draft, structuredClone(final));
  });
  set({ project: final, transientBase: null, past: [...], future: [] });
}

abortTransient(): void {
  set({ project: get().transientBase!, transientBase: null });
}
```

**Transient を使う箇所**: `TransformControls` のドラッグ、`NumberField` の `↑↓` 長押し（実装するなら）。
**使わない箇所**: `NumberField` の `onCommit`、ボタン操作（これらは既に 1 回 = 1 ステップ）。

### 15.5 履歴に「入れる／入れない」の線引き

| 対象 | 履歴 |
|------|------|
| 部材の追加・削除・複製・リネーム | 記録する |
| 寸法・材質の変更 | 記録する |
| 位置・回転の変更（確定時） | 記録する |
| 加工の追加・更新・削除・有効無効・並べ替え | 記録する |
| 整列・面スナップの適用 | 記録する |
| プロジェクト名の変更 | 記録する |
| 選択・ホバー | 記録しない |
| モード切替・タブ切替 | 記録しない |
| スナップ設定・表示オプション | 記録しない |
| カメラ視点 | 記録しない |
| 加工の下書き（draft）編集 | 記録しない |
| ファイル読み込み | 記録しない（履歴をクリアする） |

### 15.6 UI

- TopBar の Undo/Redo ボタンは `canUndo` / `canRedo` で `disabled`。
- `title` に直前の操作ラベルを出す（例: `元に戻す: 丸穴を追加 (Ctrl+Z)`）。
- StatusBar に「最後の操作: <操作ラベル>」を表示する。

---

## 16. 保存 / 読み込み

### 16.1 保存フォーマット

§7.3 の `ProjectDocument`。拡張子は `.ldiy.json`（中身はただの JSON）。

**MUST: メッシュ・頂点・三角形を一切保存しない。** 保存するのは `size` と `operations` だけで、形状は読み込み時に再構築する。

### 16.2 読み込みパイプライン

```
File / localStorage の文字列
  → JSON.parse                       （失敗 → 「ファイルが壊れています」）
  → migrate(raw)                     （schemaVersion に応じた変換）
  → projectDocumentSchema.safeParse  （zod。失敗 → フィールド名つきエラー）
  → 追加の不変条件チェック            （ID 重複、size > 0 など）
  → useProjectStore.loadProject()    （履歴クリア、キャッシュ全クリア）
  → 全部材のジオメトリを順次構築      （進捗を Toast / StatusBar に表示）
  → カメラを全体にフィット
```

### 16.3 マイグレーション

```ts
// src/core/project/migrate.ts
type Migration = (doc: any) => any;

const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2 の例（Ver.2 で追加する）
  // 1: (doc) => { ...doc, project: { ...doc.project, joints: [] } },
};

export function migrate(raw: any): any {
  let doc = raw;
  let v = doc?.schemaVersion ?? 0;
  if (v > SCHEMA_VERSION) {
    throw new AppError('UNSUPPORTED_VERSION',
      'このファイルは新しいバージョンで作成されています');
  }
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new AppError('MIGRATION_MISSING', `v${v} からの変換手順がありません`);
    doc = m(doc);
    v += 1;
    doc.schemaVersion = v;
  }
  return doc;
}
```

Ver.1 時点で `MIGRATIONS` は空でよいが、**この仕組み自体は Phase 9 で必ず作る**。後から入れると既存ファイルが読めなくなる。

### 16.4 保存先の抽象化（将来のサーバー保存の受け口）

```ts
// src/io/ProjectRepository.ts
import type { ProjectDocument, ProjectId } from '../core/types';

export interface ProjectSummary {
  id: ProjectId;
  name: string;
  savedAt: string;
  partCount: number;
}

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  load(id: ProjectId): Promise<ProjectDocument>;
  save(doc: ProjectDocument): Promise<void>;
  remove(id: ProjectId): Promise<void>;
}
```

- Ver.1: `LocalStorageRepository` のみ。
- Ver.2: `HttpProjectRepository` を追加し、`getRepository()` の返り値を差し替えるだけで済む。
- **UI とストアは `ProjectRepository` 型にのみ依存し、`localStorage` を直接触らない。**

### 16.5 localStorage のキー設計

| キー | 内容 |
|------|------|
| `letsdiy.schemaVersion` | 現在のスキーマ版（起動時の互換チェック用） |
| `letsdiy.autosave` | 自動保存された `ProjectDocument`（1 件） |
| `letsdiy.projects.index` | `ProjectSummary[]` |
| `letsdiy.projects.<projectId>` | `ProjectDocument` |
| `letsdiy.editorPrefs` | スナップ設定・表示オプション（設計データではない） |

**容量対策**: localStorage は約 5MB。部材 50 枚・加工 200 件の JSON は概ね 100KB 未満なので Ver.1 では問題ないが、`QuotaExceededError` を捕捉して「保存できませんでした。不要なプロジェクトを削除してください」と案内する。

### 16.6 自動保存

- `useProjectStore.subscribe` を **1000ms debounce**。
- 保存中は StatusBar に「保存中…」→「保存しました hh:mm」を表示。
- ページ離脱時（`beforeunload`）に未保存変更があれば debounce を待たず同期保存する。
- 起動時に `letsdiy.autosave` があれば「前回の続きから再開しますか？」を出す（自動復元ではなく確認する。意図しない上書きを避けるため）。

### 16.7 新規作成 / 読み込み時の確認

未保存の変更（`past.length > 0` かつ最終保存以降に変更あり）がある状態で「新規」「開く」を実行する場合のみ、確認ダイアログを出す。それ以外は確認なしで実行する（無駄な確認は初心者の妨げになる）。

---

## 17. パフォーマンス対策

### 17.1 対策一覧

| # | 対策 | 実装箇所 | 検証方法 |
|---|------|----------|----------|
| P-1 | 描画は変化時のみ（`frameloop="demand"`） | `Viewport.tsx` | 静止時に DevTools Performance で GPU 負荷が 0 になる |
| P-2 | 形状ハッシュによるキャッシュ | `partHash.ts` / `GeometryCache.ts` | 移動時に `buildPartGeometry` が呼ばれないことをログで確認 |
| P-3 | transform 変更は行列のみ更新 | `PartMesh.tsx` | 同上 |
| P-4 | 変更した部材だけ再構築 | `GeometryCache.get` | 3 部材中 1 部材に加工 → build ログが 1 回だけ |
| P-5 | マテリアルの共有 | `materialLibrary.ts` | `renderer.info.memory` を確認 |
| P-6 | `React.memo` + カスタム比較 | `PartMesh.tsx` | React DevTools Profiler で再レンダリング数を確認 |
| P-7 | 中間ジオメトリの確実な dispose | `geometryBuilder.ts` | 加工を 50 回繰り返して `renderer.info.memory.geometries` が増え続けないこと |
| P-8 | 自動保存の debounce | `autosave.ts` | 連続入力中に保存が 1 回にまとまる |
| P-9 | プレビューは CSG を使わない | `OperationPreview.tsx` | 入力中のフレーム時間が 16ms 以内 |
| P-10 | Outliner の仮想スクロールは Ver.1 不要 | — | 50 件程度なら不要。100 件超で検討 |

### 17.2 `GeometryCache` の仕様

```ts
// src/geometry/GeometryCache.ts
interface CacheEntry {
  hash: string;
  geometry: BufferGeometry;
  edges: BufferGeometry | null;   // 遅延生成
  buildToken: number;             // 競合検出用
}

class GeometryCache {
  private map = new Map<PartId, CacheEntry>();
  private tokens = new Map<PartId, number>();
  private listeners = new Set<(partId: PartId) => void>();

  /** キャッシュがあれば同期返却。なければ null を返しつつ非同期構築を開始する */
  get(part: Part): BufferGeometry | null;

  /** 非同期構築。同じ partId への構築要求が来たら古い方の結果を捨てる */
  private requestBuild(part: Part): void;

  /** 部材削除時。geometry / edges を dispose */
  release(partId: PartId): void;

  /** project.parts と突き合わせて、存在しない partId のエントリを解放 */
  syncWith(parts: Part[]): void;

  subscribe(fn: (partId: PartId) => void): () => void;
  clear(): void;
}
```

**競合対策（MUST）**: 同じ部材に対して構築が走っている最中に再度パラメータが変わった場合、古い構築結果を採用してはならない。`buildToken` を発行し、完了時にトークンが最新でなければ結果を `dispose()` して捨てる。

### 17.3 形状ハッシュ

```ts
// src/core/part/partHash.ts
/**
 * 形状に影響する値だけを安定した順序で文字列化し、FNV-1a でハッシュする。
 * transform / name / visible / locked は含めない（形状に影響しないため）。
 */
export function hashPartShape(part: Part): string {
  const shape = {
    s: [part.size.x, part.size.y, part.size.z],
    o: part.operations
        .filter(op => op.enabled)
        .map(op => normalizeOperationForHash(op)),  // キー順を固定して配列化
  };
  return fnv1a(JSON.stringify(shape));
}
```

`JSON.stringify` はオブジェクトのキー順に依存するため、`normalizeOperationForHash` で **明示的に配列へ変換**してキー順の揺れを排除すること。

---

## 18. エラー処理

### 18.1 エラーの分類

| 分類 | 例 | 扱い |
|------|-----|------|
| 入力エラー | 穴径が 0 | フィールドを赤くし、実行ボタンを無効化。Toast は出さない |
| 入力警告 | 穴が端に近すぎる | 黄色の警告表示。実行は許可 |
| 演算エラー | CSG 失敗、形状消滅 | その加工をスキップし、加工リストにエラーバッジ。Toast で 1 回通知 |
| I/O エラー | JSON 破損、容量超過 | Toast（エラー）+ 詳細をダイアログに表示。アプリは動作継続 |
| 想定外例外 | React レンダリング中の例外 | `ErrorBoundary` で捕捉。「編集内容は保持されています」+ 再読込ボタン |

### 18.2 エラー型

```ts
// src/core/result.ts
export type AppErrorCode =
  | 'INVALID_INPUT' | 'PART_NOT_FOUND' | 'PART_LOCKED'
  | 'CSG_FAILED' | 'GEOMETRY_EMPTY'
  | 'PARSE_FAILED' | 'SCHEMA_INVALID' | 'UNSUPPORTED_VERSION' | 'MIGRATION_MISSING'
  | 'STORAGE_QUOTA' | 'STORAGE_UNAVAILABLE';

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,                          // * ユーザーに見せる日本語
    readonly detail?: unknown,                // * console 用の技術情報
  ) { super(message); this.name = 'AppError'; }
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError };
```

**規約**: `AppError.message` は必ず **ユーザーがそのまま読める日本語**にする。技術的な詳細は `detail` に入れ、`console.error` にだけ出す。

### 18.3 CSG 失敗時の挙動（重要）

```
加工を実行 → CSG 失敗
  ├─ 形状は「その加工をスキップした状態」で表示される
  ├─ 加工リストの該当行に警告アイコン（Lucide `AlertTriangle`）と理由を表示
  ├─ Toast「加工を適用できませんでした: <理由>」
  ├─ Operation 自体はデータに残る（削除しない）
  │    → パラメータを直して再実行できる
  └─ アプリはクラッシュせず、他の操作を継続できる
```

**絶対にやってはいけないこと**: 失敗したら部材ごと消す / 加工履歴を巻き戻す / アプリを停止する。

### 18.4 ErrorBoundary の配置

```
<ErrorBoundary scope="app">        ← 最後の砦
  <AppShell>
    <TopBar />
    <LeftPanel />
    <ErrorBoundary scope="viewport" fallback={<ViewportErrorFallback/>}>
      <Viewport />                 ← WebGL の失敗で UI 全体を落とさない
    </ErrorBoundary>
    <RightPanel />
  </AppShell>
</ErrorBoundary>
```

`ViewportErrorFallback` は「3D 表示でエラーが発生しました」+ 再初期化ボタンを出す。左右のパネル（＝設計データ）は生きているので、ユーザーは保存できる。

### 18.5 WebGL 非対応

起動時に WebGL2 コンテキストを取得できるか確認し、不可なら 3D ビューポートの代わりに案内を表示する。パネルとデータ編集は動くようにする（保存はできる）。

### 18.6 ログ

```ts
// 開発時のみ詳細出力。本番は warn / error のみ
console.debug('[geometry] build', { partId, hash, durationMs });
console.warn('[snap] faces are parallel but not opposed', { source, target });
console.error('[csg] evaluate failed', { partId, operationId }, error);
```

接頭辞は `[geometry]` `[csg]` `[store]` `[io]` `[snap]` `[viewport]` に統一する。

---

## 19. Codex が実装する順番

詳細（実装内容・完了条件・テスト項目）は **[PHASES_V1.md](./PHASES_V1.md)** を参照。ここでは全体像だけ示す。

| Phase | 内容 | 主な成果物 | 依存 |
|-------|------|-----------|------|
| 0 | プロジェクト初期化・骨組み | Vite/TS/React/Tailwind、`core/types.ts`、空の 3 カラム UI | — |
| 1 | Three.js ビューポート | `Viewport` / `SceneRoot` / `CameraRig` / `GridFloor` / `Lighting` | 0 |
| 2 | 木材生成 | `core/part/*`, `geometry/boxGeometry`, `GeometryCache`（CSG なし）, `CreatePanel`, `PartsLayer` | 1 |
| 3 | 選択とプロパティ表示 | ピッキング, `PartOutliner`, `PropertyPanel`, `SelectionOutline` | 2 |
| 4 | 移動・回転・複製・削除 | `transformCommands`, `TransformGizmo`, `ArrangePanel`, `NumberField` | 3 |
| 5 | スナップ | `gridSnap`, `snapAngle`, `faceSnap`, `align`, `FaceSnapWizard`, `FacePickOverlay` | 4 |
| 6 | 加工プレビュー（CSG なし） | `toolSolid`, `operationValidate`, `MachinePanel`, `OperationForm`, `OperationPreview` | 4 |
| 7 | CSG 加工 | `CsgEngine`, `BvhCsgEngine`, `geometryBuilder`, `operationCommands`, 加工リスト編集 | 6 |
| 8 | Undo / Redo | `history.ts` への全面移行, Transient, TopBar ボタン, ショートカット | 7 |
| 9 | 保存 / 読み込み | `projectSchema`, `serialize`, `migrate`, `ProjectRepository`, `autosave`, `FileMenu` | 8 |
| 10 | UI 仕上げ・エラー処理・性能検証 | `HintBar`, `StatusBar`, `Toast`, `ErrorBoundary`, 空状態、性能測定 | 9 |

### 19.1 実装の順序に関する厳守事項

1. **Phase 0 で `src/core/types.ts` を §8 のとおり完成させる。** 型が後から揺れると全レイヤーが壊れる。
2. **Phase 2 の時点で `GeometryCache` を導入する。** CSG がまだなくても（＝ボックス生成だけでも）キャッシュ機構を通しておく。後から挟むのは高コスト。
3. **Phase 4 までは「1 コマンド = 1 setState」でよいが、Phase 8 で `applyCommand` に全面移行する。** Phase 4 の時点でコマンドを `store/commands/` に分離しておけば、Phase 8 の変更は各コマンドの中身だけで済む。
4. **Phase 6（プレビュー）を Phase 7（CSG）より先にやる。** プレビューが正しければ CSG の結果も正しいことが目視で確認でき、デバッグが劇的に楽になる。
5. **各 Phase の完了時に `npm run typecheck && npm run lint && npm run test && npm run build` を通す。** 通らない状態で次の Phase に進まない。

---

## 20. Ver.1 完成条件

### 20.1 受け入れシナリオ（これが通れば Ver.1 完成）

以下を **マニュアルなし・キーボードショートカットを使わずに** 完遂できること。

```
S-1  アプリを開く
S-2  幅600 × 高さ300 × 厚み18 の合板を生成する
S-3  複製して 2 枚にする
S-4  2 枚目を Y 軸まわりに 90° 回転する
S-5  グリッドスナップを 10mm にして、数値入力で位置を調整する
S-6  面スナップで 1 枚目の右面と 2 枚目の左面を接触させる（隙間 0）
S-7  3 枚目を生成し、整列で 3 枚の下端（Y/min）を揃える
S-8  1 枚目に φ8 の貫通丸穴を、端から X=100 / Y=50 の位置に開ける
S-9  同じ穴を X=500 にもう 1 つ開ける
S-10 1 枚目を X=450 で切断し、左側を残す
S-11 最初の穴のパラメータを開き、φ8 → φ6 に変更して更新する
S-12 Undo を 5 回押して S-7 の状態まで戻る
S-13 Redo を 5 回押して S-11 の状態まで進む
S-14 「保存」でファイルに書き出す
S-15 ブラウザをリロードし、書き出したファイルを読み込む
S-16 全ての部材の形状・位置・回転・加工が S-11 と完全に一致している
```

### 20.2 品質ゲート

| 項目 | 基準 |
|------|------|
| 型チェック | `npm run typecheck` がエラー 0 |
| Lint | `npm run lint` がエラー 0（warning は 0 が望ましい） |
| テスト | `npm run test` が全パス。`src/core/**` の行カバレッジ 80% 以上 |
| ビルド | `npm run build` が成功し、初期バンドル（gzip）が 1.5MB 以内 |
| コンソール | 通常操作でエラー・警告が 0 件 |
| メモリ | 「加工の追加 → Undo」を 50 回繰り返しても `renderer.info.memory.geometries` が単調増加しない |
| 性能 | 部材 50 枚で視点操作が 60fps。1 部材の CSG（加工 10 件）が 300ms 以内 |
| 静止時 | 操作していないとき `requestAnimationFrame` による描画が発生しない |

### 20.3 Ver.1 で必ず存在すべきテスト（`src/core/**`）

| 対象 | テスト内容 |
|------|-----------|
| `gridSnap` | 端数・負値・step=0（無効）・ちょうど中間値 |
| `angle` | 正規化（370°→10°、-10°→350°）、90° スナップ |
| `localFrame` | `cornerToLocal → localToCorner` の往復で元の値に戻る |
| `partHash` | transform を変えてもハッシュ不変 / size・operation を変えると変化 / operation のキー順が違っても同値 |
| `toolSolid` | 各加工種類について、貫通時に部材をはみ出す寸法になっている。`direction` 6 方向すべて |
| `operationValidate` | §13.3 の全ルール |
| `faceSnap` | §12.4 の必須ケース全て |
| `align` | min/center/max × X/Y/Z、回転した部材を含む場合 |
| `serialize` | `Project → Document → Project` の往復で完全一致 |
| `migrate` | 未知の新バージョンで `UNSUPPORTED_VERSION` を投げる |
| `history` | 各コマンドの Undo で元の状態に完全復帰する（Property-based に近い形で全コマンドを網羅） |

### 20.4 Ver.1 として「未完成でも許容する」もの

- 木目テクスチャ、影の品質、マテリアルの質感
- アニメーション（カメラ移動は瞬時でよい）
- 多言語対応（日本語のみでよい）
- モバイル・タブレット対応
- Undo 履歴の UI 一覧表示（ボタンと直前ラベルで十分）
- 3D 上でのドラッグによる面吸着（ウィザードで代替）

---

## 付録 A. 主要定数

```ts
// src/core/constants.ts
export const SCENE_SCALE = 1;          // 1 Three.js unit = 1 mm

export const EPS = 1e-6;
export const OVERCUT = 0.5;            // CSG コプラナー回避のはみ出し量 (mm)

export const MIN_SIZE_MM = 0.1;
export const MAX_SIZE_MM = 5000;
export const MIN_DIAMETER_MM = 0.5;

export const HISTORY_LIMIT = 100;
export const AUTOSAVE_DEBOUNCE_MS = 1000;

export const DEFAULT_SNAP: SnapSettings = { grid: 10, angle: 90 };

export const DEFAULT_PART_SIZE: Size3 = { x: 600, y: 300, z: 18 };

export const MATERIAL_PRESETS = [
  { label: '合板 t12',  size: { x: 600, y: 300, z: 12 }, material: 'plywood' },
  { label: '合板 t15',  size: { x: 600, y: 300, z: 15 }, material: 'plywood' },
  { label: '合板 t18',  size: { x: 600, y: 300, z: 18 }, material: 'plywood' },
  { label: '合板 t21',  size: { x: 600, y: 300, z: 21 }, material: 'plywood' },
  { label: 'SPF 1x4',   size: { x: 1820, y: 89, z: 19 }, material: 'pine' },
  { label: 'SPF 2x4',   size: { x: 1820, y: 89, z: 38 }, material: 'pine' },
  { label: '集成材 t25', size: { x: 900, y: 300, z: 25 }, material: 'pine' },
] as const;

export const CYLINDER_SEGMENTS = 24;   // 丸穴の分割数
```

## 付録 B. `AxisDirection` ヘルパー

```ts
// src/core/math/axis.ts
export function axisOf(dir: AxisDirection): AxisKey {
  return dir[1] as AxisKey;
}
export function signOf(dir: AxisDirection): 1 | -1 {
  return dir[0] === '+' ? 1 : -1;
}
export function axisIndex(axis: AxisKey): 0 | 1 | 2 {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
}
export function otherAxes(axis: AxisKey): [AxisKey, AxisKey] {
  return axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
}
export function dirToVec3(dir: AxisDirection): Vec3 {
  const v: [number, number, number] = [0, 0, 0];
  v[axisIndex(axisOf(dir))] = signOf(dir);
  return v;
}
export const ALL_DIRECTIONS: AxisDirection[] = ['+x', '-x', '+y', '-y', '+z', '-z'];

export const DIRECTION_LABELS: Record<AxisDirection, string> = {
  '+x': '右面 (X+)', '-x': '左面 (X−)',
  '+y': '上面 (Y+)', '-y': '下面 (Y−)',
  '+z': '手前面 (Z+)', '-z': '奥面 (Z−)',
};
```

## 付録 C. 用語

| 用語 | 定義 |
|------|------|
| 部材 (Part) | 1 枚の木材。元寸法と加工履歴を持つ |
| 加工 (Operation) | 部材から立体を減算する 1 操作 |
| ツール立体 (Tool Solid) | 加工によって減算される立体。プレビューと CSG で共有 |
| 形状ハッシュ | `size` + 有効な `operations` から算出する文字列。キャッシュキー |
| ローカル座標 | 部材の中心を原点とする座標系（mm） |
| コーナー原点 | 部材の X−/Y−/Z− 側の角を原点とする UI 表示用の座標系 |
| Transient | ドラッグ中の一時状態。確定時に 1 履歴エントリへまとめる |
