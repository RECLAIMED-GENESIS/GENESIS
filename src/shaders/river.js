// =============================================================
// REALISTIC CYBERPUNK RIVER
// =============================================================

export const riverVertexShader = `

uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {

    vUv = uv;

    vec3 pos = position;

    // ---------------------------------------------------------
    // VERY GENTLE LARGE WAVES
    // ---------------------------------------------------------

    float wave1 =
        sin(
            pos.x * 0.18 +
            uTime * 0.55
        ) * 0.018;

    float wave2 =
        sin(
            pos.y * 0.30 -
            uTime * 0.42
        ) * 0.014;

    // ---------------------------------------------------------
    // SMALL RIPPLE DETAIL
    // ---------------------------------------------------------

    float ripple1 =
        sin(
            pos.x * 1.5 +
            pos.y * 0.8 +
            uTime * 1.1
        ) * 0.006;

    float ripple2 =
        sin(
            pos.x * 2.4 -
            pos.y * 1.2 -
            uTime * 0.8
        ) * 0.004;

    // ---------------------------------------------------------
    // KEEP THE WAVES EXTREMELY SHALLOW
    // ---------------------------------------------------------

    pos.z +=
        wave1 +
        wave2 +
        ripple1 +
        ripple2;

    // ---------------------------------------------------------
    // WORLD POSITION
    // ---------------------------------------------------------

    vec4 worldPosition =
        modelMatrix *
        vec4(pos, 1.0);

    vWorldPosition =
        worldPosition.xyz;

    vNormal =
        normalize(
            normalMatrix *
            normal
        );

    gl_Position =
        projectionMatrix *
        viewMatrix *
        worldPosition;
}
`;


// =============================================================
// FRAGMENT SHADER
// =============================================================

export const riverFragmentShader = `

uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;


// =============================================================
// HASH
// =============================================================

float hash(vec2 p) {

    return fract(
        sin(
            dot(
                p,
                vec2(
                    127.1,
                    311.7
                )
            )
        ) *
        43758.5453123
    );
}


// =============================================================
// SMOOTH NOISE
// =============================================================

float noise(vec2 p) {

    vec2 i =
        floor(p);

    vec2 f =
        fract(p);

    f =
        f * f *
        (3.0 - 2.0 * f);

    float a =
        hash(i);

    float b =
        hash(
            i +
            vec2(1.0, 0.0)
        );

    float c =
        hash(
            i +
            vec2(0.0, 1.0)
        );

    float d =
        hash(
            i +
            vec2(1.0, 1.0)
        );

    return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
    );
}


// =============================================================
// FRACTAL WATER NOISE
// =============================================================

float waterNoise(vec2 p) {

    float n = 0.0;

    n += noise(p) * 0.55;

    n +=
        noise(p * 2.0)
        * 0.25;

    n +=
        noise(p * 4.0)
        * 0.12;

    n +=
        noise(p * 8.0)
        * 0.06;

    return n;
}


// =============================================================
// MAIN
// =============================================================

void main() {

    // ---------------------------------------------------------
    // WATER COORDINATES
    // ---------------------------------------------------------

    vec2 waterUV =
        vWorldPosition.xz;


    // ---------------------------------------------------------
    // SLOW FLOWING WATER
    // ---------------------------------------------------------

    vec2 flow =
        vec2(
            uTime * 0.035,
            -uTime * 0.018
        );


    // ---------------------------------------------------------
    // LARGE-SCALE WATER VARIATION
    // ---------------------------------------------------------

    float largeWater =
        waterNoise(
            waterUV * 0.045 +
            flow
        );


    // ---------------------------------------------------------
    // MEDIUM RIPPLE DETAIL
    // ---------------------------------------------------------

    float mediumWater =
        waterNoise(
            waterUV * 0.16 -
            flow * 1.5
        );


    // ---------------------------------------------------------
    // SMALL MOVING RIPPLES
    // ---------------------------------------------------------

    float smallWater =
        waterNoise(
            waterUV * 0.65 +
            flow * 3.0
        );


    // =========================================================
    // REALISTIC DARK WATER COLORS
    // =========================================================

    vec3 deepWater =
        vec3(
            0.002,
            0.008,
            0.018
        );

    vec3 darkBlue =
        vec3(
            0.003,
            0.035,
            0.065
        );

    vec3 blueWater =
        vec3(
            0.005,
            0.085,
            0.13
        );

    vec3 cyanReflection =
        vec3(
            0.0,
            0.35,
            0.55
        );


    // ---------------------------------------------------------
    // BUILD BASE WATER
    // ---------------------------------------------------------

    vec3 waterColor =
        mix(
            deepWater,
            darkBlue,
            largeWater
        );

    waterColor =
        mix(
            waterColor,
            blueWater,
            mediumWater * 0.45
        );


    // =========================================================
    // SOFT SURFACE HIGHLIGHTS
    // =========================================================

    float highlight =
        smoothstep(
            0.68,
            0.92,
            smallWater
        );


    waterColor =
        mix(
            waterColor,
            cyanReflection,
            highlight * 0.16
        );


    // =========================================================
    // LONG REALISTIC WATER STREAKS
    // =========================================================

    float streak =
        sin(
            waterUV.x * 2.8 +
            waterUV.y * 0.35 +
            uTime * 0.65
        );

    streak =
        smoothstep(
            0.82,
            0.98,
            streak
        );


    waterColor +=
        cyanReflection *
        streak *
        0.08;


    // =========================================================
    // SECONDARY SMALL STREAKS
    // =========================================================

    float streak2 =
        sin(
            waterUV.x * 7.0 -
            waterUV.y * 0.8 -
            uTime * 1.2
        );

    streak2 =
        smoothstep(
            0.86,
            0.99,
            streak2
        );


    waterColor +=
        vec3(
            0.0,
            0.10,
            0.16
        ) *
        streak2 *
        0.12;


    // =========================================================
    // FRESNEL EFFECT
    // =========================================================

    vec3 viewDirection =
        normalize(
            cameraPosition -
            vWorldPosition
        );

    float fresnel =
        1.0 -
        max(
            dot(
                normalize(vNormal),
                viewDirection
            ),
            0.0
        );

    fresnel =
        pow(
            fresnel,
            3.5
        );


    // ---------------------------------------------------------
    // EDGE REFLECTION
    // ---------------------------------------------------------

    waterColor =
        mix(
            waterColor,
            vec3(
                0.0,
                0.28,
                0.42
            ),
            fresnel * 0.30
        );


    // =========================================================
    // SUBTLE CYBERPUNK GLOW
    // =========================================================

    float neon =
        smoothstep(
            0.78,
            0.98,
            waterNoise(
                waterUV * 0.11 +
                flow
            )
        );


    waterColor +=
        vec3(
            0.0,
            0.08,
            0.13
        ) *
        neon;


    // =========================================================
    // FINAL COLOR
    // =========================================================

    gl_FragColor =
        vec4(
            waterColor,
            1.0
        );
}
`;