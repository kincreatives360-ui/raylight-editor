/** Shared by scene and layer effects, in linear RGB. */
export const COLOR_GRADE_GLSL = `
vec3 raylightGrade(vec3 color, vec4 grade, float tint) {
    color = (color * exp2(grade.x) - .5) * grade.y + .5;
    float luminance = dot(color, vec3(.2126, .7152, .0722));
    color = mix(vec3(luminance), color, grade.z);
    return color * vec3(1. + .1 * grade.w, 1. + .1 * tint, 1. - .1 * grade.w);
}
/** 4-point tone curve: shadows(s), midtones(m), highlights(h) control points lift/push. */
float raylightCurve(float v, float s, float m, float h) {
    float c1 = clamp(0.25 + s, 0.0, 1.0);
    float c2 = clamp(0.50 + m, 0.0, 1.0);
    float c3 = clamp(0.75 + h, 0.0, 1.0);
    if (v < 0.25) return mix(0.0, c1, v * 4.0);
    if (v < 0.50) return mix(c1, c2, (v - 0.25) * 4.0);
    if (v < 0.75) return mix(c2, c3, (v - 0.50) * 4.0);
    return mix(c3, 1.0, (v - 0.75) * 4.0);
}
`;

export const RANDOM_GLSL = `
float raylightRandom(vec2 cell, float seed) {
    return fract(sin(dot(cell, vec2(12.9898, 78.233)) + seed * 437.1) * 43758.5453);
}
`;
