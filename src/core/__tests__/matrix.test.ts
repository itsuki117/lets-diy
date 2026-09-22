import { describe, expect, it } from 'vitest';
import { applyMat3, matrixToEuler, rotationMatrix } from '../math/matrix';
import { localToWorldPoint, worldToLocalPoint } from '../math/matrix';
import type { Transform, Vec3 } from '../types';

const close = (a: Vec3, b: Vec3, digits = 6): void => {
  expect(a[0]).toBeCloseTo(b[0], digits);
  expect(a[1]).toBeCloseTo(b[1], digits);
  expect(a[2]).toBeCloseTo(b[2], digits);
};

describe('rotationMatrix', () => {
  it('Y 軸 90 度で +X が -Z に向く（three.js の XYZ と同じ）', () => {
    close(applyMat3(rotationMatrix([0, 90, 0]), [1, 0, 0]), [0, 0, -1]);
  });
  it('X 軸 90 度で +Y が +Z に向く', () => {
    close(applyMat3(rotationMatrix([90, 0, 0]), [0, 1, 0]), [0, 0, 1]);
  });
  it('Z 軸 90 度で +X が +Y に向く', () => {
    close(applyMat3(rotationMatrix([0, 0, 90]), [1, 0, 0]), [0, 1, 0]);
  });
});

describe('matrixToEuler', () => {
  it('rotationMatrix と往復する', () => {
    for (const rotation of [[0, 0, 0], [0, 90, 0], [30, 0, 0], [0, 0, 45], [15, 30, 45]] as Vec3[]) {
      const back = matrixToEuler(rotationMatrix(rotation));
      close(applyMat3(rotationMatrix(back), [1, 2, 3]), applyMat3(rotationMatrix(rotation), [1, 2, 3]), 5);
    }
  });
});

describe('localToWorldPoint / worldToLocalPoint', () => {
  it('回転と移動がある場合も往復で元に戻る', () => {
    const transform: Transform = { position: [120, -35, 480], rotation: [15, 30, 45] };
    const p: Vec3 = [10, 20, 30];
    close(worldToLocalPoint(transform, localToWorldPoint(transform, p)), p, 5);
  });

  it('Y 軸 90 度回転した部材のローカル +X はワールド -Z', () => {
    const transform: Transform = { position: [0, 0, 0], rotation: [0, 90, 0] };
    close(localToWorldPoint(transform, [100, 0, 0]), [0, 0, -100], 5);
  });
});
