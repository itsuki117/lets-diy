interface Option<T> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string | number> {
  label?: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented-row">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            title={option.title ?? option.label}
            disabled={disabled}
            className={option.value === value ? 'active' : undefined}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
