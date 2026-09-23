import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { partDrawingSvg } from '../../core/drawing/partDrawing';
import { downloadText } from '../../io/fileDownload';
import { useProjectStore } from '../../store/useProjectStore';

export function DrawingPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((state) => state.project);
  const [partId, setPartId] = useState(project.parts[0]?.id ?? '');
  const part = project.parts.find((item) => item.id === partId);
  const svg = part ? partDrawingSvg(part) : '';
  return <div className="overlay-panel" role="dialog" aria-label="加工図"><div className="overlay-head"><strong>加工図</strong><select aria-label="部材" value={partId} onChange={(event) => setPartId(event.target.value)}>{project.parts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={!part} onClick={() => part && downloadText(svg, `${part.name}_加工図.svg`, 'image/svg+xml')}><Download size={15}/>SVG 書き出し</button><button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}><X size={16}/></button></div><div className="overlay-body">{part ? <div className="drawing-preview" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="muted">部材がありません。</p>}</div></div>;
}
