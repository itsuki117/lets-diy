import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry } from 'three';
import { createPart } from '../../core/part/createPart';
import { GeometryCache } from '../GeometryCache';
import type { GeometryBuildResult } from '../geometryBuilder';

const result = (): GeometryBuildResult => ({ geometry: new BoxGeometry(), failedOperationIds: [], warnings: [], durationMs: 1 });
function harness() {
  const pending: Array<(value: GeometryBuildResult) => void> = [];
  const build = vi.fn(() => new Promise<GeometryBuildResult>((resolve) => pending.push(resolve)));
  const cache = new GeometryCache(build);
  const finish = async (index: number, value = result()) => {
    pending[index]!(value);
    await Promise.resolve();
    await Promise.resolve();
    return value;
  };
  return { cache, build, finish };
}

describe('GeometryCache request lifetime', () => {
  it('discards a pending edit when undo returns to the cached shape', async () => {
    const { cache, finish } = harness();
    const part = createPart({});
    cache.ensure(part);
    const original = await finish(0);
    cache.ensure({ ...part, size: { ...part.size, x: 123 } });
    cache.ensure(part);
    const stale = result();
    const dispose = vi.spyOn(stale.geometry, 'dispose');
    await finish(1, stale);
    expect(cache.peek(part.id)).toBe(original.geometry);
    expect(cache.status(part.id).building).toBe(false);
    expect(dispose).toHaveBeenCalledOnce();
    cache.clear();
  });

  it('does not accept old results after delete and undo reuse the ID', async () => {
    const { cache, finish } = harness();
    const part = createPart({});
    cache.ensure(part);
    cache.release(part.id);
    cache.ensure(part);
    await finish(0);
    expect(cache.peek(part.id)).toBeNull();
    const current = await finish(1);
    expect(cache.peek(part.id)).toBe(current.geometry);
    cache.clear();
  });

  it.each(['clear', 'sync'] as const)('%s cancels builds with no completed entry', async (action) => {
    const { cache, finish } = harness();
    const part = createPart({});
    cache.ensure(part);
    if (action === 'clear') cache.clear(); else cache.syncWith([]);
    const discarded = result();
    const dispose = vi.spyOn(discarded.geometry, 'dispose');
    await finish(0, discarded);
    expect(cache.peek(part.id)).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('does not rebuild for transforms and deduplicates the same pending shape', async () => {
    const { cache, build, finish } = harness();
    const part = createPart({});
    cache.ensure(part);
    cache.ensure(part);
    await finish(0);
    cache.ensure({ ...part, transform: { ...part.transform, position: [100, 0, 0] } });
    expect(build).toHaveBeenCalledOnce();
    cache.clear();
  });

  it('recovers from a rejected build instead of staying pending forever', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cache = new GeometryCache(() => Promise.reject(new Error('worker failed')));
    const part = createPart({});
    cache.ensure(part);
    await Promise.resolve();
    await Promise.resolve();
    expect(cache.status(part.id).building).toBe(false);
    expect(cache.peek(part.id)).not.toBeNull();
    cache.clear();
    log.mockRestore();
  });
});
