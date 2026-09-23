import { createOperationId } from '../ids';
import { applyMat3, localToWorldDir, localToWorldPoint, rotationMatrix, transpose, worldToLocalPoint } from '../math/matrix';
import { add } from '../math/vec3';
import type { AxisDirection, Hardware, Operation, Part, Vec3 } from '../types';

const axisDirection = (v: Vec3): AxisDirection => {
  const [x, y, z] = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
  const axis = x >= y && x >= z ? 'x' : y >= z ? 'y' : 'z';
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  return `${v[index] >= 0 ? '+' : '-'}${axis}` as AxisDirection;
};

export function hardwareOperations(
  hardware: Hardware,
  basePart: Part,
  movingPart: Part,
): { base: Operation[]; moving: Operation[] } {
  const rotation = rotationMatrix(hardware.rotation);
  const baseDirection = applyMat3(rotation, [0, 0, -1]);
  const movingDirection = applyMat3(transpose(rotationMatrix(movingPart.transform.rotation)), localToWorldDir(basePart.transform, baseDirection));
  const result: { base: Operation[]; moving: Operation[] } = { base: [], moving: [] };
  for (const hole of hardware.preset.holes) {
    const basePosition = add(hardware.position, applyMat3(rotation, hole.offset));
    const position = hole.target === 'base' ? basePosition : worldToLocalPoint(movingPart.transform, localToWorldPoint(basePart.transform, basePosition));
    const direction = axisDirection(hole.target === 'base' ? baseDirection : movingDirection);
    const common = { id: createOperationId(), enabled: true, depth: hole.depth, through: hole.through, position, direction, note: hardware.id };
    const operation: Operation = hole.shape === 'round'
      ? { ...common, type: 'roundHole', diameter: hole.width }
      : { ...common, type: 'rectHole', width: hole.width, height: hole.height ?? hole.width, rotation: hardware.rotation[2] };
    result[hole.target].push(operation);
  }
  return result;
}
