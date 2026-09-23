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
    expect(addHardware({ preset: preset('hinge.concealed.35'), basePartId: base, movingPartId: moving, position: [0, 0, 0], quantity: 2 })).not.toBeNull();
    const current = useProjectStore.getState();
    expect(current.project.hardware).toHaveLength(1);
    expect(current.project.joints).toHaveLength(1);
    expect(current.project.parts.flatMap((part) => part.operations)).toHaveLength(3);
    expect(current.past).toHaveLength(beforeHistory + 1);
    current.undo();
    expect(useProjectStore.getState().project).toEqual(before);
  });

  it('moves generated holes and removes only matching automatic operations', () => {
    const [base, moving] = parts();
    const id = addHardware({ preset: preset('hinge.concealed.35'), basePartId: base, movingPartId: moving, position: [0, 0, 0] })!;
    useProjectStore.getState().applyCommand('manual', (draft) => draft.parts[0]!.operations.push({ id: 'manual', type: 'roundHole', enabled: true, diameter: 5, depth: 5, through: false, position: [0, 0, 0], direction: '-z' }));
    moveHardware(id, [10, 0, 0]);
    expect(useProjectStore.getState().project.parts.flatMap((part) => part.operations).filter((operation) => operation.note === id).some((operation) => 'position' in operation && operation.position[0] !== 0)).toBe(true);
    removeHardware(id);
    expect(useProjectStore.getState().project.parts.flatMap((part) => part.operations).map((operation) => operation.id)).toContain('manual');
    expect(useProjectStore.getState().project.joints).toHaveLength(0);
  });

  it('connects a gas spring to an existing hinge without owning it', () => {
    const [base, moving] = parts();
    addHardware({ preset: preset('hinge.butt.64'), basePartId: base, movingPartId: moving, position: [0, 0, 0] });
    const gasId = addHardware({ preset: preset('gas.100n.250'), basePartId: base, movingPartId: moving, position: [0, 0, 0] })!;
    expect(useProjectStore.getState().project.gasSprings).toHaveLength(1);
    removeHardware(gasId);
    expect(useProjectStore.getState().project.joints).toHaveLength(1);
  });
});
