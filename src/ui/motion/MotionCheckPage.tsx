import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, Link, MousePointer2, MoveHorizontal, Play, RotateCw, ScanSearch, Wrench } from 'lucide-react';
import { isMovableJoint, type Joint, type Project } from '../../core/types';
import { useEditorStore } from '../../store/useEditorStore';
import { useMotionPlayer } from '../../store/useMotionPlayer';
import { useWorkingProject } from '../../store/useSimulationStore';
import { ToastHost } from '../common/ToastHost';
import { MotionSection } from '../right/MotionSection';

const ICONS = { revolute: RotateCw, prismatic: MoveHorizontal, fixed: Link } as const;

/** 可動部の説明。動きは取り付けた金物で決まる */
function describe(project: Project, joint: Joint): { title: string; detail: string } {
  const name = (id: string): string => project.parts.find((part) => part.id === id)?.name ?? '?';
  const hardware = project.hardware.filter((item) => item.jointId === joint.id);
  const detail = hardware.length > 0
    ? hardware.map((item) => `${item.preset.label} ×${item.quantity}`).join(' / ')
    : '金物なし（手動で設定した動き）';
  const title = `${name(joint.movingPartId)}（${name(joint.basePartId)}に取付）`;
  return { title, detail };
}

export function MotionCheckPage({ children }: { children: ReactNode }) {
  const project = useWorkingProject();
  const selectedJointId = useEditorStore((state) => state.selectedJointId);
  const selectJoint = useEditorStore((state) => state.selectJoint);
  const setWorkspace = useEditorStore((state) => state.setWorkspace);
  const setMode = useEditorStore((state) => state.setMode);
  const setCreateCategory = useEditorStore((state) => state.setCreateCategory);
  const settle = useMotionPlayer((state) => state.settle);

  const movable = project.joints.filter(isMovableJoint);

  useEffect(() => {
    if (!movable.some((joint) => joint.id === selectedJointId) && movable[0]) selectJoint(movable[0].id);
  }, [movable, selectJoint, selectedJointId]);

  // ページを離れるときは、動いている途中でも今の位置で確定する
  useEffect(() => () => settle(), [settle]);

  const goToHardware = (): void => {
    setWorkspace('edit');
    setMode('create');
    setCreateCategory('hardware');
  };

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
        <p>取り付けた金物のとおりに動かして、止まる位置やぶつかりを確かめます</p>
      </header>

      <aside className="motion-check-left" aria-label="動く場所">
        <div className="motion-panel-intro">
          <span className="step-number">1</span>
          <div><strong>動く場所を選ぶ</strong><small>金物を付けた場所が自動で並びます</small></div>
        </div>
        <div className="panel-scroll">
          <div className="panel-content">
            {movable.length === 0 ? (
              <div className="motion-empty-state">
                <Wrench size={28} aria-hidden />
                <h2>動く場所がありません</h2>
                <p>丁番・スライドレール・ガススプリングを取り付けると、ここに表示されます。</p>
                <button type="button" onClick={goToHardware}><Wrench size={14} aria-hidden />金物を取り付ける</button>
              </div>
            ) : (
              <div className="mechanism-rows">
                {movable.map((joint) => {
                  const Icon = ICONS[joint.kind];
                  const { title, detail } = describe(project, joint);
                  return (
                    <button
                      key={joint.id}
                      type="button"
                      className={`mechanism-row ${joint.id === selectedJointId ? 'op-row-active' : ''}`}
                      onClick={() => { settle(); selectJoint(joint.id); }}
                    >
                      <Icon size={16} aria-hidden />
                      <span>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
          <div><strong>手で動かして、離してみる</strong><small>スライダーが手です。離すと重力とガス圧で動きます</small></div>
        </div>
        <div className="panel-scroll">
          {selectedJointId && movable.some((joint) => joint.id === selectedJointId) ? <MotionSection /> : (
            <div className="motion-empty-state">
              <ScanSearch size={30} aria-hidden />
              <h2>確認する場所を選んでください</h2>
            </div>
          )}
        </div>
      </aside>
      <ToastHost />
    </div>
  );
}
