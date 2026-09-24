import { useCallback, useEffect } from 'react';
import { startStoreSync } from './store/sync';
import { AppShell } from './ui/AppShell';
import { ErrorBoundary } from './ui/common/ErrorBoundary';
import { useKeyboardShortcuts } from './ui/hooks/useKeyboardShortcuts';
import { useProjectIo, useProjectLifecycle } from './ui/hooks/useProjectIo';
import { focusOnParts } from './store/cameraCommands';
import { simToggleSelectedJoint } from './store/commands/simulationCommands';
import { Viewport } from './viewport/Viewport';
import { MotionCheckPage } from './ui/motion/MotionCheckPage';
import { geometryCache } from './geometry/GeometryCache';
import { exportStl } from './geometry/exporters/stlExporter';
import { downloadBinary } from './io/fileDownload';
import { useEditorStore } from './store/useEditorStore';
import { useMotionStore } from './store/useMotionStore';
import { useProjectStore } from './store/useProjectStore';

export default function App() {
  const io = useProjectIo();
  const workspace = useEditorStore((state) => state.workspace);
  const focus = useCallback((ids: string[]) => focusOnParts(ids), []);
  useKeyboardShortcuts(io.downloadFile, focus, simToggleSelectedJoint);
  useProjectLifecycle();
  useEffect(() => startStoreSync(), []);
  const exportStlFile = useCallback((selectedOnly: boolean) => {
    const project = useProjectStore.getState().project;
    const selected = useEditorStore.getState().selectedIds;
    const poses = useMotionStore.getState().poses;
    const parts = selectedOnly ? project.parts.filter((part) => selected.includes(part.id)) : project.parts.filter((part) => part.visible);
    const items = parts.flatMap((part) => {
      const geometry = geometryCache.peek(part.id);
      return geometry ? [{ geometry, transform: poses.get(part.id) ?? part.transform }] : [];
    });
    if (items.length !== parts.length || items.length === 0) {
      useEditorStore.getState().pushToast('warning', '形状の準備が完了してからもう一度書き出してください');
      return;
    }
    const output = exportStl(items, true);
    if (typeof output !== 'string') downloadBinary(output, `${project.name}_${selectedOnly ? '選択部材' : '全体'}.stl`, 'model/stl');
  }, []);

  return (
    <ErrorBoundary scope="app">
      {workspace === 'motionCheck' ? (
        <MotionCheckPage>
          <ErrorBoundary scope="viewport"><Viewport /></ErrorBoundary>
        </MotionCheckPage>
      ) : (
        <AppShell onExportStl={exportStlFile}>
          <ErrorBoundary scope="viewport"><Viewport /></ErrorBoundary>
        </AppShell>
      )}
    </ErrorBoundary>
  );
}
