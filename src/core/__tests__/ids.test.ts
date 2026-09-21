import { expect, it } from 'vitest';
import { createPartId, createOperationId, createProjectId } from '../ids';
it('generates prefixed, unique identifiers', () => {
  expect(createPartId()).toMatch(/^part-[\da-f]{8}$/);
  expect(createOperationId()).toMatch(/^op-[\da-f]{8}$/);
  expect(createProjectId()).toMatch(/^prj-[\da-f]{8}$/);
  expect(new Set(Array.from({ length: 1000 }, createPartId)).size).toBe(1000);
});
