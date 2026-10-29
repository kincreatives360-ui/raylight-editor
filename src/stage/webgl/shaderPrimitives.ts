/** Shared by scene and layer effects, in linear RGB. */
export const COLOR_GRADE_GLSL = `
vec3 raylightGrade(vec3 color, vec4 grade, float tint) {
    color = (color * exp2(grade.x) - .5) * grade.y + .5;
    float luminance = dot(color, vec3(.2126, .7152, .0722));
    color = mix(vec3(luminance), color, grade.z);
    return color * vec3(1. + .1 * grade.w, 1. + .1 * tint, 1. - .1 * grade.w);
}
`;

export const RANDOM_GLSL = `
float raylightRandom(vec2 cell, float seed) {
    return fract(sin(dot(cell, vec2(12.9898, 78.233)) + seed * 437.1) * 43758.5453);
}
`;
