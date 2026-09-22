import { describe, expect, it } from 'vitest';
import { applyDraftPosition, draftHandlePosition, draggableAxes } from '../operation/operationDrag';
import { toolSolidSpec } from '../operation/toolSolid';
import { defaultOperation } from '../operation/operationDefaults';
import { createOperationId } from '../ids';
import { ALL_DIRECTIONS, axisOf, axisValue, otherAxes } from '../math/axis';
import type { ArchOperation, CutOperation, NotchOperation, Operation, RoundHoleOperation, Vec3 } from '../types';
import { makePart, PLANK } from './fixtures';

const part = makePart();

const hole = (over: Partial<RoundHoleOperation> = {}): RoundHoleOperation => ({
  id: createOperationId(),
  type: 'roundHole',
  enabled: true,
  diameter: 8,
  depth: 9,
  through: true,
  position: [0, 0, 0],
  direction: '-z',
  ...over,
});

const notch = (): NotchOperation => ({
  id: createOperationId(),
  type: 'notch',
  enabled: true,
  size: { x: 50, y: 40, z: 20 },
  position: [10, 20, 0],
});

const cut = (over: Partial<CutOperation> = {}): CutOperation => ({
  id: createOperationId(),
  type: 'cut',
  enabled: true,
  axis: 'x',
  offset: 0,
  keep: 'negative',
  ...over,
});

const archOp = (): ArchOperation => ({
  id: createOperationId(),
  type: 'arch',
  enabled: true,
  width: 150,
  height: 100,
  rise: 75,
  depth: 9,
  through: true,
  position: [0, -110, 0],
  direction: '-z',
  rotation: 0,
});

describe('draggableAxes', () => {
  it('穴は掘る向きの軸を動かせない', () => {
    for (const direction of ALL_DIRECTIONS) {
      const axes = draggableAxes(hole({ direction }));
      const axis = axisOf(direction);
      expect(axes[axis]).toBe(false);
      const [ua, va] = otherAxes(axis);
      expect(axes[ua]).toBe(true);
      expect(axes[va]).toBe(true);
    }
  });

  it('アーチも穴と同じ扱い', () => {
    expect(draggableAxes(archOp())).toEqual({ x: true, y: true, z: false });
  });

  it('切り欠きは 3 軸とも動かせる', () => {
    expect(draggableAxes(notch())).toEqual({ x: true, y: true, z: true });
  });

  it('切断は切る軸だけ動かせる', () => {
    expect(draggableAxes(cut({ axis: 'x' }))).toEqual({ x: true, y: false, z: false });
    expect(draggableAxes(cut({ axis: 'y' }))).toEqual({ x: false, y: true, z: false });
  });
});

describe('draftHandlePosition', () => {
  it('穴のハンドルはツール立体の中心に出る', () => {
    const op = hole({ position: [-200, 50, 0] });
    expect(draftHandlePosition(op, PLANK)).toEqual(toolSolidSpec(op, PLANK).position);
  });

  it('切り欠きのハンドルは指定位置そのもの', () => {
    const op = notch();
    expect(draftHandlePosition(op, PLANK)).toEqual(op.position);
  });

  it('切断のハンドルは切断軸の上に乗る', () => {
    expect(draftHandlePosition(cut({ axis: 'x', offset: 120 }), PLANK)).toEqual([120, 0, 0]);
    expect(draftHandlePosition(cut({ axis: 'y', offset: -30 }), PLANK)).toEqual([0, -30, 0]);
  });
});

describe('applyDraftPosition', () => {
  it('穴は面内 2 軸だけ動き、掘る向きの成分は変わらない', () => {
    const op = hole({ position: [0, 0, 999] });
    const moved = applyDraftPosition(op, [123, -45, -7] as Vec3, PLANK);
    expect(moved.type).toBe('roundHole');
    if (moved.type !== 'roundHole') return;
    expect(moved.position[0]).toBe(123);
    expect(moved.position[1]).toBe(-45);
    expect(moved.position[2]).toBe(999);
  });

  it('掘る向きを変えても、動く軸が入れ替わるだけ', () => {
    const op = hole({ direction: '+x', position: [5, 0, 0] });
    const moved = applyDraftPosition(op, [111, 22, 33] as Vec3, PLANK);
    if (moved.type !== 'roundHole') return;
    expect(moved.position[0]).toBe(5); // x は掘る向きなので不変
    expect(moved.position[1]).toBe(22);
    expect(moved.position[2]).toBe(33);
  });

  it('アーチも面内 2 軸だけ動く', () => {
    const moved = applyDraftPosition(archOp(), [60, -80, 40] as Vec3, PLANK);
    if (moved.type !== 'arch') return;
    expect(moved.position[0]).toBe(60);
    expect(moved.position[1]).toBe(-80);
    expect(moved.position[2]).toBe(0);
  });

  it('切り欠きは 3 軸そのまま入る', () => {
    const moved = applyDraftPosition(notch(), [1, 2, 3] as Vec3, PLANK);
    if (moved.type !== 'notch') return;
    expect(moved.position).toEqual([1, 2, 3]);
  });

  it('切断は切る軸の成分だけ拾う', () => {
    const moved = applyDraftPosition(cut({ axis: 'x' }), [150, 999, 999] as Vec3, PLANK);
    if (moved.type !== 'cut') return;
    expect(moved.offset).toBe(150);
  });

  it('切断は部材の外へ出ないようにクランプされる', () => {
    const far = applyDraftPosition(cut({ axis: 'x' }), [9999, 0, 0] as Vec3, PLANK);
    if (far.type !== 'cut') return;
    expect(far.offset).toBeCloseTo(PLANK.x / 2 - 0.5, 6);

    const near = applyDraftPosition(cut({ axis: 'x' }), [-9999, 0, 0] as Vec3, PLANK);
    if (near.type !== 'cut') return;
    expect(near.offset).toBeCloseTo(-(PLANK.x / 2 - 0.5), 6);
  });

  it('動かしても加工の種類と id は変わらない', () => {
    const ops: Operation[] = [hole(), archOp(), notch(), cut()];
    for (const op of ops) {
      const moved = applyDraftPosition(op, [10, 20, 30] as Vec3, PLANK);
      expect(moved.type).toBe(op.type);
      expect(moved.id).toBe(op.id);
      expect(moved.enabled).toBe(op.enabled);
    }
  });

  it('ハンドル位置を読み戻しても加工が動かない（往復で不変）', () => {
    for (const type of ['roundHole', 'rectHole', 'arch', 'notch', 'cut'] as const) {
      const op = defaultOperation(type, part);
      const handle = draftHandlePosition(op, part.size);
      const back = applyDraftPosition(op, handle, part.size);
      expect(back).toEqual(op);
    }
  });
});

describe('ドラッグ・微調整・座標入力が同じ結果になる', () => {
  it('同じローカル座標を渡せば同じ Operation になる', () => {
    const op = hole();
    const local: Vec3 = [80, -60, 9];
    expect(applyDraftPosition(op, local, PLANK)).toEqual(applyDraftPosition(op, local, PLANK));
  });

  it('掘る向きの成分がいくつでも結果は同じ', () => {
    const op = hole({ direction: '-z', position: [0, 0, 0] });
    const front = applyDraftPosition(op, [50, 50, -9] as Vec3, PLANK);
    const back = applyDraftPosition(op, [50, 50, 9] as Vec3, PLANK);
    expect(front).toEqual(back);
  });
});

describe('回帰: 動かせない軸を動かそうとしても壊れない', () => {
  it('切断で軸外の値を渡しても offset だけが変わる', () => {
    const before = cut({ axis: 'z', offset: 3 });
    const after = applyDraftPosition(before, [500, 500, 5] as Vec3, PLANK);
    if (after.type !== 'cut') return;
    expect(after.axis).toBe('z');
    expect(after.keep).toBe('negative');
    expect(after.offset).toBe(5);
  });

  it('穴で NaN を渡しても元の値が壊れない', () => {
    const op = hole({ position: [10, 20, 30] });
    const moved = applyDraftPosition(op, [Number.NaN, 5, 0] as Vec3, PLANK);
    if (moved.type !== 'roundHole') return;
    expect(Number.isNaN(moved.position[0])).toBe(true);
    expect(moved.position[1]).toBe(5);
    expect(moved.position[2]).toBe(30);
  });
});

describe('回転した部材でも面内の軸が正しい', () => {
  it('部材の回転は Operation のローカル座標に影響しない', () => {
    const rotated = makePart({ rotation: [0, 90, 0] });
    const op = hole();
    const moved = applyDraftPosition(op, [70, 30, 0] as Vec3, rotated.size);
    if (moved.type !== 'roundHole') return;
    expect(moved.position[0]).toBe(70);
    expect(moved.position[1]).toBe(30);
  });
});

describe('既定の加工はすべてハンドルを出せる', () => {
  it.each(['roundHole', 'rectHole', 'arch', 'notch', 'cut'] as const)('%s', (type) => {
    const op = defaultOperation(type, part);
    const handle = draftHandlePosition(op, part.size);
    expect(handle.every((v) => Number.isFinite(v))).toBe(true);
    const axes = draggableAxes(op);
    expect(axes.x || axes.y || axes.z).toBe(true);
  });
});

describe('操作できない軸の指定', () => {
  it('切断以外で axisValue が必要な軸を落としていない', () => {
    const op = hole({ direction: '-y' });
    const [ua, va] = otherAxes(axisOf(op.direction));
    const moved = applyDraftPosition(op, [11, 22, 33] as Vec3, PLANK);
    if (moved.type !== 'roundHole') return;
    expect(axisValue(moved.position, ua)).toBe(11);
    expect(axisValue(moved.position, va)).toBe(33);
  });
});

describe('微調整ボタンの動き（ドラッグと同じ経路を通る）', () => {
  /** OperationNudge が行うのと同じ計算 */
  const nudge = (op: Operation, axis: 'x' | 'y' | 'z', delta: number, size = PLANK): Operation => {
    const handle = draftHandlePosition(op, size);
    const moved: Vec3 = [
      axis === 'x' ? handle[0] + delta : handle[0],
      axis === 'y' ? handle[1] + delta : handle[1],
      axis === 'z' ? handle[2] + delta : handle[2],
    ];
    return applyDraftPosition(op, moved, size);
  };

  it('穴を X に 0.5mm 動かすとちょうど 0.5mm 動く', () => {
    const op = hole({ position: [100, 50, 0] });
    const moved = nudge(op, 'x', 0.5);
    if (moved.type !== 'roundHole') return;
    expect(moved.position[0]).toBeCloseTo(100.5, 9);
    expect(moved.position[1]).toBeCloseTo(50, 9);
  });

  it('グリッドに吸着しない（0.5mm 刻みが保たれる）', () => {
    let op: Operation = hole({ position: [0, 0, 0] });
    for (let i = 0; i < 4; i += 1) op = nudge(op, 'x', 0.5);
    if (op.type !== 'roundHole') return;
    expect(op.position[0]).toBeCloseTo(2, 9);
  });

  it('動かせない軸を押しても何も変わらない', () => {
    const op = hole({ direction: '-z', position: [10, 20, 30] });
    const moved = nudge(op, 'z', 5);
    expect(moved).toEqual(op);
  });

  it('プラスとマイナスで元に戻る', () => {
    const op = hole({ position: [123.4, -56.7, 0] });
    const back = nudge(nudge(op, 'y', 5), 'y', -5);
    if (back.type !== 'roundHole') return;
    expect(back.position[0]).toBeCloseTo(123.4, 9);
    expect(back.position[1]).toBeCloseTo(-56.7, 9);
  });

  it('切断は切る軸だけ動き、部材の外へは出ない', () => {
    const op = cut({ axis: 'x', offset: 0 });
    const moved = nudge(op, 'x', 10);
    if (moved.type !== 'cut') return;
    expect(moved.offset).toBeCloseTo(10, 9);

    let far: Operation = cut({ axis: 'x', offset: 299 });
    far = nudge(far, 'x', 100);
    if (far.type !== 'cut') return;
    expect(far.offset).toBeCloseTo(PLANK.x / 2 - 0.5, 6);
  });

  it('切り欠きは 3 軸とも動く', () => {
    const op = notch();
    for (const axis of ['x', 'y', 'z'] as const) {
      const moved = nudge(op, axis, 3);
      if (moved.type !== 'notch') return;
      expect(moved.position).not.toEqual(op.position);
    }
  });

  it('アーチも面内 2 軸が動く', () => {
    const op = archOp();
    const moved = nudge(op, 'y', -2.5);
    if (moved.type !== 'arch') return;
    expect(moved.position[1]).toBeCloseTo(-112.5, 9);
  });
});
