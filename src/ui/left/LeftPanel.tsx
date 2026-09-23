import { useEditorStore } from '../../store/useEditorStore';
import { ArrangePanel } from './ArrangePanel';
import { CreatePanel } from './CreatePanel';
import { JointPanel } from './JointPanel';
import { MachinePanel } from './MachinePanel';
import { ModeTabs } from './ModeTabs';
import { PartOutliner } from './PartOutliner';

export function LeftPanel() {
  const mode = useEditorStore((s) => s.mode);
  return (
    <aside className="left-panel">
      <ModeTabs />
      <div className="panel-scroll">
        {mode === 'create' ? <CreatePanel /> : null}
        {mode === 'arrange' ? <ArrangePanel /> : null}
        {mode === 'machine' ? <MachinePanel /> : null}
        {mode === 'motion' ? <JointPanel /> : null}
      </div>
      <PartOutliner />
    </aside>
  );
}
