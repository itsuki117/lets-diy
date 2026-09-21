import type { ReactNode } from 'react';
import { Hammer, Box, Plus, Move3D, Drill } from 'lucide-react';

export function AppShell({ children }: { children?: ReactNode }) {
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><Hammer size={21} /><strong>Let's DIY<span className="brand-dot">.</span></strong><span className="version">WORKSPACE / V1</span></div><span className="project-title">無題のプロジェクト</span><div className="local-badge"><span />ローカルで編集</div></header>
    <aside className="left-panel"><div className="mode-tabs"><button className="active"><Plus size={16} />生成</button><button><Move3D size={16} />配置</button><button><Drill size={16} />加工</button></div><div className="panel-content"><p className="eyebrow">MATERIAL</p><h2>木材をつくる</h2><p className="muted">寸法を決めて、最初の一枚から。</p></div><div className="outliner"><div className="section-heading"><Box size={14} />部材一覧 <span className="count">0</span></div><p className="empty-text">まだ部材がありません</p></div></aside>
    <main className="viewport-container" aria-label="3D作業スペース">{children}</main>
    <aside className="right-panel"><div className="panel-heading">プロパティ</div><div className="empty-state"><Box size={30} /><h3>部材の詳細</h3><p>部材を選択すると<br />ここに詳細が表示されます</p></div></aside>
    <footer className="statusbar"><span className="status-dot" />準備完了<span className="status-separator" />選択 0 / 0<span className="status-spacer" />単位 mm</footer>
  </div>;
}
