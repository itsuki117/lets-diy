import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const layers = ['core', 'geometry', 'store', 'viewport', 'ui', 'io'];
const restricted = (names) => names.flatMap((name) => [name, `${name}/*`, `**/${name}`, `**/${name}/**`]);
const layer = (name, allowed, packages) => ({
  files: [`src/${name}/**/*.{ts,tsx}`],
  ignores: ['**/__tests__/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: [...restricted(layers.filter((x) => x !== name && !allowed.includes(x))), ...packages], message: '設計書 §5.1 のレイヤ依存ルールに違反しています。' }] }] },
});
export default tseslint.config(
  { ignores: ['dist', 'coverage', '.claude', 'node_modules', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } }, plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
  layer('core', [], ['react', 'react/*', 'three', 'three/*', '@react-three/*', 'zustand', 'zustand/*', 'three-bvh-csg']),
  layer('geometry', ['core'], ['react', 'react/*', '@react-three/*', 'zustand', 'zustand/*']),
  layer('store', ['core', 'io'], ['react', 'react/*', 'three', 'three/*', '@react-three/*', 'three-bvh-csg']),
  layer('ui', ['core', 'store', 'io'], ['three', 'three/*', '@react-three/*', 'three-bvh-csg']),
  layer('io', ['core'], ['react', 'react/*', 'three', 'three/*', '@react-three/*', 'zustand', 'zustand/*', 'three-bvh-csg']),
  { files: ['src/geometry/**/*.ts'], ignores: ['src/geometry/csg/BvhCsgEngine.ts', '**/__tests__/**'], rules: { 'no-restricted-imports': ['error', { patterns: [...restricted(['store', 'viewport', 'ui', 'io']), 'react', 'react/*', '@react-three/*', 'zustand', 'zustand/*', 'three-bvh-csg'] }] } },
);
