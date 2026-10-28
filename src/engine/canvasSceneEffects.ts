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
        for(let c=0;c<3;c++) dst[i+c] = (l+(rgb[c]-l)*g.saturation) * [1+t*0.1,1+tint*0.1,1-t*0.1][c];
      } else if (key === 'bloom') {
        const radius = Math.max(1, width / 240);
        for(let c=0;c<3;c++) {
          let glow=0;
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
            const sx=x+dx*radius, sy=y+dy*radius;
            const lum=sample(sx,sy,0)*0.2126+sample(sx,sy,1)*0.7152+sample(sx,sy,2)*0.0722;
            glow += sample(sx,sy,c) * Math.max(0,lum-e.bloom.threshold) / Math.max(lum,0.0001);
          }
          dst[i+c] += glow/9*e.bloom.intensity;
        }
      } else if (key === 'vignette') {
        const amount=clamp(Math.hypot(u-0.5,v-0.5)*1.4)*e.vignette.intensity;
        for(let c=0;c<3;c++) dst[i+c]*=1-amount;
      } else if (key === 'filmGrain') {
        const size=Math.max(1,e.filmGrain.size);
        const noise=fract(Math.sin(Math.floor(x/size)*12.9898+Math.floor(y/size)*78.233+evaluated.deterministicSeed*437.1)*43758.5453)-0.5;
        for(let c=0;c<3;c++) dst[i+c]+=noise*e.filmGrain.intensity;
      } else if (key === 'chromaticAberration') {
        const shift=e.chromaticAberration.offset*width;
        dst[i]=sample(x+shift,y,0); dst[i+2]=sample(x-shift,y,2);
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
        const radius=e.ghost.blur*width/1920;
        for(let c=0;c<3;c++) {
          let echo=0;
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) echo+=sample(x-e.ghost.offset*width+dx*radius,y+e.ghost.offset*height*0.5+dy*radius,c);
          dst[i+c]+=echo/9*e.ghost.opacity;
        }
      } else if (key === 'edgeFade') {
        const f=e.edgeFade;
        const amount=Math.min(f.top>0?v/f.top:1,f.bottom>0?(1-v)/f.bottom:1,(f.left??0)>0?u/f.left!:1,(f.right??0)>0?(1-u)/f.right!:1,1);
        for(let c=0;c<3;c++) dst[i+c]*=clamp(amount);
      } else if (key === 'glitch') {
        const noise=fract(Math.sin(Math.floor(v*50)*12.9898+evaluated.deterministicSeed*78.233)*43758.5453);
        const shift=noise>1-e.glitch.intensity*0.2?(noise-0.5)*width*e.glitch.intensity*0.1:0;
        for(let c=0;c<3;c++) dst[i+c]=sample(x+shift,y,c);
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }
  for(let i=0;i<data.length;i++) data[i]=Math.round(clamp(i%4===3?src[i]:srgb(src[i]))*255);
}
