import React from 'react';

export interface FocusDistanceHudProps {
  /** Whether DOF is currently enabled on the active shot */
  enabled: boolean;
  /** Focus plane distance in scene units */
  focusDistance: number;
  /** Half-width of the sharp zone */
  focusRange: number;
  /** f-stop */
  aperture: number;
  /** Lens focal length in mm */
  focalLength: number;
  /** Optional focus mode label */
  focusMode?: 'manual' | 'target' | 'selection' | 'pick';
  /** Called when user scrubs focus distance from the HUD */
  onFocusDistanceChange?: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Enter focus-pick mode */
  onBeginFocusPick?: () => void;
  /** Visible only while editing – never in export */
  visible?: boolean;
}

/**
 * On-canvas optical HUD for Depth of Field.
 * Shows focus distance, f-stop, focal length, and near/far DoF bounds.
 * Drag the focus value to adjust; does not appear in final export.
 */
export const FocusDistanceHud: React.FC<FocusDistanceHudProps> = ({
  enabled,
  focusDistance,
  focusRange,
  aperture,
  focalLength,
  focusMode = 'manual',
  onFocusDistanceChange,
  onDragStart,
  onDragEnd,
  onBeginFocusPick,
  visible = true,
}) => {
  if (!visible || !enabled) return null;

  const nearBound = Math.max(0.05, focusDistance - focusRange * 0.5);
  const farBound = focusDistance + focusRange * 0.5;

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onFocusDistanceChange) return;
    e.preventDefault();
    e.stopPropagation();
    onDragStart?.();
    const startY = e.clientY;
    const startVal = focusDistance;
    const onMove = (ev: PointerEvent) => {
      const dy = startY - ev.clientY;
      const next = Math.max(0.1, Math.min(80, startVal + dy * 0.02));
      onFocusDistanceChange(Number(next.toFixed(2)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onDragEnd?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 42,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
        lineHeight: 1.35,
        color: 'rgba(255,255,255,0.94)',
        textShadow: '0 1px 2px rgba(0,0,0,0.7)',
        background: 'rgba(8,10,14,0.62)',
        backdropFilter: 'blur(10px)',
        borderRadius: 10,
        padding: '8px 12px',
        border: '1px solid rgba(255,255,255,0.1)',
        minWidth: 168,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ opacity: 0.6, letterSpacing: '0.04em', fontSize: 10 }}>DEPTH OF FIELD</span>
        <span style={{ opacity: 0.75, fontSize: 10 }}>{focusMode}</span>
      </div>

      <div
        onPointerDown={scrub}
        style={{ cursor: onFocusDistanceChange ? 'ns-resize' : 'default', display: 'flex', justifyContent: 'space-between' }}
        title="Drag vertically to change focus distance"
      >
        <span style={{ opacity: 0.65 }}>Focus</span>
        <span style={{ fontWeight: 600 }}>{focusDistance.toFixed(2)} u</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ opacity: 0.65 }}>Near / Far</span>
        <span>
          {nearBound.toFixed(2)} – {farBound.toFixed(2)}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ opacity: 0.65 }}>Lens</span>
        <span>
          {Math.round(focalLength)}mm &nbsp; f/{aperture.toFixed(1)}
        </span>
      </div>

      {onBeginFocusPick && (
        <button
          type="button"
          onClick={onBeginFocusPick}
          style={{
            marginTop: 2,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            color: 'inherit',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Pick focus target
        </button>
      )}
    </div>
  );
};
