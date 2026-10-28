import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { evaluateEasing } from '../engine/easing';
import {
  EASING_OPTION_GROUPS,
  easingFromSelection,
  easingSelectionValue,
  type BezierDefaults,
} from '../model/easingSelection';
import type { Easing } from '../model/types';
import { EasingPopover } from '../panels/Timeline/EasingPopover';
import { FigmaSelect } from './FigmaSelect';
import { IconButton } from './primitives';
import { ScrubInput } from './ScrubInput';

export function easingCurvePath(easing: Easing): string {
  const samples = 24;
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const v = evaluateEasing(t, easing);
    const x = 3 + t * 22;
    const y = Math.max(2, Math.min(20, 18 - v * 14));
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export interface EasingControlProps {
  value: Easing;
  onChange: (easing: Easing) => void;
  selectAriaLabel?: string;
  selectClassName?: string;
  rowClassName?: string;
  bezierDefaults?: BezierDefaults;
  showCurvePreview?: boolean;
  previewAriaLabel?: string;
  showPopoverTrigger?: boolean;
  popoverButtonLabel?: string;
  showInlineTuning?: boolean;
}

export const EasingControl: React.FC<EasingControlProps> = ({
  value,
  onChange,
  selectAriaLabel = 'Easing',
  selectClassName,
  rowClassName = 'flex items-center gap-1.5',
  bezierDefaults,
  showCurvePreview = false,
  previewAriaLabel = 'Easing curve preview',
  showPopoverTrigger = true,
  popoverButtonLabel = 'Edit easing curve',
  showInlineTuning = false,
}) => {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const currentSelection = easingSelectionValue(value);

  const resolvedBezierDefaults: BezierDefaults =
    bezierDefaults ??
    (value.kind === 'bezier'
      ? { x1: value.x1, y1: value.y1, x2: value.x2, y2: value.y2 }
      : { x1: 0.65, y1: 0, x2: 0.35, y2: 1 });

  return (
    <div className="space-y-1.5 min-w-0">
      <div className={rowClassName}>
        {showCurvePreview && (
          <svg
            role="img"
            aria-label={previewAriaLabel}
            viewBox="0 0 28 22"
            className="w-7 h-7 p-1 rounded-[7px] bg-[#202020] text-[#d4d4d8] shrink-0"
          >
            <path
              d={easingCurvePath(value)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}

        <FigmaSelect
          aria-label={selectAriaLabel}
          value={currentSelection}
          onChange={(event) => {
            const next = easingFromSelection(event.target.value, resolvedBezierDefaults);
            if (next) onChange(next);
          }}
          className={selectClassName}
        >
          {EASING_OPTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </FigmaSelect>

        {showPopoverTrigger && (
          <IconButton
            label={popoverButtonLabel}
            icon={<SlidersHorizontal />}
            onClick={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
          />
        )}
      </div>

      {anchor && (
        <EasingPopover
          easing={value}
          onChange={onChange}
          onClose={() => setAnchor(null)}
          anchorRect={anchor}
        />
      )}

      {showInlineTuning && value.kind === 'spring' && (
        <div className="p-2 rounded bg-[#141417] border border-white/[0.06] space-y-1.5 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-emerald-400">
              Spring Physics Tuning ({value.name})
            </span>
            {value.config && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    kind: 'spring',
                    name: value.name,
                  })
                }
                className="text-[10px] text-zinc-400 hover:text-white cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput
              label="Stiff"
              value={value.config?.stiffness ?? 180}
              min={20}
              max={600}
              step={5}
              onChange={(stiffness) =>
                onChange({
                  kind: 'spring',
                  name: value.name,
                  config: {
                    stiffness,
                    damping: value.config?.damping ?? 18,
                    mass: value.config?.mass ?? 1,
                  },
                })
              }
            />
            <ScrubInput
              label="Damp"
              value={value.config?.damping ?? 18}
              min={2}
              max={60}
              step={1}
              onChange={(damping) =>
                onChange({
                  kind: 'spring',
                  name: value.name,
                  config: {
                    stiffness: value.config?.stiffness ?? 180,
                    damping,
                    mass: value.config?.mass ?? 1,
                  },
                })
              }
            />
            <ScrubInput
              label="Mass"
              value={value.config?.mass ?? 1}
              min={0.2}
              max={5}
              step={0.1}
              onChange={(mass) =>
                onChange({
                  kind: 'spring',
                  name: value.name,
                  config: {
                    stiffness: value.config?.stiffness ?? 180,
                    damping: value.config?.damping ?? 18,
                    mass,
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {showInlineTuning && value.kind === 'bezier' && (
        <details className="rounded-[8px] bg-[#191919] px-2.5 py-2 text-[11px] text-[#a1a1aa]">
          <summary className="cursor-pointer select-none">
            Curve ({value.x1.toFixed(2)}, {value.y1.toFixed(2)}, {value.x2.toFixed(2)},{' '}
            {value.y2.toFixed(2)})
          </summary>
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            <ScrubInput
              label="X1"
              aria-label="X1"
              value={Number(value.x1.toFixed(2))}
              min={0}
              max={1}
              step={0.02}
              onChange={(x1) =>
                onChange({
                  kind: 'bezier',
                  x1,
                  y1: value.y1,
                  x2: value.x2,
                  y2: value.y2,
                })
              }
            />
            <ScrubInput
              label="Y1"
              aria-label="Y1"
              value={Number(value.y1.toFixed(2))}
              min={-0.5}
              max={1.5}
              step={0.02}
              onChange={(y1) =>
                onChange({
                  kind: 'bezier',
                  x1: value.x1,
                  y1,
                  x2: value.x2,
                  y2: value.y2,
                })
              }
            />
            <ScrubInput
              label="X2"
              aria-label="X2"
              value={Number(value.x2.toFixed(2))}
              min={0}
              max={1}
              step={0.02}
              onChange={(x2) =>
                onChange({
                  kind: 'bezier',
                  x1: value.x1,
                  y1: value.y1,
                  x2,
                  y2: value.y2,
                })
              }
            />
            <ScrubInput
              label="Y2"
              aria-label="Y2"
              value={Number(value.y2.toFixed(2))}
              min={-0.5}
              max={1.5}
              step={0.02}
              onChange={(y2) =>
                onChange({
                  kind: 'bezier',
                  x1: value.x1,
                  y1: value.y1,
                  x2: value.x2,
                  y2,
                })
              }
            />
          </div>
        </details>
      )}
    </div>
  );
};
