import type { BufferGeometry } from 'three';
import { toolSolidSpec } from '../core/operation/toolSolid';
import type { GeometryBuildWarning, OperationId, Part } from '../core/types';
import { createBoxGeometry } from './boxGeometry';
import { createToolGeometry } from './toolGeometry';
import { getCsgEngine } from './csg';

export interface GeometryBuildResult {
  geometry: BufferGeometry;
  /** 形状に反映できなかった加工 */
  failedOperationIds: OperationId[];
  warnings: GeometryBuildWarning[];
  durationMs: number;
}

const isEmptyGeometry = (g: BufferGeometry): boolean => (g.getAttribute('position')?.count ?? 0) === 0;

/**
 * 1 部材 = 1 回の逐次減算。他の部材には一切触れない（設計書 §14.3）。
 */
export async function buildPartGeometry(part: Part): Promise<GeometryBuildResult> {
  const t0 = performance.now();
  const engine = getCsgEngine();
  const failedOperationIds: OperationId[] = [];
  const warnings: GeometryBuildWarning[] = [];

  let current = createBoxGeometry(part.size);

  for (const op of part.operations) {
    if (!op.enabled) continue;
    let tool: BufferGeometry | undefined;
    try {
      tool = createToolGeometry(toolSolidSpec(op, part.size));
      const next = await engine.subtract(current, tool);
      if (isEmptyGeometry(next)) {
        next.dispose();
        failedOperationIds.push(op.id);
        warnings.push({ operationId: op.id, message: '形状が消滅するため適用できません' });
        continue;
      }
      current.dispose();
      current = next;
    } catch (error) {
      failedOperationIds.push(op.id);
      warnings.push({ operationId: op.id, message: '加工の計算に失敗しました' });
      console.error('[csg] operation failed', { partId: part.id, operationId: op.id }, error);
    } finally {
      tool?.dispose();
    }
  }

  return { geometry: current, failedOperationIds, warnings, durationMs: performance.now() - t0 };
}
