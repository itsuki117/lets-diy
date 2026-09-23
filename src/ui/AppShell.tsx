import type { ReactNode } from 'react';
import { LeftPanel } from './left/LeftPanel';
import { PropertyPanel } from './right/PropertyPanel';
import { StatusBar } from './statusbar/StatusBar';
import { TopBar } from './topbar/TopBar';
import { ToastHost } from './common/ToastHost';
import { BomPanel } from './bom/BomPanel';
import { InterferencePanel } from './bom/InterferencePanel';

export function AppShell({ children, onExportStl }: { children?: ReactNode; onExportStl: (selectedOnly: boolean) => void }) {
  return (
    <div className="app-shell">
      <TopBar onExportStl={onExportStl} />
      <LeftPanel />
      <main className="viewport-container" aria-label="3D作業スペース">
        {children}
      </main>
      <PropertyPanel />
      <StatusBar />
      <BomPanel />
      <InterferencePanel />
      <ToastHost />
    </div>
  );
}
