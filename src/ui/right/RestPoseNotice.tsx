import { DoorClosed, TriangleAlert } from 'lucide-react';
import { canEditRestPose, isDrivenPart } from '../../core/motion/kinematics';
import { isMovableJoint, jointUnit } from '../../core/types';
import type { PartId } from '../../core/types';
import { setJointValue } from '../../store/commands/jointCommands';
import { useProjectStore } from '../../store/useProjectStore';

/**
 * 開いたままの可動部材は、位置・回転（rest pose）を編集できない。
 * その理由と、閉じるためのボタンを出す（設計書 DESIGN_V2 §7.5）。
 */
export function RestPoseNotice({ partId }: { partId: PartId }) {
  const joints = useProjectStore((s) => s.project.joints);
  if (canEditRestPose(joints, partId)) return null;

  const joint = isDrivenPart(joints, partId);
  if (!joint || !isMovableJoint(joint)) return null;
  const unit = jointUnit(joint.kind) === 'deg' ? '°' : 'mm';

  return (
    <div className="section">
      <div className="section-body">
        <p className="notice notice-warning">
          <TriangleAlert size={14} aria-hidden />
          {joint.name} が {Math.round(joint.value * 10) / 10}
          {unit} 動いています。位置と回転は閉じた状態でしか変えられません。
        </p>
        <button type="button" onClick={() => setJointValue(joint.id, joint.range.min, '閉じる')}>
          <DoorClosed size={15} aria-hidden />
          閉じて編集できるようにする
        </button>
      </div>
    </div>
  );
}
