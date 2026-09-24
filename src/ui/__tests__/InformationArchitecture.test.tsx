import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { GeneratePanel } from '../left/GeneratePanel';
import { ModeTabs } from '../left/ModeTabs';
import { MotionCheckPage } from '../motion/MotionCheckPage';

beforeEach(() => {
  useProjectStore.getState().loadProject(createProject());
  useEditorStore.setState({
    workspace: 'edit',
    createCategory: 'wood',
    mode: 'create',
    selectedJointId: null,
    toasts: [],
  });
});

describe('editor information architecture', () => {
  it('keeps the editor to the three core modes', () => {
    render(<ModeTabs />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: '生成' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '金物' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '可動' })).not.toBeInTheDocument();
  });

  it('separates wood and hardware inside generation', () => {
    render(<GeneratePanel />);
    expect(screen.getByRole('tab', { name: /木材/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('木材をつくる')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /金物/ }));
    expect(screen.getByRole('tab', { name: /金物/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('金物を取り付ける')).toBeInTheDocument();
  });

  it('presents motion checking as a dedicated two-step page', () => {
    render(<MotionCheckPage><div>3D view</div></MotionCheckPage>);
    expect(screen.getByRole('button', { name: '編集に戻る' })).toBeInTheDocument();
    expect(screen.getByText('動く場所を選ぶ')).toBeInTheDocument();
    expect(screen.getByText('手で動かして、離してみる')).toBeInTheDocument();
    // 動く場所は金物から決まる。ここで手動で作らせない
    expect(screen.queryByText('動かす場所を設定')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /金物を取り付ける/ })).toBeInTheDocument();
  });
});
