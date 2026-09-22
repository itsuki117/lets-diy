import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { toDocument } from '../../core/project/serialize';
import { KEYS, LocalStorageRepository } from '../LocalStorageRepository';

const repo = new LocalStorageRepository();
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('named project repository', () => {
  it('saves, lists, updates, loads and removes without duplicate slots', async () => {
    const doc = toDocument(createProject());
    await repo.save(doc);
    await repo.save({ ...doc, project: { ...doc.project, name: '棚' } });
    expect(await repo.list()).toMatchObject([{ name: '棚', partCount: 0 }]);
    expect((await repo.load(doc.project.id)).project.name).toBe('棚');
    await repo.remove(doc.project.id);
    expect(await repo.list()).toEqual([]);
    await expect(repo.load(doc.project.id)).rejects.toThrow();
  });
  it('concurrent saves retain both index entries', async () => {
    await Promise.all([repo.save(toDocument(createProject())), repo.save(toDocument(createProject()))]);
    expect(await repo.list()).toHaveLength(2);
  });
  it('refuses to overwrite a corrupt index', async () => {
    localStorage.setItem(KEYS.index, '{}');
    await expect(repo.list()).rejects.toThrow('保存一覧が壊れ');
    await expect(repo.save(toDocument(createProject()))).rejects.toThrow();
    expect(localStorage.getItem(KEYS.index)).toBe('{}');
  });
  it('validates saved documents on load', async () => {
    localStorage.setItem(KEYS.project('bad'), '{"project":{}}');
    await expect(repo.load('bad')).rejects.toThrow();
  });
  it('rolls back the document if the index write hits quota', async () => {
    const doc = toDocument(createProject());
    await repo.save(doc);
    const old = localStorage.getItem(KEYS.project(doc.project.id));
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === KEYS.index) throw new DOMException('full', 'QuotaExceededError');
      write.call(this, key, value);
    });
    await expect(repo.save({ ...doc, project: { ...doc.project, name: 'new' } })).rejects.toThrow('保存できません');
    expect(localStorage.getItem(KEYS.project(doc.project.id))).toBe(old);
  });
});
