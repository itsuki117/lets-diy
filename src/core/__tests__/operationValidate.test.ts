import { describe, expect, it } from 'vitest';
import { validateOperation } from '../operation/operationValidate';
import { createOperationId } from '../ids';
import type { Operation } from '../types';
import { makePart } from './fixtures';

const part = makePart();

const hole = (over: Partial<Extract<Operation, { type: 'roundHole' }>> = {}) =>
  ({
    id: createOperationId(),
    type: 'roundHole',
    enabled: true,
    diameter: 8,
    depth: 9,
    through: true,
    position: [0, 0, 0],
    direction: '-z',
    ...over,
  }) as Operation;

describe('validateOperation: 共通', () => {
  it('部材がないとエラー', () => {
    expect(validateOperation(hole(), undefined).errors).toHaveLength(1);
  });
  it('ロックされた部材はエラー', () => {
    expect(validateOperation(hole(), { ...part, locked: true }).errors).toHaveLength(1);
  });
});

describe('validateOperation: 丸穴', () => {
  it('正常な穴はエラーなし', () => {
    expect(validateOperation(hole(), part).errors).toHaveLength(0);
  });
  it('直径 0 はエラー', () => {
    expect(validateOperation(hole({ diameter: 0 }), part).errors[0]?.field).toBe('diameter');
  });
  it('非貫通で深さ 0 はエラー', () => {
    expect(validateOperation(hole({ through: false, depth: 0 }), part).errors[0]?.field).toBe('depth');
  });
  it('非貫通で板厚以上の深さはエラー', () => {
    expect(validateOperation(hole({ through: false, depth: 18 }), part).errors[0]?.field).toBe('depth');
  });
  it('部材の外に出た穴は警告', () => {
    const result = validateOperation(hole({ position: [1000, 0, 0] }), part);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('端に近すぎる穴は警告', () => {
    const result = validateOperation(hole({ position: [296, 0, 0] }), part);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('validateOperation: 角穴', () => {
  const rect = (over: Record<string, unknown> = {}) =>
    ({
      id: createOperationId(),
      type: 'rectHole',
      enabled: true,
      width: 40,
      height: 25,
      depth: 9,
      through: true,
      position: [0, 0, 0],
      direction: '-z',
      rotation: 0,
      ...over,
    }) as Operation;

  it('幅 0 はエラー', () => {
    expect(validateOperation(rect({ width: 0 }), part).errors[0]?.field).toBe('width');
  });
  it('高さ 0 はエラー', () => {
    expect(validateOperation(rect({ height: 0 }), part).errors[0]?.field).toBe('height');
  });
  it('正常ならエラーなし', () => {
    expect(validateOperation(rect(), part).errors).toHaveLength(0);
  });
});

describe('validateOperation: 切り欠き', () => {
  const notch = (over: Record<string, unknown> = {}) =>
    ({
      id: createOperationId(),
      type: 'notch',
      enabled: true,
      size: { x: 50, y: 40, z: 20 },
      position: [275, 130, 0],
      ...over,
    }) as Operation;

  it('寸法 0 はエラー', () => {
    expect(validateOperation(notch({ size: { x: 0, y: 40, z: 20 } }), part).errors).toHaveLength(1);
  });
  it('部材と交差しなければ警告', () => {
    const result = validateOperation(notch({ position: [5000, 0, 0] }), part);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('validateOperation: 切断', () => {
  const cut = (over: Record<string, unknown> = {}) =>
    ({ id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset: 0, keep: 'negative', ...over }) as Operation;

  it('部材の外で切るのはエラー', () => {
    expect(validateOperation(cut({ offset: 300 }), part).errors[0]?.field).toBe('offset');
    expect(validateOperation(cut({ offset: -300 }), part).errors[0]?.field).toBe('offset');
  });
  it('切り落とし幅が 1mm 未満なら警告', () => {
    expect(validateOperation(cut({ offset: 299.5 }), part).warnings.length).toBeGreaterThan(0);
  });
  it('中央で切るのは正常', () => {
    expect(validateOperation(cut(), part).errors).toHaveLength(0);
  });
});
