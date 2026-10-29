import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { EffectKey } from '../../model/types';
import type { EvaluatedEffects } from '../../engine/evaluateEffects';
import { COLOR_GRADE_GLSL, RANDOM_GLSL } from './shaderPrimitives';

export const scenePassKeys: EffectKey[] = ['bloom', 'vignette', 'motionBlur', 'chromaticAberration', 'filmGrain', 'ghost', 'colorGrade', 'edgeFade', 'glitch', 'depthOfField'];
const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

// Each pass reads the result of the preceding pass. All intermediate RGB is linear and premultiplied.
export function createSceneEffectPass(key: EffectKey): ShaderPass {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uResolution: { value: new THREE.Vector2(1, 1) }, uParams: { value: new THREE.Vector4() }, uExtra: { value: new THREE.Vector4() }, uSeed: { value: 0 }, uMotion: { value: new THREE.Vector2() } },
    vertexShader,
    fragmentShader: `
      #define EFFECT ${scenePassKeys.indexOf(key)}
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 uResolution, uMotion;
      uniform vec4 uParams, uExtra;
      uniform float uSeed;
      varying vec2 vUv;
      vec4 sampleAt(vec2 uv) { return texture2D(tDiffuse, clamp(uv, vec2(0.0), vec2(1.0))); }
      ${COLOR_GRADE_GLSL}
      ${RANDOM_GLSL}
      float random(vec2 cell) { return raylightRandom(cell,uSeed); }
      void main(){
        vec4 col=sampleAt(vUv);
        #if EFFECT == 0
          vec3 glow=vec3(0.0);
          float radius=max(1.0,uResolution.x/240.0)*max(0.0,uParams.z);
          for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
            vec4 s=sampleAt(vUv+vec2(float(x),float(y))*radius/uResolution);
            float lum=dot(s.rgb,vec3(.2126,.7152,.0722));
            float soft=max(.0001,uParams.w);
            glow+=s.rgb*smoothstep(uParams.y-soft,uParams.y+soft,lum)*max(0.0,lum-uParams.y)/max(lum,.0001);
          }
          col.rgb+=glow/9.0*uParams.x;
        #elif EFFECT == 1
          vec2 centered=(vUv-.5)*vec2(1.0,max(.1,uParams.z));
          float edge=clamp((length(centered)-uParams.y)*2.0+0.5,0.0,1.0);
          col.rgb*=1.0-edge*uParams.x;
        #elif EFFECT == 2
          vec4 accum=vec4(0.0); float count=clamp(uParams.y,2.0,32.0);
          for(int i=0;i<32;i++){ if(float(i)>=count) break;
            accum+=sampleAt(vUv-uMotion*(float(i)/(count-1.0))*uParams.x/360.0);
          }
          col=accum/count;
        #elif EFFECT == 3
          float edge=pow(clamp(length(vUv-.5)*2.0,0.0,1.0),max(.1,uParams.z));
          vec2 shift=vec2(uParams.x,uParams.y)*edge;
          col.r=sampleAt(vUv+shift).r;
          col.b=sampleAt(vUv-shift).b;
        #elif EFFECT == 4
          vec2 pixel=vec2(vUv.x,1.0-vUv.y)*uResolution-0.5;
          float coarse=random(floor(pixel/max(1.0,uParams.y)))-.5;
          float fine=random(floor(pixel))- .5;
          float grain=mix(coarse,fine,clamp(uParams.z,0.0,1.0));
          col.rgb+=vec3(grain*uParams.x)*col.a;
        #elif EFFECT == 5
          vec4 ghost=vec4(0.0);
          float angle=radians(uParams.w);
          vec2 shift=vec2(cos(angle),sin(angle))*uParams.y;
          float radius=uParams.z*uResolution.x/1920.0*max(.0,uExtra.x);
          for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++)
            ghost+=sampleAt(vUv+shift+vec2(float(x),float(y))*radius/uResolution);
          col.rgb+=ghost.rgb/9.0*uParams.x;
        #elif EFFECT == 6
          vec3 straight=col.a>.00001?col.rgb/col.a:vec3(0.0);
          straight=raylightGrade(straight,uParams,uExtra.x);
          float luma=dot(straight,vec3(.2126,.7152,.0722));
          straight+=vec3(uExtra.y* smoothstep(.45,1.0,luma)+uExtra.z*(1.0-smoothstep(0.0,.55,luma)));
          col.rgb=straight*col.a;
        #elif EFFECT == 7
          float amount=1.0;
          float soft=max(.1,uExtra.x);
          if(uParams.x>0.0) amount=min(amount,pow(clamp((1.0-vUv.y)/uParams.x,0.0,1.0),1.0/soft));
          if(uParams.y>0.0) amount=min(amount,pow(clamp(vUv.y/uParams.y,0.0,1.0),1.0/soft));
          if(uParams.z>0.0) amount=min(amount,pow(clamp(vUv.x/uParams.z,0.0,1.0),1.0/soft));
          if(uParams.w>0.0) amount=min(amount,pow(clamp((1.0-vUv.x)/uParams.w,0.0,1.0),1.0/soft));
          col.rgb*=clamp(amount,0.0,1.0);
        #elif EFFECT == 8
          float noise=fract(sin(floor((1.0-vUv.y)*max(2.0,uParams.y))*12.9898+uSeed*78.233)*43758.5453);
          float shift=noise>1.0-uParams.x*.2?(noise-.5)*uParams.x*.1:0.0;
          col=sampleAt(vUv+vec2(shift,0.0));
          col.r=sampleAt(vUv+vec2(shift+uParams.x*uParams.z/uResolution.x,0.0)).r;
          col.b=sampleAt(vUv+vec2(shift-uParams.x*uParams.z/uResolution.x,0.0)).b;
        #elif EFFECT == 9
          // Studio Depth-Buffer Depth of Field
          float depthVal = texture2D(tDepth, vUv).r;
          float zNear = uExtra.y > 0.0 ? uExtra.y : 0.1;
          float zFar = uExtra.z > 0.0 ? uExtra.z : 100.0;
          float linearDepth = (2.0 * zNear) / (zFar + zNear - depthVal * (zFar - zNear));
          
          float focalPlane = uParams.x;
          float focusRange = max(0.001, uParams.y);
          float bokehScale = max(0.0, uParams.z);
          float coc = clamp(abs(linearDepth - focalPlane) / focusRange * bokehScale * (2.8 / max(.1,uParams.w)), 0.0, 1.0);
          
          if (coc > 0.003) {
            vec4 accum = vec4(0.0);
            float total = 0.0;
            float maxR = coc * min(32.0, uResolution.y * 0.035);
            for (int i = 0; i < 24; i++) {
              float fi = float(i);
              float angle = fi * 2.39996323;
              float r = sqrt((fi + 0.5) / 24.0) * maxR;
              vec2 offset = vec2(cos(angle), sin(angle)) * r / uResolution;
              if (uExtra.w == 1.0) offset.x *= 2.0; // Anamorphic
              vec4 s = sampleAt(vUv + offset);
              float highlight=max(0.0,dot(s.rgb,vec3(.2126,.7152,.0722))-uExtra.x);
              s.rgb+=vec3(highlight*uMotion.x);
              accum += s;
              total += 1.0;
            }
            col = accum / total;
          }
        #endif
        gl_FragColor=col;
      }`,
  });
}

export function configureSceneEffectPass(pass: ShaderPass, key: EffectKey, effects: EvaluatedEffects, width: number, height: number, motion = { x: 0, y: 0 }) {
  const e = effects.state, p = pass.uniforms.uParams.value as THREE.Vector4;
  p.set(0, 0, 0, 0);
  pass.uniforms.uExtra.value.set(0, 0, 0, 0);
  pass.uniforms.uResolution.value.set(width, height);
  pass.uniforms.uMotion.value.set(motion.x, -motion.y);
  pass.uniforms.uSeed.value = effects.deterministicSeed;
  switch (key) {
    case 'bloom': p.set(e.bloom.intensity, e.bloom.threshold, e.bloom.radius ?? 1, e.bloom.softness ?? 0.5); break;
    case 'vignette': p.set(e.vignette.intensity, e.vignette.midpoint ?? 0.5, e.vignette.roundness ?? 1, 0); break;
    case 'motionBlur': p.set(e.motionBlur.shutterAngle, Math.max(2, Math.min(32, Math.round(e.motionBlur.samples ?? 8))), 0, 0); break;
    case 'chromaticAberration': p.set(e.chromaticAberration.offset, e.chromaticAberration.verticalOffset ?? 0, e.chromaticAberration.edgeStrength ?? 1, 0); break;
    case 'filmGrain': p.set(e.filmGrain.intensity, e.filmGrain.size, e.filmGrain.softness ?? 0, 0); break;
    case 'ghost': p.set(e.ghost.opacity, e.ghost.offset, e.ghost.blur, e.ghost.angle ?? 0); pass.uniforms.uExtra.value.x = e.ghost.spread ?? 1; break;
    case 'colorGrade': p.set(e.colorGrade.exposure, e.colorGrade.contrast, e.colorGrade.saturation, e.colorGrade.temperature ?? 0); pass.uniforms.uExtra.value.set(e.colorGrade.tint ?? 0, e.colorGrade.highlights ?? 0, e.colorGrade.shadows ?? 0, 0); break;
    case 'edgeFade': p.set(e.edgeFade.top, e.edgeFade.bottom, e.edgeFade.left ?? 0, e.edgeFade.right ?? 0); pass.uniforms.uExtra.value.x = e.edgeFade.softness ?? 1; break;
    case 'glitch': p.set(e.glitch.intensity, e.glitch.bandSize ?? 50, e.glitch.colorShift ?? 0.5, 0); break;
    case 'depthOfField': {
      const dof = e.depthOfField;
      const focusDist = Math.max(0.01, Math.min(1.0, (dof.target?.z ?? 0) * 0.1 + 0.5));
      p.set(
        focusDist,
        Math.max(0.005, dof.focusRange ?? 0.1),
        Math.max(0.0, dof.bokehScale ?? 1.0),
        dof.aperture ?? 2.8
      );
      pass.uniforms.uExtra.value.set(
        dof.highlightThreshold ?? 0.8,
        0.1,
        100.0,
        dof.bokehShape === 'anamorphic' ? 1.0 : 0.0
      );
      pass.uniforms.uMotion.value.x = dof.highlightIntensity ?? 0;
      break;
    }
  }
}

/** Explicit conversion is required: colorspace_fragment targets linear when rendering to a composer buffer. */
export function createOutputEncodingPass(): ShaderPass {
  return new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader, fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      vec3 rgb=max(vec3(0.0),c.a>.00001?c.rgb/c.a:vec3(0.0));
      vec3 encoded=mix(1.055*pow(rgb,vec3(1.0/2.4))-.055,rgb*12.92,lessThanEqual(rgb,vec3(.0031308)));
      gl_FragColor=vec4(encoded*c.a,c.a);
    }` });
}
