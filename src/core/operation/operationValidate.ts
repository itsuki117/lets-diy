import { MIN_DIAMETER_MM } from '../constants';
import { axisOf, axisSize, axisValue, otherAxes } from '../math/axis';
import type { Operation, Part, ValidationIssue, ValidationResult } from '../types';

const ok = (): ValidationResult => ({ errors: [], warnings: [] });

/** 穴が部材の断面からはみ出していないかを見る（面に沿った 2 軸で判定） */
function faceOverflow(
  op: Extract<Operation, { type: 'roundHole' | 'rectHole' }>,
  part: Part,
  halfU: number,
  halfV: number,
): ValidationIssue[] {
  const [ua, va] = otherAxes(axisOf(op.direction));
  const pu = axisValue(op.position, ua);
  const pv = axisValue(op.position, va);
  const limitU = axisSize(part.size, ua) / 2;
  const limitV = axisSize(part.size, va) / 2;
  const out: ValidationIssue[] = [];
  if (Math.abs(pu) - halfU >= limitU || Math.abs(pv) - halfV >= limitV) {
    out.push({ field: 'position', message: '加工が部材の外に出ているため、何も削られません' });
    return out;
  }
  const marginU = limitU - (Math.abs(pu) + halfU);
  const marginV = limitV - (Math.abs(pv) + halfV);
  const margin = Math.min(marginU, marginV);
  if (margin < 0) {
    out.push({ field: 'position', message: '加工が部材の端をはみ出しています' });
  } else if (margin < Math.min(halfU, halfV)) {
    out.push({ field: 'position', message: `部材の端まで ${Math.round(margin * 10) / 10}mm しかありません。割れやすくなります` });
  }
  return out;
}

/**
 * アーチ専用の当たり判定。
 *
 * アーチは「部材の端をまたいで弧状に抜く」のが普通の使い方なので、
 * はみ出していること自体は警告しない（矩形の穴とはここが違う）。
 * 見るのは「まったく重なっていない」ことと「弧の上に材がほとんど残らない」ことの 2 つ。
 */
function archOverhang(op: Extract<Operation, { type: 'arch' }>, part: Part): ValidationIssue[] {
  const [ua, va] = otherAxes(axisOf(op.direction));
  const halfU = axisSize(part.size, ua) / 2;
  const halfV = axisSize(part.size, va) / 2;
  const pu = axisValue(op.position, ua);
  const pv = axisValue(op.position, va);

  const overlaps = Math.abs(pu) - op.width / 2 < halfU && Math.abs(pv) - op.height / 2 < halfV;
  if (!overlaps) {
    return [{ field: 'position', message: 'アーチが部材と重なっていないため、何も削られません' }];
  }

  // 断面を回してある場合は上下が入れ替わるので、残り材の判定は弧が上を向いているときだけ行う
  const spin = Math.abs(((op.rotation % 360) + 360) % 360);
  if (spin > 30 && spin < 330) return [];

  const apex = pv + op.height / 2;
  const remaining = halfV - apex;
  if (remaining < 0) {
    return [{ field: 'position', message: 'アーチが部材を突き抜けています。分断されないか確認してください' }];
  }
  if (remaining < 10) {
    return [
      {
        field: 'position',
        message: `アーチの上に材が ${Math.round(remaining * 10) / 10}mm しか残りません。割れやすくなります`,
      },
    ];
  }
  return [];
}

export function validateOperation(op: Operation, part: Part | undefined): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!part) return { errors: [{ message: '対象の部材が見つかりません' }], warnings: [] };
  if (part.locked) return { errors: [{ message: 'この部材はロックされています' }], warnings: [] };

  switch (op.type) {
    case 'roundHole': {
      const thickness = axisSize(part.size, axisOf(op.direction));
      if (op.diameter < MIN_DIAMETER_MM) errors.push({ field: 'diameter', message: `直径は ${MIN_DIAMETER_MM}mm 以上にしてください` });
      if (!op.through && op.depth <= 0) errors.push({ field: 'depth', message: '深さは 0mm より大きくしてください' });
      if (!op.through && op.depth >= thickness) {
        errors.push({ field: 'depth', message: `深さが板厚 ${thickness}mm 以上です。貫通に切り替えてください` });
      }
      warnings.push(...faceOverflow(op, part, op.diameter / 2, op.diameter / 2));
      break;
    }
    case 'rectHole': {
      const thickness = axisSize(part.size, axisOf(op.direction));
      if (op.width <= 0) errors.push({ field: 'width', message: '幅は 0mm より大きくしてください' });
      if (op.height <= 0) errors.push({ field: 'height', message: '高さは 0mm より大きくしてください' });
      if (!op.through && op.depth <= 0) errors.push({ field: 'depth', message: '深さは 0mm より大きくしてください' });
      if (!op.through && op.depth >= thickness) {
        errors.push({ field: 'depth', message: `深さが板厚 ${thickness}mm 以上です。貫通に切り替えてください` });
      }
      if (op.width > 0 && op.height > 0) warnings.push(...faceOverflow(op, part, op.width / 2, op.height / 2));
      break;
    }
    case 'arch': {
      const thickness = axisSize(part.size, axisOf(op.direction));
      if (op.width <= 0) errors.push({ field: 'width', message: '幅は 0mm より大きくしてください' });
      if (op.height <= 0) errors.push({ field: 'height', message: '全高は 0mm より大きくしてください' });
      if (op.rise < 0) errors.push({ field: 'rise', message: 'アーチの高さは 0mm 以上にしてください' });
      if (op.rise > op.height) {
        errors.push({ field: 'rise', message: 'アーチの高さは全高以下にしてください' });
      }
      if (!op.through && op.depth <= 0) errors.push({ field: 'depth', message: '深さは 0mm より大きくしてください' });
      if (!op.through && op.depth >= thickness) {
        errors.push({ field: 'depth', message: `深さが板厚 ${thickness}mm 以上です。貫通に切り替えてください` });
      }
      if (op.width > 0 && op.height > 0) warnings.push(...archOverhang(op, part));
      break;
    }
    case 'roundCorner': {
      const [ua, va] = otherAxes(axisOf(op.direction));
      const shortest = Math.min(axisSize(part.size, ua), axisSize(part.size, va));
      if (op.corners.length === 0) {
        errors.push({ field: 'corners', message: '丸める角を 1 つ以上選んでください' });
      }
      if (op.radius <= 0) {
        errors.push({ field: 'radius', message: '半径は 0mm より大きくしてください' });
      } else if (op.radius > shortest / 2) {
        errors.push({
          field: 'radius',
          message: `半径は短辺の半分（${Math.round((shortest / 2) * 10) / 10}mm）以下にしてください`,
        });
      } else if (op.corners.length >= 2 && op.radius > shortest / 4) {
        warnings.push({ field: 'radius', message: '半径が大きく、直線部分がほとんど残りません' });
      }
      break;
    }
    case 'notch': {
      if (op.size.x <= 0 || op.size.y <= 0 || op.size.z <= 0) {
        errors.push({ field: 'size', message: '切り欠きの寸法は 0mm より大きくしてください' });
        break;
      }
      const hits = (['x', 'y', 'z'] as const).every((a) => {
        const half = axisSize(op.size, a) / 2;
        return Math.abs(axisValue(op.position, a)) - half < axisSize(part.size, a) / 2;
      });
      if (!hits) warnings.push({ field: 'position', message: '切り欠きが部材と重なっていないため、何も削られません' });
      break;
    }
    case 'cut': {
      const half = axisSize(part.size, op.axis) / 2;
      if (Math.abs(op.offset) >= half) {
        errors.push({ field: 'offset', message: '切断位置が部材の外にあります' });
        break;
      }
      const remain = op.keep === 'negative' ? half + op.offset : half - op.offset;
      const removed = axisSize(part.size, op.axis) - remain;
      if (removed < 1) warnings.push({ field: 'offset', message: '切り落とされる幅が 1mm 未満です' });
      if (remain < 1) errors.push({ field: 'offset', message: '残る部分が 1mm 未満です' });
      break;
    }
  }
  return { errors, warnings };
}

export const isValid = (r: ValidationResult): boolean => r.errors.length === 0;
export const emptyValidation = ok;
