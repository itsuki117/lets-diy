import { PanelsTopLeft, Wrench } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { CreatePanel } from './CreatePanel';
import { HardwarePanel } from './HardwarePanel';

export function GeneratePanel() {
  const category = useEditorStore((state) => state.createCategory);
  const setCategory = useEditorStore((state) => state.setCreateCategory);

  return (
    <>
      <div className="generate-category" role="tablist" aria-label="生成するもの">
        <button
          type="button"
          role="tab"
          aria-selected={category === 'wood'}
          className={category === 'wood' ? 'active' : undefined}
          onClick={() => setCategory('wood')}
        >
          <PanelsTopLeft size={16} aria-hidden />
          <span><strong>木材</strong><small>板や角材をつくる</small></span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={category === 'hardware'}
          className={category === 'hardware' ? 'active' : undefined}
          onClick={() => setCategory('hardware')}
        >
          <Wrench size={16} aria-hidden />
          <span><strong>金物</strong><small>蝶番などを取り付ける</small></span>
        </button>
      </div>
      {category === 'wood' ? <CreatePanel /> : <HardwarePanel />}
    </>
  );
}
