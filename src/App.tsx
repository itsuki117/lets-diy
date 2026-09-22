import { useCallback, useEffect } from 'react';
import { startStoreSync } from './store/sync';
import { AppShell } from './ui/AppShell';
import { ErrorBoundary } from './ui/common/ErrorBoundary';
import { useKeyboardShortcuts } from './ui/hooks/useKeyboardShortcuts';
import { useProjectIo, useProjectLifecycle } from './ui/hooks/useProjectIo';
import { focusOnParts } from './store/cameraCommands';
import { Viewport } from './viewport/Viewport';

export default function App() {
  const io = useProjectIo();
  const focus = useCallback((ids: string[]) => focusOnParts(ids), []);
  useKeyboardShortcuts(io.downloadFile, focus);
  useProjectLifecycle();
  useEffect(() => startStoreSync(), []);

  return (
    <ErrorBoundary scope="app">
      <AppShell>
        <ErrorBoundary scope="viewport">
          <Viewport />
        </ErrorBoundary>
      </AppShell>
    </ErrorBoundary>
  );
}
