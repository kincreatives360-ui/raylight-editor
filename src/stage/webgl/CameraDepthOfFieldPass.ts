import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { EvaluatedCameraOptics } from '../../engine/evaluateCameraOptics';

const CameraDepthOfFieldShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    focusDistance: { value: 2.65 },
    focalLength: { value: 50.0 },
    aperture: { value: 2.8 },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100.0 },
    cocScale: { value: 1.0 },
    maxBlurPx: { value: 32.0 },
    texelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    bokehShape: { value: 0 }, // 0: circular, 1: bladed, 2: anamorphic
    bokehQualitySamples: { value: 24 },
    dofEnabled: { value: 1.0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float focusDistance;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float cocScale;
    uniform float maxBlurPx;
    uniform vec2 texelSize;
    uniform int bokehShape;
    uniform int bokehQualitySamples;
    uniform float dofEnabled;

    varying vec2 vUv;

    // Linearize depth safely from depth texture with edge protection
    float getLinearDepth(vec2 uv) {
      float d = texture2D(tDepth, uv).r;
      if (d >= 0.99999) return cameraFar;
      if (d <= 0.00001) return cameraNear;
      float z = d * 2.0 - 1.0;
      float denom = cameraFar + cameraNear - z * (cameraFar - cameraNear);
      if (abs(denom) < 0.00001) return cameraFar;
      return clamp((2.0 * cameraNear * cameraFar) / denom, cameraNear, cameraFar);
    }

    // Signed CoC: negative = near field (foreground), positive = far field (background)
    float getCoC(vec2 uv) {
      float z = getLinearDepth(uv);
      if (z >= cameraFar - 0.1) return 0.0; // Ignore far background clears
      float distDiff = z - focusDistance;
      float coc = (distDiff / max(0.001, z)) * cocScale * 12.0;
      return clamp(coc, -maxBlurPx, maxBlurPx);
    }

    void main() {
      vec4 centerColor = texture2D(tDiffuse, vUv);

      if (dofEnabled < 0.5) {
        gl_FragColor = centerColor;
        return;
      }

      float centerCoC = getCoC(vUv);
      float absCoC = abs(centerCoC);

      if (absCoC < 0.2) {
        gl_FragColor = centerColor;
        return;
      }

      vec4 acc = vec4(0.0);
      float totalWeight = 0.0;
      int samples = clamp(bokehQualitySamples, 8, 48);

      // Golden angle spiral distribution
      float goldenAngle = 2.39996323;

      for (int i = 0; i < 48; i++) {
        if (i >= samples) break;

        float r = sqrt(float(i) + 0.5) / sqrt(float(samples));
        float theta = float(i) * goldenAngle;

        vec2 dir = vec2(cos(theta), sin(theta));

        // Anamorphic lens squeeze option
        if (bokehShape == 2) {
          dir.x *= 1.8;
          dir.y *= 0.6;
        }

        vec2 offset = dir * r * absCoC * texelSize;
        vec2 sampleUv = clamp(vUv + offset, 0.0, 1.0);

        vec4 sampleColor = texture2D(tDiffuse, sampleUv);
        float sampleCoC = getCoC(sampleUv);

        // Discard far samples on near sharp edges to prevent background edge bleeding
        float weight = 1.0;
        if (centerCoC < 0.0) {
          // Foreground sample: blur over both
          weight = 1.0;
        } else {
          // Background sample: do not bleed over sharp foreground
          weight = smoothstep(-1.0, 0.5, sampleCoC);
        }

        acc += sampleColor * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0.001) {
        vec4 col = acc / totalWeight;
        if (isnan(col.r) || isnan(col.g) || isnan(col.b) || isnan(col.a)) {
          gl_FragColor = centerColor;
        } else {
          gl_FragColor = col;
        }
      } else {
        gl_FragColor = centerColor;
      }
    }
  `,
};

export class CameraDepthOfFieldPass extends ShaderPass {
  constructor() {
    const material = new THREE.ShaderMaterial({
      defines: Object.assign({}, CameraDepthOfFieldShader.defines),
      uniforms: THREE.UniformsUtils.clone(CameraDepthOfFieldShader.uniforms),
      vertexShader: CameraDepthOfFieldShader.vertexShader,
      fragmentShader: CameraDepthOfFieldShader.fragmentShader,
    });
    super(material, 'tDiffuse');
  }

  public updateOptics(
    optics: EvaluatedCameraOptics,
    depthTexture: THREE.DepthTexture | null,
    camera: THREE.Camera,
    width: number,
    height: number
  ): void {
    const uniforms = this.material.uniforms;
    if (!uniforms) return;

    uniforms.dofEnabled.value = optics.enabled ? 1.0 : 0.0;
    if (!optics.enabled) return;

    if (depthTexture) {
      uniforms.tDepth.value = depthTexture;
    }

    const perspectiveCam = camera as THREE.PerspectiveCamera;
    const near = Math.max(0.01, perspectiveCam.near ?? 0.1);
    const far = Math.max(near + 0.1, perspectiveCam.far ?? 100.0);

    uniforms.focusDistance.value = optics.resolvedFocusDistance;
    uniforms.focalLength.value = optics.focalLength;
    uniforms.aperture.value = optics.aperture;
    uniforms.cameraNear.value = near;
    uniforms.cameraFar.value = far;
    uniforms.cocScale.value = optics.cocScale;

    uniforms.texelSize.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));

    const sampleCounts: Record<string, number> = { low: 16, medium: 24, high: 40 };
    uniforms.bokehQualitySamples.value = sampleCounts[optics.bokehQuality] ?? 24;

    const shapeValues: Record<string, number> = { circular: 0, bladed: 1, anamorphic: 2 };
    uniforms.bokehShape.value = shapeValues[optics.bokehShape] ?? 0;
  }

  public override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    // Dynamic ping-pong depth texture synchronization
    if (readBuffer && readBuffer.depthTexture) {
      this.material.uniforms.tDepth.value = readBuffer.depthTexture;
    }
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}
