import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HARDWARE_PRESETS } from '../../core/hardware/presets';
import { createProject } from '../../core/project/createProject';
import { makePart } from '../../core/__tests__/fixtures';
import { useProjectStore } from '../../store/useProjectStore';
import { OperationList } from '../right/OperationList';

describe('OperationList Ver.2', () => {
  beforeEach(() => {
    const part = makePart();
    part.operations.push({ id: 'op', type: 'roundHole', enabled: true, diameter: 35, depth: 11.5, through: false, position: [0, 0, 0], direction: '-z', note: 'hw' });
    useProjectStore.setState({ project: { ...createProject(), parts: [part], hardware: [{ id: 'hw', preset: HARDWARE_PRESETS[0]!, jointId: null, position: [0, 0, 0], rotation: [0, 0, 0], quantity: 1 }] } });
  });

  it('marks hardware-generated operations and prevents direct editing', () => {
    const part = useProjectStore.getState().project.parts[0]!;
    render(<OperationList part={part} />);
    expect(screen.getByText('金物から自動生成')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '編集' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'この加工を有効にする' })).toBeDisabled();
  });
});
