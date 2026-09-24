import { beforeEach, describe, expect, it } from 'vitest';
import { HARDWARE_PRESETS } from '../../core/hardware/presets';
import { createProject } from '../../core/project/createProject';
import { addHardware, moveHardware, removeHardware } from '../commands/hardwareCommands';
import { addPart } from '../commands/partCommands';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

const preset = (id: string) => HARDWARE_PRESETS.find((item) => item.presetId === id)!;
const reset = () => {
  useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
  useEditorStore.setState({ selectedIds: [], selectedJointId: null, toasts: [] });
};
const parts = (): [string, string] => [
  addPart({ name: '側板', size: { x: 300, y: 600, z: 18 }, position: [0, 0, 0] }),
  addPart({ name: '扉', size: { x: 400, y: 600, z: 18 }, position: [400, 0, 0] }),
];

describe('hardware commands', () => {
  beforeEach(reset);

  it('adds hardware, joint and holes in one undo step', () => {
    const [base, moving] = parts();
    const before = structuredClone(useProjectStore.getState().project);
    const beforeHistory = useProjectStore.getState().past.length;
    expect(addHardware({ preset: preset('hinge.concealed.35'), basePartId: base, movingPartId: moving, quantity: 2 })).not.toBeNull();
    const current = useProjectStore.getState();
    expect(current.project.hardware).toHaveLength(1);
    expect(current.project.joints).toHaveLength(1);
    // 2 個ぶん: カップ穴 2 + 座金のネジ 4
    expect(current.project.parts.flatMap((part) => part.operations)).toHaveLength(6);
    expect(current.past).toHaveLength(beforeHistory + 1);
    current.undo();
    expect(useProjectStore.getState().project).toEqual(before);
  });

  it('moves generated holes and removes only matching automatic operations', () => {
    const [base, moving] = parts();
    const id = addHardware({ preset: preset('hinge.concealed.35'), basePartId: base, movingPartId: moving })!;
    useProjectStore.getState().applyCommand('manual', (draft) => draft.parts[0]!.operations.push({ id: 'manual', type: 'roundHole', enabled: true, diameter: 5, depth: 5, through: false, position: [0, 0, 0], direction: '-z' }));
    const before = useProjectStore.getState().project.hardware[0]!.position;
    const holesBefore = useProjectStore.getState().project.parts.flatMap((part) => part.operations).filter((operation) => operation.note === id);
    moveHardware(id, [before[0], before[1] + 10, before[2]]);
    const holesAfter = useProjectStore.getState().project.parts.flatMap((part) => part.operations).filter((operation) => operation.note === id);
    expect(holesAfter).toHaveLength(holesBefore.length);
    expect(holesAfter.every((operation, i) => 'position' in operation && 'position' in holesBefore[i]! && operation.position[1] !== holesBefore[i]!.position[1])).toBe(true);
    // 丁番を動かすと回転軸も一緒に動く
    const hinge = useProjectStore.getState().project.joints[0]!;
    expect(hinge.kind === 'revolute' ? hinge.origin[1] : NaN).toBeCloseTo(before[1] + 10);
    removeHardware(id);
    expect(useProjectStore.getState().project.parts.flatMap((part) => part.operations).map((operation) => operation.id)).toContain('manual');
    expect(useProjectStore.getState().project.joints).toHaveLength(0);
  });

  it('shares one hinge axis when a second hinge is added to the same door', () => {
    const [base, moving] = parts();
    addHardware({ preset: preset('hinge.butt.64'), basePartId: base, movingPartId: moving });
    addHardware({ preset: preset('hinge.concealed.35'), basePartId: base, movingPartId: moving });
    expect(useProjectStore.getState().project.joints).toHaveLength(1);
    expect(useProjectStore.getState().project.hardware).toHaveLength(2);
  });

  it('connects a gas spring to an existing hinge without owning it', () => {
    const [base, moving] = parts();
    addHardware({ preset: preset('hinge.butt.64'), basePartId: base, movingPartId: moving });
    const gasId = addHardware({ preset: preset('gas.100n.250'), basePartId: base, movingPartId: moving })!;
    expect(useProjectStore.getState().project.gasSprings).toHaveLength(1);
    removeHardware(gasId);
    expect(useProjectStore.getState().project.joints).toHaveLength(1);
  });

  it('refuses a gas spring on parts that do not move yet (it only assists a motion)', () => {
    const [base, moving] = parts();
    const before = structuredClone(useProjectStore.getState().project);
    expect(addHardware({ preset: preset('gas.100n.250'), basePartId: base, movingPartId: moving, quantity: 2 })).toBeNull();
    expect(useProjectStore.getState().project).toEqual(before);
    expect(useEditorStore.getState().toasts.at(-1)?.message).toContain('先に丁番');
  });

});
