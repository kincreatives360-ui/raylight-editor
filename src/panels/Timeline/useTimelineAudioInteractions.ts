import React, { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Trash2 } from 'lucide-react';
import type { AudioClip, Project } from '../../model/types';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import type { TimelineContextMenuState } from './timelineTypes';

interface TimelineAudioInteractionsOptions {
    project: Project;
    pxPerMs: number;
    updateProject: (updater: (project: Project) => Project, options?: { skipHistory?: boolean }) => void;
    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    setDragging: Dispatch<SetStateAction<boolean>>;
    splitAudioClipAtPlayhead: (clipId: string, timeMs: number) => void;
    toggleProjectAudioMuted: () => void;
}

export function useTimelineAudioInteractions({
    project,
    pxPerMs,
    updateProject,
    beginDragTransaction,
    commitDragTransaction,
    setDragging,
    splitAudioClipAtPlayhead,
    toggleProjectAudioMuted,
}: TimelineAudioInteractionsOptions) {
    const [contextMenu, setContextMenu] = useState<TimelineContextMenuState | null>(null);
    // Audio clip dragging and editing are grouped here because they share project audio updates.
    const startAudioClipDrag = (
        e: React.PointerEvent,
        clip: AudioClip,
        mode: 'move' | 'left' | 'right'
    ) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const origStart = clip.startMs;
        const origDur = clip.durationMs;
        const origOffset = clip.offsetMs || 0;
        const pointerId = e.pointerId;
        let hasMoved = false;

        try {
            e.currentTarget.setPointerCapture(pointerId);
        } catch {
            // Ignore capture failure
        }

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (!hasMoved) {
                if (Math.abs(ev.clientX - startX) < 4) return;
                hasMoved = true;
                beginDragTransaction();
                setDragging(true);
            }

            const deltaMs = Math.round((ev.clientX - startX) / pxPerMs / 10) * 10;
            let nextStart = origStart;
            let nextDur = origDur;
            let nextOffset = origOffset;

            if (mode === 'move') {
                nextStart = Math.max(0, origStart + deltaMs);
            } else if (mode === 'left') {
                const minStart = Math.max(0, origStart - origOffset);
                const maxStart = origStart + origDur - 100;
                nextStart = Math.max(minStart, Math.min(maxStart, origStart + deltaMs));
                const diff = nextStart - origStart;
                nextDur = origDur - diff;
                nextOffset = origOffset + diff;
            } else if (mode === 'right') {
                nextDur = Math.max(100, origDur + deltaMs);
            }

            updateProject(
                (p) => ({
                    ...p,
                    audio: {
                        clips: (p.audio?.clips || []).map((c) =>
                            c.id === clip.id
                                ? { ...c, startMs: nextStart, durationMs: nextDur, offsetMs: nextOffset }
                                : c
                        ),
                        muted: p.audio?.muted || false,
                        masterVolume: p.audio?.masterVolume ?? 1,
                    },
                }),
                { skipHistory: true }
            );
        };

        const onEnd = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            if (hasMoved) {
                commitDragTransaction();
                setDragging(false);
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('pointercancel', onEnd);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
    };

    // 9. Delete Audio Clip helper
    const deleteAudioClip = (clipId: string) => {
        updateProject((p) => ({
            ...p,
            audio: {
                clips: (p.audio?.clips || []).filter((c) => c.id !== clipId),
                muted: p.audio?.muted || false,
                masterVolume: p.audio?.masterVolume ?? 1,
            },
        }));
    };

    const duplicateAudioClip = (clipId: string) => {
        updateProject((p) => {
            const clips = p.audio?.clips || [];
            const clip = clips.find((c) => c.id === clipId);
            if (!clip) return p;
            const newClip = {
                ...clip,
                id: `audio-${Date.now()}`,
                startMs: clip.startMs + clip.durationMs,
            };
            return {
                ...p,
                audio: {
                    ...p.audio,
                    muted: p.audio?.muted ?? false,
                    masterVolume: p.audio?.masterVolume ?? 1,
                    clips: [...clips, newClip],
                },
            };
        });
    };

    const setAudioFade = (clipId: string, type: 'in' | 'out', ms: number) => {
        updateProject((p) => ({
            ...p,
            audio: {
                ...p.audio,
                    muted: p.audio?.muted ?? false,
                    masterVolume: p.audio?.masterVolume ?? 1,
                clips: (p.audio?.clips || []).map((c) =>
                    c.id === clipId
                        ? {
                              ...c,
                              ...(type === 'in' ? { fadeInMs: ms } : { fadeOutMs: ms }),
                          }
                        : c
                ),
            },
        }));
    };

    const openAudioContextMenu = (event: React.MouseEvent, clip: AudioClip) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            items: [
                { type: 'header', label: clip.name },
                {
                    id: 'split',
                    label: 'Split at playhead',
                    shortcut: '⌘B',
                    onClick: () => splitAudioClipAtPlayhead(clip.id, usePlayheadStore.getState().currentTimeMs),
                },
                {
                    id: 'fade-in',
                    label: 'Quick fade in',
                    children: [
                        { id: 'fi-100', label: '100 ms', onClick: () => setAudioFade(clip.id, 'in', 100) },
                        { id: 'fi-250', label: '250 ms', onClick: () => setAudioFade(clip.id, 'in', 250) },
                        { id: 'fi-500', label: '500 ms', onClick: () => setAudioFade(clip.id, 'in', 500) },
                        { id: 'fi-1000', label: '1.0 s', onClick: () => setAudioFade(clip.id, 'in', 1000) },
                    ],
                },
                {
                    id: 'fade-out',
                    label: 'Quick fade out',
                    children: [
                        { id: 'fo-100', label: '100 ms', onClick: () => setAudioFade(clip.id, 'out', 100) },
                        { id: 'fo-250', label: '250 ms', onClick: () => setAudioFade(clip.id, 'out', 250) },
                        { id: 'fo-500', label: '500 ms', onClick: () => setAudioFade(clip.id, 'out', 500) },
                        { id: 'fo-1000', label: '1.0 s', onClick: () => setAudioFade(clip.id, 'out', 1000) },
                    ],
                },
                {
                    id: 'toggle-mute',
                    label: project.audio?.muted ? 'Unmute' : 'Mute',
                    shortcut: 'M',
                    onClick: () => toggleProjectAudioMuted(),
                },
                { type: 'divider' },
                {
                    id: 'duplicate',
                    label: 'Duplicate',
                    shortcut: '⌘D',
                    onClick: () => duplicateAudioClip(clip.id),
                },
                {
                    id: 'delete',
                    label: 'Delete clip',
                    icon: Trash2,
                    shortcut: '⌫',
                    danger: true,
                    onClick: () => deleteAudioClip(clip.id),
                },
            ],
        });
    };

    return {
        contextMenu,
        setContextMenu,
        startAudioClipDrag,
        deleteAudioClip,
        openAudioContextMenu,
    };
}
