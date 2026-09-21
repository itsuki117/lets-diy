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
