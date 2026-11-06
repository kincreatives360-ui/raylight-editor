import React, { useRef, useState } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import { MenuSurface, MenuItem } from './Menu';
import { useFloatingPanel } from './useFloatingPanel';
import { useSelectionStore } from '../store/useSelectionStore';

export interface DisplaySettingsMenuProps {
  showSafeArea?: boolean;
  onToggleSafeArea?: () => void;
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  leftPanelOpen?: boolean;
  rightSidebarOpen?: boolean;
  timelineOpen?: boolean;
}

export const DisplaySettingsMenu: React.FC<DisplaySettingsMenuProps> = ({
  showSafeArea = false,
  onToggleSafeArea,
  align = 'right',
  className = '',
  triggerClassName,
  leftPanelOpen: propLeftOpen,
  rightSidebarOpen: propRightOpen,
  timelineOpen: propTimelineOpen,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const storeLeftOpen = useSelectionStore((s) => s.leftPanelOpen);
  const storeRightOpen = useSelectionStore((s) => s.rightSidebarOpen);
  const storeTimelineOpen = useSelectionStore((s) => s.timelineOpen);
  const toggleLeftPanel = useSelectionStore((s) => s.toggleLeftPanel);
  const toggleRightSidebar = useSelectionStore((s) => s.toggleRightSidebar);
  const toggleTimeline = useSelectionStore((s) => s.toggleTimeline);

  const effectiveLeftOpen = propLeftOpen ?? storeLeftOpen;
  const effectiveRightOpen = propRightOpen ?? storeRightOpen;
  const effectiveTimelineOpen = propTimelineOpen ?? storeTimelineOpen;

  useFloatingPanel({
    open: isOpen,
    surfaceRef,
    anchorRef,
    onClose: () => setIsOpen(false),
  });

  const hasHiddenPanel = !effectiveLeftOpen || !effectiveRightOpen || !effectiveTimelineOpen;

  const defaultTriggerClasses =
    'relative p-1.5 rounded-lg hover:bg-subtle text-muted-foreground/80 hover:text-foreground cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={anchorRef}
        type="button"
        aria-label="Display settings"
        title="Display settings"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className={triggerClassName ?? defaultTriggerClasses}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {hasHiddenPanel && (
          <span
            className="pointer-events-none absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-blue ring-2 ring-app"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <MenuSurface
          ref={surfaceRef}
          className={`absolute top-full mt-1.5 ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          } w-48 rounded-xl bg-surface/95 backdrop-blur-xl border border-subtle shadow-2xl p-1 text-xs z-50`}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Panels
          </div>
          <MenuItem
            unstyled
            onClick={toggleLeftPanel}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left text-foreground hover:bg-subtle cursor-pointer transition-colors"
          >
            <span>Show layers</span>
            {effectiveLeftOpen && <Check className="w-3.5 h-3.5 text-brand-blue" />}
          </MenuItem>
          <MenuItem
            unstyled
            onClick={toggleRightSidebar}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left text-foreground hover:bg-subtle cursor-pointer transition-colors"
          >
            <span>Show sidebar</span>
            {effectiveRightOpen && <Check className="w-3.5 h-3.5 text-brand-blue" />}
          </MenuItem>
          <MenuItem
            unstyled
            onClick={toggleTimeline}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left text-foreground hover:bg-subtle cursor-pointer transition-colors"
          >
            <span>Show timeline</span>
            {effectiveTimelineOpen && <Check className="w-3.5 h-3.5 text-brand-blue" />}
          </MenuItem>

          <div className="my-1 border-t border-subtle" />

          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Guides
          </div>
          <MenuItem
            unstyled
            onClick={onToggleSafeArea}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left text-foreground hover:bg-subtle cursor-pointer transition-colors"
          >
            <span>Safe zones (9:16)</span>
            {showSafeArea && <Check className="w-3.5 h-3.5 text-brand-blue" />}
          </MenuItem>
        </MenuSurface>
      )}
    </div>
  );
};
