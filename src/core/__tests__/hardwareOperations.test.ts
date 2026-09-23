import { describe, expect, it } from 'vitest';
import { hardwareOperations } from '../hardware/hardwareOperations';
import { HARDWARE_PRESETS } from '../hardware/presets';
import { makePart } from './fixtures';
import type { Hardware } from '../types';

describe('hardwareOperations', () => {
  it('converts base-local holes to each target part and tags them', () => {
    const base = makePart({ position: [100, 0, 0] });
    const moving = makePart({ position: [200, 0, 0] });
    const preset = HARDWARE_PRESETS.find((item) => item.presetId === 'hinge.concealed.35')!;
    const hardware: Hardware = { id: 'hw-test', preset, jointId: 'jnt-test', position: [10, 0, 0], rotation: [0, 0, 0], quantity: 2 };
    const result = hardwareOperations(hardware, base, moving);
    expect(result.base).toHaveLength(2);
    expect(result.moving).toHaveLength(1);
    const movingHole = result.moving[0];
    expect(movingHole && 'position' in movingHole ? movingHole.position : null).toEqual([-90, 0, 0]);
    expect([...result.base, ...result.moving].every((operation) => operation.note === hardware.id)).toBe(true);
  });

  it('contains five valid data-driven presets', () => {
    expect(HARDWARE_PRESETS).toHaveLength(5);
    for (const preset of HARDWARE_PRESETS) {
      expect(preset.presetId).toBeTruthy();
      expect(preset.holes.every((hole) => hole.depth > 0 && ['base', 'moving'].includes(hole.target))).toBe(true);
    }
  });
});
