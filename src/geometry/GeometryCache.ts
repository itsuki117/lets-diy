import type { BufferGeometry } from 'three';
import { hashPartShape } from '../core/part/partHash';
import type { GeometryBuildWarning, OperationId, Part, PartId } from '../core/types';
import { createEdgesGeometry } from './edgesGeometry';
import { buildPartGeometry } from './geometryBuilder';

interface CacheEntry {
  hash: string;
  geometry: BufferGeometry;
  edges: BufferGeometry | null;
  failedOperationIds: OperationId[];
  warnings: GeometryBuildWarning[];
  durationMs: number;
}

export interface PartGeometryStatus {
  building: boolean;
  failedOperationIds: OperationId[];
  warnings: GeometryBuildWarning[];
  durationMs: number;
}

const EMPTY_STATUS: PartGeometryStatus = { building: false, failedOperationIds: [], warnings: [], durationMs: 0 };

type Listener = (partId: PartId) => void;

/**
 * 形状ハッシュをキーにした部材ジオメトリのキャッシュ。
 * transform はハッシュに含まれないので、移動・回転では再構築が走らない。
 */
class GeometryCache {
  private entries = new Map<PartId, CacheEntry>();
  private pending = new Map<PartId, string>();
  private tokens = new Map<PartId, number>();
  private listeners = new Set<Listener>();

  /** 副作用なしの参照。構築中は直前のジオメトリ（なければ null）を返す。 */
  peek(partId: PartId): BufferGeometry | null {
    return this.entries.get(partId)?.geometry ?? null;
  }

  peekEdges(partId: PartId): BufferGeometry | null {
    const entry = this.entries.get(partId);
    if (!entry) return null;
    entry.edges ??= createEdgesGeometry(entry.geometry);
    return entry.edges;
  }

  status(partId: PartId): PartGeometryStatus {
    const entry = this.entries.get(partId);
    const building = this.pending.has(partId);
    if (!entry) return { ...EMPTY_STATUS, building };
    return {
      building,
      failedOperationIds: entry.failedOperationIds,
      warnings: entry.warnings,
      durationMs: entry.durationMs,
    };
  }

  /** 必要なら構築を開始する。ハッシュが一致していれば何もしない。 */
  ensure(part: Part): void {
    const hash = hashPartShape(part);
    if (this.entries.get(part.id)?.hash === hash) return;
    if (this.pending.get(part.id) === hash) return;

    this.pending.set(part.id, hash);
    const token = (this.tokens.get(part.id) ?? 0) + 1;
    this.tokens.set(part.id, token);

    void buildPartGeometry(part).then((result) => {
      // 構築中にパラメータが変わっていたら、古い結果は捨てる
      if (this.tokens.get(part.id) !== token) {
        result.geometry.dispose();
        return;
      }
      const prev = this.entries.get(part.id);
      prev?.geometry.dispose();
      prev?.edges?.dispose();
      this.entries.set(part.id, {
        hash,
        geometry: result.geometry,
        edges: null,
        failedOperationIds: result.failedOperationIds,
        warnings: result.warnings,
        durationMs: result.durationMs,
      });
      this.pending.delete(part.id);
      console.debug('[geometry] build', { partId: part.id, hash, durationMs: Math.round(result.durationMs) });
      this.emit(part.id);
    });
  }

  release(partId: PartId): void {
    const entry = this.entries.get(partId);
    entry?.geometry.dispose();
    entry?.edges?.dispose();
    this.entries.delete(partId);
    this.pending.delete(partId);
    this.tokens.delete(partId);
  }

  /** project.parts に存在しない部材のジオメトリを解放する */
  syncWith(parts: readonly Part[]): void {
    const alive = new Set(parts.map((p) => p.id));
    for (const id of [...this.entries.keys()]) {
      if (!alive.has(id)) this.release(id);
    }
  }

  clear(): void {
    for (const id of [...this.entries.keys()]) this.release(id);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(partId: PartId): void {
    for (const listener of this.listeners) listener(partId);
  }
}

export const geometryCache = new GeometryCache();
