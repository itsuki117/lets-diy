import { MATERIAL_LABELS } from '../constants';
import { OPERATION_TYPE_LABELS } from '../operation/operationDefaults';
import { hashPartShape } from '../part/partHash';
import type { MaterialKind, OperationType, Part, PartId, Project } from '../types';

/**
 * 部品表（BOM）。設計データだけから導出する純粋な集計で、保存対象ではない。
 *
 * 「同じ部品」の判定には形状ハッシュを使う。素材寸法と加工内容が完全に一致するものだけを
 * まとめるので、左右対称で穴位置が反転している側板は別行になる。実作業でも別々に作るため
 * これが正しい。
 */

export interface BomRow {
  /** 行のキー。材質 + 形状ハッシュ */
  key: string;
  material: MaterialKind;
  materialLabel: string;
  /** 長さ・幅・厚みの順（寸法を降順に並べ替えたもの。木材の慣用表記に合わせる） */
  lumber: { length: number; width: number; thickness: number };
  quantity: number;
  partIds: PartId[];
  /** 同じ部品に付いている名前（重複を除く） */
  names: string[];
  /** 1 枚あたりの加工内訳 */
  operations: Array<{ type: OperationType; label: string; count: number }>;
  /** 1 枚あたりの最大面の面積 (m2)。板取りの目安 */
  faceAreaM2: number;
  /** 1 枚あたりの体積 (m3) */
  volumeM3: number;
}

export interface BomMaterialSummary {
  material: MaterialKind;
  materialLabel: string;
  thickness: number;
  quantity: number;
  /** 合計面積 (m2) */
  areaM2: number;
}

export interface Bom {
  rows: BomRow[];
  materials: BomMaterialSummary[];
  totalParts: number;
  totalAreaM2: number;
  totalVolumeM3: number;
}

const round = (v: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** 寸法を降順に並べ、長さ・幅・厚みとして読む */
function toLumber(part: Part): BomRow['lumber'] {
  const [length, width, thickness] = [part.size.x, part.size.y, part.size.z].sort((a, b) => b - a) as [
    number,
    number,
    number,
  ];
  return { length, width, thickness };
}

function operationBreakdown(part: Part): BomRow['operations'] {
  const counts = new Map<OperationType, number>();
  for (const op of part.operations) {
    if (!op.enabled) continue;
    counts.set(op.type, (counts.get(op.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, label: OPERATION_TYPE_LABELS[type], count }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

export function buildBom(project: Project): Bom {
  const grouped = new Map<string, BomRow>();

  for (const part of project.parts) {
    const key = `${part.material}:${hashPartShape(part)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.partIds.push(part.id);
      if (!existing.names.includes(part.name)) existing.names.push(part.name);
      continue;
    }

    const lumber = toLumber(part);
    grouped.set(key, {
      key,
      material: part.material,
      materialLabel: MATERIAL_LABELS[part.material],
      lumber,
      quantity: 1,
      partIds: [part.id],
      names: [part.name],
      operations: operationBreakdown(part),
      faceAreaM2: round((lumber.length / 1000) * (lumber.width / 1000)),
      volumeM3: round((lumber.length / 1000) * (lumber.width / 1000) * (lumber.thickness / 1000), 6),
    });
  }

  // 材質、厚み、長さの順に並べる。同じ材料がまとまって見えるように。
  const rows = [...grouped.values()].sort(
    (a, b) =>
      a.materialLabel.localeCompare(b.materialLabel) ||
      a.lumber.thickness - b.lumber.thickness ||
      b.lumber.length - a.lumber.length ||
      b.lumber.width - a.lumber.width,
  );

  const materialMap = new Map<string, BomMaterialSummary>();
  for (const row of rows) {
    const key = `${row.material}:${row.lumber.thickness}`;
    const entry = materialMap.get(key) ?? {
      material: row.material,
      materialLabel: row.materialLabel,
      thickness: row.lumber.thickness,
      quantity: 0,
      areaM2: 0,
    };
    entry.quantity += row.quantity;
    entry.areaM2 = round(entry.areaM2 + row.faceAreaM2 * row.quantity);
    materialMap.set(key, entry);
  }

  const materials = [...materialMap.values()].sort(
    (a, b) => a.materialLabel.localeCompare(b.materialLabel) || a.thickness - b.thickness,
  );

  return {
    rows,
    materials,
    totalParts: project.parts.length,
    totalAreaM2: round(rows.reduce((sum, r) => sum + r.faceAreaM2 * r.quantity, 0)),
    totalVolumeM3: round(
      rows.reduce((sum, r) => sum + r.volumeM3 * r.quantity, 0),
      6,
    ),
  };
}
