import { describe, expect, it } from 'vitest';
import { pickFace, worldFace } from '../part/partFaces';
import { ALL_DIRECTIONS } from '../math/axis';
import { localToWorldPoint } from '../math/matrix';
import { localFaceCenter } from '../math/box';
import { length } from '../math/vec3';
import { makePart } from './fixtures';

describe('worldFace', () => {
  it('法線は単位ベクトル', () => {
    const part = makePart({ rotation: [15, 30, 45] });
    for (const dir of ALL_DIRECTIONS) {
      expect(length(worldFace(part, dir).normal)).toBeCloseTo(1, 6);
    }
  });

  it('Y 軸 90 度回転すると +x 面の法線は -Z を向く', () => {
    const face = worldFace(makePart({ rotation: [0, 90, 0] }), '+x');
    expect(face.normal[0]).toBeCloseTo(0, 6);
    expect(face.normal[2]).toBeCloseTo(-1, 6);
  });

  it('面の半寸法は残り 2 軸のサイズ / 2', () => {
    const face = worldFace(makePart(), '-z');
    expect(face.halfU).toBeCloseTo(300);
    expect(face.halfV).toBeCloseTo(150);
  });
});

describe('pickFace', () => {
  it('回転 0 の部材で 6 面すべてを正しく判定する', () => {
    const part = makePart();
    for (const dir of ALL_DIRECTIONS) {
      const point = localToWorldPoint(part.transform, localFaceCenter(part.size, dir));
      expect(pickFace(part, point)).toBe(dir);
    }
  });

  it('回転した部材でも正しく判定する', () => {
    const part = makePart({ rotation: [0, 90, 0], position: [500, 100, -200] });
    for (const dir of ALL_DIRECTIONS) {
      const point = localToWorldPoint(part.transform, localFaceCenter(part.size, dir));
      expect(pickFace(part, point)).toBe(dir);
    }
  });

  it('角の付近でも例外を投げない', () => {
    const part = makePart();
    expect(() => pickFace(part, [300, 150, 9])).not.toThrow();
  });
});
