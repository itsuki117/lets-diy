import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, CircleCheck, MousePointer2, Play, ScanSearch } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { ToastHost } from '../common/ToastHost';
import { JointPanel } from '../left/JointPanel';
import { MotionSection } from '../right/MotionSection';

export function MotionCheckPage({ children }: { children: ReactNode }) {
  const project = useProjectStore((state) => state.project);
  const selectedJointId = useEditorStore((state) => state.selectedJointId);
  const selectJoint = useEditorStore((state) => state.selectJoint);
  const setWorkspace = useEditorStore((state) => state.setWorkspace);

  useEffect(() => {
    if (!selectedJointId && project.joints[0]) selectJoint(project.joints[0].id);
  }, [project.joints, selectJoint, selectedJointId]);

  return (
    <div className="motion-check-shell">
      <header className="motion-check-header">
        <button type="button" onClick={() => setWorkspace('edit')}>
          <ArrowLeft size={16} aria-hidden />
          編集に戻る
        </button>
        <div className="motion-check-title">
          <Play size={18} aria-hidden />
          <div>
            <strong>動作確認</strong>
            <span>{project.name}</span>
          </div>
        </div>
        <p>作品を開閉・スライドして、正しく動くか確認します</p>
      </header>

      <aside className="motion-check-left" aria-label="動かす場所の設定">
        <div className="motion-panel-intro">
          <span className="step-number">1</span>
          <div><strong>動かす場所を選ぶ</strong><small>未設定なら、2つの部材を結びます</small></div>
        </div>
        <div className="panel-scroll"><JointPanel /></div>
      </aside>

      <main className="motion-check-viewport" aria-label="動作確認用3D表示">
        {children}
        <div className="motion-check-guide" aria-hidden>
          <MousePointer2 size={14} /> 3D表示をドラッグして見回せます
        </div>
      </main>

      <aside className="motion-check-right" aria-label="動作確認の操作">
        <div className="motion-panel-intro">
          <span className="step-number">2</span>
          <div><strong>実際に動かして確認</strong><small>スライダーまたは開閉ボタンで操作します</small></div>
        </div>
        <div className="panel-scroll">
          {selectedJointId ? <MotionSection /> : (
            <div className="motion-empty-state">
              <ScanSearch size={30} aria-hidden />
              <h2>確認する場所を選んでください</h2>
              <p>左の一覧から動かす場所を選ぶと、ここに操作ボタンが表示されます。</p>
              {project.joints.length === 0 ? <p className="notice notice-ok"><CircleCheck size={14} />まず左から設定を追加しましょう</p> : null}
            </div>
          )}
        </div>
      </aside>
      <ToastHost />
    </div>
  );
}
