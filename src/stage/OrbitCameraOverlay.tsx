import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, Crosshair, Pin, RefreshCw } from 'lucide-react';
import * as THREE from 'three';
import type { EvaluatedCamera } from '../engine/evaluateCamera';
import { evaluateCameraPose, type DefaultCameraConfig } from './webgl/cameraMath';
import { CAMERA_ANGLE_VIEWS } from './cameraAngleViews';

export function OrbitCameraFrustum({ camera, observer, reference, width, height }: { camera: EvaluatedCamera; observer: EvaluatedCamera; reference: DefaultCameraConfig; width: number; height: number }) {
    const aspect = width / Math.max(1, height);
    const pose = evaluateCameraPose(camera, reference, aspect);
    const view = evaluateCameraPose(observer, reference, aspect);
    const projection = new THREE.PerspectiveCamera(view.fov, aspect, 0.01, 1000);
    projection.position.set(view.position.x, view.position.y, view.position.z);
    projection.rotation.set(view.rotation.x, view.rotation.y, view.rotation.z, 'XYZ');
    projection.updateMatrixWorld();
    const origin = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);
    const rotation = new THREE.Euler(pose.rotation.x, pose.rotation.y, pose.rotation.z, 'XYZ');
    const distance = (reference.position.z || 2.65) / Math.max(0.15, camera.zoom);
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(pose.fov / 2)) * distance;
    const world = (x: number, y: number) => new THREE.Vector3(x, y, -distance).applyEuler(rotation).add(origin);
    const project = (point: THREE.Vector3) => { const p = point.clone().project(projection); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }; };
    const apex = project(origin);
    const center = project(world(0, 0));
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => project(world(x * halfHeight * aspect, y * halfHeight)));
    if (![apex, center, ...corners].every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    return <svg aria-label="Orbit camera frustum" viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full overflow-visible pointer-events-none z-30" fill="none" stroke="#00bd68" strokeWidth="1.5">
        {corners.map((p, i) => <line key={i} x1={apex.x} y1={apex.y} x2={p.x} y2={p.y} opacity=".5" vectorEffect="non-scaling-stroke" />)}
        <polygon points={corners.map(p => `${p.x},${p.y}`).join(' ')} vectorEffect="non-scaling-stroke" />
        <line x1={apex.x} y1={apex.y} x2={center.x} y2={center.y} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        <circle cx={apex.x} cy={apex.y} r="8" /><circle cx={apex.x} cy={apex.y} r="5" fill="#00bd68" /><circle cx={center.x} cy={center.y} r="2.5" fill="#00bd68" />
    </svg>;
}

export function OrbitCameraControls({ pinned, zoom, onAngle, onPin, onBack, onZoom }: { pinned: boolean; zoom: number; onAngle: (orbit: number, tilt: number, roll: number) => void; onPin: () => void; onBack: () => void; onZoom: (zoom: number) => void }) {
    const [menu, setMenu] = useState<'angle' | 'zoom' | null>(null);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!menu) return;
        const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setMenu(null); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(null); } };
        document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape, true);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
    }, [menu]);
    const button = 'flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60';
    return <div ref={root} aria-label="Orbit camera controls" onMouseDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center rounded-2xl bg-[#242424] p-1 text-[#eeeeee] shadow-lg whitespace-nowrap">
        <div className="relative">
            <button className={button} aria-expanded={menu === 'angle'} aria-haspopup="menu" onClick={() => setMenu(menu === 'angle' ? null : 'angle')}><Crosshair size={16} />Angle<ChevronDown size={12} /></button>
            {menu === 'angle' && <div role="menu" aria-label="Camera angle" className="absolute bottom-full left-0 mb-2 w-44 rounded-2xl bg-[#242424] p-2 shadow-xl">{CAMERA_ANGLE_VIEWS.map(view => <button role="menuitem" key={view.id} className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/10 focus-visible:bg-white/10" onClick={() => { onAngle(view.orbit, view.tilt, view.roll); setMenu(null); }}>{view.label}</button>)}</div>}
        </div>
        <button className={button} aria-pressed={pinned} onClick={onPin}><Pin size={16} fill={pinned ? 'currentColor' : 'none'} />Pin</button>
        <button className={button} onClick={onBack}><Camera size={16} />Back to camera</button>
        <div className="relative"><button className={button} aria-label="Viewport zoom" aria-expanded={menu === 'zoom'} onClick={() => setMenu(menu === 'zoom' ? null : 'zoom')}><RefreshCw size={15} />{Math.round(zoom * 100)}%</button>
            {menu === 'zoom' && <div className="absolute bottom-full right-0 mb-2 w-28 rounded-xl bg-[#242424] p-2 shadow-xl">{[0.25, 0.5, 0.74, 1, 1.5, 2].map(value => <button key={value} className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/10" onClick={() => { onZoom(value); setMenu(null); }}>{Math.round(value * 100)}%</button>)}</div>}
        </div>
    </div>;
}

