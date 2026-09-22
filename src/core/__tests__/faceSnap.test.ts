import { describe, expect, it } from 'vitest';
import { computeFaceSnapTransform } from '../snap/faceSnap';
import { worldFace } from '../part/partFaces';
import { dot, sub } from '../math/vec3';
import { AppError } from '../result';
import type { Part } from '../types';
import { makePart } from './fixtures';

/** 2 面の距離（target の法線方向に測る） */
function gapBetween(source: Part, sourceFace: Parameters<typeof worldFace>[1], target: Part, targetFace: Parameters<typeof worldFace>[1]): number {
  const fa = worldFace(source, sourceFace);
  const fb = worldFace(target, targetFace);
  return dot(sub(fa.center, fb.center), fb.normal);
}

describe('computeFaceSnapTransform', () => {
  it('回転 0 の板 A(+x 面) と板 B(-x 面) がぴったり接する', () => {
    const a = makePart({ position: [0, 0, 0] });
    const b = makePart({ position: [2000, 0, 0] });
    const moved: Part = { ...a, transform: computeFaceSnapTransform({ source: a, sourceFace: '+x', target: b, targetFace: '-x', gap: 0, centerAlign: false }) };
    expect(gapBetween(moved, '+x', b, '-x')).toBeCloseTo(0, 6);
  });

  it('gap を正にすると、その分だけ離れる', () => {
    const a = makePart({ position: [0, 0, 0] });
    const b = makePart({ position: [2000, 0, 0] });
    const moved: Part = { ...a, transform: computeFaceSnapTransform({ source: a, sourceFace: '+x', target: b, targetFace: '-x', gap: 5, centerAlign: false }) };
    expect(gapBetween(moved, '+x', b, '-x')).toBeCloseTo(5, 6);
  });

  it('gap を負にするとめり込む', () => {
    const a = makePart({ position: [0, 0, 0] });
    const b = makePart({ position: [2000, 0, 0] });
    const moved: Part = { ...a, transform: computeFaceSnapTransform({ source: a, sourceFace: '+x', target: b, targetFace: '-x', gap: -3, centerAlign: false }) };
    expect(gapBetween(moved, '+x', b, '-x')).toBeCloseTo(-3, 6);
  });

  it('source が回転していても接触する', () => {
    const a = makePart({ position: [0, 0, 0], rotation: [0, 90, 0] });
    const b = makePart({ position: [2000, 0, 0] });
    const moved: Part = { ...a, transform: computeFaceSnapTransform({ source: a, sourceFace: '+z', target: b, targetFace: '-x', gap: 0, centerAlign: false }) };
    expect(gapBetween(moved, '+z', b, '-x')).toBeCloseTo(0, 4);
  });

  it('target が回転していても接触する', () => {
    const a = makePart({ position: [0, 0, 0] });
    const b = makePart({ position: [2000, 0, 0], rotation: [0, 90, 0] });
    const moved: Part = { ...a, transform: computeFaceSnapTransform({ source: a, sourceFace: '+x', target: b, targetFace: '+x', gap: 0, centerAlign: false }) };
    expect(gapBetween(moved, '+x', b, '+x')).toBeCloseTo(0, 4);
  });

  it('centerAlign で面の中心が一致する', () => {
    const a = makePart({ position: [0, 0, 0] });
    const b = makePart({ position: [2000, 500, 300] });
    const transform = computeFaceSnapTransform({ source: a, sourceFace: '+x', target: b, targetFace: '-x', gap: 0, centerAlign: true });
    const moved: Part = { ...a, transform };
    const fa = worldFace(moved, '+x');
    const fb = worldFace(b, '-x');
    expect(fa.center[0]).toBeCloseTo(fb.center[0], 4);
    expect(fa.center[1]).toBeCloseTo(fb.center[1], 4);
    expect(fa.center[2]).toBeCloseTo(fb.center[2], 4);
  });

  it('centerAlign しないと法線以外の位置は変わらない', () => {
    const a = makePart({ position: [0, 250, 130] });
    const b = makePart({ position: [2000, 500, 300] });
    const transform = computeFaceSnapTransform({ source: a, sourceFace: '+x', target: b, targetFace: '-x', gap: 0, centerAlign: false });
    expect(transform.position[1]).toBeCloseTo(250, 6);
    expect(transform.position[2]).toBeCloseTo(130, 6);
  });

  it('同じ部材どうしはエラー', () => {
    const a = makePart();
    expect(() =>
      computeFaceSnapTransform({ source: a, sourceFace: '+x', target: a, targetFace: '-x', gap: 0, centerAlign: false }),
    ).toThrow(AppError);
  });
});
