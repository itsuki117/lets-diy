import { createGasSpringId, createHardwareId } from '../../core/ids';
import { hardwareOperations } from '../../core/hardware/hardwareOperations';
import { defaultJoint } from '../../core/motion/jointDefaults';
import { canAddJoint } from '../../core/motion/jointValidate';
import type { Hardware, HardwareId, HardwarePreset, PartId, Vec3 } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

export interface AddHardwareInput {
  preset: HardwarePreset;
  basePartId: PartId;
  movingPartId: PartId;
  position: Vec3;
  rotation?: Vec3;
  quantity?: number;
  autoHoles?: boolean;
}

export function addHardware(input: AddHardwareInput): HardwareId | null {
  const state = useProjectStore.getState();
  const base = state.project.parts.find((part) => part.id === input.basePartId);
  const moving = state.project.parts.find((part) => part.id === input.movingPartId);
  if (!base || !moving || base.id === moving.id) {
    useEditorStore.getState().pushToast('error', '金物を取り付ける部材が見つかりません');
    return null;
  }

  const existingGasJoint = input.preset.kind === 'gasSpring'
    ? state.project.joints.find((item) => item.kind === 'revolute' && item.basePartId === base.id && item.movingPartId === moving.id)
    : undefined;
  if (input.preset.kind === 'gasSpring' && !existingGasJoint) {
    useEditorStore.getState().pushToast('warning', '先に固定側と動く側へヒンジを追加してください');
    return null;
  }
  const joint = input.preset.kind === 'gasSpring' ? null : defaultJoint(input.preset.jointKind, base, moving);
  if (joint && input.preset.defaultRange && joint.kind !== 'fixed') joint.range = { ...input.preset.defaultRange };
  if (joint) {
    const check = canAddJoint(state.project.joints, joint, state.project.parts);
    if (!check.ok) {
      useEditorStore.getState().pushToast('warning', check.reason ?? 'この金物は取り付けられません');
      return null;
    }
  }

  const hardware: Hardware = {
    id: createHardwareId(), preset: input.preset, jointId: joint?.id ?? null,
    position: input.position, rotation: input.rotation ?? [0, 0, 0], quantity: Math.max(1, Math.floor(input.quantity ?? 1)),
  };
  if (existingGasJoint) hardware.jointId = existingGasJoint.id;
  const operations = input.autoHoles === false ? { base: [], moving: [] } : hardwareOperations(hardware, base, moving);
  state.applyCommand(`${input.preset.label}を取り付け`, (draft) => {
    if (joint) draft.joints.push(joint);
    draft.hardware.push(hardware);
    if (existingGasJoint && input.preset.gasSpring) draft.gasSprings.push({
      id: createGasSpringId(), hardwareId: hardware.id, jointId: existingGasJoint.id,
      baseAnchor: input.position, movingAnchor: [input.position[0] + 150, input.position[1], input.position[2]],
      ...input.preset.gasSpring,
    });
    draft.parts.find((part) => part.id === base.id)?.operations.push(...operations.base);
    draft.parts.find((part) => part.id === moving.id)?.operations.push(...operations.moving);
  });
  if (joint ?? existingGasJoint) useEditorStore.getState().selectJoint((joint ?? existingGasJoint)!.id);
  return hardware.id;
}

export function removeHardware(hardwareId: HardwareId): void {
  const hardware = useProjectStore.getState().project.hardware.find((item) => item.id === hardwareId);
  if (!hardware) return;
  useProjectStore.getState().applyCommand('金物を削除', (draft) => {
    draft.hardware = draft.hardware.filter((item) => item.id !== hardwareId);
    if (hardware.jointId && hardware.preset.kind !== 'gasSpring') draft.joints = draft.joints.filter((joint) => joint.id !== hardware.jointId);
    draft.gasSprings = draft.gasSprings.filter((spring) => spring.hardwareId !== hardwareId);
    for (const part of draft.parts) part.operations = part.operations.filter((operation) => operation.note !== hardwareId);
  });
}

export function moveHardware(hardwareId: HardwareId, position: Vec3, rotation?: Vec3): void {
  const project = useProjectStore.getState().project;
  const hardware = project.hardware.find((item) => item.id === hardwareId);
  const joint = hardware?.jointId ? project.joints.find((item) => item.id === hardware.jointId) : undefined;
  const base = joint ? project.parts.find((part) => part.id === joint.basePartId) : undefined;
  const moving = joint ? project.parts.find((part) => part.id === joint.movingPartId) : undefined;
  if (!hardware || !base || !moving) return;
  const moved: Hardware = { ...hardware, position, rotation: rotation ?? hardware.rotation };
  const hadAutoHoles = project.parts.some((part) => part.operations.some((operation) => operation.note === hardwareId));
  const operations = hadAutoHoles ? hardwareOperations(moved, base, moving) : { base: [], moving: [] };
  useProjectStore.getState().applyCommand('金物を移動', (draft) => {
    const target = draft.hardware.find((item) => item.id === hardwareId);
    if (target) { target.position = position; target.rotation = moved.rotation; }
    for (const part of draft.parts) part.operations = part.operations.filter((operation) => operation.note !== hardwareId);
    draft.parts.find((part) => part.id === base.id)?.operations.push(...operations.base);
    draft.parts.find((part) => part.id === moving.id)?.operations.push(...operations.moving);
  });
}
