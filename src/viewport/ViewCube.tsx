export type ViewPreset = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'iso';
const views: [ViewPreset, string][] = [['front','正面'],['back','背面'],['top','上'],['bottom','下'],['left','左'],['right','右'],['iso','等角']];
export function ViewCube({ onChange }: { onChange: (preset: ViewPreset) => void }) {
  return <nav className="view-cube" aria-label="視点"><span>視点</span>{views.map(([id,label]) => <button key={id} title={`${label}から見る`} aria-label={`${label}から見る`} onClick={() => onChange(id)}>{label}</button>)}</nav>;
}
