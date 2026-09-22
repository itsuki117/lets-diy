import { describe, expect, it } from 'vitest';
import { copyName, createPart, nextPartName } from '../part/createPart';
import { DEFAULT_PART_SIZE } from '../constants';

describe('createPart', () => {
  it('既定値が入る', () => {
    const part = createPart();
    expect(part.kind).toBe('wood');
    expect(part.size).toEqual(DEFAULT_PART_SIZE);
    expect(part.operations).toEqual([]);
    expect(part.visible).toBe(true);
    expect(part.locked).toBe(false);
    expect(part.transform.rotation).toEqual([0, 0, 0]);
  });

  it('id は一意', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createPart().id));
    expect(ids.size).toBe(500);
  });

  it('既定では床の上に置かれる', () => {
    expect(createPart({ size: { x: 100, y: 200, z: 18 } }).transform.position[1]).toBe(100);
  });
});

describe('nextPartName / copyName', () => {
  it('連番で衝突を避ける', () => {
    expect(nextPartName([])).toBe('木材 1');
    expect(nextPartName(['木材 1', '木材 2'])).toBe('木材 3');
  });

  it('コピー名が衝突しない', () => {
    expect(copyName('側板 A', [])).toBe('側板 A (コピー)');
    expect(copyName('側板 A', ['側板 A (コピー)'])).toBe('側板 A (コピー 2)');
  });
});
