import { describe, expect, it } from 'vitest';
import { hashPartShape } from '../part/partHash';
import { createOperationId } from '../ids';
import type { Operation, Part, RoundHoleOperation } from '../types';
import { makePart } from './fixtures';

const hole = (): RoundHoleOperation => ({
  id: createOperationId(),
  type: 'roundHole',
  enabled: true,
  diameter: 8,
  depth: 18,
  through: true,
  position: [0, 0, 0],
  direction: '-z',
});

describe('hashPartShape', () => {
  it('transform を変えてもハッシュは変わらない', () => {
    const part = makePart();
    const moved: Part = { ...part, transform: { position: [999, 5, -3], rotation: [90, 45, 15] } };
    expect(hashPartShape(moved)).toBe(hashPartShape(part));
  });

  it('name / visible / locked を変えてもハッシュは変わらない', () => {
    const part = makePart();
    expect(hashPartShape({ ...part, name: '別名', visible: false, locked: true })).toBe(hashPartShape(part));
  });

  it('size を変えるとハッシュが変わる', () => {
    const part = makePart();
    expect(hashPartShape({ ...part, size: { ...part.size, z: 21 } })).not.toBe(hashPartShape(part));
  });

  it('加工を足すとハッシュが変わる', () => {
    const part = makePart();
    expect(hashPartShape({ ...part, operations: [hole()] })).not.toBe(hashPartShape(part));
  });

  it('無効な加工はハッシュに影響しない', () => {
    const part = makePart();
    const disabled = { ...hole(), enabled: false };
    expect(hashPartShape({ ...part, operations: [disabled] })).toBe(hashPartShape(part));
  });

  it('加工のキー順が違っても同じハッシュになる', () => {
    const part = makePart();
    const a = hole();
    const reordered = {
      direction: a.direction,
      position: a.position,
      through: a.through,
      depth: a.depth,
      diameter: a.diameter,
      enabled: a.enabled,
      type: a.type,
      id: a.id,
    } as Operation;
    expect(hashPartShape({ ...part, operations: [reordered] })).toBe(hashPartShape({ ...part, operations: [a] }));
  });
});
