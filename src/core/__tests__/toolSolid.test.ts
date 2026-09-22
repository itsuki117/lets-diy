import { describe, expect, it } from 'vitest';
import { previewSolidSpec, toolSolidSpec } from '../operation/toolSolid';
import { OVERCUT } from '../constants';
import { ALL_DIRECTIONS, axisOf, axisSize, axisValue, otherAxes, signOf } from '../math/axis';
import { createOperationId } from '../ids';
import type { AxisDirection, Operation } from '../types';
import { PLANK } from './fixtures';

const roundHole = (over: Partial<Extract<Operation, { type: 'roundHole' }>> = {}) =>
  ({
    id: createOperationId(),
    type: 'roundHole',
    enabled: true,
    diameter: 8,
    depth: 10,
    through: true,
    position: [0, 0, 0],
    direction: '-z',
    ...over,
  }) as Extract<Operation, { type: 'roundHole' }>;

describe('toolSolidSpec: 丸穴', () => {
  it('貫通穴は部材を OVERCUT ぶん突き抜ける', () => {
    for (const direction of ALL_DIRECTIONS) {
      const spec = toolSolidSpec(roundHole({ direction }), PLANK);
      const axis = axisOf(direction);
      expect(spec.shape).toBe('cylinder');
      expect(spec.size.y).toBeCloseTo(axisSize(PLANK, axis) + 2 * OVERCUT, 6);
      // 貫通なら軸方向の中心は 0
      expect(axisValue(spec.position, axis)).toBeCloseTo(0, 6);
    }
  });

  it('非貫通穴は指定面から depth だけ入った位置で終わる', () => {
    for (const direction of ALL_DIRECTIONS) {
      const depth = 7;
      const spec = toolSolidSpec(roundHole({ direction, through: false, depth }), PLANK);
      const axis = axisOf(direction);
      const sign = signOf(direction);
      const half = axisSize(PLANK, axis) / 2;
      const center = axisValue(spec.position, axis);
      // 穴の底 = 入口から depth だけ進んだところ
      const bottom = center - (sign * spec.size.y) / 2;
      expect(bottom).toBeCloseTo(sign * (half - depth), 6);
    }
  });

  it('直径がそのまま円柱の径になる', () => {
    const spec = toolSolidSpec(roundHole({ diameter: 12 }), PLANK);
    expect(spec.size.x).toBe(12);
    expect(spec.size.z).toBe(12);
  });

  it('面内の位置は保たれる', () => {
    const spec = toolSolidSpec(roundHole({ position: [-200, -100, 0] }), PLANK);
    expect(spec.position[0]).toBe(-200);
    expect(spec.position[1]).toBe(-100);
  });

  it('円柱の軸が方向に合う回転になる', () => {
    expect(toolSolidSpec(roundHole({ direction: '-y' }), PLANK).rotation).toEqual([0, 0, 0]);
    expect(toolSolidSpec(roundHole({ direction: '+x' }), PLANK).rotation).toEqual([0, 0, 90]);
    expect(toolSolidSpec(roundHole({ direction: '-z' }), PLANK).rotation).toEqual([90, 0, 0]);
  });
});

describe('toolSolidSpec: 角穴', () => {
  const rect = (direction: AxisDirection) =>
    ({
      id: createOperationId(),
      type: 'rectHole',
      enabled: true,
      width: 40,
      height: 25,
      depth: 10,
      through: true,
      position: [0, 0, 0],
      direction,
      rotation: 0,
    }) as Extract<Operation, { type: 'rectHole' }>;

  it('width / height が方向に直交する 2 軸に割り当たる', () => {
    for (const direction of ALL_DIRECTIONS) {
      const spec = toolSolidSpec(rect(direction), PLANK);
      const [ua, va] = otherAxes(axisOf(direction));
      expect(axisSize(spec.size, ua)).toBe(40);
      expect(axisSize(spec.size, va)).toBe(25);
      expect(axisSize(spec.size, axisOf(direction))).toBeCloseTo(axisSize(PLANK, axisOf(direction)) + 2 * OVERCUT, 6);
    }
  });

  it('断面の回転は方向軸まわりに入る', () => {
    const spec = toolSolidSpec({ ...rect('-z'), rotation: 30 }, PLANK);
    expect(spec.rotation).toEqual([0, 0, 30]);
  });
});

describe('toolSolidSpec: 切り欠き', () => {
  it('指定した寸法と位置がそのまま使われる', () => {
    const spec = toolSolidSpec(
      {
        id: createOperationId(),
        type: 'notch',
        enabled: true,
        size: { x: 50, y: 40, z: 30 },
        position: [10, 20, 30],
      },
      PLANK,
    );
    expect(spec.shape).toBe('box');
    expect(spec.size).toEqual({ x: 50, y: 40, z: 30 });
    expect(spec.position).toEqual([10, 20, 30]);
  });
});

describe('toolSolidSpec: 切断', () => {
  const cut = (keep: 'negative' | 'positive', offset = 150) =>
    ({ id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset, keep }) as Extract<
      Operation,
      { type: 'cut' }
    >;

  it('keep=negative なら offset より正側を完全に覆う', () => {
    const spec = toolSolidSpec(cut('negative'), PLANK);
    const lo = spec.position[0] - spec.size.x / 2;
    const hi = spec.position[0] + spec.size.x / 2;
    expect(lo).toBeCloseTo(150, 6);
    expect(hi).toBeGreaterThan(PLANK.x / 2);
  });

  it('keep=positive なら offset より負側を完全に覆う', () => {
    const spec = toolSolidSpec(cut('positive'), PLANK);
    const lo = spec.position[0] - spec.size.x / 2;
    const hi = spec.position[0] + spec.size.x / 2;
    expect(hi).toBeCloseTo(150, 6);
    expect(lo).toBeLessThan(-PLANK.x / 2);
  });

  it('残す側は削らない', () => {
    const spec = toolSolidSpec(cut('negative', 0), PLANK);
    expect(spec.position[0] - spec.size.x / 2).toBeCloseTo(0, 6);
  });
});

describe('previewSolidSpec', () => {
  it('切断以外は CSG 用と同じものを返す', () => {
    const op = roundHole();
    expect(previewSolidSpec(op, PLANK)).toEqual(toolSolidSpec(op, PLANK));
  });

  it('切断のプレビューは部材の範囲に切り詰める', () => {
    const op = {
      id: createOperationId(),
      type: 'cut',
      enabled: true,
      axis: 'x',
      offset: 0,
      keep: 'negative',
    } as Extract<Operation, { type: 'cut' }>;
    const spec = previewSolidSpec(op, PLANK);
    // 削られるのは X 0..300 の範囲だけ
    expect(spec.size.x).toBeCloseTo(300, 6);
    expect(spec.position[0]).toBeCloseTo(150, 6);
    // 残りの 2 軸は部材とほぼ同じ（見えるように 1mm だけ大きい）
    expect(spec.size.y).toBeCloseTo(PLANK.y + 1, 6);
    expect(spec.size.z).toBeCloseTo(PLANK.z + 1, 6);
  });

  it('keep=positive では反対側を切り詰める', () => {
    const op = {
      id: createOperationId(),
      type: 'cut',
      enabled: true,
      axis: 'x',
      offset: 100,
      keep: 'positive',
    } as Extract<Operation, { type: 'cut' }>;
    const spec = previewSolidSpec(op, PLANK);
    expect(spec.size.x).toBeCloseTo(400, 6);
    expect(spec.position[0]).toBeCloseTo(-100, 6);
  });
});
