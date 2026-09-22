export type AppErrorCode =
  | 'INVALID_INPUT' | 'PART_NOT_FOUND' | 'PART_LOCKED'
  | 'CSG_FAILED' | 'GEOMETRY_EMPTY'
  | 'PARSE_FAILED' | 'SCHEMA_INVALID' | 'UNSUPPORTED_VERSION' | 'MIGRATION_MISSING'
  | 'STORAGE_QUOTA' | 'STORAGE_UNAVAILABLE';

export class AppError extends Error {
  constructor(readonly code: AppErrorCode, message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
