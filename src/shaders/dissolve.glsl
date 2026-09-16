// dissolve.glsl — Level 3 Architect dissolve
// TODO: Busisiwe — dissolve on damage/death
uniform sampler2D tDiffuse;
uniform float dissolveThreshold;
varying vec2 vUv;
void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    if (c.r < dissolveThreshold) discard;
    gl_FragColor = c;
}
