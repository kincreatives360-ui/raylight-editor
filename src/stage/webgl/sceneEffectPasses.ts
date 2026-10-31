import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { EffectKey } from '../../model/types';
import type { EvaluatedEffects } from '../../engine/evaluateEffects';
import { COLOR_GRADE_GLSL, RANDOM_GLSL } from './shaderPrimitives';

export const scenePassKeys: EffectKey[] = ['bloom', 'vignette', 'motionBlur', 'chromaticAberration', 'filmGrain', 'ghost', 'colorGrade', 'edgeFade', 'glitch', 'depthOfField', 'atmosphere', 'gradientMap', 'fishEye', 'lensDistortion'];
const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

// Each pass reads the result of the preceding pass. All intermediate RGB is linear and premultiplied.
export function createSceneEffectPass(key: EffectKey): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, tDepth: { value: null }, uResolution: { value: new THREE.Vector2(1, 1) },
      uParams: { value: new THREE.Vector4() }, uExtra: { value: new THREE.Vector4() }, uExtra2: { value: new THREE.Vector4() },
      uFringe: { value: new THREE.Vector4() }, uColor: { value: new THREE.Color('#ffffff') },
      uStops: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uStopOpacity: { value: Array(8).fill(1) }, uStopCount: { value: 2 },
      uSeed: { value: 0 }, uMotion: { value: new THREE.Vector2() },
    },
    vertexShader,
    fragmentShader: `
      #define EFFECT ${scenePassKeys.indexOf(key)}
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 uResolution, uMotion;
      uniform vec4 uParams, uExtra, uExtra2, uFringe;
      uniform vec3 uColor;
      uniform vec4 uStops[8];
      uniform float uStopOpacity[8];
      uniform int uStopCount;
      uniform float uSeed;
      varying vec2 vUv;
      vec4 sampleAt(vec2 uv) { return texture2D(tDiffuse, clamp(uv, vec2(0.0), vec2(1.0))); }
      ${COLOR_GRADE_GLSL}
      ${RANDOM_GLSL}
      float random(vec2 cell) { return raylightRandom(cell,uSeed); }
      vec2 rotate2(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
      void main(){
        vec4 col=sampleAt(vUv);
        #if EFFECT == 0
          vec3 glow=vec3(0.0);
          float radius=max(1.0,uResolution.x/240.0)*max(0.0,uParams.z);
          float soft=max(.0001,uParams.w);
          float total=0.0;
          for(int i=0;i<16;i++){
            float fi=float(i);
            float angle=fi*2.39996323;
            float r=sqrt((fi+0.5)/16.0)*radius;
            vec2 offset=vec2(cos(angle),sin(angle))*r/uResolution;
            vec4 s=sampleAt(vUv+offset);
            float lum=dot(s.rgb,vec3(.2126,.7152,.0722));
            float w=smoothstep(uParams.y-soft,uParams.y+soft,lum)*max(0.0,lum-uParams.y)/max(lum,.0001);
            glow+=s.rgb*w;
            total+=1.0;
          }
          for(int i=0;i<8;i++){
            float fi=float(i);
            float angle=fi*2.39996323+1.2;
            float r=sqrt((fi+0.5)/8.0)*radius*2.0;
            vec2 offset=vec2(cos(angle),sin(angle))*r/uResolution;
            vec4 s=sampleAt(vUv+offset);
            float lum=dot(s.rgb,vec3(.2126,.7152,.0722));
            float w=smoothstep(uParams.y-soft,uParams.y+soft,lum)*max(0.0,lum-uParams.y)/max(lum,.0001)*.45;
            glow+=s.rgb*w;
            total+=0.45;
          }
          vec3 bloom = (glow / max(0.001, total)) * (uParams.x * 2.5);
          if (uExtra.x == 1.0) col.rgb += bloom;
          else if (uExtra.x == 2.0) col.rgb = mix(col.rgb, 2.0 * col.rgb * bloom + col.rgb * col.rgb * (1.0 - 2.0 * bloom), step(.5, col.rgb));
          else col.rgb = 1.0 - (1.0 - col.rgb) * (1.0 - clamp(bloom, 0.0, 1.0));
        #elif EFFECT == 1
          vec2 centered=(vUv-.5)*vec2(1.0,max(.1,uParams.z));
          float edge=clamp((length(centered)-uParams.y)*2.0+0.5,0.0,1.0);
          col.rgb*=1.0-edge*uParams.x;
        #elif EFFECT == 2
          vec4 accum=vec4(0.0); float count=clamp(uParams.y,2.0,32.0);
          for(int i=0;i<32;i++){ if(float(i)>=count) break;
            accum += sampleAt(vUv - uMotion * ((float(i) - count * 0.5) / (count - 1.0)) * (uParams.x / 180.0));
          }
          col=accum/count;
        #elif EFFECT == 3
          vec2 center=vec2(.5+uExtra.y*.5,.5-uExtra.z*.5);
          vec2 radial=vec2(vUv.x-center.x,center.y-vUv.y);
          vec2 direction=uParams.w>.5?vec2(cos(radians(uParams.z)),-sin(radians(uParams.z))):normalize(radial+vec2(.00001));
          float edge=pow(clamp(length(radial)*2.0,0.0,1.0),max(.1,uExtra.x));
          float fade=smoothstep(0.0,max(.001,uParams.y),length(radial)*2.0);
          vec2 fringe=direction*uParams.x*edge*fade+vec2(0.0,-uExtra.w);
          float hue=-radians(uFringe.w);
          vec2 red=rotate2(fringe*uFringe.x,hue), green=rotate2(fringe*uFringe.y,hue), blue=rotate2(fringe*uFringe.z,hue);
          col.r=sampleAt(vUv+vec2(red.x,-red.y)).r;
          col.g=sampleAt(vUv+vec2(green.x,-green.y)).g;
          col.b=sampleAt(vUv+vec2(blue.x,-blue.y)).b;
        #elif EFFECT == 4
          vec2 pixel=vec2(vUv.x,1.0-vUv.y)*uResolution-0.5;
          pixel.y*=uExtra.x;
          float coarse=random(floor(pixel/max(1.0,uParams.y)))-.5;
          float fine=random(floor(pixel))- .5;
          float grain=mix(coarse,fine,clamp(uParams.z,0.0,1.0));
          vec3 independent=vec3(random(floor(pixel)+vec2(17.0,0.0)),random(floor(pixel)+vec2(0.0,31.0)),random(floor(pixel)+vec2(47.0,13.0)))-.5;
          vec3 grainRgb=mix(vec3(grain),independent,uFringe.x);
          float lum=dot(col.rgb,vec3(.2126,.7152,.0722));
          float tone=mix(uExtra2.x,uExtra2.y,smoothstep(0.0,uExtra.y,lum));
          tone=mix(tone,uExtra2.z,smoothstep(uExtra.y,1.0,lum));
          float protect=mix(1.0,smoothstep(0.0,max(.001,uExtra.y),lum),uFringe.z);
          vec3 grainColor=grainRgb*uParams.x*tone*protect*mix(vec3(1.0),uColor,uFringe.w);
          if(uExtra.w==1.0) col.rgb+=grainColor*col.a;
          else if(uExtra.w==2.0) col.rgb=mix(col.rgb,col.rgb+grainColor*col.a,clamp(uParams.x,0.0,1.0));
          else if(uExtra.w==3.0) col.rgb*=1.0+grainColor;
          else col.rgb+=grainColor*col.a;
        #elif EFFECT == 5
          vec4 ghost=vec4(0.0);
          float angle=radians(uParams.w);
          vec2 shift=-vec2(cos(angle),sin(angle))*uParams.y;
          float radius=uParams.z*uResolution.x/1920.0*max(.0,uExtra.x);
          float ghostTotal=0.0;
          for(int i=0;i<16;i++){
            float fi=float(i);
            float angle=fi*2.39996323;
            float r=sqrt((fi+0.5)/16.0)*radius;
            ghost+=sampleAt(vUv+shift+vec2(cos(angle),sin(angle))*r/uResolution);
            ghostTotal+=1.0;
          }
          vec3 ghostColor = ghost.rgb / max(1.0, ghostTotal);
          col.rgb = mix(col.rgb, 1.0 - (1.0 - col.rgb) * (1.0 - ghostColor), uParams.x);
        #elif EFFECT == 6
          vec3 straight=col.a>.00001?col.rgb/col.a:vec3(0.0);
          straight=raylightGrade(straight,uParams,uExtra.x);
          float luma=dot(straight,vec3(.2126,.7152,.0722));
          straight+=vec3(uExtra.w+uExtra.y*smoothstep(.45,1.0,luma)+uExtra.z*(1.0-smoothstep(0.0,.55,luma)));
          float black=max(0.0,uExtra2.z), white=max(black+.001,uExtra2.w);
          straight=pow(clamp((straight-black)/(white-black),0.0,1.0),vec3(1.0/max(.1,uExtra2.x)));
          float gradedLuma=dot(straight,vec3(.2126,.7152,.0722));
          straight=mix(vec3(gradedLuma),straight,1.0+uExtra2.y*(1.0-gradedLuma));
          col.rgb=straight*col.a;
        #elif EFFECT == 7
          float amount=1.0;
          float soft=max(.1,uExtra.x);
          if(uParams.x>0.0) amount=min(amount,pow(clamp((1.0-vUv.y)/uParams.x,0.0,1.0),1.0/soft));
          if(uParams.y>0.0) amount=min(amount,pow(clamp(vUv.y/uParams.y,0.0,1.0),1.0/soft));
          if(uParams.z>0.0) amount=min(amount,pow(clamp(vUv.x/uParams.z,0.0,1.0),1.0/soft));
          if(uParams.w>0.0) amount=min(amount,pow(clamp((1.0-vUv.x)/uParams.w,0.0,1.0),1.0/soft));
          float fade=clamp(amount,0.0,1.0);
          col.rgb=mix(uColor*col.a,col.rgb,fade);
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
          float viewZ = (zNear * zFar) / max(0.0001, zFar - depthVal * (zFar - zNear));
          
          float focalPlane = uParams.x;
          float focusRange = max(0.01, uParams.y);
          float bokehScale = max(0.0, uParams.z);
          float deltaZ = abs(viewZ - focalPlane);
          float coc = clamp((deltaZ / max(0.1, viewZ)) * (bokehScale * 2.0 / max(0.1, uParams.w)) / focusRange * max(.01,uMotion.y), 0.0, 1.0);
          
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
        #elif EFFECT == 10
          float zNear=.1, zFar=100.0;
          float depthVal=texture2D(tDepth,vUv).r;
          float linearDepth=(2.0*zNear)/(zFar+zNear-depthVal*(zFar-zNear));
          float depthMix=uExtra.w>.5?smoothstep(uParams.w,uParams.w+max(.001,uExtra.x),linearDepth):1.0;
          float heightMask=smoothstep(1.0-uExtra.y,1.0,1.0-vUv.y);
          float amount=clamp(uParams.x*depthMix+uParams.y*heightMask+uParams.z,0.0,1.0);
          col.rgb=mix(col.rgb,uColor*col.a,amount);
        #elif EFFECT == 11
          float lum=dot(col.rgb,vec3(.2126,.7152,.0722));
          float position=clamp((lum-uParams.y)*uParams.z,0.0,1.0);
          vec4 lower=uStops[0], upper=uStops[1];
          float lowerOpacity=uStopOpacity[0], upperOpacity=uStopOpacity[1];
          for(int i=1;i<8;i++){
            if(i>=uStopCount) break;
            vec4 nextStop=uStops[i];
            if(position<=nextStop.w){ upper=nextStop; upperOpacity=uStopOpacity[i]; break; }
            lower=nextStop; upper=nextStop; lowerOpacity=uStopOpacity[i]; upperOpacity=uStopOpacity[i];
          }
          float span=max(.0001,upper.w-lower.w);
          vec3 mapped=mix(lower.rgb,upper.rgb,clamp((position-lower.w)/span,0.0,1.0));
          float stopOpacity=mix(lowerOpacity,upperOpacity,clamp((position-lower.w)/span,0.0,1.0));
          vec3 blended=mapped;
          if(uExtra.x==1.0) blended=col.rgb*mapped;
          else if(uExtra.x==2.0) blended=1.0-(1.0-col.rgb)*(1.0-mapped);
          else if(uExtra.x==3.0) blended=mix(2.0*col.rgb*mapped,1.0-2.0*(1.0-col.rgb)*(1.0-mapped),step(.5,col.rgb));
          else if(uExtra.x==4.0) blended=mix(col.rgb-sqrt(max(vec3(0.0),col.rgb))*(1.0-2.0*mapped),col.rgb+(2.0*mapped-1.0)*(sqrt(col.rgb)-col.rgb),step(.5,mapped));
          else if(uExtra.x==5.0) blended=mix(2.0*col.rgb*mapped,1.0-2.0*(1.0-col.rgb)*(1.0-mapped),step(.5,mapped));
          else if(uExtra.x==6.0) blended=abs(col.rgb-mapped);
          else if(uExtra.x==7.0) blended=col.rgb+mapped-2.0*col.rgb*mapped;
          else if(uExtra.x==8.0) blended=max(col.rgb,mapped);
          else if(uExtra.x==9.0) blended=min(col.rgb,mapped);
          else if(uExtra.x==10.0) blended=min(vec3(1.0),col.rgb/max(vec3(.001),1.0-mapped));
          else if(uExtra.x==11.0) blended=1.0-min(vec3(1.0),(1.0-col.rgb)/max(vec3(.001),mapped));
          col.rgb=mix(col.rgb,blended,clamp(uParams.x*stopOpacity,0.0,1.0)*col.a);
        #elif EFFECT == 12 || EFFECT == 13
          vec2 center=vec2(.5+uParams.y*.5,.5-uParams.z*.5);
          vec2 p=vUv-center;
          float aspect=uResolution.x/uResolution.y*uParams.w;
          p.x*=aspect;
          float radius=length(p);
          float strength=uParams.x;
          float factor;
          if(EFFECT==12){
            float theta=atan(radius);
            factor=radius>.0001?tan(theta*(1.0+strength))/radius:1.0;
          }else{
            float r2=radius*radius;
            factor=uExtra.z>.5?1.0+strength*r2:1.0-strength*r2;
          }
          p*=factor;
          p.x/=aspect;
          vec2 warped=center+p;
          if(uExtra.x==1.0) warped=mix(warped,clamp(warped,0.0,1.0),.35);
          if(uExtra.x==2.0&&(warped.x<0.0||warped.x>1.0||warped.y<0.0||warped.y>1.0)) col=vec4(0.0);
          else col=sampleAt(warped);
        #endif
        gl_FragColor=col;
      }`,
  });
}

export function configureSceneEffectPass(pass: ShaderPass, key: EffectKey, effects: EvaluatedEffects, width: number, height: number, motion = { x: 0, y: 0 }) {
  const e = effects.state, p = pass.uniforms.uParams.value as THREE.Vector4;
  p.set(0, 0, 0, 0);
  pass.uniforms.uExtra.value.set(0, 0, 0, 0);
  pass.uniforms.uExtra2.value.set(0, 0, 0, 0);
  pass.uniforms.uFringe.value.set(1, 0, -1, 0);
  (pass.uniforms.uColor.value as THREE.Color).set('#ffffff');
  pass.uniforms.uResolution.value.set(width, height);
  pass.uniforms.uMotion.value.set(motion.x, -motion.y);
  pass.uniforms.uSeed.value = effects.deterministicSeed;
  switch (key) {
    case 'bloom':
      p.set(e.bloom.intensity, e.bloom.threshold, e.bloom.radius ?? 1, e.bloom.softness ?? 0.5);
      pass.uniforms.uExtra.value.x = ({ screen: 0, add: 1, softLight: 2 } as const)[e.bloom.blendMode ?? 'screen'];
      break;
    case 'vignette': p.set(e.vignette.intensity, e.vignette.midpoint ?? 0.5, e.vignette.roundness ?? 1, 0); break;
    case 'motionBlur': {
      const blur = e.motionBlur;
      p.set(blur.shutterAngle, Math.max(2, Math.min(32, Math.round(blur.samples ?? 8))), blur.angle ?? 0, blur.amount ?? 0.02);
      if (blur.direction === 'angle') {
        const rad = THREE.MathUtils.degToRad(blur.angle ?? 0);
        pass.uniforms.uMotion.value.set(Math.cos(rad) * (blur.amount ?? 0.02), -Math.sin(rad) * (blur.amount ?? 0.02));
      } else {
        pass.uniforms.uMotion.value.set(motion.x, -motion.y);
      }
      break;
    }
    case 'chromaticAberration': {
      const split=e.chromaticAberration;
      p.set(split.offset, split.softness ?? 0.6, split.angle ?? 0, split.mode === 'split' ? 1 : 0);
      pass.uniforms.uExtra.value.set(split.edgeStrength ?? 1, split.centerX ?? 0, split.centerY ?? 0, split.verticalOffset ?? 0);
      pass.uniforms.uFringe.value.set(split.channelRed ?? 1, split.channelGreen ?? 0, split.channelBlue ?? -1, split.fringeColorAngle ?? 0);
      break;
    }
    case 'filmGrain': {
      const grain=e.filmGrain;
      p.set(grain.intensity, grain.size, grain.softness ?? 0, grain.colorAmount ?? 0.4);
      pass.uniforms.uExtra.value.set(grain.aspect ?? 1, grain.midpoint ?? 0.4, grain.protectBlacks ? 1 : 0, ({ film: 0, overlay: 1, softLight: 2, multiply: 3 } as const)[grain.blendMode ?? 'film']);
      pass.uniforms.uExtra2.value.set(grain.shadowStrength ?? 0.7, grain.midStrength ?? 1, grain.highlightStrength ?? 0.45, grain.smooth ? 1 : 0);
      pass.uniforms.uFringe.value.set(grain.perChannel ? 1 : 0, grain.smooth ? 1 : 0, grain.protectBlacks ? 1 : 0, grain.colorAmount ?? 0.4);
      (pass.uniforms.uColor.value as THREE.Color).set(({ 'Tungsten 500': '#c4d9ff', 'Kodak 5219': '#ffd5a1', 'Fuji 400': '#d3ffd9', Custom: '#ffffff' } as const)[grain.stock ?? 'Tungsten 500']);
      pass.uniforms.uSeed.value = grain.motion === 'static' ? (grain.seed ?? 0) : grain.motion === '12fps' ? Math.floor(effects.deterministicSeed * 5) / 5 + (grain.seed ?? 0) : effects.deterministicSeed + (grain.seed ?? 0);
      break;
    }
    case 'ghost': p.set(e.ghost.opacity, e.ghost.offset, e.ghost.blur, e.ghost.angle ?? 0); pass.uniforms.uExtra.value.x = e.ghost.spread ?? 1; break;
    case 'colorGrade': p.set(e.colorGrade.exposure, e.colorGrade.contrast, e.colorGrade.saturation, e.colorGrade.temperature ?? 0); pass.uniforms.uExtra.value.set(e.colorGrade.tint ?? 0, e.colorGrade.highlights ?? 0, e.colorGrade.shadows ?? 0, e.colorGrade.lift ?? 0); pass.uniforms.uExtra2.value.set(e.colorGrade.gamma ?? 1, e.colorGrade.vibrance ?? 0, e.colorGrade.blackPoint ?? 0, e.colorGrade.whitePoint ?? 1); break;
    case 'edgeFade': p.set(e.edgeFade.top, e.edgeFade.bottom, e.edgeFade.left ?? 0, e.edgeFade.right ?? 0); pass.uniforms.uExtra.value.x = e.edgeFade.softness ?? 1; (pass.uniforms.uColor.value as THREE.Color).set(e.edgeFade.color ?? '#0a0a0c'); break;
    case 'glitch': p.set(e.glitch.intensity, e.glitch.bandSize ?? 50, e.glitch.colorShift ?? 0.5, 0); break;
    case 'depthOfField': {
      const dof = e.depthOfField;
      const camZ = 3.2;
      const targetZ = dof.target?.z ?? 0;
      const focusDist = Math.max(0.1, Math.abs(camZ - targetZ));
      p.set(
        focusDist,
        Math.max(0.01, dof.focusRange ?? 0.35),
        Math.max(0.0, dof.bokehScale ?? 4.5),
        dof.aperture ?? 2.8
      );
      pass.uniforms.uExtra.value.set(
        dof.highlightThreshold ?? 0.8,
        0.1,
        100.0,
        dof.bokehShape === 'anamorphic' ? 1.0 : 0.0
      );
      pass.uniforms.uMotion.value.x = dof.highlightIntensity ?? 0;
      pass.uniforms.uMotion.value.y = (dof.focalLength ?? 50) / 50;
      break;
    }
    case 'atmosphere': {
      const atmosphere=e.atmosphere;
      p.set(atmosphere.fog, atmosphere.mist, atmosphere.haze, atmosphere.start);
      pass.uniforms.uExtra.value.set(atmosphere.reach, atmosphere.mistHeight, 0.1, atmosphere.depthEnabled ? 1 : 0);
      (pass.uniforms.uColor.value as THREE.Color).set(atmosphere.color);
      break;
    }
    case 'gradientMap': {
      const gradient=e.gradientMap;
      const stops=[...gradient.stops].sort((a,b)=>a.at-b.at).slice(0,8);
      (pass.uniforms.uStopCount as { value: number }).value=stops.length;
      const uniforms=pass.uniforms.uStops.value as THREE.Vector4[];
      const opacities=pass.uniforms.uStopOpacity.value as number[];
      for(let i=0;i<8;i++){
        const stop=stops[Math.min(i,stops.length-1)];
        if(stop){
          const color=new THREE.Color(stop.color);
          uniforms[i].set(color.r,color.g,color.b,stop.at);
          opacities[i]=stop.opacity??1;
        }
      }
      p.set(gradient.blend,gradient.shift,gradient.spread,0);
      pass.uniforms.uExtra.value.x=({ normal: 0, multiply: 1, screen: 2, overlay: 3, softLight: 4, hardLight: 5, difference: 6, exclusion: 7, lighten: 8, darken: 9, colorDodge: 10, colorBurn: 11 } as const)[gradient.blendMode];
      break;
    }
    case 'fishEye': {
      const fish=e.fishEye;
      p.set(fish.amount,fish.centerX,fish.centerY,fish.scale);
      pass.uniforms.uExtra.value.x=({ fill: 0, balanced: 1, none: 2 } as const)[fish.edgeMode];
      break;
    }
    case 'lensDistortion': {
      const lens=e.lensDistortion;
      const measure=lens.measure==='width'?1:lens.measure==='height'?width/height:Math.hypot(width,height)/height;
      p.set(lens.strength,lens.centerX,lens.centerY,measure);
      pass.uniforms.uExtra.value.x=({ fill: 0, balanced: 1, none: 2 } as const)[lens.edgeMode];
      pass.uniforms.uExtra.value.z=lens.mode==='barrel'?1:0;
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
