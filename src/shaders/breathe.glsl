// breathe.glsl — Level 2 breathing environment
// TODO: Busisiwe — vertex displacement
uniform float time;
varying vec2 vUv;
void main() {
    vec2 uv = vUv + sin(time * 0.5) * 0.01;
    gl_FragColor = vec4(uv, 0.5, 1.0);
}
