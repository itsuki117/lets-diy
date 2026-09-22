import { createProjectId } from '../ids';
import type { Project } from '../types';

export function createProject(name = '無題のプロジェクト'): Project {
  const now = new Date().toISOString();
  return { id: createProjectId(), name, unit: 'mm', parts: [], createdAt: now, updatedAt: now };
}
