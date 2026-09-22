import type { BufferGeometry } from 'three';
import { hashPartShape } from '../core/part/partHash';
import type { GeometryBuildWarning, OperationId, Part, PartId } from '../core/types';
import { createEdgesGeometry } from './edgesGeometry';
import { buildPartGeometry } from './geometryBuilder';
import { createBoxGeometry } from './boxGeometry';

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
export class GeometryCache {
  private entries = new Map<PartId, CacheEntry>();
  private pending = new Map<PartId, { hash: string }>();
  private listeners = new Set<Listener>();

  constructor(private build = buildPartGeometry) {}

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
    if (this.entries.get(part.id)?.hash === hash) {
      if (this.pending.delete(part.id)) this.emit(part.id);
      return;
    }
    if (this.pending.get(part.id)?.hash === hash) return;

    // Request identity cannot be reused after delete and undo with the same part ID.
    const request = { hash };
    this.pending.set(part.id, request);
    this.emit(part.id);

    void this.build(part).catch((error: unknown) => {
      console.error('[geometry] build failed', error);
      return {
        geometry: createBoxGeometry(part.size),
        failedOperationIds: part.operations.filter((op) => op.enabled).map((op) => op.id),
        warnings: part.operations.filter((op) => op.enabled).map((op) => ({
          operationId: op.id, message: '形状を構築できませんでした。加工パラメータを確認してください',
        })),
        durationMs: 0,
      };
    }).then((result) => {
      // 構築中にパラメータが変わっていたら、古い結果は捨てる
      if (this.pending.get(part.id) !== request) {
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
    this.emit(partId);
  }

  /** project.parts に存在しない部材のジオメトリを解放する */
  syncWith(parts: readonly Part[]): void {
    const alive = new Set(parts.map((p) => p.id));
    for (const id of new Set([...this.entries.keys(), ...this.pending.keys()])) {
      if (!alive.has(id)) this.release(id);
    }
  }

  clear(): void {
    for (const id of new Set([...this.entries.keys(), ...this.pending.keys()])) this.release(id);
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
