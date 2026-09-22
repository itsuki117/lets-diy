import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from '../common/NumberField';

const setup = (props: Partial<React.ComponentProps<typeof NumberField>> = {}) => {
  const onCommit = vi.fn();
  render(<NumberField label="横幅" value={600} onCommit={onCommit} unit="mm" {...props} />);
  return { onCommit, input: screen.getByLabelText('横幅') as HTMLInputElement };
};

describe('NumberField', () => {
  it('初期値を表示する', () => {
    const { input } = setup();
    expect(input.value).toBe('600');
  });

  it('入力している途中では onCommit を呼ばない', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup();
    await user.clear(input);
    await user.type(input, '450');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Enter で確定する', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup();
    await user.clear(input);
    await user.type(input, '450{Enter}');
    expect(onCommit).toHaveBeenCalledWith(450);
  });

  it('フォーカスを外すと確定する', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup();
    await user.clear(input);
    await user.type(input, '450');
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(450);
  });

  it('min / max でクランプする', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup({ min: 10, max: 1000 });
    await user.clear(input);
    await user.type(input, '5000{Enter}');
    expect(onCommit).toHaveBeenCalledWith(1000);

    onCommit.mockClear();
    await user.clear(input);
    await user.type(input, '1{Enter}');
    expect(onCommit).toHaveBeenCalledWith(10);
  });

  it('空文字は確定させず、直前の値に戻す', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup();
    await user.clear(input);
    await user.type(input, '{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('600');
  });

  it('数値でない入力は確定させない', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup();
    await user.clear(input);
    await user.type(input, 'abc{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('600');
  });

  it('上下キーで step ぶん増減する', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup({ step: 1 });
    await user.click(input);
    await user.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith(601);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(onCommit).toHaveBeenLastCalledWith(599);
  });

  it('Shift + 上下キーで 10 倍動く', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup({ step: 1 });
    await user.click(input);
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(onCommit).toHaveBeenLastCalledWith(610);
  });

  it('Escape で入力を捨てる', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup();
    await user.clear(input);
    await user.type(input, '123{Escape}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('600');
  });

  it('エラーがあるとメッセージを出す', () => {
    setup({ error: '直径は 0.5mm 以上にしてください' });
    expect(screen.getByText('直径は 0.5mm 以上にしてください')).toBeInTheDocument();
  });

  it('警告はエラーがないときだけ出る', () => {
    setup({ warning: '端に近すぎます' });
    expect(screen.getByText('端に近すぎます')).toBeInTheDocument();
  });

  it('disabled のとき入力できない', () => {
    const { input } = setup({ disabled: true });
    expect(input).toBeDisabled();
  });
});
