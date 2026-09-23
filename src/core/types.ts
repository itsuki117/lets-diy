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
export type JointId = string;     // "jnt-xxxxxxxx"
export type HardwareId = string;  // "hw-xxxxxxxx"

// ------------------------------------------------------------
// Transform
// ------------------------------------------------------------
/**
 * 部材ローカル原点（= 直方体の中心）のワールド配置。
 * scale は扱わない（寸法変更は size で行う）。
 *
 * **Ver.2 以降、これは rest pose（すべての joint の値が 0 のときの姿勢）である。**
 * 画面に出る姿勢は `solvePoses()` が rest pose と joint の値から毎回計算する。
 * 保存されるのは rest pose と joint の値だけで、表示姿勢は保存しない
 * （設計書 DESIGN_V2 §2）。
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

/**
 * アーチ切り欠き。矩形の上辺を弧にした断面を direction 軸方向へ押し出して削る。
 * 棚の側板の足元を弧状に抜く、といった用途。
 */
export interface ArchOperation extends OperationBase {
  type: 'arch';
  /** 開口の幅 mm */
  width: Millimeter;
  /** 断面の全高 mm（弧の部分を含む） */
  height: Millimeter;
  /**
   * 弧の高さ mm。0 なら矩形、width / 2 なら半円、それ以外は楕円弧になる。
   * 0 <= rise <= height。
   */
  rise: Millimeter;
  depth: Millimeter;
  through: boolean;
  /** 断面を囲む矩形の中心（部材ローカル、中心原点）mm */
  position: Vec3;
  /** 押し出す向き。通常は板厚方向 */
  direction: AxisDirection;
  /** direction 軸まわりの断面の回転（度）。0 で弧が上を向く */
  rotation: Degree;
}

/**
 * 面の四隅のうち、どの角を指すか。
 * 面内の第 1 軸(u)・第 2 軸(v) の最小側を left / bottom、最大側を right / top と呼ぶ。
 */
export type CornerKey = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';

export const ALL_CORNERS: CornerKey[] = ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'];

/**
 * 角丸。素材の外形の角を、指定半径の円弧で落とす。
 * 板厚を貫通して落とすので depth / through は持たない（ルーターや糸ノコの実作業に合わせている）。
 */
export interface RoundCornerOperation extends OperationBase {
  type: 'roundCorner';
  /** 丸める半径 mm */
  radius: Millimeter;
  /** どの面から見た四隅か。この軸方向へ貫通する */
  direction: AxisDirection;
  /** 丸める角。空にはできない */
  corners: CornerKey[];
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
  /** 切断面を傾ける軸。省略時は直角切断。 */
  tiltAbout?: AxisKey;
  /** -89..89 度。省略時は 0。 */
  tiltDeg?: Degree;
}

export type Operation =
  | RoundHoleOperation
  | RectHoleOperation
  | ArchOperation
  | RoundCornerOperation
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
// 可動・結合の関係（Ver.2）
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

/** 固定。自由度 0。親に貼り付けるだけ（取っ手を扉に付ける、など）。 */
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

/** 値を持つ joint（fixed 以外） */
export type MovableJoint = RevoluteJoint | PrismaticJoint;

export const isMovableJoint = (joint: Joint): joint is MovableJoint => joint.kind !== 'fixed';

export const JOINT_KIND_LABELS: Record<JointKind, string> = {
  fixed: '固定',
  revolute: 'ヒンジ',
  prismatic: 'スライド',
};

/** joint の値の単位。fixed は値を持たない */
export const jointUnit = (kind: JointKind): 'deg' | 'mm' | null =>
  kind === 'revolute' ? 'deg' : kind === 'prismatic' ? 'mm' : null;

// ------------------------------------------------------------
// 金物（Ver.2）
// ------------------------------------------------------------
export type HardwareKind = 'hinge' | 'slideRail' | 'gasSpring';

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
  /** 必要な穴 */
  holes: HardwareHole[];
  /** ガススプリングだけが持つ仕様。プリセットデータで駆動する。 */
  gasSpring?: { strokeMin: Millimeter; strokeMax: Millimeter; forceN: number };
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

/**
 * ガススプリング。自由度を持たず、revolute joint に付く補助部品として扱う。
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
// Project / 保存フォーマット
// ------------------------------------------------------------
export interface Project {
  id: ProjectId;
  name: string;
  /** Ver.1 は mm 固定。将来 'inch' 表示を追加する余地 */
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

export interface ProjectDocument {
  app: 'lets-diy';
  schemaVersion: number;
  savedAt: string;
  project: Project;
}

// ------------------------------------------------------------
// ツール立体（加工の実体。プレビューと CSG で共有する）
// ------------------------------------------------------------
export type ToolShape = 'box' | 'cylinder' | 'arch' | 'cornerFrame';

/**
 * Operation から導出される「減算する立体」の仕様。
 * 部材ローカル座標系（中心原点）で表現される。three.js に依存しない。
 */
export interface ToolSolidSpec {
  shape: ToolShape;
  /**
   * box:      [x, y, z] の 3 辺長（部材ローカル軸に沿う）
   * cylinder: x = 直径, y = 高さ（軸は +Y）, z = 直径（x と同値）
   * arch:     x = 幅, y = 全高, z = 押し出す深さ（押し出し軸は +Z）
   * cornerFrame: x = 面の u 寸法, y = 面の v 寸法, z = 押し出す深さ（押し出し軸は +Z）
   *
   * cylinder と arch はツール自身の座標系での寸法であり、
   * 部材ローカルへの向き合わせは rotation が担う。
   */
  size: Size3;
  /** ツール立体の中心（部材ローカル mm） */
  position: Vec3;
  /** ツール立体の姿勢（度、Euler 'XYZ'、部材ローカル） */
  rotation: Vec3;
  /** shape === 'arch' のときの弧の高さ mm。0 なら矩形になる */
  rise?: Millimeter;
  /** shape === 'cornerFrame' のときの丸め半径と対象コーナー */
  corner?: { radius: Millimeter; keys: CornerKey[] };
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

/** 可動モードで「固定側 -> 動く側」を選んでいる最中の下書き */
export interface JointDraft {
  kind: JointKind;
  basePartId: PartId | null;
  movingPartId: PartId | null;
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
