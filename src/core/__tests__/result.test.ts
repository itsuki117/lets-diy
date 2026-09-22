import { expect, it } from 'vitest';
import { AppError } from '../result';
it('preserves code, Japanese message and technical detail', () => {
  const error = new AppError('INVALID_INPUT', '寸法を確認してください', { size: -1 });
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe('INVALID_INPUT');
  expect(error.message).toBe('寸法を確認してください');
  expect(error.detail).toEqual({ size: -1 });
});
