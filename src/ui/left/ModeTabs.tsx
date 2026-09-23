import { Drill, Move3d, Plus, RotateCw } from 'lucide-react';
import type { EditorMode } from '../../core/types';
import { useEditorStore } from '../../store/useEditorStore';

const TABS: Array<{ mode: EditorMode; label: string; key: string; Icon: typeof Plus }> = [
  { mode: 'create', label: '生成', key: '1', Icon: Plus },
  { mode: 'arrange', label: '配置', key: '2', Icon: Move3d },
  { mode: 'machine', label: '加工', key: '3', Icon: Drill },
  { mode: 'motion', label: '可動', key: '4', Icon: RotateCw },
];

export function ModeTabs() {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  return (
    <div className="mode-tabs" role="tablist" aria-label="編集モード">
      {TABS.map(({ mode: value, label, key, Icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          className={mode === value ? 'active' : undefined}
          title={`${label}モード (${key})`}
          onClick={() => setMode(value)}
        >
          <Icon size={16} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
