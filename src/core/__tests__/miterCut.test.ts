import { describe, expect, it } from 'vitest';
import { toolSolidSpec } from '../operation/toolSolid';
import { validateOperation } from '../operation/operationValidate';
import { hashPartShape } from '../part/partHash';
import type { CutOperation } from '../types';
import { makePart, PLANK } from './fixtures';

const cut = (tiltDeg?: number): CutOperation => ({ id: 'cut', type: 'cut', enabled: true, axis: 'x', offset: 0, keep: 'negative', tiltAbout: 'y', ...(tiltDeg === undefined ? {} : { tiltDeg }) });

describe('miter cut', () => {
  it('keeps zero tilt bit-for-bit compatible with Ver.1', () => {
    expect(toolSolidSpec(cut(0), PLANK)).toEqual(toolSolidSpec({ id: 'cut', type: 'cut', enabled: true, axis: 'x', offset: 0, keep: 'negative' }, PLANK));
  });

  it('rotates the cutter around the cut point at 45 degrees', () => {
    const spec = toolSolidSpec(cut(45), PLANK);
    expect(spec.rotation[1]).toBeCloseTo(45);
    expect(spec.position[2]).not.toBe(0);
  });

  it('rejects invalid axes and angles and includes tilt in the hash', () => {
    const part = makePart();
    expect(validateOperation({ ...cut(90), tiltAbout: 'x' }, part).errors).toHaveLength(2);
    expect(hashPartShape({ ...part, operations: [cut(0)] })).not.toBe(hashPartShape({ ...part, operations: [cut(45)] }));
  });
});
