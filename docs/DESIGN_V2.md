# Let's DIY — Ver.2 設計書

- ステータス: 確定（Ver.1 公開後、そのまま着手可）
- 対象バージョン: Ver.2
- 最終更新: 2026-09-23
- 前提: [DESIGN_V1.md](./DESIGN_V1.md)（Ver.1 設計書）
- 手順: [PHASES_V2.md](./PHASES_V2.md)（Phase M0〜M12）

---

## 0. このドキュメントの読み方

Ver.1 設計書の続編であり、**Ver.1 を前提に差分を書く**。Ver.1 で決めたことは繰り返さない。

- **§1–§2** が「何を作るか」と「Ver.1 の何が壊れるか」。**§2 は必ず最初に読む。**
- **§3–§6** が UI とデータ構造
- **§7–§14** が各サブシステムの設計
- **§15–§21** が構成・非機能・移行・完成条件

Ver.1 と同じく、`MUST` / `SHOULD` / `MAY` は RFC 2119 の意味で使う。
実装中に本書と矛盾する事情が見つかったら、独断で設計を変えず**該当箇所を引用して報告**すること。

> **この 1 冊が Ver.2 の正。** 先行して書いた `DESIGN_V2_MOTION.md` / `PHASES_V2_MOTION.md` は
> 本書に統合したため削除した。

---

## 1. Ver.2 の要件定義

### 1.1 プロダクトゴール

Ver.1 は「**板を 1 枚ずつ作って、並べて、削る**」ところまでを作った。
Ver.2 の目的は 1 段上がる。

> **動く家具を設計し、作れる情報を出力する。**

「作れる情報」とは、ホームセンターと作業台に持っていける次の 3 つを指す。

1. 何をいくつ買うか（部品表 — 木材と金物）
2. どう切り分けるか（木取り図）
3. どこに穴をあけるか（部材ごとの加工図）

成功条件は「**扉が付いた小さなキャビネットを設計し、開閉させて干渉がないことを確認し、
買い物リストと木取り図と加工図を印刷して、実際に作れる**」こと。

### 1.2 Ver.1 で到達した地点（Ver.2 の出発点）

| 領域 | 状態 |
|------|------|
| 部材 | 直方体の生成・配置・複製・削除。グリッド / 角度 / 面スナップ / 整列 |
| 加工 | 丸穴・角穴・アーチ・角丸・切り欠き・切断の 6 種類。非破壊（元寸法 + 加工履歴） |
| 形状 | `CsgEngine` 越しの CSG。形状ハッシュによるキャッシュ。移動では再計算しない |
| 履歴 | immer patches による Undo / Redo。ドラッグは Transient で 1 エントリ |
| 保存 | zod 検証 + migrate（schemaVersion 3）。localStorage 自動保存 + JSON 入出力 |
| 集計 | 部品表（木材）+ CSV 書き出し |
| 検査 | 静止状態の干渉判定（OBB 分離軸） |
| 品質 | テスト 328 件。typecheck / lint / build がゼロエラー |

**Ver.2 はこの上に足す。Ver.1 の資産で最も価値があるのは次の 3 つで、いずれも壊さない。**

- `core/` が three にも React にも依存しない（テストが速く、壊れにくい）
- 形状ハッシュと `GeometryCache`（何が再計算を引き起こすかが明確）
- immer patches の履歴（新しいコマンドを足すだけで Undo が効く）

### 1.3 機能要件

#### 可動（Ver.2 の中心）

| ID | 要件 | 優先度 |
|----|------|--------|
| M-01 | 部材どうしを「固定」で結合でき、親を動かすと子が付いてくる | MUST |
| M-02 | ヒンジ（回転）で 2 部材を結合し、角度で開閉できる | MUST |
| M-03 | スライドレール（直進）で 2 部材を結合し、引き出し量で動かせる | MUST |
| M-04 | 可動範囲（最小・最大）を数値で決められる | MUST |
| M-05 | スライダーで動かすと 3D が即座に追従する | MUST |
| M-06 | 可動範囲の全域を走査し、干渉する区間を一覧できる | MUST |
| M-07 | ガススプリングの取付位置から、開く角度と必要な力の目安を出せる | SHOULD |

#### 金物

| ID | 要件 | 優先度 |
|----|------|--------|
| H-01 | 金物（スライド丁番 / 平丁番 / スライドレール / ガススプリング）をプリセットから配置できる | MUST |
| H-02 | 金物が可動の関係（joint）を自動で作る | MUST |
| H-03 | 金物に必要な穴（カップ穴・ネジ穴）を対象部材の加工として自動生成できる | SHOULD |
| H-04 | 金物が部品表に載る（品名・型番・数量） | MUST |

#### 出力

| ID | 要件 | 優先度 |
|----|------|--------|
| O-01 | 木取り図（定尺板への板取り）を作り、SVG で出力できる | MUST |
| O-02 | 部材ごとの加工図（外形 + 加工位置の寸法）を SVG で出力できる | MUST |
| O-03 | 部品表 CSV に金物を含められる | MUST |
| O-04 | 選択部材またはアセンブリ全体を STL で出力できる | SHOULD |

#### 設計の実用性

| ID | 要件 | 優先度 |
|----|------|--------|
| D-01 | 留め加工（45 度などの傾いた切断）ができる | SHOULD |
| D-02 | ドラッグ中にエッジ・頂点へ吸着できる | MAY |

### 1.4 非機能要件

| ID | 要件 |
|----|------|
| N2-01 | joint を動かしても CSG は一切走らない（形状ハッシュに joint を含めない） |
| N2-02 | 部材 50 枚・joint 10 本で、スライダー操作が 60fps を維持する |
| N2-03 | 可動範囲の干渉走査（36 分割・部材 50 枚）が 1 秒以内に終わる |
| N2-04 | Ver.1 で保存したファイル（schemaVersion 1〜3）がすべて読める |
| N2-05 | Ver.1 のテスト 328 件が通り続ける |
| N2-06 | 木取り図・加工図の出力はブラウザ内で完結する（サーバー不要） |

### 1.5 非スコープ（Ver.3 以降）

- 物理演算（慣性・摩擦・重力による自然な動き）
- 閉ループ機構（4 節リンクの厳密解を超えるもの）
- 構造解析・強度計算・たわみ計算
- 市販金物のカタログ連携・在庫検索・価格取得
- AI による設計支援 / AI による 3D プリント部品生成
- クラウド保存・ユーザーアカウント・共同編集
- 曲面・自由形状の素材（素材は直方体のまま）
- 木目・テクスチャのレンダリング

> **ガススプリングの「必要な力」は目安であって強度計算ではない。** 画面にもそう書く。

### 1.6 意図的な割り切り

| 項目 | Ver.2 の決定 | 理由 |
|------|-------------|------|
| joint の自由度 | 1 自由度のみ（固定 / 回転 / 直進） | 家具の可動部はほぼこれで足りる。多自由度は Ver.3 |
| joint の構造 | 木構造。閉ループ禁止 | 解が一意に決まり、前進計算だけで済む |
| 1 部材の被駆動 | 1 つの joint まで | 多重駆動を許すと解が決まらない |
| スライド丁番の軌跡 | 単純な回転で近似 | 実物は 4 節リンクだが、干渉判定の精度としては回転近似で足りる。§7.4 に注記 |
| 干渉判定の精度 | 外形（OBB）のみ。穴の内側は見ない | Ver.1 の判断を踏襲。メッシュ交差はコストが桁違い |
| 木取り図の最適化 | 棚積み法（FFDH）。最適解は求めない | DIY 用途では数 % の歩留まり差より速さと分かりやすさ |
| 加工図 | 部材ごとの正面図 + 寸法のみ。三面図は作らない | 作業台で必要なのは「どこに穴をあけるか」 |
| 留め加工 | 1 軸まわりの傾きのみ | 45 度留めが作れれば実用上足りる。複合角は Ver.3 |

---

## 2. Ver.1 から壊れる前提（最重要）

### 2.1 transform が「入力」から「出力」に変わる部材が生まれる

Ver.1 の一番深い前提はこれだった。

> `Part.transform` が部材の位置の唯一の真実である。

可動部品を入れると、扉の姿勢は **ヒンジの角度から計算される派生値** になる。
つまり transform が入力ではなく出力になる部材が生まれる。

**Ver.2 での定義:**

> `Part.transform` は **rest pose**（すべての joint の値が 0 のときの姿勢）である。
> 画面に出る姿勢は `solvePoses()` が rest pose と joint の値から毎回計算する。

保存されるのは rest pose と joint の値だけ。
これで Ver.1 の原則「**設計データから形状と配置を完全に再構築できる**」が保たれる。

### 2.2 影響範囲（実装前に全部確認すること）

| 箇所 | 変更 | 危険度 |
|------|------|--------|
| `Part.transform` の意味 | 「現在の姿勢」から「rest pose」へ。**コメントを必ず書き換える** | 高 |
| `PartMesh` | `poses.get(id) ?? part.transform` を使う | 高 |
| `TransformGizmo` | joint の値が 0 でない部材には出さない（§7.5） | 高 |
| `partCommands.removeParts` | 関係する joint と金物も 1 Undo ステップで消す | 高 |
| `findInterferences` | 「pose 適用済みの部材」を受け取れるようにする | 中 |
| `serialize` / `projectSchema` / `migrate` | `joints` / `hardware` / `gasSprings` を追加。schemaVersion 4 | 中 |
| `buildBom` | 金物の行を足す。木材側のロジックは変えない | 低 |
| `faceSnap` / `align` | rest pose に対して働く（現状のまま） | 低 |
| **`hashPartShape`** | **変更しない** | — |
| **`GeometryCache`** | **変更しない** | — |

> **最後の 2 行が Ver.2 の健全性の目印。**
> joint を動かして `[geometry] build` のログが出たら、どこかで設計から外れている。

---

## 3. ユーザー操作フロー

### 3.1 メインフロー（扉付きキャビネット）

```
Ver.1 の流れで箱を組む（生成 → 配置 → 加工）
     │
     ▼
[金物] タブ
  └─ スライド丁番を選ぶ
       └─ 固定側の部材をクリック（側板）
            └─ 動く側の部材をクリック（扉）
                 └─ 取付位置を決める（ドラッグ / 微調整 / 座標入力の 3 つ。Ver.1 と同じ）
                      └─ [取り付ける]
                           ・ヒンジ joint が自動で作られる
                           ・扉にカップ穴、側板にネジ穴が自動で入る
     │
     ▼
[可動] セクション（右パネル）
  ├─ スライダーで開閉 → 3D が追従
  ├─ 可動範囲を数値で設定（0 〜 110 度）
  └─ [全範囲をチェック]
       └─ 「0〜92 度は動きます / 93〜110 度で 扉 と 側板 が最大 6.2mm ぶつかります」
     │
     ▼
[出力] メニュー
  ├─ 部品表（木材 + 金物）→ CSV
  ├─ 木取り図 → SVG（定尺板を選ぶ）
  ├─ 加工図 → SVG（部材ごと）
  └─ STL（選択部材 / 全体）
```

### 3.2 金物を使わずに可動だけ試す

金物の在庫や型番が決まっていない段階でも、可動だけ先に確認できる。

```
[可動] タブ → [ヒンジを追加] → 固定側 → 動く側 → 軸の位置を決める → [作成]
```

joint は金物と独立して存在できる。**金物は「その joint を実現する実物」**であって、
joint の前提条件ではない。この分離が Ver.2 のデータモデルの要（§5.1）。

### 3.3 キーボードショートカット（Ver.1 に追加）

| キー | 動作 |
|------|------|
| `4` | 金物モード |
| `5` | 可動モード |
| `O` | 選択中の joint を開く / 閉じる（トグル） |
| `Ctrl+Shift+B` | 部品表 |

Ver.1 の原則どおり、**すべて画面上のボタンと 1:1 対応させる**。

---

## 4. 画面構成（Ver.1 からの差分）

### 4.1 モードタブ（左パネル）

```
[生成] [配置] [加工] [金物] [可動]
```

Ver.1 の 3 つに 2 つ足して 5 つ。タブが増えすぎるとモードが分かりにくくなるので、
**Ver.2 ではここで打ち止めにする**。出力系はタブではなくトップバーのメニューに置く。

### 4.2 トップバー

```
[新規][読込][保存][保存一覧][書出] │ [部品表][干渉][出力 v] │ [元に戻す][やり直す] │ ...
```

`[出力 v]` を押すとメニューが開く。

```
出力
  部品表 (CSV)
  木取り図 (SVG)
  加工図 (SVG)
  STL（選択部材）
  STL（全体）
```

Ver.1 の `[部品表]` `[干渉]` は単独ボタンのまま残す（よく使うため）。

### 4.3 金物モード（左パネル）

```
MOUNTING
金物を取り付ける

種類
  [ スライド丁番 ] [ 平丁番 ]
  [ 側面レール   ] [ 底付レール ]
  [ ガススプリング ]

プリセット  [ スライド丁番 カップ径35 標準 v ]
  カップ径 35mm / 深さ 11.5mm / 取付穴ピッチ 45mm

(1) 固定側の部材をクリック     側板 左 [選択済み]
(2) 動く側の部材をクリック     扉     [選択済み]

数量  [ 2 ] 個        （扉 1 枚あたり）

取付位置（固定側のローカル座標）
  微調整のきざみ (mm)  [0.5] [1] [*5] [10]
  Y [-] [+]   Z [-] [+]
  Y [ 80 ] mm   Z [ 0 ] mm

[x] 必要な穴を自動であける

          [ 取り付ける ]
```

Ver.1 で作った「ドラッグ / 微調整ボタン / 座標入力」の 3 点セット（§13.4.1）を
そのまま金物の位置決めにも使う。**新しい操作方法を増やさない。**

### 4.4 可動モード（左パネル）と可動セクション（右パネル）

左パネルは joint の一覧と追加。右パネルは選択中の joint の操作。

```
右パネル
> 可動
  ヒンジ: 扉ヒンジ 左
  角度  [=======|=======]  35 °     [閉じる] [開く]
  範囲  最小 [ 0 ] °   最大 [ 110 ] °

  [ 全範囲をチェック ]
    0 〜 92 度は動きます
    93 〜 110 度で「扉 / 側板 左」が最大 6.2mm ぶつかります   [該当を表示]
```

スライダーの目盛りのうち、干渉する区間を警告色で塗る。
**「どこまで開くか」が一目で分かることが、この画面の唯一の目的。**

### 4.5 UI デザイン規則

**Ver.1 §3.8 をそのまま継承する。**

- 絵文字・幾何記号を画面に出さない（アイコンは `lucide-react` のみ）
- 色付き `border-left` のアクセントカードを作らない
- `box-shadow` を使わない。境界は 1px ボーダー

Ver.2 で追加するアイコン:

| 用途 | Lucide |
|------|--------|
| 金物 | `Wrench` |
| 可動 / joint | `RotateCw`（回転） / `MoveHorizontal`（直進） / `Link`（固定） |
| 開く / 閉じる | `DoorOpen` / `DoorClosed` |
| 木取り図 | `LayoutGrid` |
| 加工図 | `Ruler` |
| 出力メニュー | `Share2` |
| ガススプリング | `Activity` |

規則違反は Ver.1 と同じく `npm run lint`（禁止文字）と `npm run test`（CSS）で落ちる。

---

## 5. データモデル

### 5.1 概念モデル

```
Project
 ├─ parts:      Part[]            木材（Ver.1 のまま）
 ├─ joints:     Joint[]           可動・結合の関係（新規）
 ├─ hardware:   Hardware[]        金物の実体（新規）
 └─ gasSprings: GasSpringMount[]  ガススプリングの取付（新規）
```

**joint と hardware を分けるのが設計の核心。**

- `Joint` は「どの部材が、どの部材に対して、どう動くか」だけを持つ。**幾何の問題。**
- `Hardware` は「その joint を実現する実物」。**買い物と穴あけの問題。**

分けておくと、

- 金物が決まっていなくても可動を試せる（§3.2）
- 同じ joint に対して金物の型番だけ差し替えられる
- 1 つの joint を複数個の金物で実現できる（扉 1 枚にヒンジ 2 個）
- 金物を消しても可動の設計は残る

逆に一体にすると、「丁番の型番を変えたら扉の開き方が変わってしまった」という
筋の悪い結合が生まれる。

### 5.2 joint の種類

| kind | 自由度 | 値の単位 | 用途 |
|------|--------|----------|------|
| `fixed` | 0 | — | 取っ手を扉に付ける / 天板を本体に固定する / 家具全体をまとめて動かす |
| `revolute` | 1 | 度 | ヒンジ（扉・フタ） |
| `prismatic` | 1 | mm | スライドレール（引き出し） |

> **`fixed` を入れることで「グループ機能」を別途作らなくて済む。**
> 家具全体をまとめて動かしたいときは、本体の部材を根として `fixed` で繋げばよい。
> 概念を 1 つ増やすより、既にある joint の自由度を 0 にする方が安い。

### 5.3 不変条件

| # | 不変条件 |
|---|----------|
| J-1 | `basePartId !== movingPartId` |
| J-2 | joint の親子関係は**閉路を作らない**（木構造。追加時に検査する） |
| J-3 | 1 つの部材が `movingPart` になれる joint は**最大 1 つ**（多重駆動の禁止） |
| J-4 | `range.min <= value <= range.max`（`fixed` は値を持たない） |
| J-5 | joint を消す / 無効にすると、その `movingPart` は rest pose に戻る |
| J-6 | `Part.transform` は rest pose（全 joint の値が 0 のときの姿勢） |
| J-7 | `Hardware.jointId` は実在する joint を指すか `null` |
| J-8 | 金物が自動生成した `Operation` は `note` に `hardwareId` を持ち、金物と同時に消える |

### 5.4 保存 JSON の実例（抜粋）

```json
{
  "app": "lets-diy",
  "schemaVersion": 4,
  "savedAt": "2026-09-23T10:00:00.000Z",
  "project": {
    "id": "prj-8f2a1c40",
    "name": "扉付きキャビネット",
    "unit": "mm",
    "parts": [
      { "id": "part-side", "name": "側板 左", "size": { "x": 300, "y": 600, "z": 18 }, "...": "..." },
      { "id": "part-door", "name": "扉", "size": { "x": 400, "y": 600, "z": 18 },
        "transform": { "position": [209, 300, 150], "rotation": [0, 0, 0] },
        "operations": [
          { "id": "op-cup", "type": "roundHole", "enabled": true,
            "diameter": 35, "depth": 11.5, "through": false,
            "position": [-180, 220, 0], "direction": "-z",
            "note": "hw-3c1a90ff" }
        ], "...": "..." }
    ],
    "joints": [
      { "id": "jnt-door", "kind": "revolute", "name": "扉ヒンジ", "enabled": true,
        "basePartId": "part-side", "movingPartId": "part-door",
        "origin": [9, 220, 150], "axis": [0, 1, 0],
        "value": 0, "range": { "min": 0, "max": 110 } }
    ],
    "hardware": [
      { "id": "hw-3c1a90ff", "jointId": "jnt-door", "quantity": 2,
        "spec": { "presetId": "hinge.concealed.35", "label": "スライド丁番 カップ径35",
                  "kind": "hinge", "partNumber": "SH-35" },
        "position": [9, 220, 150], "rotation": [0, 0, 0] }
    ],
    "gasSprings": []
  }
}
```

**メッシュ・頂点は一切保存しない。Ver.1 の原則をそのまま守る。**

---

## 6. TypeScript 型定義

> `src/core/types.ts` に追加する。Ver.1 の型は変更しない（`Part.transform` のコメントを除く）。

```ts
// ============================================================
// Ver.2 追加分
// ============================================================

export type JointId = string;    // "jnt-xxxxxxxx"
export type HardwareId = string; // "hw-xxxxxxxx"

// ------------------------------------------------------------
// 可動・結合の関係
// ------------------------------------------------------------
export type JointKind = 'fixed' | 'revolute' | 'prismatic';

interface JointBase {
  id: JointId;
  name: string;
  enabled: boolean;
  /** 固定側の部材 */
  basePartId: PartId;
  /** 動く側の部材。この部材の姿勢は joint から計算される */
  movingPartId: PartId;
}

/** 固定。自由度 0。親に貼り付けるだけ。 */
export interface FixedJoint extends JointBase {
  kind: 'fixed';
}

/** ヒンジ。base のローカル座標で定義した軸まわりに回る。 */
export interface RevoluteJoint extends JointBase {
  kind: 'revolute';
  /** 回転軸が通る点（base ローカル mm） */
  origin: Vec3;
  /** 回転軸の向き（base ローカル。正規化して使う） */
  axis: Vec3;
  /** 現在の角度（度） */
  value: Degree;
  range: { min: Degree; max: Degree };
}

/** スライドレール。base のローカル座標で定義した方向へ直進する。 */
export interface PrismaticJoint extends JointBase {
  kind: 'prismatic';
  /** 移動方向（base ローカル。正規化して使う） */
  axis: Vec3;
  /** 現在の移動量 mm */
  value: Millimeter;
  range: { min: Millimeter; max: Millimeter };
}

export type Joint = FixedJoint | RevoluteJoint | PrismaticJoint;

/** 値を持つ joint（fixed 以外）。UI の分岐で使う */
export type MovableJoint = RevoluteJoint | PrismaticJoint;

export const isMovableJoint = (joint: Joint): joint is MovableJoint => joint.kind !== 'fixed';

// ------------------------------------------------------------
// 金物
// ------------------------------------------------------------
export type HardwareKind = 'hinge' | 'slideRail' | 'gasSpring';

/** 内蔵プリセット 1 件ぶんの仕様。データとして持ち、コードで分岐しない */
export interface HardwarePreset {
  presetId: string;
  label: string;
  kind: HardwareKind;
  partNumber?: string;
  /** この金物が作る joint の種類 */
  jointKind: JointKind;
  /** 既定の可動範囲 */
  defaultRange?: { min: number; max: number };
  /** 必要な穴の定義。金物ローカル座標 mm */
  holes: HardwareHole[];
}

/** 金物が要求する穴。target で「どちらの部材にあける穴か」を決める */
export interface HardwareHole {
  target: 'base' | 'moving';
  shape: 'round' | 'rect';
  /** round: 直径 / rect: 幅 */
  width: Millimeter;
  /** rect のみ */
  height?: Millimeter;
  depth: Millimeter;
  through: boolean;
  /** 金物の取付点からのオフセット（金物ローカル mm） */
  offset: Vec3;
}

export interface Hardware {
  id: HardwareId;
  preset: HardwarePreset;
  /** この金物が実現している joint。未接続なら null */
  jointId: JointId | null;
  /** 取り付け位置（base 部材のローカル座標 mm） */
  position: Vec3;
  /** 取り付け姿勢（度、base 部材ローカル） */
  rotation: Vec3;
  /** 数量。扉 1 枚にヒンジ 2 個など */
  quantity: number;
  note?: string;
}

// ------------------------------------------------------------
// ガススプリング
// ------------------------------------------------------------
/**
 * ガススプリングは自由度を持たない。revolute joint に付く補助部品として扱い、
 * 取付 2 点の距離が伸縮することで扉を支える。
 */
export interface GasSpringMount {
  id: string;
  hardwareId: HardwareId;
  /** 支える対象の joint（revolute のみ） */
  jointId: JointId;
  /** 固定側の取付点（base 部材ローカル mm） */
  baseAnchor: Vec3;
  /** 可動側の取付点（moving 部材ローカル mm） */
  movingAnchor: Vec3;
  /** 縮んだ長さ / 伸びた長さ mm */
  strokeMin: Millimeter;
  strokeMax: Millimeter;
  /** 呼び力 N */
  forceN: number;
}

// ------------------------------------------------------------
// Project の拡張
// ------------------------------------------------------------
export interface Project {
  id: ProjectId;
  name: string;
  unit: 'mm';
  parts: Part[];
  /** Ver.2 追加。Ver.1 のファイルを読んだときは空配列が入る */
  joints: Joint[];
  hardware: Hardware[];
  gasSprings: GasSpringMount[];
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 4 as const;
```

### 6.1 `CutOperation` の拡張（留め加工 / D-01）

```ts
export interface CutOperation extends OperationBase {
  type: 'cut';
  axis: AxisKey;
  offset: Millimeter;
  keep: 'negative' | 'positive';
  /**
   * Ver.2 追加。切断面を傾ける。
   * `tiltAbout` の軸まわりに `tiltDeg` 度だけ回した平面で切る。
   * 省略時は 0（Ver.1 と同じ軸平行の切断）。45 度留めはここで作る。
   */
  tiltAbout?: AxisKey;
  tiltDeg?: Degree;
}
```

**既存フィールドは一切変えない。** 省略可能なフィールドを足すだけなので、
Ver.1 のファイルはそのまま読め、`toolSolidSpec` も既定値 0 で従来どおり動く。

---

## 7. 運動学（Kinematics）

### 7.1 姿勢の計算

```
worldTransform(part) =
    joint が無い部材                -> part.transform（rest pose）
    joint の movingPart である部材  -> worldMatrix(basePart) * jointLocal(joint) * restOffset(joint)

restOffset(joint) = inverse(matrix(basePart.transform)) * matrix(movingPart.transform)
    値が 0 のとき元の位置に戻ることを保証する

jointLocal(fixed)     = 単位行列
jointLocal(revolute)  = T(origin) * R(normalize(axis), value) * T(-origin)
jointLocal(prismatic) = T(normalize(axis) * value)
```

`src/core/motion/kinematics.ts` に純粋関数として置く。**three に依存させない。**

```ts
export interface PoseResult {
  /** 部材 ID から、その部材のワールド Transform */
  poses: Map<PartId, Transform>;
  /** 閉路や多重駆動を見つけたら理由を入れる。例外は投げない */
  problems: string[];
}

export function solvePoses(project: Project): PoseResult;
```

**MUST: `solvePoses` を毎フレーム呼ばない。** joint の値か rest pose が変わったときだけ
計算し、結果を store に持つ。Ver.1 の「変更したものだけ再計算」と同じ方針。

### 7.2 計算の順序

joint を辺とする有向グラフを作り、根（どの joint の movingPart でもない部材）から
深さ優先でたどる。J-2（閉路禁止）と J-3（多重駆動禁止）が守られていれば、
各部材はちょうど 1 回だけ訪問される。

閉路や多重駆動を見つけたら `problems` に理由を入れ、**その joint を無視して計算を続ける**。
例外を投げて画面全体を落とすより、壊れた joint だけ効かない方が復旧しやすい。

### 7.3 表示への反映

`PartMesh` は `poses.get(part.id) ?? part.transform` を使う。
**ジオメトリは変わらない**ので `GeometryCache` は一切触らない。
形状ハッシュに joint は入らない（N2-01）。扉をいくら開閉しても CSG は走らない。

### 7.4 スライド丁番の近似（割り切りの明示）

実物のスライド丁番（隠し丁番）は 4 節リンクで、扉は回転しながら少し前へ出る。
**Ver.2 では単純な回転で近似する。**

- 干渉判定の用途では、実軌跡より回転近似の方がやや厳しめ（扉が側板寄りを通る）に出る。
  つまり「近似でぶつからない」なら実物でもぶつからない。安全側に倒れている。
- 厳密な軌跡が要るのは「かぶせ量ギリギリの設計」のときだけで、Ver.2 の想定利用では稀。

UI の金物パネルに「軌跡は回転で近似しています」と 1 行出す。Ver.3 で 4 節リンクを入れる。

### 7.5 配置モードとの整合（重要）

可動部材をギズモで動かすとどうなるか。答えは **rest pose を編集する**。

| 状況 | 挙動 |
|------|------|
| joint の値が 0（または `fixed`） | ギズモで普通に動かせる。結果が新しい rest pose |
| 値が 0 でない | **ギズモを出さない。**「閉じた状態に戻してから動かしてください」と案内し、［閉じる］ボタンを併置 |

値が 0 でないまま rest pose をいじれると、
「扉を 45 度開けた状態で 10mm 動かしたら、閉じたとき 10mm ずれていた」という
直感に反する挙動になる。**Ver.2 では禁止する。**

---

## 8. ガススプリング

自由度を持たない。取付 2 点の距離から、開き角ごとの状態を求める。

```
角度 a における取付点間距離:
  L(a) = |worldPoint(movingAnchor, pose(a)) - worldPoint(baseAnchor)|

判定:
  L(a) < strokeMin  -> 縮みきり。そこまで開かない
  L(a) > strokeMax  -> 伸びきり。そこまで開かない
  それ以外          -> 可動

必要な力の目安（静止つり合い、扉の自重のみ）:
  扉の質量 m = 体積 × 材質の密度
  ヒンジ軸から扉の重心までの水平距離 r(a)
  扉のモーメント   M(a) = m * 9.81 * r(a)
  ガススプリングの腕の長さ（軸から作用線までの距離） d(a)
  必要な力         F(a) = M(a) / d(a)
```

`src/core/motion/gasSpring.ts`:

```ts
export interface GasSpringCurvePoint {
  angleDeg: number;
  lengthMm: number;
  /** その角度で成立するか（ストローク範囲内か） */
  feasible: boolean;
  /** 自重を支えるのに必要な力 N */
  requiredN: number;
}

export function gasSpringCurve(
  mount: GasSpringMount, joint: RevoluteJoint, project: Project, steps?: number,
): GasSpringCurvePoint[];
```

**密度**は `MATERIAL_DENSITY`（kg/m3）として `core/constants.ts` に追加する。

```ts
export const MATERIAL_DENSITY: Record<MaterialKind, number> = {
  plywood: 600,
  pine: 450,
  lauan: 450,
  mdf: 750,
  generic: 550,
};
```

UI は角度に対する「取付点間距離」と「必要な力」の 2 本の折れ線を出し、
`forceN` が足りているかを色で示す。
**画面に「強度計算ではなく取付位置の当たりを付けるための目安」と明記する（MUST）。**

---

## 9. 動作シミュレーションと可動域干渉

### 9.1 走査

```ts
export interface MotionBlock {
  fromValue: number;
  toValue: number;
  pairs: InterferencePair[];
}

export interface MotionScanResult {
  jointId: JointId;
  /** 干渉した区間 */
  blocked: MotionBlock[];
  /** 実際に動かせる範囲。全域で干渉していれば null */
  usable: { min: number; max: number } | null;
}

export function scanJointMotion(
  project: Project, jointId: JointId, steps?: number,
): MotionScanResult;
```

`range.min` から `range.max` を `steps`（既定 36）分割し、各姿勢で
`solvePoses` → pose 適用済みの部材で `findInterferences` を回す。
**Ver.1 で作った OBB 判定をそのまま使えるので、新しい幾何計算は要らない。**

### 9.2 性能（N2-03）

部材 50 枚 × 36 ステップ = 1,225 ペア × 36 = 44,100 回の OBB 判定。
1 回あたり最大 15 軸なので概算 66 万回の内積。1 秒以内に収まる見込み。

それでも足りなければ、この順に手を打つ。

1. **動く部材とその子孫だけを可動側**とし、固定側は毎ステップ再計算しない
2. AABB で粗く弾いてから OBB に落とす
3. ステップ数を二分探索に変える（「ぶつかり始める角度」だけが欲しいので）

**最初から 3 を入れない。** 区間の一覧が欲しいので、まず素直に全走査する。

### 9.3 UI

- スライダーは **Transient 扱い**。ドラッグ中は履歴に積まず、離したときに 1 エントリ。
  Ver.1 の `beginTransient` / `commitTransient` をそのまま使う。
- 干渉した区間はスライダーの目盛りを警告色にする。
- 結果の行から［該当を表示］で、その角度へ移動し、該当部材を選択してカメラを寄せる。

---

## 10. 金物プリセットと自動加工

### 10.1 内蔵プリセット（Ver.2）

| presetId | 品名 | joint | 主な寸法 |
|----------|------|-------|----------|
| `hinge.concealed.35` | スライド丁番 カップ径35 | revolute | カップ穴 φ35 深さ 11.5 非貫通 / ネジ穴 φ3 ピッチ 45 |
| `hinge.butt.64` | 平丁番 64 | revolute | 64 x 30 / ネジ穴 φ3 x 4 |
| `slide.side.350` | 側面レール 350 | prismatic | 有効長 350 / ストローク 350 / ネジ穴 φ4 |
| `slide.undermount.400` | 底付レール 400 | prismatic | 有効長 400 / ストローク 400 |
| `gas.100n.250` | ガススプリング 100N | （なし） | 縮 250 / 伸 400 / 100N |

`src/core/hardware/presets.ts` に**データとして持つ**。
**コードで分岐しないこと（MUST）。** Ver.3 のカタログ連携で差し替えられるようにする。

### 10.2 自動加工（H-03）

```ts
export function hardwareOperations(
  hardware: Hardware, basePart: Part, movingPart: Part,
): { base: Operation[]; moving: Operation[] };
```

- プリセットの `holes` を、金物の取付位置・姿勢で変換して `Operation` にする
- 生成した `Operation` の `note` に `hardwareId` を書く（J-8）
- **金物の追加と穴の追加は 1 コマンド = 1 Undo ステップ**
- 金物を消したら、その `hardwareId` を持つ `Operation` も同時に消える

Ver.1 の加工の仕組み（`Operation` を足すだけ）に完全に乗るので、**CSG 側の変更は不要**。

### 10.3 手で入れた加工との区別

`note` に `hardwareId` を持つ加工は、加工リストで金物アイコン付きで表示し、
**直接編集させない**（金物の位置を動かすと追従するため）。
削除したい場合は金物ごと消す。

---

## 11. 留め加工（任意角の切断 / D-01）

### 11.1 ツール立体

Ver.1 の切断は「残さない側の半空間を覆う巨大ボックス」だった（§13.2）。
Ver.2 では**そのボックスを傾ける**だけで済む。

```
big        = max(size) * 2 + 100
removeSign = keep === 'negative' ? +1 : -1
tilt       = tiltAbout / tiltDeg（省略時は無回転）

position = withAxis([0,0,0], axis, offset + removeSign * big / 2)
           を tilt の回転で offset 点まわりに回したもの
rotation = tilt の回転
```

`tiltDeg` が 0 なら Ver.1 と完全に同じ結果になること（**回帰テストで固定する**）。

### 11.2 検証

| 条件 | 扱い |
|------|------|
| `tiltDeg` が -89〜89 の範囲外 | エラー（平面が部材と平行になり、全部残るか全部消える） |
| `tiltAbout` が `axis` と同じ | エラー（切断面が回らない） |
| 傾けた結果、残る部分の最小厚みが 1mm 未満 | 警告 |

### 11.3 UI

切断のフォームに追加する。

```
切断する向き  [X] [Y] [Z]
切断位置（コーナーから X）  [ 300 ] mm
残す側        [ X- 側 ] [ X+ 側 ]
傾き          軸 [Y] [Z]    角度 [ 45 ] °
              [ 留め 45 度 ] [ 直角に戻す ]
```

［留め 45 度］［直角に戻す］のショートカットを置く。アーチの［半円にする］と同じ考え方。

---

## 12. 部品表の拡張

Ver.1 の `buildBom` に金物の行を足す。**木材側の集計ロジックは変更しない。**

```ts
export interface BomHardwareRow {
  presetId: string;
  label: string;
  partNumber?: string;
  kind: HardwareKind;
  quantity: number;
}

export interface Bom {
  rows: BomRow[];              // 木材（Ver.1 のまま）
  hardware: BomHardwareRow[];  // Ver.2 追加
  materials: BomMaterialSummary[];
  totalParts: number;
  totalAreaM2: number;
  totalVolumeM3: number;
}
```

金物は `presetId` でまとめ、`quantity` を合計する。
CSV にも「金物」ブロックを足す（木材ブロックの形式は変えない）。

**Ver.1 のテストがそのまま通り続けることで、木材側を壊していないことを確認する。**

---

## 13. 木取り図（O-01）

### 13.1 やること

部材を定尺板の上に並べ、何枚の板が要るかと、どこで切るかを示す。

```ts
export interface StockSheet {
  id: string;
  label: string;        // 'サブロク 910x1820'
  width: number;        // mm
  height: number;       // mm
  thickness: number;    // mm
}

export interface NestedPiece {
  partIds: PartId[];    // 同一形状をまとめた元の部材
  x: number; y: number; // 板の左下を原点とする配置
  width: number; height: number;
  rotated: boolean;     // 90 度回して置いたか
  label: string;
}

export interface NestedSheet {
  sheet: StockSheet;
  index: number;        // 同じ定尺板の何枚目か
  pieces: NestedPiece[];
  /** 歩留まり 0..1 */
  usage: number;
}

export interface NestingResult {
  sheets: NestedSheet[];
  /** 板に載らなかった部材（定尺より大きい） */
  unplaced: Array<{ partIds: PartId[]; label: string; reason: string }>;
}

export function nestParts(
  parts: readonly Part[], stocks: readonly StockSheet[], kerf?: number,
): NestingResult;
```

### 13.2 アルゴリズム

**棚積み法（First-Fit Decreasing Height）**を使う。

1. 部材を材質・厚みでグループ分けし、それぞれ対応する定尺板へ割り当てる
2. 各グループ内で、部材を高さの降順に並べる
3. 板の下から「棚」を作り、幅が入るなら同じ棚に、入らなければ次の棚へ
4. 板の高さを超えたら次の板へ

- **鋸刃の幅（kerf、既定 3mm）**を各ピースの間に入れる。これを忘れると実際に材が足りなくなる
- 90 度回して入るなら回す（木目を考慮しないので可。UI に注記を出す）
- 最適解は求めない（§1.6）。**数 % の歩留まりより、結果がすぐ出て読めることを優先する**

### 13.3 出力

SVG で、1 枚の定尺板につき 1 つの矩形。各ピースに寸法と部材名を入れる。
歩留まりと必要枚数を欄外に出す。

**印刷を前提に、線は黒、塗りは無し、文字は 3mm 相当以上。**

---

## 14. 出力（加工図 / STL）

### 14.1 加工図（O-02）

部材ごとに 1 枚。**正面図（最大面）+ 加工位置の寸法**だけを描く。三面図は作らない。

```ts
export function partDrawingSvg(part: Part, options?: { scale?: number }): string;
```

- 外形は `effectiveLocalBox`（切断を反映）+ 角丸・アーチの輪郭
- 丸穴は中心線つきの円、径と「端からの距離」を引出線で表示
- 角穴・切り欠きは矩形、幅・高さ・端からの距離
- 非貫通の加工は深さを併記
- 裏面から加工するものは「裏」と明記する（**これを忘れると現場で間違える**）

### 14.2 STL（O-04）

`three/examples/jsm/exporters/STLExporter.js` を使う。

```ts
export function exportStl(geometries: BufferGeometry[], binary?: boolean): ArrayBuffer | string;
```

- 既定はバイナリ（ファイルが小さい）
- 選択部材 1 つ、またはアセンブリ全体（pose 適用済み）
- 単位は mm のまま（STL に単位はないが、スライサは mm 前提が普通）
- **`geometry/` 層に置く**（three 依存のため）。`io/` からは呼ぶだけ

---

## 15. ディレクトリ構成（追加分）

Ver.1 のレイヤ規則（§5.1）をそのまま守る。`core/` は three にも React にも依存しない。

```
src/
├─ core/
│  ├─ motion/
│  │  ├─ kinematics.ts          * solvePoses（純粋）
│  │  ├─ jointValidate.ts       閉路・多重駆動の検査
│  │  ├─ jointDefaults.ts       種類ごとの初期値
│  │  ├─ motionScan.ts          * 可動範囲の干渉走査
│  │  └─ gasSpring.ts           * 取付点距離と必要な力
│  ├─ hardware/
│  │  ├─ presets.ts             内蔵プリセット（データのみ）
│  │  └─ hardwareOperations.ts  * 金物から加工を生成
│  ├─ nesting/
│  │  ├─ stockSheets.ts         定尺板のプリセット
│  │  └─ nestParts.ts           * 棚積み法による板取り
│  ├─ drawing/
│  │  ├─ partDrawing.ts         * 加工図の SVG 生成（純粋。文字列を返す）
│  │  └─ nestingDrawing.ts      * 木取り図の SVG 生成
│  ├─ bom/buildBom.ts           金物の行を追加
│  ├─ collision/interference.ts pose 適用済み部材を受け取れるようにする
│  └─ operation/toolSolid.ts    切断に傾きを追加
├─ geometry/
│  └─ exporters/stlExporter.ts  three 依存
├─ store/
│  ├─ useMotionStore.ts         * joint の値と solvePoses の結果
│  └─ commands/
│     ├─ jointCommands.ts       add / remove / setRange / setValue / rename / setEnabled
│     └─ hardwareCommands.ts    add / remove / move
├─ viewport/
│  ├─ HardwareLayer.tsx         金物の簡易表示
│  └─ JointGizmo.tsx            回転軸 / 移動方向の表示
└─ ui/
   ├─ left/HardwarePanel.tsx    金物の取り付け
   ├─ left/JointPanel.tsx       joint の一覧と追加
   ├─ right/MotionSection.tsx   スライダーと可動範囲
   ├─ topbar/ExportMenu.tsx     出力メニュー
   └─ output/
      ├─ NestingPanel.tsx       木取り図
      └─ DrawingPanel.tsx       加工図
```

**`*` が付いたものは純粋関数で、UI なしでテストできる。Ver.2 のテストの主戦場。**

---

## 16. 保存形式とマイグレーション

### 16.1 schemaVersion 4

```ts
const MIGRATIONS: Record<number, Migration> = {
  1: (doc) => doc,                       // v1 -> v2: アーチ追加。変換不要
  2: (doc) => doc,                       // v2 -> v3: 角丸追加。変換不要
  3: (doc) => ({                         // v3 -> v4: 可動・金物を追加
    ...doc,
    project: { ...doc.project, joints: [], hardware: [], gasSprings: [] },
  }),
};
```

**v3 -> v4 は Ver.1 で初めて「実際に変換が要る」migration になる。**
ここまでの恒等変換と違い、配列を足さないと zod 検証で落ちる。

### 16.2 Ver.1 で公開したファイルとの互換（N2-04）

Ver.1 を公開したあと、ユーザーの手元には schemaVersion 1〜3 のファイルが残る。

| 版 | 中身 | Ver.2 での扱い |
|----|------|---------------|
| 1 | Ver.1 初期（アーチ・角丸なし） | 3 段の migration を通して読む |
| 2 | アーチ追加後 | 2 段 |
| 3 | 角丸追加後（公開版） | 1 段 |

**受け入れテスト（MUST）**: リポジトリに v1 / v2 / v3 のサンプルファイルを置き、
すべて読み込めて往復一致することを自動テストで固定する。
`samples/performance-50-200.json` が既に schemaVersion 1 なので、これを v1 の検体に使える。

### 16.3 前方互換

v4 のファイルを Ver.1 のビルドで開くと
「このファイルは新しいバージョンで作成されています」と出る（Ver.1 の `migrate` の既存挙動）。
**これは正しい挙動なので変えない。**

---

## 17. パフォーマンス

| # | 対策 | 実装箇所 |
|---|------|----------|
| P2-1 | 形状ハッシュに joint を含めない | `hashPartShape`（**変更しない**） |
| P2-2 | `solvePoses` は joint の値か rest pose が変わったときだけ | `useMotionStore` |
| P2-3 | pose の変化は `Object3D` の行列だけ更新。ジオメトリは触らない | `PartMesh` |
| P2-4 | 干渉走査は動く部材とその子孫だけを再計算 | `motionScan`（必要になったら） |
| P2-5 | 木取り・加工図の SVG はボタンを押したときだけ生成 | `NestingPanel` / `DrawingPanel` |
| P2-6 | STL 出力はジオメトリを使い回し、新規に CSG しない | `stlExporter` |

### 17.1 検証方法

Ver.1 の `scripts/benchmark.ts` と `samples/performance-50-200.json` を流用し、
Ver.2 用に **joint 10 本を足したサンプル**を作る。

測るもの:

- スライダー 1 目盛りあたりの `solvePoses` 時間（目標 1ms 未満）
- `scanJointMotion` の 36 ステップ合計（目標 1 秒未満）
- スライダー操作中の fps（目標 60）
- **スライダー操作中に `[geometry] build` が 0 件であること（最重要）**

結果は `docs/PERF_V2.md` に記録する。

---

## 18. エラー処理

Ver.1 §18 の分類をそのまま使う。Ver.2 で追加するコードは次のとおり。

```ts
export type AppErrorCode =
  | ...Ver.1 のもの
  | 'JOINT_CYCLE'          // joint が閉路を作る
  | 'JOINT_MULTI_DRIVE'    // 1 部材が複数の joint で駆動されている
  | 'JOINT_NOT_FOUND'
  | 'HARDWARE_TARGET_LOST' // 金物の対象部材が消えた
  | 'NESTING_TOO_LARGE'    // 定尺板に載らない部材がある
  | 'EXPORT_FAILED';
```

### 18.1 壊れた joint の扱い

| 状況 | 挙動 |
|------|------|
| 閉路ができる joint を追加しようとした | 追加を拒否し、Toast で理由を出す（作らせない） |
| 保存ファイルに閉路が入っていた | 該当 joint を無効にして読み込み、警告を出す（読めなくしない） |
| joint の対象部材が消えた | joint も一緒に消す（`removeParts` が面倒を見る） |
| 金物の対象部材が消えた | 金物と自動生成された加工も一緒に消す |

**方針は Ver.1 と同じ。壊れた一部だけを無効にし、アプリは動かし続ける。**

---

## 19. Ver.1 への影響まとめ（実装前チェックリスト）

Phase M0 に入る前に、この表を上から確認すること。

```
[ ] Part.transform のコメントを「rest pose」に書き換えた
[ ] PartMesh が poses を見るようになった
[ ] TransformGizmo が joint の値 != 0 の部材に出なくなった
[ ] removeParts が joint と金物を道連れにする（1 Undo ステップ）
[ ] findInterferences が pose 適用済み部材を受け取れる
[ ] projectSchema / migrate / serialize に 3 配列を足した
[ ] buildBom の木材側ロジックを変えていない
[ ] hashPartShape を変えていない
[ ] GeometryCache を変えていない
[ ] Ver.1 のテスト 328 件が通っている
```

**下 3 行が最も重要。** ここを変えたくなったら、設計が間違っている可能性を先に疑う。

---

## 20. 実装フェーズ概要

詳細は [PHASES_V2.md](./PHASES_V2.md)。

| Phase | 内容 | 依存 |
|-------|------|------|
| M0 | 型定義・schemaVersion 4・migration・Ver.1 ファイルの互換テスト | — |
| M1 | `solvePoses`（純粋関数とテストのみ。**UI に触らない**） | M0 |
| M2 | joint のコマンドと検査（閉路・多重駆動） | M1 |
| M3 | 表示への反映・`JointGizmo` | M2 |
| M4 | スライダー UI と Transient 履歴 | M3 |
| M5 | 配置モードとの整合（値 != 0 ならギズモを出さない） | M4 |
| M6 | 可動範囲の干渉走査と結果表示 | M4 |
| M7 | 金物プリセットと取り付け | M2 |
| M8 | 金物からの自動加工 | M7 |
| M9 | 部品表への金物追加 | M7 |
| M10 | 木取り図 | M0 |
| M11 | 加工図・STL 出力 | M0 |
| M12 | 留め加工（任意角の切断） | M0 |

### 20.1 順序の考え方

- **M1 を単独で切るのが最重要。** 運動学は UI なしで完全にテストできる。
  ここを固めてから表示に繋がないと、「動かないのが数式のせいか描画のせいか」が分からなくなる。
- **M10 / M11 / M12 は M0 さえ済めば独立して進められる。** 可動の実装が詰まっても止まらない。
- M7（金物）は M2（joint コマンド）に乗る。可動が動く前に金物を置いても意味がない。

### 20.2 最小の到達点

Ver.2 として最低限成立するのは **M0〜M6 + M9**。
扉が開閉でき、可動域の干渉が分かり、部品表が出る。
金物の自動加工（M8）と出力系（M10〜M12）はそこから積み増す。

---

## 21. Ver.2 完成条件

### 21.1 受け入れシナリオ

Ver.1 の S-1〜S-16 に加えて、次を**マニュアルなしで**完遂できること。

```
V2-1  Ver.1 で保存したファイル（schemaVersion 3）を開く
V2-2  側板と扉を用意し、スライド丁番を選んで取り付ける
V2-3  扉にカップ穴が自動で入っていることを確認する
V2-4  スライダーで扉を 0 度から 110 度まで開く
V2-5  [全範囲をチェック] を押し、ぶつかる角度域が出ることを確認する
V2-6  扉の位置を直すため、いったん閉じてからギズモで動かす
V2-7  引き出しを作り、スライドレールで前後に動かす
V2-8  取っ手を固定 joint で扉に付け、扉を開くと取っ手も付いてくることを確認する
V2-9  部品表を開き、木材と金物の両方が出ていることを確認する
V2-10 木取り図を出し、必要な定尺板の枚数を確認する
V2-11 加工図を出し、扉のカップ穴の位置が寸法つきで出ることを確認する
V2-12 保存してリロードし、joint の値と金物が復元されることを確認する
V2-13 Ver.1 のファイルを開き直しても壊れないことを確認する
```

### 21.2 品質ゲート

| 項目 | 基準 |
|------|------|
| 型チェック | `npm run typecheck` がエラー 0 |
| Lint | `npm run lint` がエラー 0 |
| テスト | 全パス。**Ver.1 の 328 件を含む**。`src/core/**` の行カバレッジ 80% 以上 |
| ビルド | 成功。初期バンドル（gzip）が 600KB 以内 |
| コンソール | 通常操作でエラー・警告 0 件（Ver.1 既知の上流警告を除く） |
| 互換 | schemaVersion 1 / 2 / 3 のサンプルがすべて読め、往復一致する |
| **CSG** | **スライダー操作中に `[geometry] build` が 1 件も出ない** |
| 性能 | 部材 50 枚 + joint 10 本でスライダーが 60fps。干渉走査 36 ステップが 1 秒以内 |

### 21.3 必ず存在すべきテスト（`src/core/**`）

| 対象 | テスト内容 |
|------|-----------|
| `kinematics` | 値 0 で rest pose と完全一致 / revolute 90 度の既知座標 / 原点をずらした軸 / prismatic の正規化 / 2 段の伝播 / fixed が親に追従 |
| `jointValidate` | 閉路 A->B->A の検出 / 多重駆動の検出 / 自己参照の検出 |
| `motionScan` | 干渉しない構成で `blocked` が空 / 途中からぶつかる構成で `usable.max` が正しい / 全域で干渉なら `usable` が null |
| `gasSpring` | ストローク範囲外で `feasible: false` / 力が距離に応じて変わる / 縮みきり・伸びきりの境界 |
| `hardwareOperations` | プリセットの穴が正しい位置・向きに変換される / `note` に hardwareId が入る |
| `nestParts` | 定尺に載らない部材が `unplaced` に入る / kerf が効いている / 同一形状がまとめられる / 歩留まりの計算 |
| `partDrawing` | 加工ごとに寸法線が出る / 裏面加工に「裏」が付く / SVG が妥当（XML として parse できる） |
| `toolSolid`（切断の傾き） | **`tiltDeg` 0 で Ver.1 と完全に同じ spec になる（回帰）** / 45 度で平面が傾く |
| `migrate` | v1 / v2 / v3 のいずれからでも v4 になる / 3 配列が空で足される |
| `serialize` | joint・金物・ガススプリングを含む往復一致 |
| `history` | **joint 系・金物系の全コマンドで「実行 -> undo で元の Project と deep equal」** |

### 21.4 Ver.2 として未完成でも許容するもの

- 金物の見た目（簡易形状の箱と円柱で可）
- スライド丁番の厳密な軌跡（回転近似のまま）
- 木取り図の最適化（棚積み法のまま）
- 加工図の三面図・断面図
- 多言語対応・モバイル対応

---

## 付録 A. Ver.2 で追加する定数

```ts
// src/core/constants.ts に追加

/** 材質ごとの密度 kg/m3。ガススプリングの計算に使う概算値 */
export const MATERIAL_DENSITY: Record<MaterialKind, number> = {
  plywood: 600, pine: 450, lauan: 450, mdf: 750, generic: 550,
};

/** 鋸刃の幅 mm。木取り図でピースの間に入れる */
export const DEFAULT_KERF_MM = 3;

/** 可動範囲の干渉走査の分割数 */
export const MOTION_SCAN_STEPS = 36;

/** ガススプリングの計算の分割数 */
export const GAS_SPRING_STEPS = 24;

/** 定尺板のプリセット */
export const STOCK_SHEETS = [
  { id: 'sanroku', label: 'サブロク 910x1820', width: 910, height: 1820 },
  { id: 'shiroku', label: 'シハチ 1230x2430', width: 1230, height: 2430 },
  { id: 'half', label: 'ハーフ 910x910', width: 910, height: 910 },
] as const;

export const GRAVITY = 9.81;
```

## 付録 B. 用語（Ver.1 からの追加分）

| 用語 | 定義 |
|------|------|
| rest pose | すべての joint の値が 0 のときの部材の姿勢。`Part.transform` が持つ |
| joint | 部材どうしの結合・可動の関係。固定 / 回転 / 直進の 3 種類 |
| 金物 (Hardware) | joint を実現する実物。買い物と穴あけの根拠 |
| 前進運動学 | 根から葉へ順に姿勢を計算すること。Ver.2 はこれだけを使う |
| 多重駆動 | 1 つの部材が複数の joint で動かされる状態。禁止 |
| kerf | 鋸刃の幅。木取り図でピースの間に確保する |
| 歩留まり | 定尺板のうち実際に部材として使える面積の割合 |
| 定尺板 | 市販の規格サイズの板。サブロク（910x1820）など |
