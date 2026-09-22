import { describe, expect, it } from 'vitest';
import { operationLabel } from '../operation/operationLabel';
import { createOperationId } from '../ids';
import type { Operation } from '../types';
import { makePart } from './fixtures';

const part = makePart();

describe('operationLabel', () => {
  it('丸穴はコーナー原点で表示する', () => {
    const op: Operation = {
      id: createOperationId(),
      type: 'roundHole',
      enabled: true,
      diameter: 8,
      depth: 9,
      through: true,
      position: [-200, -100, 0],
      direction: '-z',
    };
    expect(operationLabel(op, part)).toBe('丸穴 φ8 貫通 @ (100, 50)');
  });

  it('非貫通は深さを出す', () => {
    const op: Operation = {
      id: createOperationId(),
      type: 'roundHole',
      enabled: true,
      diameter: 6,
      depth: 10,
      through: false,
      position: [0, 0, 0],
      direction: '-z',
    };
    expect(operationLabel(op, part)).toContain('深さ10');
  });

  it('切断は残す側を出す', () => {
    const op: Operation = { id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset: 150, keep: 'negative' };
    expect(operationLabel(op, part)).toBe('切断 X=450 / X-側を残す');
  });
});
