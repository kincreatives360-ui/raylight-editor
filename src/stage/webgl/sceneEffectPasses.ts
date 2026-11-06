import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { EffectKey } from '../../model/types';
import type { EvaluatedEffects } from '../../engine/evaluateEffects';
import { COLOR_GRADE_GLSL, RANDOM_GLSL } from './shaderPrimitives';
import {
  computePhysicalCocGain,
  calculateFocusDistanceToPoint,
  getBokehShapeConfig,
  DEFAULT_SCENE_SCALE,
} from '../../engine/cameraOptics';

export const scenePassKeys: EffectKey[] = ['bloom', 'vignette', 'motionBlur', 'chromaticAberration', 'filmGrain', 'ghost', 'colorGrade', 'edgeFade', 'glitch', 'atmosphere', 'gradientMap', 'fishEye', 'lensDistortion', 'depthOfField'];
const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
/** Authored frame height that blur sizes (in pixels) are written against; matches the film-grain pass. */
export const DOF_REFERENCE_HEIGHT = 1080;
/**
 * Blur sizes are authored for a 1080-pixel-high frame. Scaling them to the real render height keeps the look the same
 * on a 1x or 2x display, a small preview, and a 4K export; unscaled, the same project blurred ~2x harder in a
 * 540-pixel preview than in a 1080p export.
 */
export function dofResolutionScale(renderHeight: number): number {
  return Number.isFinite(renderHeight) && renderHeight > 0 ? Math.max(0.25, renderHeight / DOF_REFERENCE_HEIGHT) : 1;
}

// Each pass reads the result of the preceding pass. All intermediate RGB is linear and premultiplied.
export function createSceneEffectPass(key: EffectKey): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, tDepth: { value: null }, uResolution: { value: new THREE.Vector2(1, 1) },
      uParams: { value: new THREE.Vector4() }, uExtra: { value: new THREE.Vector4() }, uExtra2: { value: new THREE.Vector4() },
      uFringe: { value: new THREE.Vector4() }, uColor: { value: new THREE.Color('#ffffff') },
      uStops: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uStopOpacity: { value: Array(8).fill(1) }, uStopCount: { value: 2 },
      uSeed: { value: 0 }, uMotion: { value: new THREE.Vector2() }, uDebug: { value: 0 },
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
      uniform float uDebug;
      varying vec2 vUv;
      // Explicit mip levels: sampling stays predictable inside branches and loops, and blurs can read pre-averaged texels.
      vec4 sampleAt(vec2 uv) { return textureLod(tDiffuse, clamp(uv, vec2(0.0), vec2(1.0)), 0.0); }
      vec4 sampleLod(vec2 uv, float lod) { return textureLod(tDiffuse, clamp(uv, vec2(0.0), vec2(1.0)), lod); }
      // Size of one blur tap in pixels -> mip level that averages exactly that footprint.
      float blurLod(float footprintPx) { return clamp(log2(max(footprintPx, 1.0)), 0.0, 8.0); }
      // Per-pixel grain (interleaved gradient noise): breaks up any remaining sample pattern so it never reads as echoes.
      float interleavedNoise() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); }
      ${COLOR_GRADE_GLSL}
      ${RANDOM_GLSL}
      float random(vec2 cell) { return raylightRandom(cell,uSeed); }
      vec2 rotate2(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
      #if EFFECT == 13
      float dofLinearDepth(float depth) {
        float zNear = max(0.001, uExtra2.x);
        float zFar = max(zNear + 0.01, uExtra2.y);
        return (zNear * zFar) / (zFar - depth * (zFar - zNear));
      }
      // Signed blur size in pixels: negative in front of the focus plane, positive behind it.
      float dofCoc(float linearDepth) {
        float focusDist = max(0.001, uParams.x);
        float signedDist = linearDepth - focusDist;
        float maxBlurPx = max(0.5, uParams.z);
        float isPhysical = uColor.g;
        float coc;
        if (isPhysical > 0.5) {
          float lensRatio = abs(signedDist) / max(linearDepth, 1e-4);
          float magnitude = clamp(lensRatio * uExtra.y, 0.0, 1.0);
          coc = magnitude * maxBlurPx;
        } else {
          float focusRange = max(0.02, uExtra.x);
          float outside = max(0.0, abs(signedDist) - focusRange * 0.5);
          coc = outside * (2.8 / max(0.5, uParams.y)) * max(0.05, uExtra.z) * max(0.2, uExtra.w) * 8.0;
          coc = min(coc, maxBlurPx);
          coc *= smoothstep(0.0, max(0.02, focusRange * 0.3), outside);
        }
        return signedDist < 0.0 ? -coc : coc;
      }
      vec2 shapeBokehTap(vec2 tap, vec2 uv) {
        vec2 stretch = uMotion.xy;
        vec2 shaped = tap * (length(stretch) > 0.01 ? stretch : vec2(1.0, 1.0));
        float catEye = uFringe.z;
        if (catEye <= 0.0) return shaped;
        vec2 fromCenter = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
        float dist = length(fromCenter);
        if (dist < 1e-4) return shaped;
        vec2 radial = fromCenter / dist;
        vec2 tangent = vec2(-radial.y, radial.x);
        float squeeze = 1.0 - catEye * smoothstep(0.0, 0.7, dist);
        return radial * (dot(shaped, radial) * squeeze) + tangent * dot(shaped, tangent);
      }
      float bokehRimWeight(float normalizedRadius) {
        float rim = uFringe.w;
        if (rim <= 0.0) return 1.0;
        float rimDist = abs(normalizedRadius - 1.0);
        return 1.0 + smoothstep(0.35, 0.0, rimDist) * rim * 1.8;
      }
      float bokehSoftnessWeight(float normalizedRadius) {
        float softness = uColor.r;
        if (softness <= 0.0) return 1.0;
        return mix(1.0, exp(-4.0 * normalizedRadius * normalizedRadius), softness);
      }
      // Aperture-shaped sample on the unit disc; z compensates the sample density of polygon shapes.
      vec3 dofTap(float index, float count, float jitter, float blades, float rotation) {
        float radius = sqrt((index + 0.5) / count);
        float angle = (index + jitter) * 2.39996323;
        float density = 1.0;
        if (blades >= 3.0) {
          float segment = 6.2831853 / blades;
          float local = mod(angle - rotation, segment) - segment * 0.5;
          float edge = cos(3.14159265 / blades) / cos(local);
          radius *= edge;
          density = edge * edge;
        }
        return vec3(vec2(cos(angle), sin(angle)) * radius, density);
      }
      #endif
      void main(){
        vec4 col=sampleAt(vUv);
        #if EFFECT == 0
          // Bright-pass glow gathered from mip-filtered taps over a disc: smooth, no repeated copies.
          vec3 glow=vec3(0.0);
          float reach=max(1.0,uResolution.x/240.0)*max(0.0,uParams.z)*2.0;
          float soft=max(.0001,uParams.w);
          float jitter=interleavedNoise();
          float total=0.0;
          float lod=blurLod(reach*sqrt(3.14159265/24.0));
          for(int i=0;i<24;i++){
            float fi=float(i);
            float phase=(fi+0.5)/24.0;
            float angle=(fi+jitter)*2.39996323;
            vec2 offset=vec2(cos(angle),sin(angle))*sqrt(phase)*reach/uResolution;
            vec3 s=sampleLod(vUv+offset,lod).rgb;
            float lum=dot(s,vec3(.2126,.7152,.0722));
            float gate=smoothstep(uParams.y-soft,uParams.y+soft,lum)*max(0.0,lum-uParams.y)/max(lum,.0001);
            float w=exp(-2.5*phase);
            glow+=s*gate*w;
            total+=w;
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
          // Enough taps for the streak length, jittered along the streak and read from pre-averaged mips.
          vec2 streak=uMotion*(uParams.x/180.0);
          float streakPx=length(streak*uResolution);
          float count=floor(clamp(max(uParams.y,streakPx*0.5),2.0,48.0)+0.5);
          float jitter=interleavedNoise();
          float lod=blurLod(streakPx/count*0.7);
          vec4 accum=vec4(0.0);
          for(int i=0;i<48;i++){ if(float(i)>=count) break;
            float t=(float(i)+jitter)/count-0.5;
            accum += sampleLod(vUv - streak*t, lod);
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
          // Normalize to 1080p-equivalent author space: grain cells keep the
          // same size relative to the frame at 720p, 4K, or any viewport.
          pixel*=1080.0/max(1.0,uResolution.y);
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
          // uFringe.y (smooth) reduces grain intensity for a softer film look
          float grainSmoothFactor = 1.0 - uFringe.y * 0.5;
          grainColor *= grainSmoothFactor;
          if(uExtra.w==1.0) col.rgb+=grainColor*col.a;
          else if(uExtra.w==2.0) col.rgb=mix(col.rgb,col.rgb+grainColor*col.a,clamp(uParams.x,0.0,1.0));
          else if(uExtra.w==3.0) col.rgb*=1.0+grainColor;
          else col.rgb+=grainColor*col.a;
        #elif EFFECT == 5
          float gAngle=radians(uParams.w);
          vec2 shift=-vec2(cos(gAngle),sin(gAngle))*uParams.y;
          float reach=uParams.z*uResolution.x/1920.0*max(.0,uExtra.x);
          vec3 ghostColor=sampleAt(vUv+shift).rgb;
          if(reach>0.5){
            float jitter=interleavedNoise();
            float lod=blurLod(reach*sqrt(3.14159265/24.0));
            vec3 ghost=vec3(0.0);
            float ghostTotal=0.0;
            for(int i=0;i<24;i++){
              float fi=float(i);
              float phase=(fi+0.5)/24.0;
              float ang=(fi+jitter)*2.39996323;
              float w=exp(-2.5*phase);
              ghost+=sampleLod(vUv+shift+vec2(cos(ang),sin(ang))*sqrt(phase)*reach/uResolution,lod).rgb*w;
              ghostTotal+=w;
            }
            ghostColor=ghost/max(0.001,ghostTotal);
          }
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
          float zNear=max(0.001,uExtra2.x>0.0?uExtra2.x:0.1);
          float zFar=max(zNear+0.01,uExtra2.y>0.0?uExtra2.y:100.0);
          float depthVal=texture2D(tDepth,vUv).r;
          float linearDepth=(zNear*zFar)/(zFar-depthVal*(zFar-zNear));
          float depthMix=uExtra.w>.5?smoothstep(uParams.w,uParams.w+max(.001,uExtra.x),linearDepth):1.0;
          float heightMask=smoothstep(1.0-uExtra.y,1.0,1.0-vUv.y);
          float amount=clamp(uParams.x*depthMix+uParams.y*heightMask+uParams.z,0.0,1.0);
          col.rgb=mix(col.rgb,uColor*col.a,amount);
        #elif EFFECT == 10
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
        #elif EFFECT == 11 || EFFECT == 12
          vec2 center=vec2(.5+uParams.y*.5,.5-uParams.z*.5);
          vec2 p=vUv-center;
          float aspect=uResolution.x/uResolution.y*uParams.w;
          p.x*=aspect;
          float radius=length(p);
          float strength=uParams.x;
          float factor;
          if(EFFECT==11){
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

        #elif EFFECT == 13
          // Camera-style optical depth of field with physical thin-lens optics:
          //  - every sample carries its own blur size, so a sharp subject never takes colour from a blurry background
          //  - blurry foreground spreads over sharper areas behind it
          //  - each tap is weighted by 1 / (its blur disc area)
          //  - support for optical bokeh shapes (spherical, anamorphic stretch, cat-eye vignetting, portrait softness, rim)
          //  - specular highlight boosting via smooth hermite curve
          float jitter = interleavedNoise();
          float linearDepth = dofLinearDepth(textureLod(tDepth, vUv, 0.0).r);
          float signedCoc = dofCoc(linearDepth);
          float ownCoc = abs(signedCoc);
          float maxBlurPx = max(0.5, uParams.z);

          // Blurrier, nearer neighbours reach over this pixel even when it is sharp itself.
          float reach = ownCoc;
          for (int i = 0; i < 16; i++) {
            float fi = float(i);
            float angle = (fi + jitter) * 2.39996323;
            vec2 offsetPx = vec2(cos(angle), sin(angle)) * sqrt((fi + 0.5) / 16.0) * maxBlurPx;
            vec2 neighbourUv = clamp(vUv + offsetPx / uResolution, vec2(0.001), vec2(0.999));
            float neighbourSignedCoc = dofCoc(dofLinearDepth(textureLod(tDepth, neighbourUv, 0.0).r));
            if (neighbourSignedCoc < 0.0 && -neighbourSignedCoc >= length(offsetPx) * 0.5) reach = max(reach, -neighbourSignedCoc);
          }

          if (reach >= 0.4) {
            float count = floor(min(48.0, clamp(uParams.w, 4.0, 32.0) + clamp(reach * 0.5, 0.0, 16.0)) + 0.5);
            float lod = blurLod(reach * sqrt(3.14159265 / count) * 0.9);
            float highlightGain = uFringe.y;
            float highlightThreshold = uFringe.x;
            // Depth gap over which "behind" fades in, so the in-front / behind decision never flips on a single pixel.
            float depthTolerance = max(0.02, uExtra.x * 0.25);
            // Smallest disc a tap is normalised by: keeps a nearly sharp tap from dominating a wide gather.
            float minDisc = max(1.0, reach * 0.5);
            // A pixel that is itself in focus keeps its own colour; a blurred pixel is rebuilt from its taps only.
            float selfWeight = clamp(1.0 - ownCoc, 0.0, 1.0);
            vec4 accum = col * selfWeight;
            float wSum = selfWeight;
            for (int i = 0; i < 48; i++) {
              if (float(i) >= count) break;
              vec3 tap = dofTap(float(i), count, jitter, uExtra2.z, uExtra2.w);
              vec2 shapedTap = shapeBokehTap(tap.xy, vUv);
              vec2 offsetPx = shapedTap * reach;
              float dist = length(offsetPx);
              vec2 rawUv = vUv + offsetPx / uResolution;
              vec2 inside = step(vec2(0.0), rawUv) * step(rawUv, vec2(1.0));
              vec2 sampleUv = clamp(rawUv, vec2(0.001), vec2(0.999));
              float sampleDepth = dofLinearDepth(textureLod(tDepth, sampleUv, 0.0).r);
              float sampleCoc = abs(dofCoc(sampleDepth));
              // A sample behind this pixel can only spill as far as this pixel's own blur allows.
              float behind = smoothstep(-depthTolerance, depthTolerance, sampleDepth - linearDepth);
              float effective = mix(sampleCoc, min(sampleCoc, ownCoc), behind);
              // Soft rim: a wide ramp instead of a hard cut-off, so the disc edge never reads as a crisp outline.
              float cover = clamp((effective - dist) / max(1.0, effective * 0.25) + 1.0, 0.0, 1.0);
              float disc = minDisc / max(effective, minDisc);
              float normRadius = clamp(dist / max(effective, 1e-4), 0.0, 1.0);
              float rimW = bokehRimWeight(normRadius);
              float softW = bokehSoftnessWeight(normRadius);
              vec4 sampleTexel = sampleLod(sampleUv, lod);
              float lum = dot(sampleTexel.rgb, vec3(0.2126, 0.7152, 0.0722));
              float highlight = 1.0;
              if (highlightGain > 0.0 && lum > highlightThreshold) {
                float normLum = clamp((lum - highlightThreshold) / max(1.0 - highlightThreshold, 1e-4), 0.0, 1.0);
                highlight += highlightGain * normLum * normLum * (3.0 - 2.0 * normLum) * 3.5;
              }
              float w = cover * disc * disc * rimW * softW * tap.z * highlight * inside.x * inside.y;
              accum += sampleTexel * w;
              wSum += w;
            }
            if (wSum > 0.001) col = accum / wSum;
          }
          // Debug view (add ?dofDebug=1 to the page address): red = blur size, green = gather reach, blue = in focus.
          if (uDebug > 0.5) col.rgb = vec3(ownCoc / maxBlurPx, reach / maxBlurPx, ownCoc < 0.4 ? 1.0 : 0.0);

        #endif
        gl_FragColor=col;
      }`,
  });
}

const tempLocalFocusVec = new THREE.Vector3();

export function configureSceneEffectPass(
  pass: ShaderPass,
  key: EffectKey,
  effects: EvaluatedEffects,
  width: number,
  height: number,
  motion = { x: 0, y: 0 },
  cameraClip: {
    near: number;
    far: number;
    position?: { x: number; y: number; z: number };
    forward?: { x: number; y: number; z: number };
    matrixWorldInverse?: THREE.Matrix4;
  } = { near: 0.1, far: 100 },
  resolvedFocusTarget?: { x: number; y: number; z: number } | null
) {
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
      pass.uniforms.uExtra.value.x = ({ screen: 0, add: 1, softLight: 2 } as const)[(e.bloom.blendMode ?? 'screen') as 'screen' | 'add' | 'softLight'];
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
      pass.uniforms.uExtra.value.set(grain.aspect ?? 1, grain.midpoint ?? 0.4, grain.protectBlacks ? 1 : 0, ({ film: 0, overlay: 1, softLight: 2, multiply: 3 } as const)[(grain.blendMode ?? 'film') as 'film' | 'overlay' | 'softLight' | 'multiply']);
      pass.uniforms.uExtra2.value.set(grain.shadowStrength ?? 0.7, grain.midStrength ?? 1, grain.highlightStrength ?? 0.45, grain.smooth ? 1 : 0);
      pass.uniforms.uFringe.value.set(grain.perChannel ? 1 : 0, grain.smooth ? 1 : 0, grain.protectBlacks ? 1 : 0, grain.colorAmount ?? 0.4);
      (pass.uniforms.uColor.value as THREE.Color).set(({ 'Tungsten 500': '#c4d9ff', 'Kodak 5219': '#ffd5a1', 'Fuji 400': '#d3ffd9', Custom: '#ffffff' } as const)[(grain.stock ?? 'Tungsten 500') as 'Tungsten 500' | 'Kodak 5219' | 'Fuji 400' | 'Custom']);
      pass.uniforms.uSeed.value = grain.motion === 'static' ? (grain.seed ?? 0) : grain.motion === '12fps' ? Math.floor(effects.deterministicSeed * 5) / 5 + (grain.seed ?? 0) : effects.deterministicSeed + (grain.seed ?? 0);
      break;
    }
    case 'ghost': p.set(e.ghost.opacity, e.ghost.offset, e.ghost.blur, e.ghost.angle ?? 0); pass.uniforms.uExtra.value.x = e.ghost.spread ?? 1; break;
    case 'colorGrade': p.set(e.colorGrade.exposure, e.colorGrade.contrast, e.colorGrade.saturation, e.colorGrade.temperature ?? 0); pass.uniforms.uExtra.value.set(e.colorGrade.tint ?? 0, e.colorGrade.highlights ?? 0, e.colorGrade.shadows ?? 0, e.colorGrade.lift ?? 0); pass.uniforms.uExtra2.value.set(e.colorGrade.gamma ?? 1, e.colorGrade.vibrance ?? 0, e.colorGrade.blackPoint ?? 0, e.colorGrade.whitePoint ?? 1); break;
    case 'edgeFade': p.set(e.edgeFade.top, e.edgeFade.bottom, e.edgeFade.left ?? 0, e.edgeFade.right ?? 0); pass.uniforms.uExtra.value.x = e.edgeFade.softness ?? 1; (pass.uniforms.uColor.value as THREE.Color).set(e.edgeFade.color ?? '#0a0a0c'); break;
    case 'glitch': p.set(e.glitch.intensity, e.glitch.bandSize ?? 50, e.glitch.colorShift ?? 0.5, 0); break;
    case 'atmosphere': {
      const atmosphere=e.atmosphere;
      p.set(atmosphere.fog, atmosphere.mist, atmosphere.haze, atmosphere.start);
      pass.uniforms.uExtra.value.set(atmosphere.reach, atmosphere.mistHeight, 0.1, atmosphere.depthEnabled ? 1 : 0);
      pass.uniforms.uExtra2.value.set(Math.max(0.001, cameraClip.near), Math.max(0.01, cameraClip.far), 0, 0);
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
      pass.uniforms.uExtra.value.x=({ normal: 0, multiply: 1, screen: 2, overlay: 3, softLight: 4, hardLight: 5, difference: 6, exclusion: 7, lighten: 8, darken: 9, colorDodge: 10, colorBurn: 11 } as const)[gradient.blendMode as 'normal' | 'multiply' | 'screen' | 'overlay' | 'softLight' | 'hardLight' | 'difference' | 'exclusion' | 'lighten' | 'darken' | 'colorDodge' | 'colorBurn'];
      break;
    }
    case 'fishEye': {
      const fish=e.fishEye;
      p.set(fish.amount,fish.centerX,fish.centerY,fish.scale);
      pass.uniforms.uExtra.value.x=({ fill: 0, balanced: 1, none: 2 } as const)[fish.edgeMode as 'fill' | 'balanced' | 'none'];
      break;
    }
    case 'lensDistortion': {
      const lens=e.lensDistortion;
      const measure=lens.measure==='width'?1:lens.measure==='height'?width/height:Math.hypot(width,height)/height;
      p.set(lens.strength,lens.centerX,lens.centerY,measure);
      pass.uniforms.uExtra.value.x=({ fill: 0, balanced: 1, none: 2 } as const)[lens.edgeMode as 'fill' | 'balanced' | 'none'];
      pass.uniforms.uExtra.value.z=lens.mode==='barrel'?1:0;
      break;
    }
    case 'depthOfField': {
      const dof = e.depthOfField ?? ({} as NonNullable<typeof e.depthOfField>);
      let focusDist = Number(dof.focusDistance);
      if (!Number.isFinite(focusDist)) focusDist = 2.65;
      // Object-aware: when focusMode is target, selection, or pick, calculate focus distance toward target.
      // Depth is measured along the camera's view direction, matching the depth buffer, so focus stays
      // correct when the camera moves, orbits or zooms. When focusMode is manual, focusDist remains unchanged.
      const shouldCalculateTarget = dof.focusMode === 'target' || dof.focusMode === 'selection' || dof.focusMode === 'pick';
      if (shouldCalculateTarget) {
        // When focusAssetId is configured, use resolvedFocusTarget if provided.
        // If resolvedFocusTarget is null (focusAssetId was set but object was not found in scene),
        // do not fall back to stale dof.target.
        const target = (dof.focusAssetId !== undefined && dof.focusAssetId !== '')
          ? (resolvedFocusTarget ?? null)
          : (resolvedFocusTarget ?? dof.target);
        if (target) {
          if (cameraClip.matrixWorldInverse) {
            tempLocalFocusVec.set(target.x, target.y, target.z).applyMatrix4(cameraClip.matrixWorldInverse);
            const alongView = Math.max(-tempLocalFocusVec.z, 0.001);
            if (Number.isFinite(alongView) && alongView > 0.001) focusDist = alongView;
          } else {
            const { position, forward } = cameraClip;
            if (position && forward) {
              const alongView = calculateFocusDistanceToPoint(target, position, forward);
              if (Number.isFinite(alongView) && alongView > 0.001) focusDist = alongView;
            } else {
              const tz = Number(target.z);
              if (Number.isFinite(tz)) focusDist = Math.max(0.05, Math.abs(2.65 - tz));
            }
          }
        }
      }
      const aperture = Number(dof.aperture);
      const maxBlur = Number(dof.maxBlur);
      let samples = Number(dof.samples);
      // Quality presets override sample count when present
      if (dof.quality === 'draft') samples = Math.min(samples || 8, 10);
      else if (dof.quality === 'high') samples = Math.max(samples || 24, 28);
      else if (!Number.isFinite(samples)) samples = 16;

      const focusRange = Math.max(0.02, Number(dof.focusRange) || 0.85);
      const bokehScale = Math.max(0.05, Number(dof.bokehScale) || 1);
      const focalLength = Number.isFinite(Number(dof.focalLength)) ? Number(dof.focalLength) : 50;
      const sensor = Number.isFinite(Number(dof.sensorHeightMm)) ? Number(dof.sensorHeightMm) : 24;
      const sceneScale = Number.isFinite(Number(dof.sceneScale)) ? Number(dof.sceneScale) : DEFAULT_SCENE_SCALE;
      const resolutionScale = dofResolutionScale(height);

      // Compute physical CoC gain using thin-lens optics
      const optics = computePhysicalCocGain({
        focalLengthMm: focalLength,
        fNumber: Number.isFinite(aperture) ? aperture : 2.8,
        sceneScale,
        focusDistance: focusDist,
        viewportHeight: height,
      });

      // Bokeh shape configuration
      const shapeConfig = getBokehShapeConfig(dof.bokehShape);
      const bladeCount = Number(dof.apertureBlades);
      const blades = bladeCount >= 3 ? Math.min(12, Math.round(bladeCount)) : dof.bokehShape === 'hexagonal' ? 6 : dof.bokehShape === 'octagonal' ? 8 : 0;

      // Max blur in render pixels: resolutionScale applies only to configured maxBlur, not to optics.bokehScale fallback
      const maxBlurPx = Number.isFinite(maxBlur)
        ? Math.max(1, maxBlur * resolutionScale)
        : Math.max(1, optics.bokehScale);

      // uParams: focusDistance, f-stop, maxBlurPx (render pixels), samples
      p.set(
        focusDist,
        Number.isFinite(aperture) ? aperture : 2.8,
        maxBlurPx,
        Math.max(4, Math.min(48, Math.round(samples)))
      );
      // uExtra: focusRange, cocGain, bokehScale, focalScale (includes the resolution scale)
      const focalScale = (focalLength / 50) * (24 / sensor) * resolutionScale;
      pass.uniforms.uExtra.value.set(
        focusRange,
        optics.cocGain * bokehScale,
        bokehScale,
        focalScale
      );
      // uExtra2: camera near / far for depth linearization, aperture blades, bokeh rotation (radians)
      pass.uniforms.uExtra2.value.set(
        Math.max(0.001, cameraClip.near),
        Math.max(0.01, cameraClip.far),
        blades,
        THREE.MathUtils.degToRad(Number.isFinite(Number(dof.bokehRotation)) ? Number(dof.bokehRotation) : 0)
      );
      // uFringe: highlight threshold, highlight intensity, catEye, rim
      const highlightThreshold = Number.isFinite(Number(dof.highlightThreshold)) ? Number(dof.highlightThreshold) : 0.7;
      const highlightIntensity = Number.isFinite(Number(dof.highlightIntensity)) ? Number(dof.highlightIntensity) : (Number(dof.highlightGain) || 0);
      pass.uniforms.uFringe.value.set(
        highlightThreshold,
        highlightIntensity,
        shapeConfig.catEye,
        shapeConfig.rim
      );
      // uMotion: bokehStretch.x, bokehStretch.y
      pass.uniforms.uMotion.value.set(shapeConfig.stretch.x, shapeConfig.stretch.y);
      // uColor: r = softness, g = isPhysical (1.0 for physical, 0.0 for artistic and classic), b = 0
      (pass.uniforms.uColor.value as THREE.Color).setRGB(
        shapeConfig.softness,
        dof.model === 'physical' ? 1.0 : 0.0,
        0
      );

      pass.uniforms.uSeed.value = effects.deterministicSeed;
      pass.uniforms.uDebug.value = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dofDebug') === '1' ? 1 : 0;
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
