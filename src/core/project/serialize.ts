import { motionJoints, rebuildBracketJoints } from '../hardware/brackets';
import { AppError, type Result } from '../result';
import { SCHEMA_VERSION, type Project, type ProjectDocument } from '../types';
import { migrate } from './migrate';
import { projectDocumentSchema } from './projectSchema';

export function toDocument(project: Project): ProjectDocument {
  return {
    app: 'lets-diy',
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    project,
  };
}

/** 検証と移行を通して Project を復元する。失敗理由はユーザーに見せられる日本語で返す。 */
export function fromDocument(raw: unknown): Result<Project> {
  try {
    const migrated = migrate(raw);
    const parsed = projectDocumentSchema.safeParse(migrated);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const where = first?.path.length ? `（${first.path.join('.')}）` : '';
      return {
        ok: false,
        error: new AppError('SCHEMA_INVALID', `ファイルの内容が設計データとして読めません${where}`, parsed.error.issues),
      };
    }
    const project = parsed.data.project as Project;
    // 設計データは「設計した状態」だけを持つ。動作確認で動かした量・ロックの状態は持たない（設計書 DESIGN_V2 §9.6）
    const hardware = project.hardware.map((item) => ({
      ...item,
      ...(item.preset.kind === 'bracket' ? { jointId: null } : {}),
      ...(item.latch ? { latch: { ...item.latch, engaged: false } } : {}),
    }));
    const joints = motionJoints(project.joints).map((joint) => ({ ...joint, value: 0 }));
    const gasSprings = project.gasSprings.map((mount) => ({ ...mount, locked: false }));
    const normalized: Project = { ...project, hardware, joints, gasSprings };
    return { ok: true, value: { ...normalized, joints: rebuildBracketJoints(normalized).joints } };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error };
    return { ok: false, error: new AppError('PARSE_FAILED', 'ファイルを読み込めませんでした', error) };
  }
}

export function parseProjectJson(text: string): Result<Project> {
  try {
    return fromDocument(JSON.parse(text));
  } catch (error) {
    return { ok: false, error: new AppError('PARSE_FAILED', 'ファイルが壊れています（JSON として読めません）', error) };
  }
}
