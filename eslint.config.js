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

// 設計書 §3.8 規則 1: 画面に絵文字・幾何記号を出さない（アイコンは lucide-react のみ）
// 矢印(2190-21FF)・各種記号(2300-27BF)・幾何図形(25A0-25FF)・その他記号(2B00-2BFF)・
// 異体字セレクタ(FE0F)・絵文字の上位サロゲート(D83C-D83E) を拒否する。
const GLYPHS = '[\u2190-\u2BFF\uFE0F\uD83C-\uD83E]';
const noGlyphs = {
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['**/__tests__/**'],
  rules: {
    'no-restricted-syntax': ['error',
      { selector: `JSXText[value=/${GLYPHS}/]`, message: '設計書 §3.8: 画面に絵文字・幾何記号を出さないでください。lucide-react のアイコンを使ってください。' },
      { selector: `Literal[value=/${GLYPHS}/]`, message: '設計書 §3.8: 画面に絵文字・幾何記号を出さないでください。lucide-react のアイコンを使ってください。' },
      { selector: `TemplateElement[value.cooked=/${GLYPHS}/]`, message: '設計書 §3.8: 画面に絵文字・幾何記号を出さないでください。lucide-react のアイコンを使ってください。' },
    ],
  },
};

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
  noGlyphs,
  { files: ['src/geometry/**/*.ts'], ignores: ['src/geometry/csg/BvhCsgEngine.ts', '**/__tests__/**'], rules: { 'no-restricted-imports': ['error', { patterns: [...restricted(['store', 'viewport', 'ui', 'io']), 'react', 'react/*', '@react-three/*', 'zustand', 'zustand/*', 'three-bvh-csg'] }] } },
);
