import { describe, expect, it } from 'vitest';
import { gasSpringCurve } from '../motion/gasSpring';
import { createProject } from '../project/createProject';
import { makePart } from './fixtures';
import type { GasSpringMount, RevoluteJoint } from '../types';

describe('gasSpringCurve', () => {
  it('marks stroke boundaries and returns changing geometry', () => {
    const base = makePart({ position: [0, 0, 0] });
    const moving = makePart({ position: [100, 0, 0] });
    const joint: RevoluteJoint = { id: 'j', name: 'hinge', kind: 'revolute', enabled: true, basePartId: base.id, movingPartId: moving.id, origin: [0, 0, 0], axis: [0, 0, 1], value: 0, range: { min: 0, max: 90 } };
    const mount: GasSpringMount = { id: 'g', hardwareId: 'h', jointId: joint.id, baseAnchor: [0, 50, 0], movingAnchor: [0, 0, 0], strokeMin: 80, strokeMax: 120, forceN: 100 };
    const project = { ...createProject(), parts: [base, moving], joints: [joint] };
    const curve = gasSpringCurve(mount, joint, project, 2);
    expect(curve).toHaveLength(3);
    expect(curve.some((point) => point.feasible)).toBe(true);
    expect(curve.every((point) => Number.isFinite(point.requiredN))).toBe(true);
  });
});
