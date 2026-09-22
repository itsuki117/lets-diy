import { describe, expect, it } from 'vitest';
import { toolSolidSpec, previewSolidSpec } from '../operation/toolSolid';
import { defaultOperation } from '../operation/operationDefaults';
import { operationLabel } from '../operation/operationLabel';
import { validateOperation } from '../operation/operationValidate';
import { draftHandlePosition, draggableAxes, applyDraftPosition } from '../operation/operationDrag';
import { hashPartShape } from '../part/partHash';
import { OVERCUT } from '../constants';
import { ALL_DIRECTIONS, axisOf, axisSize, otherAxes } from '../math/axis';
import { createOperationId } from '../ids';
import { ALL_CORNERS, type RoundCornerOperation, type Vec3 } from '../types';
import { makePart, PLANK } from './fixtures';

const part = makePart();

const round = (over: Partial<RoundCornerOperation> = {}): RoundCornerOperation => ({
  id: createOperationId(),
  type: 'roundCorner',
  enabled: true,
  radius: 10,
  direction: '-z',
  corners: [...ALL_CORNERS],
  ...over,
});

describe('toolSolidSpec: 角丸', () => {
  it('枠のサイズが面の 2 辺と板厚になる', () => {
    for (const direction of ALL_DIRECTIONS) {
      const spec = toolSolidSpec(round({ direction }), PLANK);
      const axis = axisOf(direction);
      const [ua, va] = otherAxes(axis);
      expect(spec.shape).toBe('cornerFrame');
      expect(spec.size.x).toBeCloseTo(axisSize(PLANK, ua), 6);
      expect(spec.size.y).toBeCloseTo(axisSize(PLANK, va), 6);
      expect(spec.size.z).toBeCloseTo(axisSize(PLANK, axis) + 2 * OVERCUT, 6);
    }
  });

  it('半径と対象コーナーが spec に渡る', () => {
    const spec = toolSolidSpec(round({ radius: 25, corners: ['topLeft', 'bottomRight'] }), PLANK);
    expect(spec.corner).toEqual({ radius: 25, keys: ['topLeft', 'bottomRight'] });
  });

  it('枠は素材の中心に置かれる', () => {
    expect(toolSolidSpec(round(), PLANK).position).toEqual([0, 0, 0]);
  });

  it('プレビューと CSG で同じ spec を使う', () => {
    const op = round();
    expect(previewSolidSpec(op, PLANK)).toEqual(toolSolidSpec(op, PLANK));
  });
});

describe('validateOperation: 角丸', () => {
  it('正常ならエラーなし', () => {
    expect(validateOperation(round({ radius: 10 }), part).errors).toHaveLength(0);
  });
  it('半径 0 はエラー', () => {
    expect(validateOperation(round({ radius: 0 }), part).errors[0]?.field).toBe('radius');
  });
  it('短辺の半分を超えたらエラー', () => {
    // -z 面の面内は 600 x 300。短辺 300 の半分 = 150
    expect(validateOperation(round({ radius: 151 }), part).errors[0]?.field).toBe('radius');
    expect(validateOperation(round({ radius: 150 }), part).errors).toHaveLength(0);
  });
  it('角を 1 つも選んでいなければエラー', () => {
    expect(validateOperation(round({ corners: [] }), part).errors[0]?.field).toBe('corners');
  });
  it('半径が大きすぎると警告', () => {
    expect(validateOperation(round({ radius: 100 }), part).warnings.length).toBeGreaterThan(0);
  });
  it('既定値は検証を通る', () => {
    expect(validateOperation(defaultOperation('roundCorner', part), part).errors).toHaveLength(0);
  });
});

describe('operationLabel: 角丸', () => {
  it('四隅なら「四隅」と出す', () => {
    expect(operationLabel(round({ radius: 8 }), part)).toBe('角丸 R8 四隅');
  });
  it('一部なら角の名前を並べる', () => {
    expect(operationLabel(round({ radius: 12, corners: ['topLeft', 'topRight'] }), part)).toBe('角丸 R12 左上・右上');
  });
});

describe('hashPartShape: 角丸', () => {
  it('半径を変えるとハッシュが変わる', () => {
    const a = { ...part, operations: [round({ radius: 10 })] };
    const b = { ...part, operations: [round({ radius: 12 })] };
    expect(hashPartShape(a)).not.toBe(hashPartShape(b));
  });
  it('コーナーの並び順が違っても同じハッシュ', () => {
    const a = { ...part, operations: [round({ corners: ['topLeft', 'bottomRight'] })] };
    const b = { ...part, operations: [round({ corners: ['bottomRight', 'topLeft'] })] };
    expect(hashPartShape(a)).toBe(hashPartShape(b));
  });
  it('コーナーが違えばハッシュも違う', () => {
    const a = { ...part, operations: [round({ corners: ['topLeft'] })] };
    const b = { ...part, operations: [round({ corners: ['topRight'] })] };
    expect(hashPartShape(a)).not.toBe(hashPartShape(b));
  });
});

describe('角丸は位置を持たない', () => {
  it('ギズモも微調整ボタンも出ない', () => {
    expect(draggableAxes(round())).toEqual({ x: false, y: false, z: false });
  });
  it('ハンドル位置は原点', () => {
    expect(draftHandlePosition(round(), PLANK)).toEqual([0, 0, 0]);
  });
  it('位置を渡しても変化しない', () => {
    const op = round();
    expect(applyDraftPosition(op, [99, 99, 99] as Vec3, PLANK)).toEqual(op);
  });
});
