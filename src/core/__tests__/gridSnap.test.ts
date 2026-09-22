import { describe, expect, it } from 'vitest';
import { snapValue, snapVec3 } from '../snap/gridSnap';

describe('snapValue', () => {
  it('最も近い格子に丸める', () => {
    expect(snapValue(137, 10)).toBe(140);
    expect(snapValue(134, 10)).toBe(130);
    expect(snapValue(0, 10)).toBe(0);
  });
  it('ちょうど中間は上に丸める（Math.round の挙動）', () => {
    expect(snapValue(135, 10)).toBe(140);
    expect(snapValue(-135, 10)).toBe(-130);
  });
  it('負値でも動く', () => {
    expect(snapValue(-137, 10)).toBe(-140);
  });
  it('step 0 は素通し', () => {
    expect(snapValue(137.42, 0)).toBe(137.42);
    expect(snapValue(137.42, -1)).toBe(137.42);
  });
  it('1mm / 5mm 刻み', () => {
    expect(snapValue(3.4, 1)).toBe(3);
    expect(snapValue(3.6, 5)).toBe(5);
  });
  it('snapVec3 は成分ごとに丸める', () => {
    expect(snapVec3([1.2, -7.7, 13], 5)).toEqual([0, -10, 15]);
  });
});
