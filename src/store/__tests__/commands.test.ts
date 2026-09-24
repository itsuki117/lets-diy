import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { useProjectStore } from '../useProjectStore';
import { useEditorStore } from '../useEditorStore';
import { addPart, duplicateParts, removeParts, setPartLocked, setPartSize } from '../commands/partCommands';
import { setPartPosition, setPartRotation, updateTransientTransform } from '../commands/transformCommands';
import { addHardware } from '../commands/hardwareCommands';
import { getHardwarePreset } from '../../core/hardware/presets';
import { MAX_SIZE_MM, MIN_SIZE_MM } from '../../core/constants';

const reset = (): void => {
  useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
  useEditorStore.setState({ selectedIds: [], snap: { grid: 0, angle: 0 }, toasts: [] });
};
const parts = () => useProjectStore.getState().project.parts;

describe('duplicateParts', () => {
  beforeEach(reset);

  it('id と全加工 id が新規採番され、元は変わらない', () => {
    const id = addPart({ size: { x: 600, y: 300, z: 18 } });
    const original = JSON.parse(JSON.stringify(parts()[0]));
    duplicateParts([id]);
    expect(parts()).toHaveLength(2);
    expect(parts()[1]!.id).not.toBe(id);
    expect(parts()[0]).toEqual(original);
  });

  it('名前に「(コピー)」が付く', () => {
    const id = addPart({ name: '側板 A', size: { x: 600, y: 300, z: 18 } });
    duplicateParts([id]);
    expect(parts()[1]!.name).toBe('側板 A (コピー)');
  });

  it('X 方向に size.x + 20 ずれる', () => {
    const id = addPart({ size: { x: 600, y: 300, z: 18 }, position: [0, 0, 0] });
    duplicateParts([id]);
    expect(parts()[1]!.transform.position[0]).toBe(620);
  });

  it('複製した部材が選択される', () => {
    const id = addPart({ size: { x: 600, y: 300, z: 18 } });
    duplicateParts([id]);
    expect(useEditorStore.getState().selectedIds).toEqual([parts()[1]!.id]);
  });
});

describe('removeParts', () => {
  beforeEach(reset);

  it('指定した部材だけ消える', () => {
    const a = addPart({});
    const b = addPart({});
    removeParts([a]);
    expect(parts().map((p) => p.id)).toEqual([b]);
  });

  it('ロックされた部材は消えない', () => {
    const id = addPart({});
    setPartLocked(id, true);
    removeParts([id]);
    expect(parts()).toHaveLength(1);
  });

  it('存在しない id は無視される', () => {
    addPart({});
    removeParts(['part-nope']);
    expect(parts()).toHaveLength(1);
  });
});

describe('transform コマンド', () => {
  beforeEach(reset);

  it('位置はグリッドスナップされる', () => {
    useEditorStore.setState({ snap: { grid: 10, angle: 0 } });
    const id = addPart({});
    setPartPosition(id, [137, 4, -3]);
    expect(parts()[0]!.transform.position).toEqual([140, 0, 0]);
  });

  it('回転は正規化される', () => {
    const id = addPart({});
    setPartRotation(id, [370, -10, 0]);
    expect(parts()[0]!.transform.rotation).toEqual([10, 350, 0]);
  });

  it('ロックされた部材は動かない', () => {
    const id = addPart({ position: [0, 0, 0] });
    setPartLocked(id, true);
    setPartPosition(id, [500, 0, 0]);
    expect(parts()[0]!.transform.position[0]).toBe(0);
  });

  it('金物でつながった部材は、片方を移動しても一緒に動く', () => {
    const base = addPart({ name: '側板', position: [0, 0, 0] });
    const moving = addPart({ name: '扉', position: [600, 0, 0] });
    addHardware({ preset: getHardwarePreset('hinge.butt.64')!, basePartId: base, movingPartId: moving, autoHoles: false });

    setPartPosition(moving, [700, 50, -20]);

    expect(parts().find((part) => part.id === moving)!.transform.position).toEqual([700, 50, -20]);
    expect(parts().find((part) => part.id === base)!.transform.position).toEqual([100, 50, -20]);
  });

  it('固定金具で連結された複数部材は、ドラッグ中も相対位置を保つ', () => {
    const first = addPart({ name: '天板', position: [0, 0, 0] });
    const second = addPart({ name: '脚', position: [300, -300, 0] });
    const third = addPart({ name: '補強', position: [300, -600, 0] });
    const bracket = getHardwarePreset('bracket.l.40')!;
    addHardware({ preset: bracket, basePartId: first, movingPartId: second, autoHoles: false });
    addHardware({ preset: bracket, basePartId: second, movingPartId: third, autoHoles: false });

    useProjectStore.getState().beginTransient();
    updateTransientTransform(second, { position: [400, -200, 50], rotation: [0, 0, 0] });
    useProjectStore.getState().commitTransient('部材を移動');

    expect(parts().find((part) => part.id === first)!.transform.position).toEqual([100, 100, 50]);
    expect(parts().find((part) => part.id === second)!.transform.position).toEqual([400, -200, 50]);
    expect(parts().find((part) => part.id === third)!.transform.position).toEqual([400, -500, 50]);
  });

  it('連結された部材の回転でも組立品の形を保つ', () => {
    const base = addPart({ position: [0, 0, 0] });
    const moving = addPart({ position: [100, 0, 0] });
    addHardware({ preset: getHardwarePreset('hinge.butt.64')!, basePartId: base, movingPartId: moving, autoHoles: false });

    setPartRotation(base, [0, 0, 90]);

    const rotated = parts().find((part) => part.id === moving)!.transform.position;
    expect(rotated[0]).toBeCloseTo(0, 6);
    expect(rotated[1]).toBeCloseTo(100, 6);
    expect(rotated[2]).toBeCloseTo(0, 6);
  });
});

describe('setPartSize', () => {
  beforeEach(reset);

  it('上下限でクランプされる', () => {
    const id = addPart({});
    setPartSize(id, { x: 0, y: 99999, z: 18 });
    expect(parts()[0]!.size.x).toBe(MIN_SIZE_MM);
    expect(parts()[0]!.size.y).toBe(MAX_SIZE_MM);
  });
});
