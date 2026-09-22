import { BvhCsgEngine } from './BvhCsgEngine';
import type { CsgEngine } from './CsgEngine';

let engine: CsgEngine | null = null;

export function getCsgEngine(): CsgEngine {
  engine ??= new BvhCsgEngine();
  return engine;
}

/** テストから差し替えるための入口 */
export function setCsgEngine(next: CsgEngine | null): void {
  engine = next;
}

export type { CsgEngine };
