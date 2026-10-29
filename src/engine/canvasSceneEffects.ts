import type { EvaluatedEffects } from './evaluateEffects';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const linear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const srgb = (v: number) => v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
const fract = (v: number) => v - Math.floor(v);

/** Ordered post-processing in linear light; output is Canvas2D\'s sRGB bytes. */
export function applyCanvasSceneEffects(data: Uint8ClampedArray, width: number, height: number, evaluated: EvaluatedEffects): void {
  const len = data.length;
  let src = new Float32Array(len);
  let dst = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    src[i] = i % 4 === 3 ? data[i] / 255 : linear(data[i] / 255);
  }

  const e = evaluated.state;
  for (const { key } of evaluated.orderedEnabledPasses) {
    if (key === 'depthOfField') continue; // Applied at layer evaluation.
    dst.set(src);
    const sample = (x: number, y: number, c: number) => src[(Math.max(0, Math.min(height - 1, Math.round(y))) * width + Math.max(0, Math.min(width - 1, Math.round(x)))) * 4 + c];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, u = (x + 0.5) / width, v = (y + 0.5) / height;
      if (key === 'colorGrade') {
        const g = e.colorGrade, gain = 2 ** g.exposure;
        const rgb = [src[i], src[i+1], src[i+2]].map(n => (n * gain - 0.5) * g.contrast + 0.5);
        const l = rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722;
        const t = g.temperature ?? 0, tint = g.tint ?? 0;
        const graded = rgb.map((channel, c) => (l + (channel - l) * g.saturation) * [1+t*0.1,1+tint*0.1,1-t*0.1][c]);
        const gradedLuma = graded[0]*0.2126 + graded[1]*0.7152 + graded[2]*0.0722;
        for(let c=0;c<3;c++) {
          dst[i+c]=graded[c]+(g.highlights??0)*Math.max(0,gradedLuma-.45)+(g.shadows??0)*Math.max(0,.55-gradedLuma);
        }
      } else if (key === 'bloom') {
        const radius = Math.max(1, width / 240)*(e.bloom.radius??1), softness=e.bloom.softness??0.5;
        for(let c=0;c<3;c++) {
          let glow=0;
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
            const sx=x+dx*radius, sy=y+dy*radius;
            const lum=sample(sx,sy,0)*0.2126+sample(sx,sy,1)*0.7152+sample(sx,sy,2)*0.0722;
            const gate=softness<=0?Number(lum>=e.bloom.threshold):clamp((lum-e.bloom.threshold+softness)/(2*softness));
            glow += sample(sx,sy,c) * gate * Math.max(0,lum-e.bloom.threshold) / Math.max(lum,0.0001);
          }
          dst[i+c] += glow/9*e.bloom.intensity;
        }
      } else if (key === 'vignette') {
        const roundness=e.vignette.roundness??1, midpoint=e.vignette.midpoint??0.5;
        const distance=Math.hypot((u-0.5),(v-0.5)*Math.max(0.1,roundness));
        const amount=clamp((distance-midpoint)*2+0.5)*e.vignette.intensity;
        for(let c=0;c<3;c++) dst[i+c]*=1-amount;
      } else if (key === 'filmGrain') {
        const size=Math.max(1,e.filmGrain.size);
        const noiseAt=(cellX:number,cellY:number)=>fract(Math.sin(cellX*12.9898+cellY*78.233+evaluated.deterministicSeed*437.1)*43758.5453)-0.5;
        const coarse=noiseAt(Math.floor(x/size),Math.floor(y/size));
        const fine=noiseAt(x,y);
        const noise=coarse*(1-(e.filmGrain.softness??0))+fine*(e.filmGrain.softness??0);
        for(let c=0;c<3;c++) dst[i+c]+=noise*e.filmGrain.intensity;
      } else if (key === 'chromaticAberration') {
        const edge=Math.hypot(u-.5,v-.5)*2*(e.chromaticAberration.edgeStrength??1);
        const shift=e.chromaticAberration.offset*width*edge, vertical=e.chromaticAberration.verticalOffset??0;
        dst[i]=sample(x+shift,y-vertical*height,0); dst[i+2]=sample(x-shift,y+vertical*height,2);
      } else if (key === 'motionBlur') {
        const motion = (evaluated as EvaluatedEffects & { motionVector?: {x:number;y:number} }).motionVector;
        if (motion && (motion.x || motion.y)) {
          const count=Math.max(2,Math.min(32,e.motionBlur.samples??8));
          for(let c=0;c<3;c++) {
            let sum=0;
            for(let n=0;n<count;n++) { const t=(n/(count-1)-0.5)*e.motionBlur.shutterAngle/360; sum+=sample(x+motion.x*width*t,y+motion.y*height*t,c); }
            dst[i+c]=sum/count;
          }
        }
      } else if (key === 'ghost') {
        const angle=(e.ghost.angle??0)*Math.PI/180, spread=e.ghost.spread??1;
        const radius=e.ghost.blur*width/1920*spread;
        for(let c=0;c<3;c++) {
          let echo=0;
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) echo+=sample(x-Math.cos(angle)*e.ghost.offset*width+dx*radius,y+Math.sin(angle)*e.ghost.offset*height+dy*radius,c);
          dst[i+c]+=echo/9*e.ghost.opacity;
        }
      } else if (key === 'edgeFade') {
        const f=e.edgeFade;
        const softness=f.softness??1, raw=Math.min(f.top>0?v/f.top:1,f.bottom>0?(1-v)/f.bottom:1,(f.left??0)>0?u/f.left!:1,(f.right??0)>0?(1-u)/f.right!:1,1);
        const amount=softness<=0?raw:Math.pow(clamp(raw),1/Math.max(0.1,softness));
        for(let c=0;c<3;c++) dst[i+c]*=clamp(amount);
      } else if (key === 'glitch') {
        const noise=fract(Math.sin(Math.floor(v*(e.glitch.bandSize??50))*12.9898+evaluated.deterministicSeed*78.233)*43758.5453);
        const shift=noise>1-e.glitch.intensity*0.2?(noise-0.5)*width*e.glitch.intensity*0.1:0;
        for(let c=0;c<3;c++) dst[i+c]=sample(x+shift+(c===0?1:c===2?-1:0)*e.glitch.intensity*(e.glitch.colorShift??0.5),y,c);
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }
  for(let i=0;i<data.length;i++) data[i]=Math.round(clamp(i%4===3?src[i]:srgb(src[i]))*255);
}
