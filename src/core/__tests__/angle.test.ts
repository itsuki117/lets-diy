import { describe, expect, it } from 'vitest';
import { degToRad, normalizeDeg, radToDeg, snapAngle } from '../math/angle';

describe('normalizeDeg', () => {
  it('[0, 360) に収める', () => {
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(-360)).toBe(0);
    expect(normalizeDeg(720.5)).toBeCloseTo(0.5);
  });
  it('-0 を返さない', () => {
    expect(Object.is(normalizeDeg(-0), -0)).toBe(false);
  });
});

describe('snapAngle', () => {
  it('step 刻みに丸める', () => {
    expect(snapAngle(47, 45)).toBe(45);
    expect(snapAngle(68, 45)).toBe(90);
    expect(snapAngle(91, 90)).toBe(90);
    expect(snapAngle(-89, 90)).toBe(270);
  });
  it('step 0 は正規化のみ', () => {
    expect(snapAngle(370, 0)).toBe(10);
  });
});

describe('degToRad / radToDeg', () => {
  it('往復で元に戻る', () => {
    for (const deg of [0, 30, 45, 90, 180, 359.5]) {
      expect(radToDeg(degToRad(deg))).toBeCloseTo(deg, 9);
    }
  });
});
