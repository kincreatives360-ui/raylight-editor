import { useEffect, useState } from 'react';
import { getWorkspaceLayout } from '../ui/workspaceLayout';
import { useSelectionStore } from '../store/useSelectionStore';

interface UseAppWorkspaceLayoutOptions {
  leftPanelWidth: number;
  rightSidebarWidth: number;
  leftPanelOpen: boolean;
  rightSidebarOpen: boolean;
  setLeftPanelOpen?: (open: boolean) => void;
  setRightSidebarOpen?: (open: boolean) => void;
}

export function useAppWorkspaceLayout({
  leftPanelWidth,
  rightSidebarWidth,
  leftPanelOpen,
  rightSidebarOpen,
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
      setWorkspaceWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { workspaceWidth, setResizePriority, panelLayout };
}
