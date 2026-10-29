import type { EvaluatedEffects } from './evaluateEffects';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const linear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const srgb = (v: number) => v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
const fract = (v: number) => v - Math.floor(v);
const hexLinear = (hex: string) => {
  const value=hex.replace('#','');
  return [0,2,4].map(i=>linear(parseInt(value.slice(i,i+2),16)/255));
};
const blendChannel = (base:number, map:number, mode:string) => {
  switch(mode){
    case 'multiply': return base*map;
    case 'screen': return 1-(1-base)*(1-map);
    case 'overlay': return base<.5?2*base*map:1-2*(1-base)*(1-map);
    case 'softLight': return map<.5?base-(1-2*map)*base*(1-base):base+(2*map-1)*(Math.sqrt(Math.max(0,base))-base);
    case 'hardLight': return map<.5?2*base*map:1-2*(1-base)*(1-map);
    case 'difference': return Math.abs(base-map);
    case 'exclusion': return base+map-2*base*map;
    case 'lighten': return Math.max(base,map);
    case 'darken': return Math.min(base,map);
    case 'colorDodge': return Math.min(1,base/Math.max(.001,1-map));
    case 'colorBurn': return 1-Math.min(1,(1-base)/Math.max(.001,map));
    default: return map;
  }
};

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
        let graded = rgb.map((channel, c) => (l + (channel - l) * g.saturation) * [1+t*0.1,1+tint*0.1,1-t*0.1][c] + (g.lift ?? 0));
        const gradedLuma = graded[0]*0.2126 + graded[1]*0.7152 + graded[2]*0.0722;
        const black=g.blackPoint??0, white=Math.max(black+.001,g.whitePoint??1), gamma=Math.max(.1,g.gamma??1);
        graded=graded.map(v=>Math.pow(clamp((v-black)/(white-black)),1/gamma));
        const gradeLuma=graded[0]*0.2126+graded[1]*0.7152+graded[2]*0.0722;
        const saturation=1+(g.vibrance??0)*(1-gradeLuma);
        for(let c=0;c<3;c++) {
          dst[i+c]=gradeLuma+(graded[c]-gradeLuma)*saturation+(g.highlights??0)*Math.max(0,gradedLuma-.45)+(g.shadows??0)*Math.max(0,.55-gradedLuma);
        }
      } else if (key === 'atmosphere') {
        const a=e.atmosphere, color=hexLinear(a.color);
        const depth=a.depthEnabled?clamp((v-a.start)/Math.max(.001,a.reach)):1;
        const height=clamp((v-(1-a.mistHeight))/Math.max(.001,a.mistHeight));
        const amount=clamp(a.fog*depth+a.mist*height+a.haze);
        for(let c=0;c<3;c++) dst[i+c]=src[i+c]*(1-amount)+color[c]*amount;
      } else if (key === 'gradientMap') {
        const g=e.gradientMap, stops=[...g.stops].sort((a,b)=>a.at-b.at);
        const lum=src[i]*.2126+src[i+1]*.7152+src[i+2]*.0722;
        const pos=clamp((lum-g.shift)*g.spread);
        let lower=stops[0], upper=stops[stops.length-1];
        for(let n=1;n<stops.length;n++) if(pos<=stops[n].at){lower=stops[n-1];upper=stops[n];break;}
        const span=Math.max(.0001,upper.at-lower.at), mix=clamp((pos-lower.at)/span);
        const lo=hexLinear(lower.color), hi=hexLinear(upper.color), mode=g.blendMode;
        const opacity=(lower.opacity??1)+((upper.opacity??1)-(lower.opacity??1))*mix;
        for(let c=0;c<3;c++){
          const mapped=lo[c]+(hi[c]-lo[c])*mix;
          dst[i+c]=src[i+c]+(blendChannel(src[i+c],mapped,mode)-src[i+c])*g.blend*opacity;
        }
      } else if (key === 'fishEye' || key === 'lensDistortion') {
        const fish=key==='fishEye'?e.fishEye:null, lens=key==='lensDistortion'?e.lensDistortion:null;
        const centerX=.5+(fish?.centerX??lens!.centerX)*.5, centerY=.5+(fish?.centerY??lens!.centerY)*.5;
        const measure=lens?.measure??'width';
        const aspect=width/Math.max(height,1)*(fish?.scale??(measure==='width'?1:measure==='height'?width/height:Math.hypot(width,height)/height));
        const dx=(u-centerX)*aspect, dy=v-centerY, radius=Math.hypot(dx,dy), amount=fish?.amount??lens!.strength;
        const factor=key==='fishEye'
          ?radius>.0001?Math.tan(Math.atan(radius)*(1+amount))/radius:1
          :1+amount*radius*radius*(lens!.mode==='barrel'?1:-1);
        const sx=centerX+dx*factor/aspect, sy=centerY+dy*factor;
        const edgeMode=fish?.edgeMode??lens!.edgeMode;
        if(edgeMode==='none'&&(sx<0||sx>1||sy<0||sy>1)){ for(let c=0;c<4;c++) dst[i+c]=0; }
        else {
          const ex=edgeMode==='balanced'?u+(sx-u)*.65:sx, ey=edgeMode==='balanced'?v+(sy-v)*.65:sy;
          for(let c=0;c<4;c++) dst[i+c]=sample(ex*width-.5,ey*height-.5,c);
        }
      } else if (key === 'bloom') {
        const radius = Math.max(1, width / 240)*(e.bloom.radius??1), softness=e.bloom.softness??0.5;
        for(let c=0;c<3;c++) {
          let glow=0;
          for(let ring=1;ring<=2;ring++) for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
            const weight=ring===1?1:.45, sx=x+dx*radius*ring, sy=y+dy*radius*ring;
            const lum=sample(sx,sy,0)*0.2126+sample(sx,sy,1)*0.7152+sample(sx,sy,2)*0.0722;
            const gate=softness<=0?Number(lum>=e.bloom.threshold):clamp((lum-e.bloom.threshold+softness)/(2*softness));
            glow += sample(sx,sy,c) * gate * Math.max(0,lum-e.bloom.threshold) / Math.max(lum,0.0001)*weight;
          }
          const bloom=glow/14.4*e.bloom.intensity, mode=e.bloom.blendMode??'screen';
          dst[i+c]=mode==='add'?src[i+c]+bloom:mode==='softLight'?blendChannel(src[i+c],clamp(bloom),mode):1-(1-src[i+c])*(1-clamp(bloom));
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
        const ca=e.chromaticAberration, centerX=.5+(ca.centerX??0)*.5, centerY=.5+(ca.centerY??0)*.5;
        const direction=ca.mode==='split'?{x:Math.cos((ca.angle??0)*Math.PI/180),y:Math.sin((ca.angle??0)*Math.PI/180)}:{x:(u-centerX)/Math.max(.001,Math.hypot(u-centerX,v-centerY)),y:(v-centerY)/Math.max(.001,Math.hypot(u-centerX,v-centerY))};
        const fade=clamp(Math.hypot(u-centerX,v-centerY)*2/Math.max(.001,ca.softness??.6));
        const shift=ca.offset*width*edge*fade, vertical=ca.verticalOffset??0;
        const rotate=(dx:number,dy:number,angle:number)=>({x:dx*Math.cos(angle)-dy*Math.sin(angle),y:dx*Math.sin(angle)+dy*Math.cos(angle)});
        const hue=(ca.fringeColorAngle??0)*Math.PI/180;
        const red=rotate(direction.x*shift*(ca.channelRed??1),direction.y*shift*(ca.channelRed??1),hue);
        const green=rotate(direction.x*shift*(ca.channelGreen??0),direction.y*shift*(ca.channelGreen??0),hue);
        const blue=rotate(direction.x*shift*(ca.channelBlue??-1),direction.y*shift*(ca.channelBlue??-1),hue);
        dst[i]=sample(x+red.x,y+red.y-vertical*height,0);
        dst[i+1]=sample(x+green.x,y+green.y,1);
        dst[i+2]=sample(x+blue.x,y+blue.y+vertical*height,2);
      } else if (key === 'motionBlur') {
        const motion = (evaluated as EvaluatedEffects & { motionVector?: {x:number;y:number} }).motionVector;
        const blurMotion=e.motionBlur.direction==='angle'?{x:Math.cos((e.motionBlur.angle??0)*Math.PI/180)*(e.motionBlur.amount??.01),y:Math.sin((e.motionBlur.angle??0)*Math.PI/180)*(e.motionBlur.amount??.01)}:motion;
        if (blurMotion && (blurMotion.x || blurMotion.y)) {
          const count=Math.max(2,Math.min(32,e.motionBlur.samples??8));
          for(let c=0;c<3;c++) {
            let sum=0;
            for(let n=0;n<count;n++) { const t=(n/(count-1)-0.5)*e.motionBlur.shutterAngle/360; sum+=sample(x+blurMotion.x*width*t,y+blurMotion.y*height*t,c); }
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
        const color=hexLinear(f.color??'#0a0a0c');
        for(let c=0;c<3;c++) dst[i+c]=color[c]*(1-clamp(amount))+dst[i+c]*clamp(amount);
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
