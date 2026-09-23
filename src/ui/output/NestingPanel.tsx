import { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import { nestingDrawingSvg } from '../../core/drawing/nestingDrawing';
import { nestParts } from '../../core/nesting/nestParts';
import { stockSheetsForThickness } from '../../core/nesting/stockSheets';
import { downloadText } from '../../io/fileDownload';
import { useProjectStore } from '../../store/useProjectStore';

export function NestingPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((state) => state.project);
  const result = useMemo(() => {
    const thicknesses = [...new Set(project.parts.map((part) => [part.size.x, part.size.y, part.size.z].sort((a, b) => a - b)[0]!))];
    return nestParts(project.parts, thicknesses.flatMap(stockSheetsForThickness));
  }, [project]);
  return <div className="overlay-panel" role="dialog" aria-label="木取り図"><div className="overlay-head"><strong>木取り図</strong><span className="muted">{result.sheets.length} 枚 / 未配置 {result.unplaced.length}</span><button type="button" onClick={() => downloadText(nestingDrawingSvg(result), `${project.name}_木取り図.svg`, 'image/svg+xml')}><Download size={15}/>SVG 書き出し</button><button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}><X size={16}/></button></div><div className="overlay-body">
    <p className="notice">棚積み法による概算です。木目方向は考慮していません。鋸刃幅は 3mm です。</p>
    {result.sheets.map((sheet) => <section key={`${sheet.sheet.id}-${sheet.sheet.thickness}-${sheet.index}`}><h3 className="overlay-subhead">{sheet.sheet.label} t{sheet.sheet.thickness} — {sheet.index}枚目（歩留まり {(sheet.usage * 100).toFixed(1)}%）</h3><table className="data-table"><tbody>{sheet.pieces.map((piece, index) => <tr key={`${piece.label}-${index}`}><td>{piece.label} ×{piece.partIds.length}</td><td className="num">{piece.width} × {piece.height}</td><td>{piece.rotated ? '90度回転' : '-'}</td></tr>)}</tbody></table></section>)}
    {result.unplaced.map((item) => <p className="notice notice-warning" key={item.partIds.join(',')}>{item.label}: {item.reason}</p>)}
  </div></div>;
}
