// pixelate.glsl — Level 1 flat-world pixelation
// TODO: Busisiwe — orthographic pixelation that fades near portal
// Placeholder fragment shader
uniform sampler2D tDiffuse;
uniform float pixelSize;
varying vec2 vUv;

void main() {
    vec2 uv = floor(vUv * pixelSize) / pixelSize;
    gl_FragColor = texture2D(tDiffuse, uv);
}
