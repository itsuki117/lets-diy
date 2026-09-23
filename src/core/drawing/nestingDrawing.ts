import type { NestingResult } from '../nesting/nestParts';

const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

export function nestingDrawingSvg(result: NestingResult): string {
  const gap = 80;
  const scale = Math.min(1, 800 / Math.max(1, ...result.sheets.map((item) => item.sheet.width)));
  const widths = result.sheets.map((item) => item.sheet.width * scale);
  const heights = result.sheets.map((item) => item.sheet.height * scale);
  const width = Math.max(320, ...widths) + 60;
  const height = heights.reduce((sum, value) => sum + value + gap, 40) + 30;
  let yOffset = 30;
  const body: string[] = [];
  result.sheets.forEach((nested, index) => {
    const w = widths[index]!;
    const h = heights[index]!;
    body.push(`<text x="30" y="${yOffset - 8}" font-size="12">${esc(nested.sheet.label)} t${nested.sheet.thickness} — ${nested.index}枚目 / 歩留まり ${(nested.usage * 100).toFixed(1)}%</text>`);
    body.push(`<rect x="30" y="${yOffset}" width="${w}" height="${h}" fill="none" stroke="#000"/>`);
    for (const piece of nested.pieces) {
      const x = 30 + piece.x * scale;
      const y = yOffset + h - (piece.y + piece.height) * scale;
      body.push(`<rect x="${x}" y="${y}" width="${piece.width * scale}" height="${piece.height * scale}" fill="none" stroke="#000"/>`);
      body.push(`<text x="${x + 4}" y="${y + 14}" font-size="11">${esc(piece.label)} ×${piece.partIds.length}</text>`);
      body.push(`<text x="${x + 4}" y="${y + 28}" font-size="10">${piece.width} × ${piece.height} mm${piece.rotated ? '（90°）' : ''}</text>`);
    }
    yOffset += h + gap;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><style>text{font-family:sans-serif;fill:#000}</style>${body.join('')}</svg>`;
}
