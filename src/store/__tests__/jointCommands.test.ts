import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { isMovableJoint } from '../../core/types';
import { useProjectStore } from '../useProjectStore';
import { useEditorStore } from '../useEditorStore';
import { addPart, removeParts } from '../commands/partCommands';
import {
  addJoint,
  closeAllJoints,
  removeJoint,
  renameJoint,
  setJointEnabled,
  setJointRange,
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

describe('addJoint', () => {
  beforeEach(reset);

  it('ヒンジを追加できる', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving);
    expect(id).not.toBeNull();
    expect(joints()).toHaveLength(1);
    expect(joints()[0]!.kind).toBe('revolute');
  });

  it('固定・スライドも追加できる', () => {
    const [base, moving] = twoParts();
    expect(addJoint('fixed', base, moving)).not.toBeNull();
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

  it('範囲を変えると現在値も丸められる', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving)!;
    setJointValue(id, 100);
    setJointRange(id, { min: 0, max: 45 });
    const joint = joints()[0]!;
    if (!isMovableJoint(joint)) return;
    expect(joint.value).toBe(45);
  });

  it('最小と最大が逆でも入れ替えて受け付ける', () => {
    const [base, moving] = twoParts();
    const id = addJoint('revolute', base, moving)!;
    setJointRange(id, { min: 90, max: 10 });
    const joint = joints()[0]!;
    if (!isMovableJoint(joint)) return;
    expect(joint.range).toEqual({ min: 10, max: 90 });
  });

  it('固定 joint には値を設定できない', () => {
    const [base, moving] = twoParts();
    const id = addJoint('fixed', base, moving)!;
    setJointValue(id, 50);
    expect('value' in joints()[0]!).toBe(false);
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
    addJoint('fixed', base, third);
    removeParts([moving]);
    expect(joints()).toHaveLength(1);
    expect(joints()[0]!.kind).toBe('fixed');
  });
});

describe('全コマンドの undo 網羅（joint 系）', () => {
  beforeEach(reset);

  const cases: Array<[string, (jointId: string) => void]> = [
    ['setJointValue', (id) => setJointValue(id, 45)],
    ['setJointRange', (id) => setJointRange(id, { min: -10, max: 80 })],
    ['renameJoint', (id) => renameJoint(id, '新しい名前')],
    ['setJointEnabled', (id) => setJointEnabled(id, false)],
    ['removeJoint', (id) => removeJoint(id)],
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
