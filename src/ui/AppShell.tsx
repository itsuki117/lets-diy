import type { ReactNode } from 'react';
import { LeftPanel } from './left/LeftPanel';
import { PropertyPanel } from './right/PropertyPanel';
import { StatusBar } from './statusbar/StatusBar';
import { TopBar } from './topbar/TopBar';
import { ToastHost } from './common/ToastHost';

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="app-shell">
      <TopBar />
      <LeftPanel />
      <main className="viewport-container" aria-label="3D作業スペース">
        {children}
      </main>
      <PropertyPanel />
      <StatusBar />
      <ToastHost />
    </div>
  );
}
