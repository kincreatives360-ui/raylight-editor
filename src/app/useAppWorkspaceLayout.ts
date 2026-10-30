import { useEffect, useState } from 'react';
import { getWorkspaceLayout } from '../ui/workspaceLayout';
import { useSelectionStore } from '../store/useSelectionStore';

interface UseAppWorkspaceLayoutOptions {
  leftPanelWidth: number;
  rightSidebarWidth: number;
  leftPanelOpen: boolean;
  rightSidebarOpen: boolean;
  setLeftPanelOpen: ReturnType<typeof useSelectionStore.getState>['setLeftPanelOpen'];
  setRightSidebarOpen: ReturnType<typeof useSelectionStore.getState>['setRightSidebarOpen'];
}

export function useAppWorkspaceLayout({
  leftPanelWidth,
  rightSidebarWidth,
  leftPanelOpen,
  rightSidebarOpen,
  setLeftPanelOpen,
  setRightSidebarOpen,
}: UseAppWorkspaceLayoutOptions) {
  const [workspaceWidth, setWorkspaceWidth] = useState(() => window.innerWidth);
  const [resizePriority, setResizePriority] = useState<'left' | 'right'>();
  const panelLayout = getWorkspaceLayout({
    viewport: workspaceWidth,
    left: leftPanelWidth,
    right: rightSidebarWidth,
    leftOpen: leftPanelOpen,
    rightOpen: rightSidebarOpen,
    priority: resizePriority,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWorkspaceWidth(width);
      if (width < 1024) setLeftPanelOpen(false);
      if (width < 860) setRightSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setLeftPanelOpen, setRightSidebarOpen]);

  return { workspaceWidth, setResizePriority, panelLayout };
}
