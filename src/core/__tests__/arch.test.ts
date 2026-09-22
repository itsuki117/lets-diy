import { describe, expect, it } from 'vitest';
import { toolSolidSpec, previewSolidSpec } from '../operation/toolSolid';
import { defaultOperation } from '../operation/operationDefaults';
import { operationLabel } from '../operation/operationLabel';
import { validateOperation } from '../operation/operationValidate';
import { hashPartShape } from '../part/partHash';
import { OVERCUT } from '../constants';
import { ALL_DIRECTIONS, axisOf, axisSize, axisValue, otherAxes } from '../math/axis';
import { applyMat3, rotationMatrix } from '../math/matrix';
import { createOperationId } from '../ids';
import type { ArchOperation, AxisDirection, Vec3 } from '../types';
import { makePart, PLANK } from './fixtures';

const part = makePart();

const arch = (over: Partial<ArchOperation> = {}): ArchOperation => ({
  id: createOperationId(),
  type: 'arch',
  enabled: true,
  width: 150,
  height: 100,
  rise: 75,
  depth: 9,
  through: true,
  position: [0, 0, 0],
  direction: '-z',
  rotation: 0,
  ...over,
});

describe('toolSolidSpec: アーチ', () => {
  it('幅と全高がツール座標系の x / y に入る', () => {
    const spec = toolSolidSpec(arch({ width: 150, height: 100 }), PLANK);
    expect(spec.shape).toBe('arch');
    expect(spec.size.x).toBe(150);
    expect(spec.size.y).toBe(100);
  });

  it('貫通なら押し出し量が板厚 + OVERCUT * 2 になる', () => {
    for (const direction of ALL_DIRECTIONS) {
      const spec = toolSolidSpec(arch({ direction }), PLANK);
      const axis = axisOf(direction);
      expect(spec.size.z).toBeCloseTo(axisSize(PLANK, axis) + 2 * OVERCUT, 6);
      expect(axisValue(spec.position, axis)).toBeCloseTo(0, 6);
    }
  });

  it('非貫通なら指定面から depth だけ入った位置で終わる', () => {
    const depth = 7;
    const spec = toolSolidSpec(arch({ through: false, depth, direction: '-z' }), PLANK);
    // -z 面（z = -9）から +z 方向へ 7mm
    const bottom = spec.position[2] + spec.size.z / 2;
    expect(bottom).toBeCloseTo(-PLANK.z / 2 + depth, 6);
  });

  it('rise は 0 と全高の間に収まる', () => {
    expect(toolSolidSpec(arch({ rise: -10 }), PLANK).rise).toBe(0);
    expect(toolSolidSpec(arch({ height: 100, rise: 500 }), PLANK).rise).toBe(100);
    expect(toolSolidSpec(arch({ rise: 40 }), PLANK).rise).toBe(40);
  });

  it('面内の位置は保たれる', () => {
    const spec = toolSolidSpec(arch({ position: [-120, -80, 0] }), PLANK);
    expect(spec.position[0]).toBeCloseTo(-120, 6);
    expect(spec.position[1]).toBeCloseTo(-80, 6);
  });

  it('押し出し軸(+Z)が 6 方向すべてで正しく向く', () => {
    for (const direction of ALL_DIRECTIONS) {
      const spec = toolSolidSpec(arch({ direction }), PLANK);
      const extrude = applyMat3(rotationMatrix(spec.rotation), [0, 0, 1] as Vec3);
      const axis = axisOf(direction);
      // 押し出し軸は direction の軸に平行（向きはどちらでもよい。断面は前後対称）
      expect(Math.abs(axisValue(extrude, axis))).toBeCloseTo(1, 4);
    }
  });

  it('断面の上(+Y)が面内の第 2 軸に向く（回転 0 のとき）', () => {
    for (const direction of ALL_DIRECTIONS) {
      const spec = toolSolidSpec(arch({ direction }), PLANK);
      const up = applyMat3(rotationMatrix(spec.rotation), [0, 1, 0] as Vec3);
      const [, va] = otherAxes(axisOf(direction));
      expect(axisValue(up, va)).toBeCloseTo(1, 4);
    }
  });

  it('断面の回転を 90 度入れると上向きが第 1 軸へ回る', () => {
    const spec = toolSolidSpec(arch({ direction: '-z', rotation: 90 }), PLANK);
    const up = applyMat3(rotationMatrix(spec.rotation), [0, 1, 0] as Vec3);
    // -z 方向の面内軸は [x, y]。90 度回すと +Y が -X になる
    expect(up[0]).toBeCloseTo(-1, 4);
    expect(up[1]).toBeCloseTo(0, 4);
  });

  it('鏡像にならない（右手系の姿勢になっている）', () => {
    for (const direction of ALL_DIRECTIONS) {
      const spec = toolSolidSpec(arch({ direction }), PLANK);
      const m = rotationMatrix(spec.rotation);
      const x = applyMat3(m, [1, 0, 0] as Vec3);
      const y = applyMat3(m, [0, 1, 0] as Vec3);
      const z = applyMat3(m, [0, 0, 1] as Vec3);
      const det =
        x[0] * (y[1] * z[2] - y[2] * z[1]) -
        x[1] * (y[0] * z[2] - y[2] * z[0]) +
        x[2] * (y[0] * z[1] - y[1] * z[0]);
      expect(det).toBeCloseTo(1, 4);
    }
  });

  it('プレビュー用も CSG 用と同じものを返す（切断以外なので）', () => {
    const op = arch();
    expect(previewSolidSpec(op, PLANK)).toEqual(toolSolidSpec(op, PLANK));
  });
});

describe('defaultOperation: アーチ', () => {
  it('既定値は半円で、部材の下端をまたぐ位置に置かれる', () => {
    const op = defaultOperation('arch', part);
    expect(op.type).toBe('arch');
    if (op.type !== 'arch') return;
    expect(op.rise).toBeCloseTo(op.width / 2, 6);
    expect(op.through).toBe(true);
    // 断面の下端が部材の下端より外に出ている = 足元を抜く形になる
    const bottom = op.position[1] - op.height / 2;
    expect(bottom).toBeLessThan(-part.size.y / 2);
  });

  it('既定値は検証を通る', () => {
    expect(validateOperation(defaultOperation('arch', part), part).errors).toHaveLength(0);
  });
});

describe('validateOperation: アーチ', () => {
  it('正常ならエラーなし', () => {
    expect(validateOperation(arch(), part).errors).toHaveLength(0);
  });
  it('幅 0 はエラー', () => {
    expect(validateOperation(arch({ width: 0 }), part).errors[0]?.field).toBe('width');
  });
  it('全高 0 はエラー', () => {
    expect(validateOperation(arch({ height: 0 }), part).errors[0]?.field).toBe('height');
  });
  it('アーチの高さが負ならエラー', () => {
    expect(validateOperation(arch({ rise: -1 }), part).errors[0]?.field).toBe('rise');
  });
  it('アーチの高さが全高を超えたらエラー', () => {
    expect(validateOperation(arch({ height: 50, rise: 80 }), part).errors[0]?.field).toBe('rise');
  });
  it('rise 0（矩形）は許容する', () => {
    expect(validateOperation(arch({ rise: 0 }), part).errors).toHaveLength(0);
  });
  it('非貫通で板厚以上の深さはエラー', () => {
    expect(validateOperation(arch({ through: false, depth: 18 }), part).errors[0]?.field).toBe('depth');
  });
  it('部材と重なっていなければ警告', () => {
    const result = validateOperation(arch({ position: [5000, 0, 0] }), part);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('部材の端をまたぐ普通の使い方では警告を出さない', () => {
    // 足元を弧状に抜く形。断面の下端は部材の外に出るが、これは正常な使い方
    const op = arch({ width: 200, height: 120, rise: 100, position: [0, -part.size.y / 2 - 10 + 60, 0] });
    const result = validateOperation(op, part);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('弧の上に材がほとんど残らなければ警告', () => {
    // 弧の頂点が部材の上端まで届いている
    const op = arch({ width: 200, height: 300, rise: 100, position: [0, 4, 0] });
    const result = validateOperation(op, part);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('断面を 90 度回してあるときは残り材の判定をしない', () => {
    const op = arch({ width: 200, height: 300, rise: 100, position: [0, 4, 0], rotation: 90 });
    expect(validateOperation(op, part).warnings).toHaveLength(0);
  });
});

describe('operationLabel: アーチ', () => {
  it('弧の高さを出す', () => {
    const op = arch({ width: 150, height: 100, rise: 75, position: [-225, -100, 0] });
    expect(operationLabel(op, part)).toBe('アーチ 150x100 弧75 貫通 @ (75, 50)');
  });
  it('rise 0 は矩形と表示する', () => {
    expect(operationLabel(arch({ rise: 0 }), part)).toContain('矩形');
  });
});

describe('hashPartShape: アーチ', () => {
  it('rise を変えるとハッシュが変わる', () => {
    const a = { ...part, operations: [arch({ rise: 75 })] };
    const b = { ...part, operations: [{ ...a.operations[0]!, rise: 40 } as ArchOperation] };
    expect(hashPartShape(b)).not.toBe(hashPartShape(a));
  });

  it('transform を変えてもハッシュは変わらない', () => {
    const withArch = { ...part, operations: [arch()] };
    const moved = { ...withArch, transform: { position: [9, 9, 9] as Vec3, rotation: [0, 90, 0] as Vec3 } };
    expect(hashPartShape(moved)).toBe(hashPartShape(withArch));
  });
});

describe('アーチの向き（回帰用の具体値）', () => {
  it('-z 面から掘るアーチは、断面が XY 平面に乗る', () => {
    const spec = toolSolidSpec(arch({ direction: '-z' as AxisDirection }), PLANK);
    expect(spec.rotation).toEqual([0, 0, 0]);
  });
});
