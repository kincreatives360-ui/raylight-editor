import * as THREE from 'three';

export function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(Math.max(0.0001, radius), width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

export function createScreenGeometry(width: number, height: number, radius: number): THREE.ShapeGeometry {
  const geometry = new THREE.ShapeGeometry(roundedRect(width, height, radius), 36);
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + width / 2) / width;
    uv[i * 2 + 1] = (position.getY(i) + height / 2) / height;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export function createBodyGeometry(width: number, height: number, radius: number, depth: number, fixed = false): THREE.ExtrudeGeometry {
  const bevelSize = Math.min(depth * 0.08, radius * 0.08);
  const bevelThickness = depth * 0.08;
  const geometry = new THREE.ExtrudeGeometry(roundedRect(
    fixed ? width - bevelSize * 2 : width,
    fixed ? height - bevelSize * 2 : height,
    fixed ? radius - bevelSize : radius
  ), {
    depth: fixed ? depth - bevelThickness * 2 : depth,
    bevelEnabled: true,
    bevelSegments: 6,
    bevelSize,
    bevelThickness,
    curveSegments: 36,
    steps: 1,
  });
  // Extrusion bevels extend beyond their input shape. Fixed hardware dimensions include them.
  if (fixed) geometry.translate(0, 0, bevelThickness);
  return geometry;
}

export function createBezelGeometry(
  outerWidth: number,
  outerHeight: number,
  outerRadius: number,
  screenWidth: number,
  screenHeight: number,
  screenRadius: number,
  overlap: number,
  depth: number
): THREE.ExtrudeGeometry {
  const bezel = roundedRect(outerWidth, outerHeight, outerRadius);
  // The hole is inset by `overlap` on every side so the rim always tucks over
  // the artwork edge. The screen hole must be strictly smaller than the screen
  // plane or hardware can never occlude it at a tilt.
  const screen = roundedRect(
    Math.max(0.001, screenWidth - overlap * 2),
    Math.max(0.001, screenHeight - overlap * 2),
    screenRadius - overlap
  );
  bezel.holes.push(screen);
  return new THREE.ExtrudeGeometry(bezel, {
    depth,
    bevelEnabled: false,
    curveSegments: 36,
    steps: 1,
  });
}

/** A centered extruded panel used for rear glass and the camera plateau. */
export function createRoundedPanelGeometry(width: number, height: number, radius: number, depth: number): THREE.ExtrudeGeometry {
  const bevel = Math.min(depth * 0.12, radius * 0.14);
  const geometry = new THREE.ExtrudeGeometry(roundedRect(width - bevel * 2, height - bevel * 2, radius - bevel), {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelSegments: 6,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 36,
  });
  geometry.translate(0, 0, -depth / 2 + bevel);
  return geometry;
}

export interface CameraBarrelGeometry {
  ring: THREE.TorusGeometry;
  glass: THREE.CylinderGeometry;
  /** Local Z translations keep glass recessed inside the rear-facing ring. */
  positionZ: number;
  glassPositionZ: number;
}

/** A rear-facing metal lens ring with a separate recessed dark-glass cap. */
export function createCameraBarrelGeometry(radius: number, depth: number, glassRadius: number): CameraBarrelGeometry {
  // A torus leaves a real aperture for the dark lens instead of burying it
  // behind a solid cylinder cap. Its normal is already along local Z.
  const ringTube = Math.max(depth * 0.36, radius * 0.08);
  const ring = new THREE.TorusGeometry(Math.max(0.0001, radius - ringTube), ringTube, 24, 64);
  const glassDepth = Math.max(depth * 0.16, 0.0005);
  const glass = new THREE.CylinderGeometry(glassRadius, glassRadius * 0.97, glassDepth, 64, 1, false);
  glass.rotateX(Math.PI / 2);
  return {
    ring,
    glass,
    positionZ: 0,
    // Negative Z faces the rear. Place the glass behind the rear ring lip
    // so it reads as recessed from a camera-facing view.
    glassPositionZ: -depth * 0.14,
  };
}

/** Stylised low-relief Apple mark, centered in its supplied rear-mark area. */
export function createAppleMarkGeometry(width: number, height: number, depth: number): THREE.ExtrudeGeometry {
  const x = width * 0.5;
  const y = height * 0.5;
  const body = new THREE.Shape();
  body.moveTo(-x * 0.05, y * 0.27);
  body.bezierCurveTo(-x * 0.34, y * 0.48, -x * 0.70, y * 0.32, -x * 0.67, y * 0.03);
  body.bezierCurveTo(-x * 0.64, -y * 0.30, -x * 0.32, -y * 0.47, 0, -y * 0.43);
  body.bezierCurveTo(x * 0.30, -y * 0.47, x * 0.60, -y * 0.27, x * 0.66, -y * 0.07);
  // The inward curve gives the body its familiar bitten right edge.
  body.bezierCurveTo(x * 0.48, -y * 0.10, x * 0.30, -y * 0.03, x * 0.30, y * 0.08);
  body.bezierCurveTo(x * 0.29, y * 0.20, x * 0.46, y * 0.28, x * 0.62, y * 0.20);
  body.bezierCurveTo(x * 0.54, y * 0.40, x * 0.18, y * 0.44, -x * 0.05, y * 0.27);
  const leaf = new THREE.Shape();
  leaf.moveTo(x * 0.02, y * 0.38);
  leaf.bezierCurveTo(x * 0.08, y * 0.61, x * 0.42, y * 0.66, x * 0.37, y * 0.35);
  leaf.bezierCurveTo(x * 0.24, y * 0.26, x * 0.08, y * 0.27, x * 0.02, y * 0.38);
  const geometry = new THREE.ExtrudeGeometry([body, leaf], {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: Math.min(depth * 0.16, width * 0.025),
    bevelThickness: Math.min(depth * 0.16, width * 0.025),
    curveSegments: 32,
  });
  // Keep the full two-piece mark centered in the layout's supplied mark box.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

