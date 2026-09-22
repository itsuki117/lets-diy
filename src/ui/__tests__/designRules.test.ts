import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 設計書 §3.8 UI デザイン規則の自動チェック。
 * ESLint では CSS を見られないので、ここでソース全体を走査する。
 */
const SRC = join(process.cwd(), 'src');

// 矢印・記号・幾何図形(2190-2BFF)、絵文字(1F000-1FAFF)、異体字セレクタ(FE0F)。
// FE0F は結合文字なので、同じ文字クラスに混ぜると
// no-misleading-character-class に引っかかる。正規表現を分けておく。
const FORBIDDEN_SYMBOLS = /[←-⯿]/u;
const FORBIDDEN_EMOJI = /[\u{1F000}-\u{1FAFF}]/u;
const VARIATION_SELECTOR = /️/u;

const hasForbidden = (line: string): boolean =>
  FORBIDDEN_SYMBOLS.test(line) || FORBIDDEN_EMOJI.test(line) || VARIATION_SELECTOR.test(line);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(entry) ? [full] : [];
  });
}

const files = walk(SRC).filter((f) => !f.includes('__tests__'));

describe('UI デザイン規則', () => {
  it('ソースを 1 つ以上走査している', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('絵文字・幾何記号を画面に出していない（アイコンは lucide-react のみ）', () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (hasForbidden(line)) offenders.push(`${file.replace(SRC, 'src')}:${index + 1}  ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('色付き border-left のアクセントカードを作っていない', () => {
    const css = readFileSync(join(SRC, 'styles', 'index.css'), 'utf8');
    const offenders = css
      .split('\n')
      .filter((line) => /border-left:/.test(line))
      .filter((line) => !/var\(--border\)/.test(line));
    expect(offenders).toEqual([]);
  });

  it('box-shadow を使っていない（境界は 1px ボーダーで表現する）', () => {
    const css = readFileSync(join(SRC, 'styles', 'index.css'), 'utf8');
    expect(css).not.toMatch(/^\s*box-shadow:/m);
  });

  it('アイコンは lucide-react からのみ import している', () => {
    const offenders = files.filter((file) =>
      /from '(react-icons|@heroicons|@mui\/icons)/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
