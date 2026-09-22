import { describe, expect, it } from 'vitest';
import { effectiveLocalBox, findInterferences, obbPenetration, partObb } from '../collision/interference';
import { createOperationId } from '../ids';
import type { Operation, Part } from '../types';
import { makePart } from './fixtures';

const cut = (offset: number, keep: 'negative' | 'positive' = 'negative'): Operation => ({
  id: createOperationId(),
  type: 'cut',
  enabled: true,
  axis: 'x',
  offset,
  keep,
});

describe('effectiveLocalBox', () => {
  it('加工がなければ素材の外形そのもの', () => {
    const box = effectiveLocalBox(makePart());
    expect(box.min).toEqual([-300, -150, -9]);
    expect(box.max).toEqual([300, 150, 9]);
  });

  it('切断すると外形が縮む', () => {
    const part = { ...makePart(), operations: [cut(100, 'negative')] };
    expect(effectiveLocalBox(part).max[0]).toBe(100);
  });

  it('反対側を残す切断でも縮む', () => {
    const part = { ...makePart(), operations: [cut(-100, 'positive')] };
    expect(effectiveLocalBox(part).min[0]).toBe(-100);
  });

  it('無効な切断は無視する', () => {
    const part = { ...makePart(), operations: [{ ...cut(100), enabled: false }] };
    expect(effectiveLocalBox(part).max[0]).toBe(300);
  });

  it('穴は外形を変えない', () => {
    const hole: Operation = {
      id: createOperationId(),
      type: 'roundHole',
      enabled: true,
      diameter: 8,
      depth: 9,
      through: true,
      position: [0, 0, 0],
      direction: '-z',
    };
    expect(effectiveLocalBox({ ...makePart(), operations: [hole] }).max[0]).toBe(300);
  });
});

describe('obbPenetration', () => {
  it('完全に重なっていれば短辺ぶんの深さ', () => {
    const a = partObb(makePart({ position: [0, 0, 0] }));
    expect(obbPenetration(a, a)).toBeCloseTo(18, 6);
  });

  it('離れていれば null', () => {
    const a = partObb(makePart({ position: [0, 0, 0] }));
    const b = partObb(makePart({ position: [1000, 0, 0] }));
    expect(obbPenetration(a, b)).toBeNull();
  });

  it('ちょうど接しているだけなら null', () => {
    const a = partObb(makePart({ position: [0, 0, 0] }));
    const b = partObb(makePart({ position: [600, 0, 0] }));
    expect(obbPenetration(a, b)).toBeNull();
  });

  it('食い込んだ量を返す', () => {
    const a = partObb(makePart({ position: [0, 0, 0] }));
    const b = partObb(makePart({ position: [595, 0, 0] }));
    expect(obbPenetration(a, b)).toBeCloseTo(5, 6);
  });

  it('回転していても正しく判定する', () => {
    // 90 度回した板を、厚み方向で 3mm 食い込ませる
    const a = makePart({ position: [0, 0, 0] });
    const b = makePart({ position: [300 + 9 - 3, 0, 0], rotation: [0, 90, 0] });
    expect(obbPenetration(partObb(a), partObb(b))).toBeCloseTo(3, 4);
  });

  it('斜めに交差していても検出する', () => {
    const a = makePart({ position: [0, 0, 0] });
    const b = makePart({ position: [0, 0, 0], rotation: [0, 0, 45] });
    expect(obbPenetration(partObb(a), partObb(b))).not.toBeNull();
  });
});

describe('findInterferences', () => {
  const at = (x: number, name: string): Part => makePart({ name, position: [x, 0, 0] });

  it('離れていれば何も出ない', () => {
    expect(findInterferences([at(0, 'A'), at(1000, 'B')])).toHaveLength(0);
  });

  it('面スナップでぴったり接した部材は干渉としない', () => {
    expect(findInterferences([at(0, 'A'), at(600, 'B')])).toHaveLength(0);
  });

  it('許容値以下の食い込みは無視する', () => {
    expect(findInterferences([at(0, 'A'), at(599.7, 'B')], 0.5)).toHaveLength(0);
  });

  it('許容値を超える食い込みを報告する', () => {
    const found = findInterferences([at(0, 'A'), at(590, 'B')]);
    expect(found).toHaveLength(1);
    expect(found[0]!.depthMm).toBeCloseTo(10, 2);
  });

  it('深い順に並ぶ', () => {
    const parts = [at(0, 'A'), at(590, 'B'), at(30, 'C')];
    const found = findInterferences(parts);
    expect(found.length).toBeGreaterThan(1);
    for (let i = 1; i < found.length; i += 1) {
      expect(found[i - 1]!.depthMm).toBeGreaterThanOrEqual(found[i]!.depthMm);
    }
  });

  it('非表示の部材は対象外', () => {
    const a = at(0, 'A');
    const b = { ...at(30, 'B'), visible: false };
    expect(findInterferences([a, b])).toHaveLength(0);
  });

  it('同じペアを 2 回報告しない', () => {
    const found = findInterferences([at(0, 'A'), at(30, 'B')]);
    expect(found).toHaveLength(1);
  });

  it('切断した部材は縮んだ外形で判定する', () => {
    // A を X=0 で切って左半分だけ残すと、右隣の板とは重ならなくなる
    const a: Part = { ...makePart({ name: 'A', position: [0, 0, 0] }), operations: [cut(0, 'negative')] };
    const b = at(310, 'B');
    expect(findInterferences([a, b])).toHaveLength(0);
    // 切断しなければ重なる
    expect(findInterferences([{ ...a, operations: [] }, b]).length).toBe(1);
  });

  it('3 枚がすべて重なれば 3 ペア出る', () => {
    const found = findInterferences([at(0, 'A'), at(20, 'B'), at(40, 'C')]);
    expect(found).toHaveLength(3);
  });
});
