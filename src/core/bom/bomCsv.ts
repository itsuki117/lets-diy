import type { Bom } from './buildBom';

/** CSV のセルを安全にする（カンマ・引用符・改行を含む値を引用する） */
const cell = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * 部品表を CSV にする。ホームセンターへ持っていく想定なので、
 * 1 行目に人が読める見出しを置き、寸法は mm のまま出す。
 * Excel が UTF-8 と判断できるよう BOM を付ける。
 */
export function bomToCsv(bom: Bom, projectName: string): string {
  const lines: string[] = [];
  lines.push(['プロジェクト', projectName].map(cell).join(','));
  lines.push('');
  lines.push(['No', '材質', '長さ(mm)', '幅(mm)', '厚み(mm)', '数量', '加工', '名前'].map(cell).join(','));

  bom.rows.forEach((row, index) => {
    const operations = row.operations.map((o) => `${o.label}x${o.count}`).join(' ');
    lines.push(
      [
        index + 1,
        row.materialLabel,
        row.lumber.length,
        row.lumber.width,
        row.lumber.thickness,
        row.quantity,
        operations || 'なし',
        row.names.join(' / '),
      ]
        .map(cell)
        .join(','),
    );
  });

  lines.push('');
  lines.push(['材料集計'].map(cell).join(','));
  lines.push(['材質', '厚み(mm)', '枚数', '面積(m2)'].map(cell).join(','));
  for (const material of bom.materials) {
    lines.push([material.materialLabel, material.thickness, material.quantity, material.areaM2].map(cell).join(','));
  }

  lines.push('');
  lines.push(['合計部材数', bom.totalParts].map(cell).join(','));
  lines.push(['合計面積(m2)', bom.totalAreaM2].map(cell).join(','));

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
