import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CircleAlert, TriangleAlert } from 'lucide-react';

export interface NumberFieldProps {
  label: string;
  value: number;
  /** 確定時のみ発火する（= 1 Undo ステップ） */
  onCommit: (value: number) => void;
  /** 入力中に発火する。プレビュー更新用で履歴には残さない。 */
  onPreview?: (value: number) => void;
  unit?: 'mm' | 'deg';
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  error?: string;
  warning?: string;
  compact?: boolean;
}

const UNIT_TEXT: Record<NonNullable<NumberFieldProps['unit']>, string> = { mm: 'mm', deg: '°' };

const round = (v: number, precision: number): number => {
  const f = 10 ** precision;
  return Math.round(v * f) / f;
};

export function NumberField({
  label,
  value,
  onCommit,
  onPreview,
  unit,
  min,
  max,
  step = 1,
  precision = 1,
  disabled,
  error,
  warning,
  compact,
}: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => String(round(value, precision)));
  const [focused, setFocused] = useState(false);
  const [clamped, setClamped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clampTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Escape の直後に走る blur で、捨てたはずの値を確定させないための印
  const skipCommit = useRef(false);

  // 入力中は外からの値で上書きしない（打っている途中の文字列を壊さないため）
  useEffect(() => {
    if (!focused) setText(String(round(value, precision)));
  }, [value, precision, focused]);

  // アンマウント後に setState しないようタイマーを片付ける
  useEffect(
    () => () => {
      if (clampTimer.current) clearTimeout(clampTimer.current);
    },
    [],
  );

  const clamp = (v: number): number => {
    let next = v;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    if (next !== v) {
      setClamped(true);
      if (clampTimer.current) clearTimeout(clampTimer.current);
      clampTimer.current = setTimeout(() => {
        clampTimer.current = null;
        setClamped(false);
      }, 600);
    }
    return round(next, precision);
  };

  const commit = (raw: string): void => {
    const parsed = Number(raw);
    if (raw.trim() === '' || Number.isNaN(parsed)) {
      setText(String(round(value, precision)));
      return;
    }
    const next = clamp(parsed);
    setText(String(next));
    if (next !== value) onCommit(next);
  };

  const nudge = (direction: 1 | -1, event: KeyboardEvent<HTMLInputElement>): void => {
    const amount = event.shiftKey ? step * 10 : event.altKey ? step / 10 : step;
    const base = Number(text);
    const next = clamp((Number.isNaN(base) ? value : base) + direction * amount);
    setText(String(next));
    onPreview?.(next);
    onCommit(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(text);
      inputRef.current?.blur();
      return;
    }
    if (event.key === 'Escape') {
      skipCommit.current = true;
      setText(String(round(value, precision)));
      inputRef.current?.blur();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      nudge(1, event);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      nudge(-1, event);
    }
  };

  return (
    <div className={`field${compact ? ' field-compact' : ''}${error ? ' field-invalid' : ''}${clamped ? ' field-clamped' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-control">
        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(event) => {
            setText(event.target.value);
            const parsed = Number(event.target.value);
            if (event.target.value.trim() !== '' && !Number.isNaN(parsed)) onPreview?.(parsed);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (skipCommit.current) {
              skipCommit.current = false;
              setText(String(round(value, precision)));
              return;
            }
            commit(text);
          }}
          onKeyDown={handleKeyDown}
        />
        {unit ? <span className="field-unit">{UNIT_TEXT[unit]}</span> : null}
      </div>
      {error ? (
        <p className="field-message field-message-error">
          <CircleAlert size={13} aria-hidden />
          {error}
        </p>
      ) : warning ? (
        <p className="field-message field-message-warning">
          <TriangleAlert size={13} aria-hidden />
          {warning}
        </p>
      ) : null}
    </div>
  );
}
