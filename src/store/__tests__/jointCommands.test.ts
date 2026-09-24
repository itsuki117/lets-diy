import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { isMovableJoint } from '../../core/types';
import { useProjectStore } from '../useProjectStore';
import { useEditorStore } from '../useEditorStore';
import { addPart, removeParts } from '../commands/partCommands';
import { addHardware } from '../commands/hardwareCommands';
import { getHardwarePreset } from '../../core/hardware/presets';
import type { JointKind } from '../../core/types';
import {
  closeAllJoints,
  renameJoint,
  setJointEnabled,
  setJointValue,
  updateTransientJointValue,
} from '../commands/jointCommands';

const reset = (): void => {
  useProjectStore.setState({
    project: createProject(),
    past: [],
    future: [],
    transientBase: null,
    savedAt: null,
  });
  useEditorStore.setState({ selectedIds: [], snap: { grid: 0, angle: 0 }, toasts: [] });
};

const store = () => useProjectStore.getState();
const joints = () => store().project.joints;
const snapshot = () => JSON.parse(JSON.stringify(store().project));

const twoParts = (): [string, string] => {
  const a = addPart({ name: '側板', size: { x: 300, y: 600, z: 18 }, position: [0, 300, 0] });
  const b = addPart({ name: '扉', size: { x: 400, y: 600, z: 18 }, position: [400, 300, 0] });
  return [a, b];
};

/**
 * 可動は金物からしか作れない（設計書 DESIGN_V2 §3.2 廃止）。
 * テストでは種類に合う金物を付けて joint を作る。
 */
const PRESET_FOR: Record<JointKind, string> = { revolute: 'hinge.butt.64', prismatic: 'slide.side.350', fixed: 'bracket.l.40' };
function addJoint(kind: JointKind, basePartId: string, movingPartId: string): string | null {
  const before = new Set(store().project.joints.map((joint) => joint.id));
  const id = addHardware({ preset: getHardwarePreset(PRESET_FOR[kind])!, basePartId, movingPartId, autoHoles: false });
  if (!id) return null;
  return store().project.joints.find((joint) => !before.has(joint.id))?.id ?? null;
}

describe('金物で可動を作る', () => {
  beforeEach(reset);

  it('ヒンジを追加できる', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving);
    expect(id).not.toBeNull();
    expect(joints()).toHaveLength(1);
    expect(joints()[0]!.kind).toBe('revolute');
  });

  it('スライドも追加できる。動かない部材どうしの固定金具は可動を作らない', () => {
    const [base, moving] = twoParts();
    expect(addJoint('fixed', base, moving)).toBeNull();
    expect(store().project.hardware).toHaveLength(1);
    reset();
    const [b2, m2] = twoParts();
    expect(addJoint('prismatic', b2, m2)).not.toBeNull();
  });

  it('閉路になる追加を拒否し、Toast を出す', () => {
    const [base, moving] = twoParts();
    addJoint('revolute', base, moving);
    const id = addJoint('revolute', moving, base);
    expect(id).toBeNull();
    expect(joints()).toHaveLength(1);
    expect(useEditorStore.getState().toasts.length).toBeGreaterThan(0);
  });

  it('多重駆動になる追加を拒否する', () => {
    const [base, moving] = twoParts();
    const third = addPart({ name: '天板', size: { x: 300, y: 18, z: 300 }, position: [0, 700, 0] });
    addJoint('revolute', base, moving);
    expect(addJoint('revolute', third, moving)).toBeNull();
    expect(joints()).toHaveLength(1);
  });

  it('同じ部材どうしを拒否する', () => {
    const [base] = twoParts();
    expect(addJoint('revolute', base, base)).toBeNull();
  });

  it('存在しない部材を拒否する', () => {
    const [base] = twoParts();
    expect(addJoint('revolute', base, 'part-nope')).toBeNull();
  });
});

describe('joint の値と範囲', () => {
  beforeEach(reset);

  it('値を範囲内にクランプする', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving)!;
    setJointValue(id, 999);
    const joint = joints()[0]!;
    if (!isMovableJoint(joint)) return;
    expect(joint.value).toBe(joint.range.max);
  });

  it('固定 joint（動く部材に金具で付けた部材）には値を設定できない', () => {
    const [base, moving] = twoParts();
    const handle = addPart({ name: '取っ手', size: { x: 20, y: 120, z: 30 }, position: [400, 300, 24] });
    addJoint('revolute', base, moving);
    addJoint('fixed', moving, handle);
    const fixed = joints().find((joint) => joint.kind === 'fixed')!;
    setJointValue(fixed.id, 50);
    expect('value' in joints().find((joint) => joint.id === fixed.id)!).toBe(false);
  });

  it('closeAllJoints ですべて 0 に戻る', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving)!;
    setJointValue(id, 90);
    closeAllJoints();
    const joint = joints()[0]!;
    if (!isMovableJoint(joint)) return;
    expect(joint.value).toBe(0);
  });
});

describe('Transient な値の更新', () => {
  beforeEach(reset);

  it('ドラッグ中は履歴に積まず、commit で 1 件だけ増える', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving)!;
    const depth = store().past.length;

    store().beginTransient();
    for (let i = 1; i <= 10; i += 1) updateTransientJointValue(id, i * 5);
    expect(store().past.length).toBe(depth);

    store().commitTransient('扉を開く');
    expect(store().past.length).toBe(depth + 1);
    const joint = joints()[0]!;
    if (!isMovableJoint(joint)) return;
    expect(joint.value).toBe(50);
  });

  it('abort すると元の角度に戻る', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving)!;
    setJointValue(id, 30);
    const before = snapshot();

    store().beginTransient();
    updateTransientJointValue(id, 90);
    store().abortTransient();
    expect(snapshot()).toEqual(before);
  });
});

describe('部材を消すと可動も道連れになる', () => {
  beforeEach(reset);

  it('joint が一緒に消える', () => {
    const [base, moving] = twoParts();
    addJoint('revolute', base, moving);
    removeParts([moving]);
    expect(joints()).toHaveLength(0);
  });

  it('1 つの Undo で部材と joint の両方が戻る', () => {
    const [base, moving] = twoParts();
    addJoint('revolute', base, moving);
    const before = snapshot();
    const depth = store().past.length;

    removeParts([moving]);
    expect(store().past.length).toBe(depth + 1);

    store().undo();
    expect(snapshot()).toEqual(before);
  });

  it('関係ない joint は残る', () => {
    const [base, moving] = twoParts();
    const third = addPart({ name: '天板', size: { x: 300, y: 18, z: 300 }, position: [0, 700, 0] });
    addJoint('revolute', base, moving);
    addJoint('prismatic', base, third);
    removeParts([moving]);
    expect(joints()).toHaveLength(1);
    expect(joints()[0]!.kind).toBe('prismatic');
  });
});

describe('全コマンドの undo 網羅（joint 系）', () => {
  beforeEach(reset);

  const cases: Array<[string, (jointId: string) => void]> = [
    ['setJointValue', (id) => setJointValue(id, 45)],
    ['renameJoint', (id) => renameJoint(id, '新しい名前')],
    ['setJointEnabled', (id) => setJointEnabled(id, false)],
    ['closeAllJoints', () => closeAllJoints()],
  ];

  it.each(cases)('%s は undo で完全に戻る', (_name, run) => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving)!;
    setJointValue(id, 20);
    const before = snapshot();

    run(id);
    store().undo();
    expect(snapshot()).toEqual(before);
  });

  it('addJoint も undo で戻る', () => {
    const [base, moving] = twoParts();
    const before = snapshot();
    addJoint('revolute', base, moving);
    store().undo();
    expect(snapshot()).toEqual(before);
  });
});
