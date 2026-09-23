import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

/** 「次に何をすればいいか」を常に 1 行で示す。Blender 化しないための中核。 */
function useHint(): string {
  const mode = useEditorStore((s) => s.mode);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const faceSnap = useEditorStore((s) => s.faceSnap);
  const draft = useEditorStore((s) => s.operationDraft);
  const override = useEditorStore((s) => s.hintOverride);
  const partCount = useProjectStore((s) => s.project.parts.length);
  const jointDraft = useEditorStore((s) => s.jointDraft);
  const jointCount = useProjectStore((s) => s.project.joints.length);

  if (override) return override;
  if (faceSnap && !faceSnap.source) return '動かす部材の面をクリックしてください';
  if (faceSnap && !faceSnap.target) return '接触させる相手の面をクリックしてください';
  if (faceSnap) return '隙間を確認して［適用］を押してください';
  if (jointDraft && !jointDraft.basePartId) return '固定側の部材をクリックしてください';
  if (jointDraft && !jointDraft.movingPartId) return '動く側の部材をクリックしてください';
  if (partCount === 0) return '左の［生成］から木材を作りましょう';
  if (mode === 'create') return '寸法を入力して［木材を生成する］を押してください';
  if (mode === 'arrange' && selectedIds.length === 0) return '部材をクリックするか、左の一覧から選んでください';
  if (mode === 'arrange') return '右のパネルで数値を入力するか、ギズモをドラッグして動かします';
  if (mode === 'machine' && selectedIds.length !== 1) return '加工する部材を 1 つ選んでください';
  if (draft) return '矢印のドラッグ・微調整ボタン・座標入力の 3 つで位置を決められます';
  if (mode === 'motion' && jointCount === 0) return '［可動を追加］から、扉や引き出しの動きを作れます';
  if (mode === 'motion') return '一覧から可動を選ぶと、右のスライダーで動かせます';
  return '加工の種類を選んでください';
}

export function HintBar() {
  const hint = useHint();
  return <div className="hint-bar">{hint}</div>;
}
