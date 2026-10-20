// Generated from Raylight production GLSL shaders
// High-performance procedural GPU background shaders for Three.js

export const BACKGROUND_VERTEX_SHADER = "varying vec2 vUv;\n  void main() {\n    vUv = uv;\n    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  }";

export const COMMON_COLOR_UNIFORMS = "uniform vec3 uColors[5];\n  uniform float uColorCount;";

export const COMMON_GLSL_FUNCTIONS = "#define TWO_PI 6.28318530718\n\n  float hash21(vec2 p) {\n    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;\n    p += dot(p, p + 19.19);\n    return fract(p.x * p.y);\n  }\n\n  float valueNoise(vec2 st) {\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n    float a = hash21(i);\n    float b = hash21(i + vec2(1.0, 0.0));\n    float c = hash21(i + vec2(0.0, 1.0));\n    float d = hash21(i + vec2(1.0, 1.0));\n    vec2 u = f * f * (3.0 - 2.0 * f);\n\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n  }\n\n  vec2 rotate2(vec2 uv, float th) {\n    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;\n  }";

export const SHADER_PRESET_FRAGMENTS: Record<string, string> = {
  "silk": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uColor;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n\n  varying vec2 vUv;\n\n  float silkField(vec2 p, float t, float freq) {\n    vec2 w = p;\n    w.x += 1.1 * sin(p.y * 0.8 + t * 0.22);\n    w.y += 1.1 * sin(p.x * 0.6 - t * 0.17);\n    w.x += 0.55 * sin(w.y * 1.7 - t * 0.13);\n    w.y += 0.55 * sin(w.x * 1.5 + t * 0.11);\n\n    float h = sin((w.x * 0.5 + w.y * 1.5) * freq + t * 0.15);\n    h += 0.55 * sin((w.x * 0.8 + w.y * 1.1) * freq - t * 0.10 + 1.7);\n    h += 0.22 * sin((w.x * 1.6 + w.y * 2.4) * freq + t * 0.08 + 4.0);\n\n    return h;\n  }\n\n  void main() {\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;\n    float t = uTime;\n\n    // Base tunables — mirror silk.html's PARAMS (tuned visually against\n    // the dark-satin references; the brightest animation phase keeps\n    // ~60% of the frame near-black, typical phases ~90%). The user's\n    // scrub inputs are normalized multipliers on top: waves scales fold\n    // frequency, focus scales relief (crease crispness), glow scales\n    // exposure, shine scales the glint.\n    const float sheenPow   = 20.0;  // lit-face tightness\n    const float rampLo     = 0.12;  // unlit floor stays near-black\n    const float whiteGain  = 0.06;  // only the very core eases toward white\n    const float glintPow   = 220.0; // thin liquid-glass streak along creases\n    const float glintWhite = 0.35;  // glint tint: accent nudged toward white\n\n    float amp = 2.8 * uFocus;\n    float exposure = 1.15 * uGlow;\n    float glintGain = 1.1 * uShine;\n    float freq = 0.9 * uWaves;\n\n    float eps = 0.015;\n    float h  = silkField(p, t, freq);\n    float hx = silkField(p + vec2(eps, 0.0), t, freq);\n    float hy = silkField(p + vec2(0.0, eps), t, freq);\n\n    vec3 n = normalize(vec3(\n      -(hx - h) / eps * amp,\n      -(hy - h) / eps * amp,\n      1.0\n    ));\n    vec3 l = normalize(vec3(-0.5, 0.7, 0.4));\n    vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));\n    float ndl = max(dot(n, l), 0.0);\n    float ndh = max(dot(n, hv), 0.0);\n\n    float sheen = pow(ndl, sheenPow);\n    float hRamp = rampLo + (1.0 - rampLo) * clamp((h + 1.8) / 3.6, 0.0, 1.0);\n    float e = sheen * hRamp * exposure;\n    float white = whiteGain * e * e;\n\n    float glint = glintGain * pow(ndh, glintPow) * hRamp;\n    vec3 glintTint = mix(uColor, vec3(1.0), glintWhite);\n\n    vec3 col = uBase +\n      (vec3(1.0) - exp(-(uColor * e + glintTint * glint + vec3(white))));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "undertones": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uColor;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n  uniform float uAngle;\n\n  varying vec2 vUv;\n\n  float hash(float n) {\n    return fract(sin(n * 127.1) * 43758.5453);\n  }\n\n  float hash2(vec2 p) {\n    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);\n  }\n\n  vec4 blobs(vec2 s, float t, float smear, float lum) {\n    vec3 c = vec3(0.0);\n    vec2 d;\n    float addGain = 1.0 - 0.8 * lum;\n    float tighten = 1.0 + 0.4 * lum;\n\n    vec2 c0 = vec2(0.9 * sin(t * 0.10), 0.30 * sin(t * 0.13 + 1.0));\n    d = s - c0; d.x *= smear;\n    c += mix(uColor, vec3(1.0), 0.25) * 1.35 * addGain\n      * exp(-dot(d, d) * 14.0 * tighten);\n\n    vec2 c1 = vec2(1.1 * sin(t * 0.07 + 2.6), 0.4 * sin(t * 0.09 + 4.0));\n    d = s - c1; d.x *= smear * 1.2;\n    float dens = exp(-dot(d, d) * 16.0 * (1.0 - 0.5 * lum));\n    c += uColor * 1.6 * addGain * dens;\n\n    vec2 c2 = vec2(1.2 * sin(t * 0.06 + 5.1), 0.5 * sin(t * 0.11 + 2.2));\n    d = s - c2; d.x *= smear * 1.3;\n    c += uColor * 0.45 * 0.5 * addGain\n      * exp(-dot(d, d) * 18.0 * tighten);\n\n    return vec4(c, dens);\n  }\n\n  void main() {\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;\n\n    // The 1.5x time scale + the wide drift amplitudes in blobs() exist\n    // because the original slow sine drift read as a still image even\n    // at the speed slider's 3x maximum.\n    float t = uTime * 1.5;\n\n    // PARAMS — mirror the JS tuning harness\n    // (scripts/shader-preview/undertones.html): a\n    // frosted ribbed-glass sheet at a fixed diagonal, backlit by three\n    // drifting anisotropic gaussians (white, accent, warm ember). The\n    // user's scrub inputs are normalized multipliers: waves scales slat\n    // density, focus sharpens/blurs the through-glass smear, glow scales\n    // the backlight exposure, shine scales the edge dispersion fringes.\n    const float bandFreq   = 4.5;\n    const float widthWarp  = 0.5;\n    const float edgeWobble = 0.03;\n    const float grooveBase = 0.16;\n    const float fringeW    = 0.06;\n    const float grainAmt   = 0.015;\n\n    float a = radians(uAngle);\n    mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));\n    vec2 q = R * p;\n\n    float freq = bandFreq * uWaves;\n    float bandPos = q.y * freq\n      + widthWarp * sin(q.y * 1.7 + 0.8)\n      + edgeWobble * sin(q.x * 2.0 + 1.0);\n    float id = floor(bandPos);\n    float x = fract(bandPos);\n\n    float lum = dot(uBase, vec3(0.299, 0.587, 0.114));\n    float smear = 0.4 * uFocus;\n\n    vec2 sampleQ = q + vec2((hash(id) - 0.5) * 1.1, 0.0);\n    vec4 backDens = blobs(sampleQ, t, smear, lum);\n    vec3 back = backDens.rgb;\n\n    float groove = grooveBase + 0.12 * (hash(id * 1.7 + 11.0) - 0.5);\n    float body = smoothstep(0.0, groove, x)\n      * (1.0 - smoothstep(1.0 - groove, 1.0, x));\n    float shade = 0.82 + 0.35 * pow(sin(x * 3.14159), 1.5);\n    float tint = 0.15 + 1.1 * pow(hash(id + 3.7), 1.5);\n\n    float f0 = exp(-(x * x) / (fringeW * fringeW));\n    float x1 = 1.0 - x;\n    float f1 = exp(-(x1 * x1) / (fringeW * fringeW));\n    float bright = dot(back, vec3(0.299, 0.587, 0.114));\n    // Fringe colors derive from the accent (lighter tint on the upper\n    // edge, deeper shade on the lower) so the frame stays strictly\n    // monochromatic for any accent — fixed amber/blue dispersion\n    // polluted every non-orange palette.\n    float gate = smoothstep(0.12, 0.55, bright);\n    vec3 fringe = uShine * gate * bright * (1.0 - 0.4 * lum) * (\n      f1 * mix(uColor, vec3(1.0), 0.55) * 1.4 +\n      f0 * uColor * 0.55 * 0.7\n    );\n\n    float exposure = 0.85 * uGlow;\n    float k = exposure * (0.03 + (shade * tint - 0.03) * body);\n    vec3 lit = back * k + fringe;\n\n    // Luminance-based filmic compression: per-channel 1-exp() washed\n    // every bright core to pure white, which is why the accent never\n    // read in the streaks. Compressing the luminance and rescaling the\n    // color keeps the accent hue at full brightness; the 25% white\n    // blend restores a touch of core bloom.\n    float litLum = dot(lit, vec3(0.299, 0.587, 0.114));\n    float comp = 1.0 - exp(-litLum);\n    vec3 litOut = mix(\n      lit * (comp / max(litLum, 1e-4)),\n      vec3(comp),\n      0.25\n    );\n\n    float grooveAmb = 0.80 - 0.06 * lum;\n    float slatAmb = 0.86 + 0.16 * smoothstep(0.0, 0.9, x)\n      + 0.04 * sin(x * 3.14159);\n    float ambient = mix(grooveAmb, slatAmb, body);\n\n    float maxc = max(max(uColor.r, uColor.g), max(uColor.b, 0.001));\n    vec3 dye = uColor / maxc;\n    float dyeAmt = clamp(backDens.a * (0.15 + 0.85 * lum), 0.0, 0.9) * body;\n    vec3 transmit = vec3(1.0) - (vec3(1.0) - dye) * dyeAmt;\n\n    float g = hash2(floor(vUv * vec2(uAspect, 1.0) * 900.0));\n    vec3 col = uBase * ambient * transmit + litOut;\n\n    // Grain is added in DISPLAY space, BEFORE the decode: display space\n    // is perceptually uniform, so one amplitude reads the same against\n    // black and white. Adding it after the decode (in linear) let the\n    // output re-encode amplify a ±0.01 offset near black into ~9% gray\n    // speckle — the \"insanely grainy blacks\". Light bases get a mild\n    // boost so the frosted texture still reads against white.\n    col += vec3((g - 0.5) * grainAmt * (1.0 + 1.0 * lum));\n\n    // The composition above was tuned in DISPLAY space (the JS harness\n    // writes sRGB pixels directly); decoding to linear here keeps the\n    // approved depth once the pipeline re-encodes on output.\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "mosaic": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uColor;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n\n  varying vec2 vUv;\n\n  float hash2(vec2 p) {\n    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);\n  }\n\n  float blobs(vec2 s, float t) {\n    float d = 0.0;\n    vec2 v;\n\n    vec2 c0 = vec2(0.85 * sin(t * 0.11), 0.45 * sin(t * 0.14 + 1.3));\n    v = s - c0;\n    d += exp(-dot(v, v) * 2.2);\n\n    vec2 c1 = vec2(0.95 * sin(t * 0.08 + 2.7), 0.55 * sin(t * 0.10 + 4.1));\n    v = s - c1;\n    d += 0.85 * exp(-dot(v, v) * 2.8);\n\n    vec2 c2 = vec2(1.05 * sin(t * 0.06 + 5.2), 0.5 * sin(t * 0.12 + 2.0));\n    v = s - c2;\n    d += 0.7 * exp(-dot(v, v) * 3.2);\n\n    return d;\n  }\n\n  void main() {\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;\n\n    // Same 1.5x time scale as undertones: the blob drift is slow enough\n    // that the unscaled clock read as a still image at the speed\n    // slider's maximum.\n    float t = uTime * 1.5;\n\n    // PARAMS — a grid of frosted rounded-glass tiles over the base\n    // color, backlit by three drifting gaussian glows. The user's scrub\n    // inputs are normalized multipliers: waves scales tile density,\n    // focus sharpens/blurs the per-pane frost, glow scales the\n    // backlight exposure, shine scales the rim pooling at tile edges.\n    const float tileFreq = 3.4;\n    const float gapW = 0.045;\n    const float corner = 0.15;\n    const float edgeAA = 0.02;\n    const float grainAmt = 0.012;\n\n    float freq = tileFreq * uWaves;\n    vec2 g = p * freq;\n    vec2 id = floor(g);\n    vec2 f = g - id - 0.5;\n    vec2 center = (id + 0.5) / freq;\n\n    vec2 q = abs(f) - (0.5 - gapW - corner);\n    float sd = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - corner;\n    float tileMask = 1.0 - smoothstep(-edgeAA, edgeAA, sd);\n\n    // Frost: each pane samples the backlight near its OWN jittered\n    // center rather than per-pixel, so a whole tile catches one slice\n    // of the glow and adjacent tiles read as separate panes — the\n    // \"different pane, different light\" discontinuity of real glass\n    // tiles. Focus blends toward true per-pixel sampling for a clearer,\n    // more continuous look.\n    float clarity = clamp(0.35 * uFocus, 0.05, 1.0);\n    vec2 jitter = vec2(hash2(id) - 0.5, hash2(id + 7.3) - 0.5) * (0.25 / freq);\n    vec2 bodySample = mix(center + jitter, p, clarity);\n\n    float exposure = 0.85 * uGlow;\n    float dBody = blobs(bodySample, t) * exposure;\n    float dHere = blobs(p, t) * exposure;\n\n    // Rim pooling: the glow concentrates along tile edges (gated by the\n    // LOCAL backlight so only edges actually facing a glow light up),\n    // which is what sells the thick-glass refraction of the reference.\n    float rim = smoothstep(-0.18, -0.02, sd) * tileMask;\n    float dTile = dBody + uShine * rim * dHere * 0.8;\n\n    // The accent acts as a DYE (Beer-Lambert absorption, exponent =\n    // density) rather than an additive glow: over the near-white tiles\n    // a faint glow tints pale and a strong glow saturates fully toward\n    // the accent instead of washing out to white, and the frame stays\n    // strictly monochromatic for any accent color.\n    float maxc = max(max(uColor.r, uColor.g), max(uColor.b, 0.001));\n    vec3 dye = uColor / maxc;\n    vec3 tileTransmit = pow(dye, vec3(clamp(dTile, 0.0, 3.0)));\n    vec3 gapTransmit = pow(dye, vec3(clamp(dHere * 1.35, 0.0, 3.5)));\n\n    float bevel = 1.0\n      + 0.05 * f.y\n      - 0.03 * smoothstep(-0.3, -0.02, sd);\n\n    vec3 tileWhite = mix(uBase, vec3(1.0), 0.55);\n    vec3 tileCol = tileWhite * bevel * tileTransmit;\n    vec3 gapCol = uBase * 0.96 * gapTransmit;\n\n    vec3 col = mix(gapCol, tileCol, tileMask);\n\n    // Grain in DISPLAY space, before the decode, for the same\n    // perceptual-uniformity reason as undertones.\n    float grain = hash2(floor(vUv * vec2(uAspect, 1.0) * 900.0));\n    col += vec3((grain - 0.5) * grainAmt);\n\n    // Composition tuned in display space; decode to linear so the\n    // pipeline's output re-encode restores the approved look.\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "meshGradient": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n  \n  uniform vec3 uColors[5];\n  uniform float uColorCount;\n\n\n  varying vec2 vUv;\n\n  \n  #define TWO_PI 6.28318530718\n\n  float hash21(vec2 p) {\n    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;\n    p += dot(p, p + 19.19);\n    return fract(p.x * p.y);\n  }\n\n  float valueNoise(vec2 st) {\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n    float a = hash21(i);\n    float b = hash21(i + vec2(1.0, 0.0));\n    float c = hash21(i + vec2(0.0, 1.0));\n    float d = hash21(i + vec2(1.0, 1.0));\n    vec2 u = f * f * (3.0 - 2.0 * f);\n\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n  }\n\n  vec2 rotate2(vec2 uv, float th) {\n    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;\n  }\n\n\n  vec2 spotPosition(float i, float t) {\n    float a = i * 0.37;\n    float b = 0.6 + fract(i / 3.0) * 0.9;\n    float c = 0.8 + fract((i + 1.0) / 4.0);\n\n    return 0.5 + 0.5 * vec2(sin(t * b + a), cos(t * c + a * 1.5));\n  }\n\n  void main() {\n    // Paper's \"object box\" fit: the unit square covers the frame's\n    // SHORT axis and overhangs the long one, so the spot field keeps\n    // its proportions at any aspect instead of stretching.\n    vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0) / min(uAspect, 1.0) + 0.5;\n    vec2 grainUV = (vUv - 0.5) * vec2(uAspect, 1.0) * 1000.0;\n\n    // PARAMS — colored spots orbiting fixed trajectories, blended by\n    // inverse distance so the field reads as one continuous gradient.\n    // The scrubs are normalized multipliers over the tuned bases:\n    // waves scales the vortex swirl, focus the organic distortion,\n    // glow overall exposure, shine both grain terms.\n    float t = 0.5 * (uTime + 41.5);\n    float swirl = 0.35 * uWaves;\n    float distortion = 0.55 * uFocus;\n    float mixerGrain = 0.4 * (0.35 * uShine) * (valueNoise(grainUV) - 0.5);\n\n    float radius = smoothstep(0.0, 1.0, length(uv - 0.5));\n    float center = 1.0 - radius;\n\n    for (int i = 1; i <= 2; i++) {\n      float fi = float(i);\n\n      uv.x += distortion * center / fi\n        * sin(t + fi * 0.4 * smoothstep(0.0, 1.0, uv.y))\n        * cos(0.2 * t + fi * 2.4 * smoothstep(0.0, 1.0, uv.y));\n      uv.y += distortion * center / fi\n        * cos(t + fi * 2.0 * smoothstep(0.0, 1.0, uv.x));\n    }\n\n    vec2 spotUV = rotate2(uv - 0.5, -3.0 * swirl * radius) + 0.5;\n\n    vec3 col = vec3(0.0);\n    float totalWeight = 0.0;\n\n    for (int i = 0; i < 5; i++) {\n      if (i >= int(uColorCount)) break;\n\n      vec2 pos = spotPosition(float(i), t) + mixerGrain;\n      float weight = 1.0 / (pow(length(spotUV - pos), 3.5) + 1e-3);\n\n      col += uColors[i] * weight;\n      totalWeight += weight;\n    }\n\n    col /= max(1e-4, totalWeight);\n    col *= 0.55 + 0.45 * uGlow;\n\n    float overlay = valueNoise(rotate2(grainUV, 1.0) + vec2(3.0));\n    overlay = mix(overlay, valueNoise(rotate2(grainUV, 2.0) + vec2(-1.0)), 0.5);\n    overlay = pow(overlay, 1.3);\n\n    float signedGrain = overlay * 2.0 - 1.0;\n    float grainStrength = pow((0.18 * uShine) * abs(signedGrain), 0.8);\n    col = mix(col, vec3(step(0.0, signedGrain)), 0.35 * grainStrength);\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "warp": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n  \n  uniform vec3 uColors[5];\n  uniform float uColorCount;\n\n\n  varying vec2 vUv;\n\n  \n  #define TWO_PI 6.28318530718\n\n  float hash21(vec2 p) {\n    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;\n    p += dot(p, p + 19.19);\n    return fract(p.x * p.y);\n  }\n\n  float valueNoise(vec2 st) {\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n    float a = hash21(i);\n    float b = hash21(i + vec2(1.0, 0.0));\n    float c = hash21(i + vec2(0.0, 1.0));\n    float d = hash21(i + vec2(1.0, 1.0));\n    vec2 u = f * f * (3.0 - 2.0 * f);\n\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n  }\n\n  vec2 rotate2(vec2 uv, float th) {\n    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;\n  }\n\n\n  void main() {\n    // Paper's pattern UV is canvas pixels / 100, which would make the\n    // marbling coarser on a small preview than in a 4K export. Pinning\n    // it to a 1080p-equivalent span keeps preview and export identical.\n    vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0) * 5.4;\n\n    // PARAMS — a checkerboard field dragged through noise displacement\n    // and a stack of swirl passes, then remapped onto the palette. The\n    // scrubs: waves scales swirl strength, focus the noise\n    // displacement, glow exposure, shine the softness of the color\n    // transitions (0 = hard marbled bands, high = smooth blend).\n    float t = 0.0625 * (uTime + 118.0);\n    float swirl = 0.6 * uWaves;\n    float distortion = 0.35 * uFocus;\n    float softness = clamp(0.5 * uShine, 0.0, 1.0);\n    const float shapeScale = 0.85;\n\n    float n1 = valueNoise(uv + t);\n    float n2 = valueNoise(uv * 2.0 - t);\n    float angle = n1 * TWO_PI;\n\n    uv.x += 4.0 * distortion * n2 * cos(angle);\n    uv.y += 4.0 * distortion * n2 * sin(angle);\n\n    for (int i = 1; i < 12; i++) {\n      float fi = float(i);\n\n      uv.x += swirl / fi * cos(t + fi * 1.5 * uv.y);\n      uv.y += swirl / fi * cos(t + fi * 1.0 * uv.x);\n    }\n\n    vec2 checkUV = uv * shapeScale;\n    float shape = 0.5 + 0.5 * sin(checkUV.x) * cos(checkUV.y);\n\n    float mixer = shape * (uColorCount - 1.0);\n\n    // Derivatives are undefined inside the palette loop's non-uniform\n    // control flow, so both antialiasing widths are taken up front.\n    float aa = fwidth(shape);\n    float aaMixer = fwidth(mixer);\n\n    vec3 col = uColors[0];\n\n    for (int i = 1; i < 5; i++) {\n      if (i >= int(uColorCount)) break;\n\n      float m = clamp(mixer - float(i - 1), 0.0, 1.0);\n      float localStart = floor(m);\n      float soft = 0.5 * softness + aaMixer;\n      float smoothed = smoothstep(\n        max(0.0, 0.5 - soft - aa),\n        min(1.0, 0.5 + soft + aa),\n        m - localStart\n      );\n\n      col = mix(col, uColors[i], mix(localStart + smoothed, m, softness));\n    }\n\n    col *= 0.55 + 0.45 * uGlow;\n\n    // Paper's banding fix: a sub-LSB dither, which matters here because\n    // wide soft color ramps are exactly where 8-bit banding shows.\n    col += (1.0 / 256.0)\n      * (fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233)))\n        * 43758.5453123) - 0.5);\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "grainGradient": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n  \n  uniform vec3 uColors[5];\n  uniform float uColorCount;\n\n\n  varying vec2 vUv;\n\n  \n  #define TWO_PI 6.28318530718\n\n  float hash21(vec2 p) {\n    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;\n    p += dot(p, p + 19.19);\n    return fract(p.x * p.y);\n  }\n\n  float valueNoise(vec2 st) {\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n    float a = hash21(i);\n    float b = hash21(i + vec2(1.0, 0.0));\n    float c = hash21(i + vec2(0.0, 1.0));\n    float d = hash21(i + vec2(1.0, 1.0));\n    vec2 u = f * f * (3.0 - 2.0 * f);\n\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n  }\n\n  vec2 rotate2(vec2 uv, float th) {\n    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;\n  }\n\n\n  vec3 permute(vec3 x) {\n    return mod(((x * 34.0) + 1.0) * x, 289.0);\n  }\n\n  float snoise(vec2 v) {\n    const vec4 C = vec4(\n      0.211324865405187, 0.366025403784439,\n      -0.577350269189626, 0.024390243902439\n    );\n    vec2 i = floor(v + dot(v, C.yy));\n    vec2 x0 = v - i + dot(i, C.xx);\n    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n    vec4 x12 = x0.xyxy + C.xxzz;\n    x12.xy -= i1;\n    i = mod(i, 289.0);\n    vec3 p = permute(\n      permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)\n    );\n    vec3 m = max(\n      0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),\n      0.0\n    );\n    m = m * m;\n    m = m * m;\n    vec3 x = 2.0 * fract(p * C.www) - 1.0;\n    vec3 h = abs(x) - 0.5;\n    vec3 ox = floor(x + 0.5);\n    vec3 a0 = x - ox;\n    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);\n    vec3 g;\n    g.x = a0.x * x0.x + h.x * x0.y;\n    g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n\n    return 130.0 * dot(m, g);\n  }\n\n  vec4 grainFbm(vec2 n0, vec2 n1, vec2 n2, vec2 n3) {\n    float amplitude = 0.2;\n    vec4 total = vec4(0.0);\n\n    for (int i = 0; i < 3; i++) {\n      n0 = rotate2(n0, 0.3);\n      n1 = rotate2(n1, 0.3);\n      n2 = rotate2(n2, 0.3);\n      n3 = rotate2(n3, 0.3);\n      total.x += valueNoise(n0) * amplitude;\n      total.y += valueNoise(n1) * amplitude;\n      total.z += valueNoise(n2) * amplitude;\n      total.w += valueNoise(n3) * amplitude;\n      n0 *= 1.99;\n      n1 *= 1.99;\n      n2 *= 1.99;\n      n3 *= 1.99;\n      amplitude *= 0.6;\n    }\n\n    return total;\n  }\n\n  void main() {\n    // Both UV spans are pinned to a 1080p-equivalent frame rather than\n    // to live canvas pixels, so an export matches its preview instead of\n    // rescaling the wave and getting a finer grain at higher output\n    // resolutions.\n    vec2 patternUV = (vUv - 0.5) * vec2(uAspect, 1.0) * 10.8;\n    vec2 grainUV = patternUV * 160.0;\n\n    // PARAMS — Paper's \"wave\" form: a wavy horizon sweeping the frame,\n    // quantized onto the palette, with the band edges eaten into by fbm\n    // grain. Of their seven forms this is the one that fills the whole\n    // frame; the corner and blob forms leave most of a 16:9 background\n    // flat, which reads as a bug rather than a composition. The scrubs:\n    // waves zooms the wave, focus the softness of the color steps, glow\n    // how hard the grain displaces those edges, shine the visible grain.\n    float t = 0.1 * (uTime + 7.0);\n    float count = max(uColorCount, 1.0);\n    float softness = clamp(0.5 * uFocus, 0.0, 1.0);\n    float intensity = 0.3 * uGlow;\n    float grainAmount = 0.06 * uShine;\n\n    vec2 shapeUV = (patternUV * 0.5) / max(uWaves, 0.25);\n\n    float wave = cos(0.5 * shapeUV.x - 4.0 * t)\n      * sin(1.5 * shapeUV.x + 2.0 * t)\n      * (0.75 + 0.25 * cos(6.0 * t));\n    float shape = 1.0 - smoothstep(-1.0, 1.0, shapeUV.y + wave);\n\n    float baseNoise = snoise(grainUV * 0.5);\n    vec4 fbmVals = grainFbm(\n      0.002 * grainUV + 10.0,\n      0.003 * grainUV,\n      0.001 * grainUV,\n      rotate2(0.4 * grainUV, 2.0)\n    );\n    float grainDist = baseNoise * snoise(grainUV * 0.2) - fbmVals.x - fbmVals.y;\n    float noise = clamp(0.75 * baseNoise - fbmVals.w - fbmVals.z, 0.0, 1.0);\n\n    shape += intensity * 2.0 / count * (grainDist + 0.5);\n    shape += grainAmount * 10.0 / count * noise;\n\n    float aa = fwidth(shape);\n\n    shape = clamp(shape - 0.5 / count, 0.0, 1.0);\n    float coverage = smoothstep(\n      0.0,\n      softness + 2.0 * aa,\n      clamp(shape * count, 0.0, 1.0)\n    );\n\n    float mixer = shape * (count - 1.0);\n    float aaMixer = fwidth(mixer);\n\n    vec3 col = uColors[0];\n\n    for (int i = 1; i < 5; i++) {\n      if (i >= int(count)) break;\n\n      float localT = clamp(mixer - float(i - 1), 0.0, 1.0);\n      localT = smoothstep(\n        0.5 - 0.5 * softness - aaMixer,\n        0.5 + 0.5 * softness + aaMixer,\n        localT\n      );\n\n      col = mix(col, uColors[i], localT);\n    }\n\n    col = mix(uBase, col, coverage);\n\n    // Paper gates every grain term behind the wash's coverage, which\n    // leaves the base region perfectly flat — a bug in a preset named\n    // for its grain. The base keeps a faint dusting of the same simplex\n    // field. It uses the SIGNED baseNoise, not the clamped noise value\n    // the bands ride on: that one is positive-only, so adding it here\n    // would darken the base rather than texture it.\n    col += vec3(baseNoise * grainAmount * 0.35 * (1.0 - coverage));\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "prism": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uAngle;\n  \n  uniform vec3 uColors[5];\n  uniform float uColorCount;\n\n\n  varying vec2 vUv;\n\n  // The palette decoded to display space once per pixel, so every\n  // spectrum lookup below is a handful of mixes instead of pow calls.\n  vec3 gPalette[5];\n\n  float hash11(float n) {\n    return fract(sin(n * 127.1 + 311.7) * 43758.5453);\n  }\n\n  float hash21(vec2 p) {\n    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n    p3 += dot(p3, p3.yzx + 33.33);\n\n    return fract((p3.x + p3.y) * p3.z);\n  }\n\n  // A smooth, compactly supported step from -1 to 1 over [-2, 2]: the\n  // integral of a gaussian-like blur kernel, used to soften box edges.\n  float soften(float x) {\n    return 2.0 * smoothstep(-2.0, 2.0, x) - 1.0;\n  }\n\n  // A box of half-width span blurred by a kernel of the given inverse\n  // width, normalized so its peak is 1 however narrow the box is.\n  float blurredBox(float x, float span, float invBlur) {\n    return (soften((x + span) * invBlur) - soften((x - span) * invBlur))\n      / (2.0 * soften(span * invBlur));\n  }\n\n  vec3 toDisplay(vec3 c) {\n    return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));\n  }\n\n  vec3 paletteAt(float s) {\n    float count = max(uColorCount, 1.0);\n    float x = clamp(s, 0.0, 1.0) * (count - 1.0);\n    vec3 col = gPalette[0];\n\n    for (int i = 1; i < 5; i++) {\n      if (i >= int(uColorCount)) break;\n      col = mix(col, gPalette[i], clamp(x - float(i - 1), 0.0, 1.0));\n    }\n\n    return col;\n  }\n\n  // All shards in fan space. u is the angular coordinate in cell units,\n  // r the distance from the source, aa the pixel footprint of u. Each\n  // shard is a beam (box) smeared across the fan by its dispersion (a\n  // second box) and blurred: the spectral coordinate runs first color to\n  // last across the smear, and the hue at a point is the palette averaged\n  // over every wavelength that still covers it, so cores blend toward the\n  // palette mean and edges separate into pure fringes with no stepping.\n  // Shard centers stay within 0.39 of their cell's middle, so any cell\n  // outside the 5-cell walk is at least 2.11 cells away; both profiles\n  // are windowed to zero by 2.1 so nothing clips at a cell boundary.\n  vec3 shards(float u, float r, float t, float aa, vec3 mean) {\n    vec3 acc = vec3(0.0);\n    float ic = floor(u);\n\n    for (int k = -2; k <= 2; k++) {\n      float cell = ic + float(k);\n      float h1 = hash11(cell);\n      float h2 = hash11(cell * 1.37 + 17.0);\n      float h3 = hash11(cell * 2.11 + 41.0);\n      float h4 = hash11(cell * 0.73 + 73.0);\n      float h5 = hash11(cell * 3.19 + 97.0);\n\n      float drift = 0.14 * sin(t * (0.21 + 0.18 * h5) + 6.2832 * h4);\n      float center = cell + 0.5 + (h1 - 0.5) * 0.5 + drift;\n\n      float breathe = 0.5 + 0.5 * sin(t * (0.33 + 0.25 * h2) + 6.2832 * h3);\n      float gain = (0.15 + 1.1 * pow(h2, 1.6)) * (0.3 + 0.7 * breathe);\n\n      // Dispersion grows with distance from the source (the beam leaves\n      // the prism nearly white and splits as it travels); the beam width\n      // is a fraction of it, so a thin beam throws a pure rainbow and a\n      // wide one a white core with colored fringes.\n      float disp = (0.35 + 0.55 * h4) * (0.45 + 0.55 * smoothstep(0.0, 3.0, r));\n      float hw = disp * mix(0.06, 0.5, h3) * (0.9 + 0.2 * breathe);\n      float blur = max(0.035 + 0.02 * r, aa);\n\n      float reach = hw + 2.0 * blur + 0.5 * disp;\n      float squeeze = min(1.0, 1.4 / reach);\n      hw *= squeeze;\n      blur *= squeeze;\n      disp *= squeeze;\n\n      float len = 2.0 + 3.5 * h5;\n      float along = exp(-max(r - len, 0.0) * 0.8);\n\n      float dx = u - center;\n      float halfSpan = 0.5 * disp + hw;\n      float level = blurredBox(dx, halfSpan, 1.0 / blur)\n        * smoothstep(2.1, 1.5, abs(dx));\n\n      // Halation: a wide, dim copy of the shard so bright light blooms\n      // into the dark around it instead of ending at a hard tube edge.\n      float halo = blurredBox(dx, halfSpan + 0.15, 1.0 / (blur * 3.0 + 0.12))\n        * smoothstep(2.1, 1.2, abs(dx));\n\n      float invDisp = 1.0 / max(disp, 1e-3);\n      float sc = dx * invDisp + 0.5;\n      float wnd = (hw + 0.5 * blur) * invDisp;\n      float lo = clamp(sc - wnd, 0.0, 1.0);\n      float hi = clamp(sc + wnd, 0.0, 1.0);\n      float span = hi - lo;\n      vec3 hue = (\n        paletteAt(lo) + paletteAt(lo + 0.25 * span) + paletteAt(lo + 0.5 * span)\n        + paletteAt(lo + 0.75 * span) + paletteAt(hi)\n      ) * 0.2;\n      hue = mix(hue, mean, span * span);\n\n      acc += (hue * level + mix(hue, mean, 0.5) * halo * 0.22) * (gain * along);\n    }\n\n    return acc;\n  }\n\n  void main() {\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;\n    float t = uTime;\n\n    float a = radians(uAngle);\n    vec2 dir = vec2(cos(a), -sin(a));\n\n    // The source sits just past the frame edge behind the light, so the\n    // fan always enters from outside the frame whatever the aspect.\n    float tx = uAspect / max(abs(dir.x), 1e-3);\n    float ty = 1.0 / max(abs(dir.y), 1e-3);\n    vec2 src = -dir * (min(tx, ty) + 0.45);\n\n    vec2 v = p - src;\n    float r = length(v);\n    float theta = atan(dir.x * v.y - dir.y * v.x, dot(dir, v));\n\n    float sway = 0.045 * sin(t * 0.17) + 0.02 * sin(t * 0.29 + 1.3);\n    theta += sway;\n\n    float fanHalf = 0.46 * uFocus;\n    float spacing = 2.4 * fanHalf / (8.0 * uWaves);\n    float u = theta / spacing;\n\n    // Shards converge toward the source; this floor keeps their edges at\n    // least a pixel soft there so dense fans never alias.\n    float aa = fwidth(u);\n\n    for (int i = 0; i < 5; i++) {\n      gPalette[i] = toDisplay(uColors[i]);\n    }\n\n    vec3 mean = vec3(0.0);\n\n    for (int i = 0; i < 5; i++) {\n      if (i >= int(uColorCount)) break;\n      mean += gPalette[i];\n    }\n\n    mean /= max(uColorCount, 1.0);\n\n    vec3 light = shards(u, r, t, aa, mean);\n\n    // A slow low-frequency swell across the fan clusters the shards into\n    // bright and dark regions, the uneven light of a real prism throw.\n    float fanEnv = exp(-pow(abs(theta) / (fanHalf * 1.15), 2.4));\n    float swell = 0.5 + 0.5 * sin(theta / max(fanHalf, 0.05) * 2.4 + t * 0.11 + 1.7);\n    fanEnv *= 0.35 + 0.85 * swell;\n    float falloff = exp(-r * 0.12) * smoothstep(0.0, 0.6, r);\n\n    float hazeEnv = exp(-pow(abs(theta) / (fanHalf * 1.8), 2.0));\n    vec3 haze = mean * 0.025 * hazeEnv * exp(-r * 0.7);\n\n    // More shards overlap more light, so exposure eases off with density\n    // to keep Rays from doubling as a brightness knob.\n    float density = pow(max(uWaves, 0.05), -0.3);\n    float pulse = 0.92 + 0.08 * sin(t * 0.37 + 0.6);\n    vec3 lit = (light * fanEnv * falloff * density + haze) * 4.0 * uGlow * pulse;\n\n    // Luminance-based filmic shoulder (keeps the palette hue in bright\n    // cores instead of clipping each channel to white) with a gentle toe\n    // so overlapping dim tails sink into the base rather than greying it.\n    float litLum = dot(lit, vec3(0.299, 0.587, 0.114));\n    float comp = 1.0 - exp(-litLum * 1.1);\n    comp *= 0.65 + 0.35 * smoothstep(0.0, 0.35, comp);\n    vec3 litOut = mix(lit * (comp / max(litLum, 1e-4)), vec3(comp), 0.05);\n\n    vec3 base = toDisplay(uBase);\n    float baseLum = dot(base, vec3(0.299, 0.587, 0.114));\n    vec3 screen = 1.0 - (1.0 - base) * (1.0 - clamp(litOut, 0.0, 1.0));\n\n    // Over a light base, added light has nowhere to go, so the shards act\n    // as a dye instead: like a prism throw on a white wall, each fringe\n    // stains the base with its own hue while the near-white cores stay\n    // subtle. Dark bases keep the pure additive (screen) light.\n    float peak = max(max(litOut.r, litOut.g), max(litOut.b, 1e-4));\n    vec3 dye = litOut / peak;\n    float dyeAmt = clamp(comp * 1.6, 0.0, 0.9);\n    vec3 stained = base * (1.0 - dyeAmt * (1.0 - dye)) * (1.0 - 0.06 * dyeAmt)\n      + litOut * 0.12;\n    vec3 col = mix(screen, stained, smoothstep(0.3, 0.75, baseLum));\n\n    // Grain in display space, pinned to the frame so an export matches\n    // its preview, plus a sub-LSB screen dither against banding.\n    vec2 grainCell = floor(vUv * vec2(uAspect, 1.0) * 900.0);\n    float g = hash21(grainCell) + hash21(grainCell + 71.3) - 1.0;\n    float lum = dot(col, vec3(0.299, 0.587, 0.114));\n    col += vec3(g * 0.018 * (0.6 + 0.5 * sqrt(lum)));\n\n    float dither = hash21(gl_FragCoord.xy + 0.5) - 0.5;\n    col += vec3(dither / 255.0);\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "halo": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n  \n  uniform vec3 uColors[5];\n  uniform float uColorCount;\n\n\n  varying vec2 vUv;\n\n  #define TWO_PI 6.28318530718\n\n  float hash12(vec2 p) {\n    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n    p3 += dot(p3, p3.yzx + 33.33);\n\n    return fract((p3.x + p3.y) * p3.z);\n  }\n\n  vec3 linearToOklab(vec3 c) {\n    float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;\n    float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;\n    float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;\n    l = pow(max(l, 0.0), 1.0 / 3.0);\n    m = pow(max(m, 0.0), 1.0 / 3.0);\n    s = pow(max(s, 0.0), 1.0 / 3.0);\n\n    return vec3(\n      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,\n      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,\n      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s\n    );\n  }\n\n  vec3 oklabToLinear(vec3 c) {\n    float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;\n    float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;\n    float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;\n    l = l * l * l;\n    m = m * m * m;\n    s = s * s * s;\n\n    return vec3(\n      4.0767416621 * l - 3.3077108586 * m + 0.2309699292 * s,\n      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,\n      -0.0041960863 * l - 0.5115603949 * m + 1.5967789710 * s\n    );\n  }\n\n  // Cyclic palette lookup in OKLab: u wraps once around the whole\n  // palette, neighbours blend perceptually so blue to orange passes\n  // through a clean hue instead of a muddy grey.\n  vec3 paletteLab(float u) {\n    float n = max(uColorCount, 1.0);\n    float x = fract(u) * n;\n    float i0 = floor(x);\n    float f = x - i0;\n    f = f * f * (3.0 - 2.0 * f);\n    float i1 = mod(i0 + 1.0, n);\n    vec3 a = vec3(0.0);\n    vec3 b = vec3(0.0);\n\n    for (int i = 0; i < 5; i++) {\n      if (i >= int(uColorCount)) break;\n\n      float fi = float(i);\n\n      if (fi == i0) a = uColors[i];\n      if (fi == i1) b = uColors[i];\n    }\n\n    return mix(linearToOklab(a), linearToOklab(b), f);\n  }\n\n  // Exact inverse of the pow(2.2) decode at the end of main(), so linear\n  // uniforms round-trip to the picked hex.\n  vec3 toDisplay(vec3 lin) {\n    return pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2));\n  }\n\n  void main() {\n    // Frame space normalized to the shorter side, so the bowl keeps its\n    // proportions in portrait and square frames.\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;\n    p /= min(uAspect, 1.0);\n\n    float t = uTime;\n    float size = clamp(uWaves, 0.25, 2.5);\n    float soft = clamp(uFocus, 0.2, 2.0);\n    float glow = clamp(uGlow, 0.0, 2.0);\n\n    vec3 base = toDisplay(uBase);\n    float lum = dot(base, vec3(0.299, 0.587, 0.114));\n    // 1 on pale bases (opaque white body), 0 on dark ones (ring of light).\n    float light = smoothstep(0.2, 0.75, lum);\n\n    float breathe = 1.0 + 0.045 * sin(t * 0.37) + 0.02 * sin(t * 0.23 + 1.7);\n    float R = 1.15 * pow(size, 0.85) * breathe;\n    float by = R * mix(1.25, 1.0, smoothstep(0.6, 1.0, uAspect));\n    float ax = R * max(0.75 * uAspect, 0.8);\n    // The bowl's bottom rim is anchored near the lower third as Size\n    // grows (a soft max keeps the drift smooth through the crossover), so\n    // a large bowl becomes a wide arc instead of leaving the frame.\n    float floorY = 0.79 * inversesqrt(min(uAspect, 1.0));\n    vec2 center = vec2(\n      (0.16 * sin(t * 0.13 + 0.4) + 0.05 * sin(t * 0.29))\n        * clamp(uAspect, 0.6, 1.0),\n      0.5 * ((by - floorY) + sqrt((by - floorY) * (by - floorY) + 0.02))\n        + 0.06 * sin(t * 0.19 + 2.1)\n    );\n    float rot = 0.12 * sin(t * 0.11 + 0.8);\n    vec2 q = p - center;\n    q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * q;\n\n    float n = 2.6 + 0.7 * sin(t * 0.17 + 0.3);\n\n    float r = length(q);\n    float theta = atan(q.y, q.x + 1e-6);\n    float cs = max(abs(cos(theta)), 1e-4);\n    float sn = max(abs(sin(theta)), 1e-4);\n    float rse = pow(pow(cs / ax, n) + pow(sn / by, n), -1.0 / n);\n    rse *= 1.0\n      + 0.035 * sin(2.0 * theta + t * 0.31)\n      + 0.025 * sin(3.0 * theta - t * 0.23 + 1.3);\n    float d = r - rse;\n\n    // Profile widths: thin caustic line, inner color wash, outer bloom.\n    float ws = sqrt(size) * soft;\n    float wLine = 0.028 * ws;\n    float wIn = 0.5 * ws;\n    float wOut = 0.42 * ws * mix(0.75, 1.3, glow * 0.5);\n\n    // Palette position: travels around the rim over time and shifts\n    // with distance across the edge (the prism dispersion), with a faster\n    // split right at the line.\n    float u = theta / TWO_PI + t * 0.03 - 0.25;\n    float disp = 0.35;\n    float uHere = u + disp * clamp(d / wOut, -2.0, 3.0) * 0.5\n      + 0.07 * clamp(d / (3.0 * wLine), -1.0, 1.0);\n    // Light gathers at the bottom of the bowl: the line is strongest there.\n    float caustic = 0.5 - 0.5 * sin(theta + 0.35 * sin(t * 0.21));\n    caustic = mix(0.3, 1.0, caustic * caustic);\n\n    vec3 rimLab = paletteLab(uHere);\n    rimLab.yz *= 1.0 + 0.4 * max(glow - 1.0, 0.0);\n    vec3 rimCol = toDisplay(oklabToLinear(rimLab));\n    vec3 deepLab = rimLab;\n    deepLab.x *= mix(1.08, 0.9, light);\n    deepLab.yz *= 1.25;\n    vec3 deepCol = toDisplay(oklabToLinear(deepLab));\n\n    float din = max(-d, 0.0);\n    float dout = max(d, 0.0);\n    float wash = exp(-pow(din / wIn, 1.4));\n    float line = exp(-(d * d) / (wLine * wLine));\n    float bloom = exp(-pow(dout / (wOut * mix(0.7, 1.0, light)), 1.2));\n    float tint = min(glow, 1.0);\n\n    // Fades the angular tint out toward the middle so the polar hue\n    // never converges into a visible pinch at the center.\n    float hub = smoothstep(0.08, 0.9, r / rse);\n    float sat = clamp(wash * hub * tint * 0.95, 0.0, 1.0);\n    vec3 C = mix(vec3(1.0), rimCol, mix(tint, sat, light));\n    C = mix(C, vec3(1.0), 0.3 * (1.0 - bloom) * light * step(0.0, d));\n    C = mix(C, deepCol, line * caustic * 0.6 * tint);\n    C = mix(C, vec3(1.0), line * caustic * 0.3 * tint * (1.0 - light));\n\n    float aIn = max(light, wash * hub * 0.95);\n    float strength = clamp(0.3 + 0.5 * glow, 0.0, 1.0);\n    float aOut = bloom * mix(aIn, strength, smoothstep(0.0, 3.0 * wLine, dout));\n    float A = d < 0.0 ? aIn : aOut;\n\n    vec3 col = mix(base, C, A);\n\n    // Film grain: cells pinned to the frame (about 1.2 px at 1080p, the\n    // same physical size at 4K), reseeded 24 times per second of uTime\n    // with a bounded offset so the hash never loses float precision on\n    // long timelines. Two summed hashes give a softer, film-like\n    // distribution than one uniform hash. Added in display space and\n    // eased off in the shadows, where the same step reads as speckle.\n    float frame = floor(t * 24.0);\n    vec2 seed = vec2(fract(frame * 0.7548777), fract(frame * 0.5698403)) * 512.0;\n    vec2 cell = floor(vUv * vec2(uAspect, 1.0) * 900.0) + seed;\n    float grain = hash12(cell) + hash12(cell + vec2(71.3, 19.7)) - 1.0;\n    float colLum = dot(col, vec3(0.299, 0.587, 0.114));\n    col += vec3(grain * 0.045 * uShine * mix(0.35, 1.0, smoothstep(0.0, 0.5, colLum)));\n\n    // Sub-LSB dither so the wide soft gradients never band when grain is 0.\n    col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "shift": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n  \n  uniform vec3 uColors[5];\n  uniform float uColorCount;\n\n\n  varying vec2 vUv;\n\n  #define MAX_DEPTH 6\n  #define TWO_PI_SHIFT 6.28318530718\n  #define LAYOUT_BEAT 4.0\n  #define LAYOUT_CYCLE 7.0\n  #define LAYOUT_SLIDE 0.55\n\n  float hash11(float p) {\n    p = fract(p * 0.1031);\n    p *= p + 33.33;\n    p *= p + p;\n\n    return fract(p);\n  }\n\n  float hash12(vec2 p) {\n    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n    p3 += dot(p3, p3.yzx + 33.33);\n\n    return fract((p3.x + p3.y) * p3.z);\n  }\n\n  // Layout changes are choreographed on a shared beat: every node\n  // changes on one beat out of LAYOUT_CYCLE, at a per-node phase, so\n  // each beat a few seams slide together and then the whole layout\n  // rests. Returns (layout index, eased blend toward the next layout).\n  vec2 nodeClock(float id, float t) {\n    float x = t / LAYOUT_BEAT;\n    float beat = floor(x);\n    float phase = floor(hash11(id * 3.17 + 9.1) * LAYOUT_CYCLE);\n    float slot = mod(beat + phase, LAYOUT_CYCLE);\n    float k = floor((beat + phase) / LAYOUT_CYCLE);\n    float e = smoothstep(1.0 - LAYOUT_SLIDE, 1.0, fract(x))\n      * step(LAYOUT_CYCLE - 1.5, slot);\n\n    return vec2(k, e * e * e * (e * (e * 6.0 - 15.0) + 10.0));\n  }\n\n  // Split ratios snap to a small editorial set so seams line up across\n  // the layout like a designed grid instead of random cuts.\n  float splitRatio(float h) {\n    if (h < 0.34) return 0.5;\n    if (h < 0.54) return 1.0 / 3.0;\n    if (h < 0.74) return 2.0 / 3.0;\n    if (h < 0.87) return 0.25;\n\n    return 0.75;\n  }\n\n  // One child's contribution to its block's register shift for one\n  // layout: (offset xy, scale delta, time lead).\n  vec4 childShift(float id, float k) {\n    float angle = TWO_PI_SHIFT * hash12(vec2(id, k) + 3.1);\n    float reach = 0.08 + 0.16 * hash12(vec2(id, k) + 7.9);\n\n    return vec4(\n      reach * vec2(cos(angle), sin(angle)),\n      0.07 * (hash12(vec2(id, k) + 5.3) - 0.5),\n      1.4 * (hash12(vec2(id, k) + 1.7) - 0.5)\n    );\n  }\n\n  // Layout space: x runs along the frame's long axis and the short axis\n  // spans one unit, so every aspect gets the same editorial rhythm.\n  vec2 toLayout(vec2 q) {\n    return uAspect >= 1.0 ? q : vec2(q.y, q.x) / uAspect;\n  }\n\n  // Walk the subdivision tree down to the block containing l (layout\n  // space), writing the block's rectangle and returning its register\n  // shift. Three rules keep everything continuous:\n  //  - split geometry only slides (between layouts) toward a node's\n  //    fixed park edge, so blocks grow and shrink rather than appear;\n  //  - a block's shift is the SUM of per-split contributions down its\n  //    path, each weighted by that split's visibility, so a split that\n  //    fades out (Blocks knob, minimum size) makes both sides identical\n  //    and any geometry change beneath it is invisible;\n  //  - axis choice reads the node's nominal (unanimated) size, so it\n  //    never flips mid-slide.\n  vec4 locateBlock(vec2 l, float t, float budget, float minSize, out vec2 lo, out vec2 hi) {\n    vec2 nominal = vec2(max(uAspect, 1.0 / uAspect), 1.0);\n\n    lo = -0.5 * nominal;\n    hi = 0.5 * nominal;\n\n    float id = 1.0;\n    float alive = 1.0;\n    float vis = 1.0;\n    vec4 shift = vec4(0.0);\n\n    for (int d = 0; d < MAX_DEPTH; d++) {\n      float depth = float(d);\n      bool splitX = nominal.x > nominal.y * 0.85\n        || (nominal.y < nominal.x * 2.0 && hash11(id * 5.71 + 0.3) < 0.5);\n\n      vec2 clk = nodeClock(id, t);\n      float kA = clk.x;\n      float kB = clk.x + 1.0;\n      float r = mix(\n        splitRatio(hash12(vec2(id, kA) + 0.13)),\n        splitRatio(hash12(vec2(id, kB) + 0.13)),\n        clk.y\n      );\n\n      // Whether this node splits: a hash against a depth-falling budget.\n      // Geometry uses the hard test; visibility ramps in just above it.\n      float want = 0.62 + 0.38 * (budget - depth);\n      float gA = 0.03 + 0.94 * hash12(vec2(id, kA) + 0.5);\n      float gB = 0.03 + 0.94 * hash12(vec2(id, kB) + 0.5);\n      float presence = mix(step(gA, want), step(gB, want), clk.y);\n      float fade = mix(\n        smoothstep(gA, gA + 0.07, want),\n        smoothstep(gB, gB + 0.07, want),\n        clk.y\n      );\n\n      // Minimum block size, read from the node's live size: the ratio\n      // clamps away from the edges, and a node too small to halve stops\n      // splitting (fading its seam out before the geometry lets go).\n      float size = splitX ? hi.x - lo.x : hi.y - lo.y;\n      float margin = min(0.5, minSize / max(size, 1e-4));\n      r = clamp(r, margin, 1.0 - margin);\n      presence *= alive * step(2.0 * minSize, size);\n      fade *= smoothstep(2.0 * minSize, 2.15 * minSize, size);\n\n      float edge = step(0.5, hash11(id * 2.93 + 4.4));\n      float s = mix(edge, r, presence);\n      float side;\n\n      if (splitX) {\n        float cut = mix(lo.x, hi.x, s);\n        side = step(cut, l.x);\n        lo.x = mix(lo.x, cut, side);\n        hi.x = mix(cut, hi.x, side);\n        nominal.x *= 0.5;\n      } else {\n        float cut = mix(lo.y, hi.y, s);\n        side = step(cut, l.y);\n        lo.y = mix(lo.y, cut, side);\n        hi.y = mix(cut, hi.y, side);\n        nominal.y *= 0.5;\n      }\n\n      id = id * 2.0 + side;\n      alive = presence;\n      vis *= fade;\n\n      // The child's own shift re-registers on its own beat.\n      vec2 cclk = nodeClock(id + 517.0, t);\n      shift += vis * mix(childShift(id, cclk.x), childShift(id, cclk.x + 1.0), cclk.y);\n    }\n\n    return shift;\n  }\n\n  // The flowing gradient: two drifting spots per palette color, blended\n  // by a softmax over additively weighted distances (curved, organic\n  // boundaries) whose temperature is the Soft knob. Palette uniforms\n  // arrive linear; they are composed in display space like the rest of\n  // the shader, so a picked hex shows exactly.\n  vec3 gradientField(vec2 p, float t, float temperature) {\n    p += 0.11 * vec2(\n      sin(1.9 * p.y + 0.43 * t + 1.1),\n      sin(1.6 * p.x - 0.37 * t + 2.3)\n    );\n    p += 0.05 * vec2(\n      sin(3.7 * p.y - 0.29 * t + 4.0),\n      sin(3.1 * p.x + 0.31 * t + 0.6)\n    );\n\n    vec2 span = vec2(0.5 * uAspect + 0.12, 0.62);\n\n    float dMin = 1e4;\n\n    for (int i = 0; i < 5; i++) {\n      if (i >= int(uColorCount)) break;\n\n      for (int j = 0; j < 2; j++) {\n        float s = float(i * 2 + j) + 1.0;\n        vec2 w = 0.13 + 0.12 * vec2(hash11(s * 1.31), hash11(s * 2.77));\n        vec2 ph = TWO_PI_SHIFT * vec2(hash11(s * 4.13), hash11(s * 5.71));\n        vec2 c = span * vec2(sin(w.x * t + ph.x), cos(w.y * t + ph.y));\n        float radius = 0.08 + 0.14 * hash11(s * 6.37);\n\n        dMin = min(dMin, length(p - c) - radius);\n      }\n    }\n\n    vec3 col = vec3(0.0);\n    vec3 mean = vec3(0.0);\n    float total = 0.0;\n\n    for (int i = 0; i < 5; i++) {\n      if (i >= int(uColorCount)) break;\n\n      vec3 swatch = pow(max(uColors[i], vec3(0.0)), vec3(1.0 / 2.2));\n\n      for (int j = 0; j < 2; j++) {\n        float s = float(i * 2 + j) + 1.0;\n        vec2 w = 0.13 + 0.12 * vec2(hash11(s * 1.31), hash11(s * 2.77));\n        vec2 ph = TWO_PI_SHIFT * vec2(hash11(s * 4.13), hash11(s * 5.71));\n        vec2 c = span * vec2(sin(w.x * t + ph.x), cos(w.y * t + ph.y));\n        float radius = 0.08 + 0.14 * hash11(s * 6.37);\n        float weight = exp(-(length(p - c) - radius - dMin) / temperature);\n\n        col += swatch * weight;\n        total += weight;\n      }\n\n      mean += swatch;\n    }\n\n    col /= max(total, 1e-5);\n    mean /= uColorCount;\n\n    // A hot softmax pulls every pixel toward the palette mean; stretch\n    // back out from the mean so a very soft field keeps its color range\n    // instead of going muddy.\n    float stretch = 1.0 + 0.9 * smoothstep(0.12, 0.5, temperature);\n\n    return clamp(mean + (col - mean) * stretch, 0.0, 1.0);\n  }\n\n  // One block's out-of-register slice of the gradient.\n  vec3 blockColor(vec2 q, vec4 shift, float t, float temperature) {\n    vec2 p = q * (1.0 + uFocus * shift.z) + uFocus * shift.xy;\n\n    return gradientField(p, t * 0.32 + uFocus * shift.w, temperature);\n  }\n\n  void main() {\n    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);\n    vec2 l = toLayout(q);\n\n    // Layout units per pixel, taken before any branching so derivatives\n    // stay defined. Only used to antialias the seams.\n    float pxL = max(fwidth(l.x), fwidth(l.y));\n\n    float t = uTime;\n\n    // PARAMS: Blocks maps to a subdivision depth budget and a minimum\n    // block size, Offset scales each block's register shift, Soft is\n    // the softmax temperature of the color field, Glow is exposure.\n    float budget = 1.0 + 1.6 * uWaves;\n    float minSize = 0.15 / sqrt(max(uWaves, 0.1));\n    float temperature = 0.06 + 0.1 * uShine + 0.05 * uShine * uShine;\n\n    vec2 lo;\n    vec2 hi;\n    vec4 shift = locateBlock(l, t, budget, minSize, lo, hi);\n    vec3 col = blockColor(q, shift, t, temperature);\n\n    // Seam antialiasing: find the nearest interior block edge and, when\n    // it is within a pixel, blend in the neighbor block's color by\n    // box-filter coverage. Frame-boundary edges are not seams.\n    vec2 frameHi = 0.5 * vec2(max(uAspect, 1.0 / uAspect), 1.0);\n    float eps = 1e-4;\n    float dEdge = 1e4;\n    vec2 normal = vec2(0.0);\n\n    if (lo.x > -frameHi.x + eps && l.x - lo.x < dEdge) {\n      dEdge = l.x - lo.x;\n      normal = vec2(-1.0, 0.0);\n    }\n\n    if (hi.x < frameHi.x - eps && hi.x - l.x < dEdge) {\n      dEdge = hi.x - l.x;\n      normal = vec2(1.0, 0.0);\n    }\n\n    if (lo.y > -frameHi.y + eps && l.y - lo.y < dEdge) {\n      dEdge = l.y - lo.y;\n      normal = vec2(0.0, -1.0);\n    }\n\n    if (hi.y < frameHi.y - eps && hi.y - l.y < dEdge) {\n      dEdge = hi.y - l.y;\n      normal = vec2(0.0, 1.0);\n    }\n\n    if (dEdge < pxL) {\n      vec2 nLo;\n      vec2 nHi;\n      vec4 nShift = locateBlock(l + normal * (dEdge + 0.5 * pxL), t, budget, minSize, nLo, nHi);\n      vec3 nCol = blockColor(q, nShift, t, temperature);\n\n      col = mix(nCol, col, clamp(0.5 + dEdge / pxL, 0.0, 1.0));\n    }\n\n    // Exposure: a plain scale below 1, a soft shoulder above it so a\n    // hot Glow lifts toward white without clipping hard.\n    float exposure = 0.55 + 0.45 * uGlow;\n\n    if (exposure > 1.0) {\n      col = 1.0 - pow(max(1.0 - col, vec3(0.0)), vec3(exposure));\n    } else {\n      col *= exposure;\n    }\n\n    // Fine static grain pinned to the frame for a printed, editorial\n    // texture, plus a sub-LSB dither against banding in the soft ramps.\n    vec2 grainCell = floor(vUv * vec2(uAspect, 1.0) * 1400.0);\n    col += 0.02 * (hash12(grainCell) - 0.5);\n    col += (1.0 / 256.0)\n      * (fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233)))\n        * 43758.5453123) - 0.5);\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "lineScreen": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uColor;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uShine;\n  uniform float uAngle;\n\n  varying vec2 vUv;\n\n  float ease(float x) {\n    x = clamp(x, 0.0, 1.0);\n\n    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);\n  }\n\n  // Eased step clock: holds on integers, then slides to the next one over\n  // moveFrac of each period. Continuous for all t.\n  float pressClock(float t, float period, float moveFrac, float phase) {\n    float x = t / period + phase;\n\n    return floor(x) + ease(fract(x) / moveFrac);\n  }\n\n  float hash11(float n) {\n    return fract(sin(n * 127.1 + 311.7) * 43758.5453);\n  }\n\n  float splitHeight(float cell, float t) {\n    float h = hash11(cell);\n    float amp = 0.5 + 0.8 * hash11(cell + 17.0);\n    float clock = pressClock(t, 5.2, 0.45, h);\n\n    return amp * sin(1.5707963 * clock + 3.14159265 * floor(h * 2.0));\n  }\n\n  // Ink of one bar cell: even cells are bars, and the split inverts\n  // everything above the cell's own (animated) split height.\n  float cellInk(float cell, float y, float t, float w) {\n    float bar = 1.0 - mod(cell, 2.0);\n    float split = smoothstep(-w, w, y - splitHeight(cell, t));\n\n    return bar + split - 2.0 * bar * split;\n  }\n\n  float shapeCover(vec2 s, float t, float w) {\n    float periodA = 3.4;\n    float slide = pressClock(t, 4.0, 0.6, 0.0) * 0.25;\n    float bendClock = pressClock(t, 6.5, 0.5, 0.35);\n    float k = 0.95 * cos(1.5707963 * bendClock);\n    float tipY = 0.25 * sin(1.5707963 * pressClock(t, 4.7, 0.6, 0.7));\n    float slope = sqrt(1.0 + k * k);\n\n    float u = (s.x + k * abs(s.y - tipY)) / periodA - slide;\n    float cellPos = u * 2.0;\n    float cell = floor(cellPos);\n    float local = cellPos - cell;\n    float side = local < 0.5 ? -1.0 : 1.0;\n    float edgeDist = min(local, 1.0 - local) * 0.5 * periodA / slope;\n\n    // AA across a cell boundary blends the two cells' finished ink rather\n    // than XOR-ing independently AA'd edges, which left a half-tone seam\n    // wherever a bar edge and a split step coincided.\n    float inkHere = cellInk(cell, s.y, t, w);\n    float inkNext = cellInk(cell + side, s.y, t, w);\n\n    return mix(inkHere, inkNext, 1.0 - smoothstep(-w, w, edgeDist));\n  }\n\n  // Second antiderivative of a unit-period pulse train (width c, centered\n  // at 0.5), so the line screen can be tent-filtered exactly. Callers keep\n  // x near [0, 1] so the second difference does not lose precision.\n  float pulseIntegral2(float x, float c) {\n    float n = floor(x);\n    float f = x - n;\n    float a = 0.5 - 0.5 * c;\n    float r = clamp(f - a, 0.0, c);\n    float k = 0.5 * r * r + c * max(f - a - c, 0.0);\n\n    return 0.5 * c * n * n + n * c * f + k;\n  }\n\n  float screenCoverage(float w, float c, float h) {\n    float x = fract(w);\n\n    return (pulseIntegral2(x + h, c) - 2.0 * pulseIntegral2(x, c)\n      + pulseIntegral2(x - h, c)) / (h * h);\n  }\n\n  void main() {\n    // Frame space normalized to the short side so the composition and the\n    // line spacing hold up in portrait, square and landscape.\n    float shortSide = min(uAspect, 1.0);\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0 / shortSide;\n    float t = uTime;\n\n    vec2 s = p / max(uWaves, 0.05);\n    float pix = fwidth(s.y);\n\n    float ink = shapeCover(s, t, pix * 0.75);\n\n    // Sheen field: an offset, heavily blurred copy of the shapes (minus\n    // the sharp ones) gives every region a soft pressed-light gradient\n    // along its edges; two slow glows stretched along the lines add broad\n    // swells across the flat areas.\n    vec2 lightOffset = vec2(0.3, -0.22);\n    float halo = shapeCover(s + lightOffset, t, 0.75);\n\n    float a = radians(uAngle);\n    vec2 along = vec2(cos(a), sin(a));\n    vec2 n = vec2(-along.y, along.x);\n    vec2 g0 = vec2(1.2 * sin(t * 0.21), 0.5 * cos(t * 0.17 + 1.0));\n    vec2 g1 = vec2(1.4 * sin(t * 0.13 + 2.4), 0.6 * sin(t * 0.19 + 4.0));\n    vec2 d0 = vec2(dot(p - g0, along) * 0.4, dot(p - g0, n));\n    vec2 d1 = vec2(dot(p - g1, along) * 0.45, dot(p - g1, n));\n    float glow = exp(-dot(d0, d0) * 1.3) - exp(-dot(d1, d1) * 1.6);\n    float field = clamp(1.3 * (halo - ink) + 0.75 * glow, -1.0, 1.0);\n\n    // The coverage ranges for ink and paper never overlap, so even at max\n    // sheen the shape edges stay readable.\n    float swell = 0.3 * uShine;\n    float cover = mix(0.2, 0.8, ink) + swell * field;\n    cover = clamp(cover, mix(0.03, 0.6, ink), mix(0.4, 0.97, ink));\n\n    // ~92 lines across the short side at Lines 1, with a faint wobble so\n    // the screen feels printed rather than ruled.\n    float density = 46.0 * uFocus;\n    float w = (dot(p, n) + 0.008 * sin(dot(p, vec2(1.3, -0.7)) * 1.6 + t * 0.2))\n      * density;\n\n    // Fade to the average tone as the line period nears ~2px, before the\n    // pixel grid starts beating against it.\n    float fw = max(length(vec2(dFdx(w), dFdy(w))), 1e-4);\n    float lineInk = screenCoverage(w, cover, fw);\n    lineInk = mix(lineInk, cover, smoothstep(0.22, 0.45, fw));\n\n    vec3 col = pow(mix(uBase, uColor, lineInk), vec3(1.0 / 2.2));\n\n    // Sub-LSB dither keeps the faded small-preview gradients from banding.\n    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\n    col += (dither - 0.5) / 255.0;\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "dotMatrix": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uColor;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uAngle;\n\n  varying vec2 vUv;\n\n  float hash(vec2 p) {\n    vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n    p3 += dot(p3, p3.yzx + 33.33);\n    return fract((p3.x + p3.y) * p3.z);\n  }\n\n  float noise(vec2 p) {\n    vec2 i = floor(p);\n    vec2 f = fract(p);\n    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);\n    float a = hash(i);\n    float b = hash(i + vec2(1.0, 0.0));\n    float c = hash(i + vec2(0.0, 1.0));\n    float d = hash(i + vec2(1.0, 1.0));\n\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n  }\n\n  float fbm(vec2 p) {\n    float s = 0.0;\n    float a = 0.5;\n    mat2 m = mat2(0.8, 0.6, -0.6, 0.8);\n\n    for (int i = 0; i < 3; i++) {\n      s += a * noise(p);\n      p = m * p * 2.03 + 17.1;\n      a *= 0.5;\n    }\n\n    return s / 0.875;\n  }\n\n  float bayer2(vec2 a) {\n    a = floor(a);\n    return fract(a.x * 0.5 + a.y * a.y * 0.75);\n  }\n\n  float bayer4(vec2 a) {\n    return bayer2(0.5 * a) * 0.25 + bayer2(a);\n  }\n\n  float bayer8(vec2 a) {\n    return bayer4(0.5 * a) * 0.25 + bayer2(a);\n  }\n\n  // Beam field in frame space, sampled once per cell. q.x runs along the\n  // beams, q.y across them. Elongated, domain-warped noise gives broad\n  // soft bands with organic edges; everything slides along the beam\n  // direction and morphs slowly so motion reads calm but alive.\n  float beamField(vec2 c, float t) {\n    float a = radians(uAngle);\n    vec2 dir = vec2(cos(a), sin(a));\n    vec2 q = vec2(dot(c, dir), dot(c, vec2(-dir.y, dir.x)));\n\n    vec2 w = vec2(\n      fbm(q * vec2(0.4, 0.8) + vec2(-t * 0.05, 0.0)),\n      fbm(q * vec2(0.4, 0.8) + vec2(5.2, 1.3) + vec2(t * 0.04, -t * 0.03))\n    );\n\n    float across = q.y + 0.9 * (w.x - 0.5);\n    float beams = 0.5 + 0.5 * sin(across * 3.6 + t * 0.22 + 3.2 * (w.y - 0.5));\n    beams = beams * beams * (3.0 - 2.0 * beams);\n\n    // A second, fainter beam family a few degrees off the first so the\n    // bands cross, merge, and pinch into shapes instead of reading as\n    // evenly spaced stripes.\n    vec2 dir2 = vec2(cos(a + 0.42), sin(a + 0.42));\n    float across2 = dot(c, vec2(-dir2.y, dir2.x)) + 0.7 * (w.y - 0.5);\n    float beams2 = 0.5 + 0.5 * sin(across2 * 2.3 - t * 0.17 + 1.7);\n    beams2 = beams2 * beams2;\n    beams = max(beams, beams2 * 0.85);\n\n    float mass = fbm(vec2(q.x * 0.5 - t * 0.14, q.y * 1.3) + 1.5 * w);\n    mass = smoothstep(0.25, 0.75, mass);\n\n    float detail = noise(vec2(q.x * 1.4 - t * 0.3, q.y * 3.0) + 2.0 * w) - 0.5;\n\n    return beams * 0.55 + mass * 0.55 + detail * 0.22 - 0.05;\n  }\n\n  // Exact box-filtered coverage of a centered 1D segment of half-width h\n  // seen through a pixel footprint fw: stays crisp when dots span many\n  // pixels and averages out to the true area when they shrink below one.\n  float boxCover(float x, float h, float fw) {\n    float lo = clamp(x - 0.5 * fw, -h, h);\n    float hi = clamp(x + 0.5 * fw, -h, h);\n\n    return (hi - lo) / fw;\n  }\n\n  vec3 toDisplay(vec3 lin) {\n    return pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2));\n  }\n\n  void main() {\n    vec3 accent = toDisplay(uColor);\n    vec3 base = toDisplay(uBase);\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;\n    float t = uTime;\n\n    // PARAMS: about 56 rows at waves 1, which lands near 100 columns\n    // across a 16:9 frame (the LED billboard pitch of the references).\n    float density = 28.0 * uWaves;\n    vec2 g = p * density;\n    vec2 id = floor(g);\n    vec2 f = g - id - 0.5;\n    vec2 center = (id + 0.5) / density;\n\n    float field = beamField(center, t);\n\n    // Beams knob: shifts how much of the field clears the dither ramp.\n    float litRaw = (field - 0.48 + 0.3 * (uGlow - 1.0)) / 0.5;\n\n    // Ambient scatter: a slow, very sparse dim layer so some of the dark\n    // gaps keep a faint LED texture while others drop out entirely.\n    float amb = noise(center * 1.3 + vec2(t * 0.05, -t * 0.04));\n    amb = 0.1 * smoothstep(0.45, 0.8, amb) * clamp(uGlow, 0.0, 1.0);\n\n    float lit = max(clamp(litRaw, 0.0, 1.0), amb);\n    float core = smoothstep(1.0, 1.6, litRaw);\n\n    float th = mix(bayer8(id), hash(id + 3.7), 0.12) * 0.94 + 0.03;\n    float on = smoothstep(th - 0.05, th + 0.05, lit);\n\n    float size = (mix(0.5, 1.0, lit) + 0.3 * core) * on;\n    float h = clamp(0.17 * uFocus * size, 0.0, 0.46);\n\n    vec2 fw = max(fwidth(g), vec2(1e-4));\n    float cover = boxCover(f.x, h, fw.x) * boxCover(f.y, h, fw.y);\n\n    // When a pixel spans more than about half a cell the per-cell value\n    // is undersampled; settle to the cell's mean light so tiny previews\n    // read as a smooth tone instead of moire.\n    float meanCover = 4.0 * h * h;\n    cover = mix(cover, meanCover, smoothstep(0.45, 1.0, max(fw.x, fw.y)));\n\n    float bright = mix(0.55, 1.0, lit) * on;\n    // Hot cores push the accent slightly further away from the base\n    // (brighter on dark bases, deeper on light ones).\n    vec3 hot = clamp(accent + (accent - base) * 0.18 * core, 0.0, 1.0);\n    vec3 dotCol = mix(base, hot, bright);\n\n    // A whisper of accent haze under the beams so the field has depth.\n    // Sampled per pixel (not per cell) so it never shows cell blocks\n    // when the grid is coarse.\n    float hazeField = beamField(p, t);\n    float haze = smoothstep(0.3, 1.2, hazeField + 0.3 * (uGlow - 1.0)) * 0.045;\n    vec3 bg = mix(base, accent, haze);\n\n    vec3 col = mix(bg, dotCol, cover);\n\n    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;\n\n    // Composition tuned in display space; decode to linear so the\n    // pipeline's output re-encode restores the approved look.\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "watercolor": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n  uniform float uShine;\n  \n  uniform vec3 uColors[5];\n  uniform float uColorCount;\n\n\n  varying vec2 vUv;\n\n  \n  #define TWO_PI 6.28318530718\n\n  float hash21(vec2 p) {\n    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;\n    p += dot(p, p + 19.19);\n    return fract(p.x * p.y);\n  }\n\n  float valueNoise(vec2 st) {\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n    float a = hash21(i);\n    float b = hash21(i + vec2(1.0, 0.0));\n    float c = hash21(i + vec2(0.0, 1.0));\n    float d = hash21(i + vec2(1.0, 1.0));\n    vec2 u = f * f * (3.0 - 2.0 * f);\n\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n  }\n\n  vec2 rotate2(vec2 uv, float th) {\n    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;\n  }\n\n\n  vec2 gradDir(vec2 i) {\n    float a = hash21(i) * TWO_PI;\n\n    return vec2(cos(a), sin(a));\n  }\n\n  // Quintic gradient noise, roughly [-0.7, 0.7]. Smooth enough that the\n  // soft color fields never show the lattice.\n  float gnoise(vec2 x) {\n    vec2 i = floor(x);\n    vec2 f = fract(x);\n    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);\n    float a = dot(gradDir(i), f);\n    float b = dot(gradDir(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));\n    float c = dot(gradDir(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));\n    float d = dot(gradDir(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));\n\n    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n  }\n\n  // Color uniforms arrive linear (three's ColorManagement decodes hex on\n  // set); this pass composes in display space, so re-encode them first\n  // and a picked hex shows exactly.\n  vec3 toDisplay(vec3 c) {\n    return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));\n  }\n\n  void main() {\n    // Frame space with the SHORT axis spanning [-1, 1], so a portrait\n    // frame shows as many regions across as a landscape one shows down.\n    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0 / min(uAspect, 1.0);\n\n    float scale = clamp(uWaves, 0.25, 2.5);\n    float bleed = clamp(uFocus, 0.2, 2.0);\n    float pigment = clamp(uGlow, 0.0, 2.0);\n    float grainAmt = clamp(uShine, 0.0, 2.0);\n    float t = uTime;\n    float count = max(uColorCount, 1.0);\n\n    vec2 q = p / scale;\n\n    // Broad, slow flow so the regions drift and turn rather than slide.\n    vec2 flow = vec2(\n      gnoise(q * 0.55 + vec2(1.3, 0.021 * t)),\n      gnoise(q * 0.55 + vec2(7.9, -4.2) - vec2(0.017 * t, 0.0))\n    );\n    vec2 qw = q + 0.75 * flow;\n\n    // Plumes: a tent-shaped ridge along x (sharp peaks at the noise's\n    // zero crossings) lifts the lower color up into the one above it,\n    // like pigment wicking up through wet paper. The ridge itself drifts\n    // and morphs slowly so the peaks rise, lean and fade.\n    float rn = gnoise(vec2(qw.x * 0.5, qw.y * 0.2 - 0.03 * t) + 3.7);\n    float ridge = 1.0 - min(sqrt(rn * rn + 0.0025) * 1.8, 1.0);\n    float plume = ridge * sqrt(ridge);\n\n    // Fine vertical feathering: streaks of pigment carried up the paper.\n    float streak = gnoise(vec2(qw.x * 3.2, qw.y * 0.6 - 0.04 * t) + 9.1);\n\n    vec2 qs = qw;\n    qs.y -= bleed * (0.9 * (plume - 0.3) + 0.05 * streak);\n\n    // Each pigment has a home in a loose two-row layout (first half of\n    // the palette across the top, the rest along the bottom) so every\n    // color gets its own big region, then noise breaks the layout up.\n    // Zoomed far out the homes fade and the noise alone sets the regions.\n    vec2 ext = vec2(uAspect, 1.0) / min(uAspect, 1.0);\n    float homeW = smoothstep(0.3, 0.9, scale);\n    float topCount = floor((count + 1.0) * 0.5);\n    float botCount = max(count - topCount, 1.0);\n\n    // Per-pigment fields mixed wet-in-wet by a softmax: the temperature\n    // sets how wide the bleeds between neighboring colors are.\n    float sharp = 5.2 * pow(bleed, -0.3);\n    float wsum = 0.0;\n    vec3 lin = vec3(0.0);\n    vec3 absorb = vec3(0.0);\n\n    for (int i = 0; i < 5; i++) {\n      if (i >= int(count)) break;\n\n      float fi = float(i);\n      bool top = fi < topCount;\n      float j = top ? fi : fi - topCount;\n      float rowN = top ? topCount : botCount;\n      vec2 home = vec2(\n        ((j + 0.5) / rowN) * 2.0 - 1.0 + (top ? -0.1 : 0.35),\n        top ? 0.5 : -0.85\n      );\n      home *= ext * 0.8;\n      home += 0.14 * vec2(\n        sin(t * 0.05 * (1.0 + 0.3 * fi) + fi * 1.7),\n        cos(t * 0.043 * (1.0 + 0.2 * fi) + fi * 2.9)\n      );\n\n      vec2 d = qs - home;\n      vec2 drift = vec2(cos(fi * 2.4 + 0.7), sin(fi * 2.4 + 0.7)) * 0.02 * t;\n      float n = gnoise(qs * 0.42 + vec2(fi * 3.71, fi * -2.13) + drift)\n        + 0.3 * gnoise(qs * 0.9 + vec2(fi * -1.9, fi * 4.3) - drift);\n      n = mix(n, 0.7 * n - 0.75 * dot(d, d), homeW);\n      float w = exp(sharp * n);\n      vec3 c = clamp(toDisplay(uColors[i]), vec3(0.01), vec3(1.0));\n      wsum += w;\n      lin += w * c;\n      absorb += w * -log(c);\n    }\n\n    lin /= wsum;\n    absorb /= wsum;\n\n    // Mostly a straight blend so meeting colors stay clean and luminous,\n    // with a little subtractive mixing for depth where they overlap.\n    vec3 pig = mix(lin, exp(-absorb), 0.22);\n\n    // Gentle density variation inside each region: deeper pools of\n    // pigment and thinner, lighter washes.\n    float pool = gnoise(qw * 0.75 + vec2(-5.0, 0.012 * t)) * 0.7\n      + gnoise(qw * 1.6 + 11.0) * 0.3;\n    pig *= exp(-pool * 0.4 * (vec3(1.0) - pig));\n\n    // The paper tints the light areas a touch and is what the pigment\n    // fades toward. Past 1, Pigment deepens and saturates the wash.\n    vec3 paper = toDisplay(uBase);\n    float lightness = dot(pig, vec3(0.299, 0.587, 0.114));\n    vec3 col = mix(pig, paper, 0.04 + 0.1 * lightness * lightness);\n    float extra = max(pigment - 1.0, 0.0);\n    float luma = dot(col, vec3(0.299, 0.587, 0.114));\n    col = mix(vec3(luma), col, 1.0 + 0.45 * extra);\n    col *= 1.0 - 0.18 * extra * (1.0 - col);\n    col = mix(paper, col, smoothstep(0.0, 1.0, min(pigment, 1.0)));\n\n    // Paper grain: fine, even and frame-pinned, a little coarser in the\n    // lights than the darks like film. Added in display space.\n    vec2 g = p * 420.0;\n    float grain = gnoise(g) * 0.7 + gnoise(rotate2(g, 1.3) * 1.9 + 5.0) * 0.3;\n    col += grain * 0.1 * grainAmt * (0.6 + 0.4 * luma);\n\n    // Sub-LSB dither so the soft gradients never band.\n    col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  "voxels": "precision highp float;\n\n  uniform float uTime;\n  uniform float uAspect;\n  uniform vec3 uColor;\n  uniform vec3 uBase;\n  uniform float uWaves;\n  uniform float uFocus;\n  uniform float uGlow;\n\n  varying vec2 vUv;\n\n  float hash21(vec2 p) {\n    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;\n    p += dot(p, p + 19.19);\n    return fract(p.x * p.y);\n  }\n\n  vec3 toDisplay(vec3 lin) {\n    return pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2));\n  }\n\n  // Lambert-ish brightness of a unit normal under the orbiting key light,\n  // remapped so the terminator side never drops to nothing.\n  float lit(vec3 n, vec3 l) {\n    float k = clamp(dot(n, l), 0.0, 1.0);\n\n    return 0.24 + 0.76 * k * k * (3.0 - 2.0 * k);\n  }\n\n  // The 3D forms, evaluated at one cell center in frame space (y spans\n  // -1..1). Returns (presence 0..1, brightness 0..1). Where forms overlap\n  // the one whose surface sits nearest the viewer wins, so they layer like\n  // solid objects.\n  vec2 forms(vec2 p, float t, float aspect, float scale, vec3 l) {\n    float bestZ = -1e3;\n    vec2 res = vec2(0.0);\n    float soft = 0.035;\n\n    // Orb: a full sphere drifting on a slow loop.\n    vec2 c1 = vec2(aspect * (0.22 * sin(t * 0.159) - 0.4), 0.22 * sin(t * 0.216 + 1.1) + 0.38);\n    float r1 = scale * (0.7 + 0.05 * sin(t * 0.286));\n    vec2 q1 = (p - c1) / r1;\n    float d1 = length(q1);\n\n    if (d1 < 1.0 + soft / r1) {\n      vec3 n = vec3(q1, sqrt(max(1.0 - d1 * d1, 0.0)));\n      float z = 0.4 + n.z * r1;\n\n      if (z > bestZ) {\n        bestZ = z;\n        res = vec2(1.0 - smoothstep(1.0 - soft / r1, 1.0 + soft / r1, d1), lit(n, l));\n      }\n    }\n\n    // Lamp shade: the upper half of a wide sphere resting on the bottom\n    // of the frame, so its rows widen toward the flat rim.\n    vec2 c2 = vec2(aspect * (0.2 * cos(t * 0.122) + 0.38), -1.0 + 0.12 * sin(t * 0.185 + 2.3));\n    float r2 = scale * (1.08 + 0.07 * sin(t * 0.234 + 0.7));\n    vec2 q2 = (p - c2) / r2;\n    float d2 = length(q2);\n    float rim = smoothstep(-0.02, 0.02, q2.y + 0.04);\n\n    if (d2 < 1.0 + soft / r2 && rim > 0.0) {\n      vec3 n = vec3(q2, sqrt(max(1.0 - d2 * d2, 0.0)));\n      float z = n.z * r2;\n\n      if (z > bestZ) {\n        bestZ = z;\n        res = vec2((1.0 - smoothstep(1.0 - soft / r2, 1.0 + soft / r2, d2)) * rim, lit(n, l));\n      }\n    }\n\n    // Tube: a long diagonal cylinder sweeping slowly across the back.\n    float ang = 0.62 + 0.18 * sin(t * 0.112);\n    vec2 dir = vec2(cos(ang), sin(ang));\n    vec2 nrm = vec2(-dir.y, dir.x);\n    vec2 c3 = vec2(aspect * 0.5 * sin(t * 0.096 + 4.0), 0.0);\n    float hw = scale * 0.36;\n    float across = dot(p - c3, nrm) / hw;\n\n    if (abs(across) < 1.0 + soft / hw) {\n      float nz = sqrt(max(1.0 - across * across, 0.0));\n      vec3 n = vec3(nrm * across, nz);\n      float z = -0.3 + nz * hw;\n\n      if (z > bestZ) {\n        bestZ = z;\n        res = vec2(1.0 - smoothstep(1.0 - soft / hw, 1.0 + soft / hw, abs(across)), lit(n, l));\n      }\n    }\n\n    return res;\n  }\n\n  // Ink at one frame point (x in row units, y in rows). Returns the\n  // stippled ink in x and its expected value (the mean the stipple\n  // converges to) in y, so the caller can fade to the mean where the\n  // grain gets finer than a pixel.\n  vec2 inkAt(vec2 g, float t, float aspect, float rows, float scale, float shading, vec3 l) {\n    float row = floor(g.y);\n    float v = g.y - row;\n    float rh = hash21(vec2(row, 3.7));\n\n    // Cells are about 1.9 rows wide; each row gets its own width and\n    // phase, and a gentle monotonic warp lets widths vary along the row.\n    float cw = 1.9 * (0.82 + 0.36 * rh);\n    float xw = g.x + 0.3 * cw * sin(g.x * 0.85 / cw * 2.0 + row * 1.7) / 2.0 + rh * 7.0;\n    float ci = floor(xw / cw);\n    float u = xw / cw - ci;\n\n    vec2 center = vec2(((ci + 0.5) * cw - rh * 7.0) / rows, (row + 0.5) / rows);\n    vec2 p = (center - vec2(0.5 * aspect, 0.5)) * 2.0;\n    vec2 f = forms(p, t, aspect, scale, l);\n    float presence = f.x;\n\n    // Lighting through the Shading knob: 0 flattens every cell to a\n    // dense brick, 1 is natural, 2 deepens the shadow side.\n    float bright = mix(0.86, f.y, min(shading, 1.0));\n    bright = pow(clamp(bright, 0.0, 1.0), 1.0 + max(shading - 1.0, 0.0) * 1.3);\n\n    // Brick body with thin gaps, measured in row units so the gaps stay\n    // even on wide and narrow cells.\n    float ux = u * cw;\n    float gx = 0.09;\n    float gy = 0.085;\n    float edge = min(min(ux - gx, cw - gx - ux), min(v - gy, 1.0 - gy - v));\n    float body = step(0.0, edge);\n\n    // The lit share of the cell's face is solid stipple on its right;\n    // the rest keeps only a speckled outline, so dim cells read as\n    // hollow voxels or thin slivers seen edge-on.\n    // Each cell carries a little random tone so bars read as separate\n    // voxels rather than one smooth gradient.\n    float cellTone = clamp(bright + (hash21(vec2(ci, row) + 5.3) - 0.5) * 0.28, 0.0, 1.0);\n\n    // The lit share of the cell's face is solid stipple on its right; the\n    // rest thins out, and only cells deep in shadow fall back to a\n    // speckled outline, so dim cells read as hollow voxels or slivers\n    // seen edge-on.\n    float solidFrom = (cw - gx) - (cw - 2.0 * gx) * clamp(cellTone * 1.7 - 0.15, 0.1, 1.0);\n    float hollow = 1.0 - smoothstep(0.2, 0.45, cellTone);\n    float ring = (1.0 - step(0.11, edge)) * hollow;\n    float cap = step(ux, gx + 0.26);\n    float density = ux > solidFrom ? 0.3 + 0.64 * sqrt(cellTone) : 0.05 + 0.3 * cellTone;\n    density = max(density, ring * 0.6);\n    density *= cap > 0.5 ? 0.55 : 1.0;\n    density *= presence * body;\n\n    // Stipple: about 17 dots per row, each with its own fixed threshold\n    // and a soft switch so dots fade instead of popping as light moves.\n    vec2 dot = floor(vec2(g.x, g.y) * 17.0);\n    float th = 0.08 + 0.9 * hash21(dot);\n    float ink = smoothstep(th - 0.06, th + 0.06, density);\n\n    return vec2(ink, density);\n  }\n\n  void main() {\n    vec3 accent = toDisplay(uColor);\n    vec3 base = toDisplay(uBase);\n    float t = uTime;\n\n    // Forms are sized in frame heights; portrait frames shrink them so\n    // the narrow width still shows whole silhouettes, and get more rows\n    // so cells stay a sensible size across the width.\n    float fit = min(uAspect / 1.6, 1.0);\n    float scale = clamp(uFocus, 0.2, 3.0) * pow(fit, 0.85);\n\n    // PARAMS: about 22 rows at Rows 1 on a landscape frame.\n    float rows = 22.0 * uWaves * inversesqrt(fit);\n    float shading = max(uGlow, 0.0);\n\n    // The key light orbits slowly so shading rolls across the forms.\n    float la = t * 0.22;\n    vec3 l = normalize(vec3(0.7 * cos(la) + 0.2, 0.5 * sin(la) + 0.3, 0.42));\n\n    vec2 g = vec2(vUv.x * uAspect, vUv.y) * rows;\n    vec2 fw = fwidth(g);\n\n    // Four rotated-grid subsamples resolve the dots and brick edges at\n    // preview sizes; where a dot shrinks below a pixel the stipple fades\n    // to its mean so small frames never alias into moire.\n    vec2 acc = vec2(0.0);\n    acc += inkAt(g + fw * vec2(-0.125, -0.375), t, uAspect, rows, scale, shading, l);\n    acc += inkAt(g + fw * vec2(0.375, -0.125), t, uAspect, rows, scale, shading, l);\n    acc += inkAt(g + fw * vec2(0.125, 0.375), t, uAspect, rows, scale, shading, l);\n    acc += inkAt(g + fw * vec2(-0.375, 0.125), t, uAspect, rows, scale, shading, l);\n    acc *= 0.25;\n\n    float dotsPerPixel = max(fw.x, fw.y) * 17.0;\n    float ink = mix(acc.x, acc.y, smoothstep(0.8, 1.6, dotsPerPixel));\n\n    vec3 col = mix(base, accent, ink);\n\n    col = pow(max(col, vec3(0.0)), vec3(2.2));\n\n    gl_FragColor = vec4(col, 1.0);\n\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>\n  }",

  silkFlow: `precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float silkHeight(vec2 p, float t, float freq) {
    vec2 w = p;
    w.x += 0.85 * sin(p.y * 1.2 + t * 0.35);
    w.y += 0.85 * cos(p.x * 1.1 - t * 0.28);
    w.x += 0.45 * sin(w.y * 2.3 + t * 0.22);
    w.y += 0.45 * cos(w.x * 2.1 - t * 0.18);

    float h = sin((w.x * 0.6 + w.y * 1.8) * freq + t * 0.25);
    h += 0.45 * sin((w.x * 1.2 - w.y * 1.4) * freq - t * 0.18);
    h += 0.25 * noise((w * 3.5) + vec2(t * 0.15, -t * 0.12));
    return h;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
    float speed = max(uSpeed, 0.05);
    float t = (uTime + 12.0) * speed;
    float freq = (uWaves > 0.0 ? uWaves : 1.0) * (uNoiseScale > 0.0 ? uNoiseScale : 1.0) * 1.4;
    float focus = uFocus > 0.0 ? uFocus : 1.0;
    float glow = uGlow > 0.0 ? uGlow : 1.0;
    float shine = uShine > 0.0 ? uShine : 1.0;

    float eps = 0.02;
    float h = silkHeight(p, t, freq);
    float hx = silkHeight(p + vec2(eps, 0.0), t, freq);
    float hy = silkHeight(p + vec2(0.0, eps), t, freq);

    vec3 n = normalize(vec3(-(hx - h) / eps * 2.5 * focus, -(hy - h) / eps * 2.5 * focus, 1.0));
    vec3 l = normalize(vec3(-0.4, 0.7, 0.6));
    vec3 v = vec3(0.0, 0.0, 1.0);
    vec3 hVec = normalize(l + v);

    float ndl = max(dot(n, l), 0.0);
    float ndh = max(dot(n, hVec), 0.0);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);

    float normH = clamp((h + 1.6) / 3.2, 0.0, 1.0);
    vec3 baseFold = mix(uColor1, uColor2, smoothstep(0.15, 0.85, normH));
    vec3 crestColor = mix(baseFold, uColor3, smoothstep(0.5, 1.0, normH) * 0.8);

    float sheen = pow(ndl, 14.0) * 1.2 * glow;
    float glint = pow(ndh, 80.0) * 2.5 * shine;

    vec3 col = crestColor * (0.35 + 0.65 * ndl * glow) + (uColor3 * sheen * 0.6) + vec3(glint * (0.6 + 0.4 * fresnel));
    col = clamp(col, 0.0, 2.0);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  meshAurora: `precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;

  varying vec2 vUv;

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0) / min(uAspect, 1.0) + 0.5;
    float speed = max(uSpeed, 0.05);
    float t = (uTime + 24.0) * speed * 0.35;
    float scale = (uNoiseScale > 0.0 ? uNoiseScale : 1.0) * (uWaves > 0.0 ? uWaves : 1.0);
    float focus = max(uFocus, 0.1);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    vec2 q = uv;
    for (int i = 1; i <= 3; i++) {
      float fi = float(i);
      q.x += (0.16 / fi) * sin(q.y * 3.4 * scale + t * 1.1 * fi + fi * 1.6) * focus;
      q.y += (0.13 / fi) * cos(q.x * 3.1 * scale - t * 0.95 * fi + fi * 2.3) * focus;
    }

    vec2 p1 = vec2(0.25 + 0.25 * sin(t * 0.7), 0.75 + 0.2 * cos(t * 0.5));
    vec2 p2 = vec2(0.75 + 0.2 * cos(t * 0.6 + 1.2), 0.3 + 0.25 * sin(t * 0.8 + 2.0));
    vec2 p3 = vec2(0.5 + 0.3 * sin(t * 0.4 + 3.1), 0.5 + 0.3 * cos(t * 0.9 + 0.8));

    float d1 = exp(-dot(q - p1, q - p1) * (3.2 / focus));
    float d2 = exp(-dot(q - p2, q - p2) * (3.0 / focus));
    float d3 = exp(-dot(q - p3, q - p3) * (2.8 / focus));

    float sum = max(d1 + d2 + d3, 0.001);
    vec3 col = (uColor1 * d1 + uColor2 * d2 + uColor3 * d3) / sum;

    float ribbon = sin((q.x + q.y * 0.4) * 8.0 * scale + t * 1.4);
    ribbon = 0.5 + 0.5 * ribbon;
    float ribbonFringe = pow(ribbon, 4.0) * 0.6 * shine;
    col += mix(uColor2, uColor3, ribbon) * ribbonFringe;

    col *= (0.65 + 0.55 * glow);
    col = clamp(col, 0.0, 2.0);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  liquidMetal: `precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;

  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 3.0;
    float speed = max(uSpeed, 0.05);
    float t = (uTime + 45.0) * speed * 0.45;
    float scale = (uNoiseScale > 0.0 ? uNoiseScale : 1.0) * (uWaves > 0.0 ? uWaves : 1.0) * 0.8;
    float focus = max(uFocus, 0.1);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    vec2 v = p * scale;
    for (int i = 1; i <= 5; i++) {
      float fi = float(i);
      v += vec2(
        (0.6 / fi) * sin(fi * v.y + t * 0.65 + 0.4 * fi),
        (0.45 / fi) * cos(fi * v.x - t * 0.55 + 0.3 * fi)
      );
    }

    float eps = 0.015;
    float f = sin(v.x) * cos(v.y);
    float fx = sin(v.x + eps) * cos(v.y);
    float fy = sin(v.x) * cos(v.y + eps);

    vec3 n = normalize(vec3(-(fx - f) / eps * 2.2 * focus, -(fy - f) / eps * 2.2 * focus, 1.0));
    vec3 l = normalize(vec3(-0.35, 0.65, 0.7));
    vec3 eye = vec3(0.0, 0.0, 1.0);
    vec3 halfVec = normalize(l + eye);

    float ndl = max(dot(n, l), 0.0);
    float ndh = max(dot(n, halfVec), 0.0);
    float fresnel = pow(1.0 - max(dot(n, eye), 0.0), 3.0);

    float heightMap = clamp(0.5 + 0.5 * sin(v.x + v.y + t * 0.3), 0.0, 1.0);
    vec3 metalAlloy = mix(uColor1, uColor2, smoothstep(0.2, 0.8, heightMap));
    vec3 rimIridescence = mix(metalAlloy, uColor3, fresnel);

    float specular = pow(ndh, 48.0 * shine) * 2.0 * shine;
    float gloss = pow(ndl, 6.0) * 0.8 * glow;

    vec3 col = rimIridescence * (0.3 + gloss) + vec3(specular) + uColor3 * (fresnel * 0.45 * shine);
    col = clamp(col, 0.0, 2.0);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  sphereGradient: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  float snoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(
      mix(mix(fract(sin(n + 0.0) * 43758.5453), fract(sin(n + 1.0) * 43758.5453), f.x),
          mix(fract(sin(n + 57.0) * 43758.5453), fract(sin(n + 58.0) * 43758.5453), f.x), f.y),
      mix(mix(fract(sin(n + 113.0) * 43758.5453), fract(sin(n + 114.0) * 43758.5453), f.x),
          mix(fract(sin(n + 170.0) * 43758.5453), fract(sin(n + 171.0) * 43758.5453), f.x), f.y), f.z);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
    float t = (uTime + 10.0) * max(uSpeed, 0.05) * 0.5;
    float radius = 0.72 * max(uFocus, 0.2);
    float dist = length(p);
    float waves = max(uWaves, 0.1);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    if (dist <= radius) {
      float z = sqrt(max(0.0, radius * radius - dist * dist));
      vec3 n = normalize(vec3(p, z));
      vec3 rotPos = vec3(
        n.x * cos(t * 0.4) - n.z * sin(t * 0.4),
        n.y,
        n.x * sin(t * 0.4) + n.z * cos(t * 0.4)
      );
      float turb = snoise3D(rotPos * (2.4 * waves) + vec3(0.0, t * 0.3, t * 0.2));
      turb += 0.5 * snoise3D(rotPos * (4.8 * waves) - vec3(t * 0.2, 0.0, t * 0.4));

      vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
      float diff = max(dot(n, lightDir), 0.0);
      float fresnel = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);

      vec3 col = mix(uColor1, uColor2, smoothstep(-0.4, 0.6, turb + (n.y * 0.5)));
      col = mix(col, uColor3, fresnel * 0.85);
      col *= (0.4 + 0.8 * diff * glow);
      col += vec3(pow(max(dot(reflect(-lightDir, n), vec3(0.0, 0.0, 1.0)), 0.0), 32.0)) * shine * 1.5;

      col = pow(max(col, vec3(0.0)), vec3(2.2));
      gl_FragColor = vec4(col, 1.0);
    } else {
      float halo = exp(-(dist - radius) * 4.0 / max(0.1, glow));
      vec3 haloCol = mix(uColor2, uColor3, 0.5) * halo * 0.6 * glow;
      vec3 col = uBase + haloCol;
      col = pow(max(col, vec3(0.0)), vec3(2.2));
      gl_FragColor = vec4(col, 1.0);
    }

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  waterPlane: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 4.0;
    float t = (uTime + 20.0) * max(uSpeed, 0.05) * 0.8;
    float waves = max(uWaves, 0.2);
    float focus = max(uFocus, 0.2);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    vec2 v = p * (1.2 * waves);
    float h = 0.0;
    h += sin(v.x * 2.0 + t * 1.2) * cos(v.y * 1.8 - t * 0.9);
    h += 0.5 * sin(v.x * 3.4 - t * 1.5 + v.y * 2.2);
    h += 0.25 * sin(length(v + vec2(sin(t * 0.5), cos(t * 0.6))) * 5.0 - t * 2.0);

    float eps = 0.02;
    float hx = sin((v.x + eps) * 2.0 + t * 1.2) * cos(v.y * 1.8 - t * 0.9);
    float hy = sin(v.x * 2.0 + t * 1.2) * cos((v.y + eps) * 1.8 - t * 0.9);
    vec3 n = normalize(vec3(-(hx - h) / eps * focus, -(hy - h) / eps * focus, 1.0));

    vec3 light = normalize(vec3(-0.4, 0.6, 0.7));
    float diff = max(dot(n, light), 0.0);
    float fresnel = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);

    vec2 cUv = v + vec2(h * 0.3);
    float caustics = pow(abs(sin(cUv.x * 3.5 + t) * sin(cUv.y * 3.5 - t)), 2.0) * 1.6;
    caustics += pow(abs(cos(cUv.x * 5.0 - t * 1.2) * cos(cUv.y * 5.0 + t * 1.1)), 2.5);

    vec3 waterDeep = mix(uBase, uColor1, 0.8);
    vec3 waterShallow = mix(uColor1, uColor2, clamp(h * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = mix(waterDeep, waterShallow, 0.6 + 0.4 * diff);
    col += uColor3 * (caustics * 0.4 * focus) * glow;
    col += vec3(pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0)) * shine * 2.2;
    col += uColor2 * (fresnel * 0.5 * glow);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  stripeMesh: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float t = (uTime + 30.0) * max(uSpeed, 0.05) * 0.6;
    float waves = max(uWaves, 0.1);
    float focus = max(uFocus, 0.1);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.0);

    vec2 warp = vec2(
      sin(uv.y * (4.0 * waves) + t * 0.8) * cos(uv.x * (2.5 * waves) - t * 0.5),
      cos(uv.x * (4.0 * waves) - t * 0.7) * sin(uv.y * (3.0 * waves) + t * 0.6)
    );
    vec2 warpedUV = uv + warp * (0.28 * focus);

    vec3 cTL = uColor1;
    vec3 cTR = uColor2;
    vec3 cBR = uColor3;
    vec3 cBL = uBase;

    vec2 st = clamp(warpedUV, 0.0, 1.0);
    vec2 smoothSt = smoothstep(0.0, 1.0, st);
    vec3 cTop = mix(cTL, cTR, smoothSt.x);
    vec3 cBottom = mix(cBL, cBR, smoothSt.x);
    vec3 col = mix(cBottom, cTop, 1.0 - smoothSt.y);

    col *= (0.7 + 0.5 * glow);

    float grain = hash(floor(vUv * vec2(uAspect, 1.0) * 800.0));
    col += vec3((grain - 0.5) * 0.04 * shine);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  topography: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  float topoNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 3.5;
    float t = (uTime + 15.0) * max(uSpeed, 0.05) * 0.35;
    float waves = max(uWaves, 0.2);
    float focus = max(uFocus, 0.2);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    vec2 q = p * (0.8 * waves);
    float elevation = topoNoise(q + vec2(t * 0.2, t * 0.15));
    elevation += 0.5 * topoNoise(q * 2.1 - vec2(t * 0.25, -t * 0.1));
    elevation += 0.25 * topoNoise(q * 4.2 + vec2(t * 0.1, t * 0.3));

    float numContours = 14.0 * focus;
    float cPos = elevation * numContours;
    float lineFrac = abs(fract(cPos) - 0.5) * 2.0;
    float lineDist = fwidth(cPos) * 1.5;
    float line = 1.0 - smoothstep(0.0, max(0.06, lineDist), lineFrac);

    vec3 terrain = mix(uBase, uColor1, smoothstep(0.1, 0.6, elevation));
    terrain = mix(terrain, uColor2, smoothstep(0.5, 1.2, elevation));
    vec3 contourGlow = uColor3 * line * 1.8 * glow;
    vec3 col = terrain + contourGlow + (uColor2 * line * 0.4 * shine);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  hyperspeed: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float speed = max(uSpeed, 0.1);
    float t = (uTime + 50.0) * speed * 2.2;
    float waves = max(uWaves, 0.2);
    float focus = max(uFocus, 0.2);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    float horizonY = -0.15;
    float py = p.y - horizonY;
    float depth = 1.0 / (abs(py) + 0.04);
    vec2 road = vec2(p.x * depth * (1.2 * focus), depth * 0.5 + (py > 0.0 ? -t : t));

    vec3 col = uBase;
    float lane = floor(road.x * 4.0 * waves);
    float laneFrac = fract(road.x * 4.0 * waves);

    float streak = pow(abs(sin(road.y * 0.4 + hash(lane) * 6.28)), 16.0);
    float railMask = smoothstep(0.12, 0.02, abs(laneFrac - 0.5));
    float light = streak * railMask * smoothstep(0.0, 4.0, depth) * glow;

    vec3 lightCol = mix(uColor1, uColor2, fract(lane * 0.37));
    if (py < 0.0) lightCol = mix(lightCol, uColor3, 0.4);

    col += lightCol * light * 2.5;

    float horizonGlow = exp(-abs(py) * 12.0) * 0.8 * glow;
    col += mix(uColor2, uColor1, 0.5) * horizonGlow;

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  plasma: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 3.0;
    float t = (uTime + 25.0) * max(uSpeed, 0.05) * 0.7;
    float waves = max(uWaves, 0.2);
    float focus = max(uFocus, 0.2);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    vec2 v = p * (1.2 * waves);
    float v1 = sin(v.x * 2.5 + t);
    float v2 = sin(v.y * 2.5 - t * 0.9);
    float v3 = sin((v.x + v.y) * 2.0 + t * 1.2);
    float dist = length(v + vec2(sin(t * 0.5), cos(t * 0.4)));
    float v4 = sin(dist * (3.0 * focus) - t * 1.5);

    float plasmaVal = (v1 + v2 + v3 + v4) * 0.25;

    vec3 col1 = mix(uBase, uColor1, clamp(plasmaVal + 0.5, 0.0, 1.0));
    vec3 col2 = mix(uColor2, uColor3, clamp(sin(plasmaVal * 3.14159 + t * 0.5) * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = mix(col1, col2, smoothstep(-0.3, 0.5, plasmaVal));

    float filament = pow(1.0 - abs(plasmaVal), 4.0) * 0.7 * shine;
    col += uColor3 * filament;
    col *= (0.7 + 0.5 * glow);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  dither: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  float getBayer4x4(vec2 p) {
    vec2 ij = mod(floor(p), 4.0);
    int x = int(ij.x);
    int y = int(ij.y);
    float m[16];
    m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
    m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
    m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
    m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
    return m[y * 4 + x] / 16.0;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
    float t = (uTime + 8.0) * max(uSpeed, 0.05) * 0.4;
    float waves = max(uWaves, 0.2);
    float focus = max(uFocus, 0.2);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    float angle = 0.785;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 q = rot * p * waves;

    float gradient = q.x * 0.4 + q.y * 0.3 + sin(q.x * 2.0 + t) * 0.15;
    gradient = clamp(gradient * 0.5 + 0.5, 0.0, 1.0);

    float pixelSize = max(2.0, 5.0 * (1.0 / focus));
    float bayer = getBayer4x4(gl_FragCoord.xy / pixelSize);

    float ditherVal = gradient + (bayer - 0.5) * (0.6 * shine);
    ditherVal = clamp(ditherVal, 0.0, 1.0);

    vec3 col;
    if (ditherVal < 0.33) {
      col = mix(uBase, uColor1, ditherVal / 0.33);
    } else if (ditherVal < 0.66) {
      col = mix(uColor1, uColor2, (ditherVal - 0.33) / 0.33);
    } else {
      col = mix(uColor2, uColor3, (ditherVal - 0.66) / 0.34);
    }
    col *= (0.75 + 0.4 * glow);

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  threads: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.5;
    float t = (uTime + 35.0) * max(uSpeed, 0.05) * 0.6;
    float waves = max(uWaves, 0.2);
    float focus = max(uFocus, 0.2);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    vec3 col = uBase;
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float phase = fi * 0.7 + t * 0.5;
      float freq = (1.2 + fi * 0.2) * waves;
      float amp = (0.28 + 0.08 * sin(fi * 1.5 + t * 0.3)) * focus;
      float y = sin(p.x * freq + phase) * amp + (fi - 4.0) * 0.09;

      float d = abs(p.y - y);
      float beam = 1.0 / (d * 85.0 + 1.0);
      beam = pow(beam, 1.8) * glow;

      vec3 strandColor = mix(uColor1, uColor2, fi / 8.0);
      strandColor = mix(strandColor, uColor3, 0.5 + 0.5 * sin(p.x * 2.0 + t));
      col += strandColor * beam * (0.35 + 0.3 * shine);
    }

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,

  chromaticWaves: `precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uResolution;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uBase;
  uniform float uWaves;
  uniform float uFocus;
  uniform float uGlow;
  uniform float uShine;
  varying vec2 vUv;

  float wavePass(vec2 p, float t, float freq) {
    float w = sin(p.x * freq + t) * cos(p.y * freq * 0.8 - t * 0.7);
    w += 0.5 * sin((p.x + p.y) * freq * 1.4 + t * 1.2);
    return w;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 3.0;
    float t = (uTime + 40.0) * max(uSpeed, 0.05) * 0.75;
    float waves = max(uWaves, 0.2);
    float focus = max(uFocus, 0.1);
    float glow = max(uGlow, 0.1);
    float shine = max(uShine, 0.1);

    float freq = 1.6 * waves;
    float disp = 0.045 * focus;

    float rWave = wavePass(p + vec2(disp, 0.0), t, freq);
    float gWave = wavePass(p, t + 0.1, freq);
    float bWave = wavePass(p - vec2(disp, 0.0), t + 0.2, freq);

    vec3 colR = mix(uColor1, uColor2, clamp(rWave * 0.5 + 0.5, 0.0, 1.0));
    vec3 colG = mix(uColor2, uColor3, clamp(gWave * 0.5 + 0.5, 0.0, 1.0));
    vec3 colB = mix(uColor3, uColor1, clamp(bWave * 0.5 + 0.5, 0.0, 1.0));

    vec3 col = vec3(colR.r, colG.g, colB.b);
    col *= (0.7 + 0.5 * glow);
    float crest = pow(clamp(gWave * 0.5 + 0.5, 0.0, 1.0), 4.0) * shine;
    col += uColor3 * crest * 0.6;

    col = pow(max(col, vec3(0.0)), vec3(2.2));
    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
};

export const IMAGE_VERTEX_SHADER = "varying vec2 vUv;\n  void main() {\n    vUv = uv;\n    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  }";

export const IMAGE_FRAGMENT_SHADER = `precision highp float;

  uniform sampler2D uMap;
  uniform float uHasTexture;
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  uniform vec3 uColor;
  uniform float uDim;
  uniform float uBlur;

  varying vec2 vUv;

  void main() {
    if (uHasTexture < 0.5) {
      gl_FragColor = vec4(uColor, 1.0);
      return;
    }

    vec2 uv = uOffset + vUv * uRepeat;

    // Contain fit letterboxes: outside the image rect the backdrop
    // color shows through.
    float inside =
      step(0.0, uv.x) * step(uv.x, 1.0) *
      step(0.0, uv.y) * step(uv.y, 1.0);

    vec4 tex;
    if (uBlur > 0.001) {
      float spread = uBlur * 0.035;
      tex = texture2D(uMap, uv) * 0.22;
      tex += texture2D(uMap, uv + vec2( 0.94, -0.40) * spread) * 0.13;
      tex += texture2D(uMap, uv + vec2(-0.94,  0.46) * spread) * 0.13;
      tex += texture2D(uMap, uv + vec2(-0.09,  0.93) * spread) * 0.13;
      tex += texture2D(uMap, uv + vec2( 0.34, -0.79) * spread) * 0.13;
      tex += texture2D(uMap, uv + vec2( 0.55,  0.55) * spread * 1.5) * 0.065;
      tex += texture2D(uMap, uv + vec2(-0.55, -0.55) * spread * 1.5) * 0.065;
      tex += texture2D(uMap, uv + vec2(-0.55,  0.55) * spread * 1.5) * 0.065;
      tex += texture2D(uMap, uv + vec2( 0.55, -0.55) * spread * 1.5) * 0.065;
    } else {
      tex = texture2D(uMap, uv);
    }

    // The texture is tagged sRGB, so sampling already yields linear
    // values (hardware decode): no manual decode here, mirroring the
    // video-layer rule that a second decode darkens the image.
    vec3 col = mix(uColor, tex.rgb, tex.a * inside);
    col *= 1.0 - clamp(uDim, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

