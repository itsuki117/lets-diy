import type { ProjectDocument, ProjectId } from '../core/types';

export interface ProjectSummary {
  id: ProjectId;
  name: string;
  savedAt: string;
  partCount: number;
}

/**
 * 保存先の抽象。Ver.1 は localStorage だけだが、
 * Ver.2 で HttpProjectRepository に差し替えられるよう UI はこの型にだけ依存する。
 */
export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  load(id: ProjectId): Promise<ProjectDocument>;
  save(doc: ProjectDocument): Promise<void>;
  remove(id: ProjectId): Promise<void>;
}
