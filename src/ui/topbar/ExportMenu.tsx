import { useState } from 'react';
import { ChevronDown, LayoutGrid, Ruler, Share2 } from 'lucide-react';
import { DrawingPanel } from '../output/DrawingPanel';
import { NestingPanel } from '../output/NestingPanel';

export function ExportMenu({ onExportStl }: { onExportStl: (selectedOnly: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<'nesting' | 'drawing' | null>(null);
  const exportParts = (selectedOnly: boolean) => { onExportStl(selectedOnly); setOpen(false); };
  return <div className="export-menu-wrap"><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Share2 size={15}/>出力<ChevronDown size={13}/></button>{open ? <div className="export-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setPanel('nesting'); setOpen(false); }}><LayoutGrid size={15}/>木取り図 (SVG)</button><button type="button" role="menuitem" onClick={() => { setPanel('drawing'); setOpen(false); }}><Ruler size={15}/>加工図 (SVG)</button><button type="button" role="menuitem" onClick={() => exportParts(true)}>STL（選択部材）</button><button type="button" role="menuitem" onClick={() => exportParts(false)}>STL（全体）</button></div> : null}{panel === 'nesting' ? <NestingPanel onClose={() => setPanel(null)} /> : null}{panel === 'drawing' ? <DrawingPanel onClose={() => setPanel(null)} /> : null}</div>;
}
