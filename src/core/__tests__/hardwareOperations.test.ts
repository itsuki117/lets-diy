import { describe, expect, it } from 'vitest';
import { hardwareOperations } from '../hardware/hardwareOperations';
import { hingeLayout } from '../hardware/mechanism';
import { HARDWARE_PRESETS } from '../hardware/presets';
import { createProject } from '../project/createProject';
import { makePart } from './fixtures';
import type { Hardware, RevoluteJoint } from '../types';

describe('hardwareOperations', () => {
  it('drills a cup in the door back and plate screws in the side panel for each hinge', () => {
    const side = makePart({ name: '側板', size: { x: 18, y: 600, z: 400 }, position: [-191, 0, 0] });
    const door = makePart({ name: '扉', size: { x: 400, y: 600, z: 18 }, position: [0, 0, 209] });
    const layout = hingeLayout(side, door);
    const joint: RevoluteJoint = {
      id: 'j', name: 'd', enabled: true, kind: 'revolute', basePartId: side.id, movingPartId: door.id,
      origin: layout.origin, axis: layout.axis, value: 0, range: { min: 0, max: 110 },
    };
    const preset = HARDWARE_PRESETS.find((item) => item.presetId === 'hinge.concealed.35')!;
    const hardware: Hardware = { id: 'hw-test', preset, jointId: 'j', position: layout.origin, rotation: layout.rotation, quantity: 2 };
    const project = { ...createProject(), parts: [side, door], joints: [joint], hardware: [hardware] };
    const result = hardwareOperations(hardware, project, side.id, door.id);
    const cups = result.get(door.id) ?? [];
    const screws = result.get(side.id) ?? [];
    expect(cups).toHaveLength(2);
    expect(screws).toHaveLength(4);
    // カップは扉の裏面（Z-）から、ネジは側板の内側（X+）から
    expect(cups.every((op) => 'direction' in op && op.direction === '-z')).toBe(true);
    expect(screws.every((op) => 'direction' in op && op.direction === '+x')).toBe(true);
    // カップ中心は扉の端から 22.5mm
    const cup = cups[0]!;
    expect('position' in cup ? cup.position[0] : 0).toBeCloseTo(-200 + 22.5);
    expect([...cups, ...screws].every((operation) => operation.note === hardware.id)).toBe(true);
  });

  it('contains valid data-driven presets', () => {
    for (const preset of HARDWARE_PRESETS) {
      expect(preset.presetId).toBeTruthy();
      expect(preset.holes.every((hole) => hole.depth > 0 && ['base', 'moving'].includes(hole.target))).toBe(true);
      if (preset.kind === 'gasSpring') expect(preset.gasSpring!.strokeMin).toBeLessThan(preset.gasSpring!.strokeMax);
    }
  });
});
