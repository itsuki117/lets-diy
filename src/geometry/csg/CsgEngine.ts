import type { BufferGeometry } from 'three';

export interface CsgEngine {
  /**
   * base から tool を減算した新しいジオメトリを返す。
   * 引数のジオメトリは変更しない（dispose 責任は呼び出し側）。
   * Promise なのは Ver.2 で Worker 実装に差し替えるため。
   */
  subtract(base: BufferGeometry, tool: BufferGeometry): Promise<BufferGeometry>;
  dispose(): void;
}
