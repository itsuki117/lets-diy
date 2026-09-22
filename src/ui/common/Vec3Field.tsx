import type { Vec3 } from '../../core/types';
import { NumberField } from './NumberField';

interface Vec3FieldProps {
  labels?: [string, string, string];
  value: Vec3;
  onCommit: (value: Vec3) => void;
  unit?: 'mm' | 'deg';
  step?: number;
  disabled?: boolean;
}

export function Vec3Field({ labels = ['X', 'Y', 'Z'], value, onCommit, unit, step, disabled }: Vec3FieldProps) {
  const setAt = (index: 0 | 1 | 2, next: number): void => {
    const out: [number, number, number] = [value[0], value[1], value[2]];
    out[index] = next;
    onCommit(out);
  };
  return (
    <div className="vec3-field">
      {([0, 1, 2] as const).map((i) => (
        <NumberField
          key={labels[i]}
          compact
          label={labels[i]}
          value={value[i]}
          unit={unit}
          step={step}
          disabled={disabled}
          onCommit={(next) => setAt(i, next)}
        />
      ))}
    </div>
  );
}
