import * as THREE from 'three'

const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
        vUv = uv;

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;

        vNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`

const fragmentShader = `
    uniform float time;
    uniform vec3 baseColor;
    uniform vec3 darkColor;
    uniform vec3 lightColor;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    // Simple procedural noise
    float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);

        f = f * f * (3.0 - 2.0 * f);

        float n000 = hash(i + vec3(0,0,0));
        float n100 = hash(i + vec3(1,0,0));
        float n010 = hash(i + vec3(0,1,0));
        float n110 = hash(i + vec3(1,1,0));
        float n001 = hash(i + vec3(0,0,1));
        float n101 = hash(i + vec3(1,0,1));
        float n011 = hash(i + vec3(0,1,1));
        float n111 = hash(i + vec3(1,1,1));

        float x00 = mix(n000, n100, f.x);
        float x10 = mix(n010, n110, f.x);
        float x01 = mix(n001, n101, f.x);
        float x11 = mix(n011, n111, f.x);

        float y0 = mix(x00, x10, f.y);
        float y1 = mix(x01, x11, f.y);

        return mix(y0, y1, f.z);
    }

    void main() {

        // Rock texture
        float rockNoise = noise(vWorldPosition * 0.45);
        float fineNoise = noise(vWorldPosition * 1.5);

        float texture = rockNoise * 0.7 + fineNoise * 0.3;

        vec3 rockColor = mix(
            darkColor,
            baseColor,
            texture
        );

        // Fake directional lighting
        vec3 lightDirection = normalize(vec3(-0.4, 1.0, 0.3));

        float lighting = max(
            dot(normalize(vNormal), lightDirection),
            0.0
        );

        lighting = 0.35 + lighting * 0.65;

        rockColor *= lighting;

        // Warm underground glow
        float lanternGlow =
            0.5 +
            0.5 * sin(time * 3.0 + vWorldPosition.x * 0.15);

        rockColor += lightColor * lanternGlow * 0.035;

        gl_FragColor = vec4(rockColor, 1.0);
    }
`

function createMineShader({
    baseColor = 0x4a4038,
    darkColor = 0x211d1a,
    lightColor = 0xffa34d
} = {}) {

    return new THREE.ShaderMaterial({
        uniforms: {
            time: {
                value: 0
            },

            baseColor: {
                value: new THREE.Color(baseColor)
            },

            darkColor: {
                value: new THREE.Color(darkColor)
            },

            lightColor: {
                value: new THREE.Color(lightColor)
            }
        },

        vertexShader,
        fragmentShader
    })
}

export default createMineShader