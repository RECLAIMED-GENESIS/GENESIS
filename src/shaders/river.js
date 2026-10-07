// =============================================================
// REALISTIC MOVING SEA
// Used by Level2.createRiver()
//
// Uniforms:
//   uTime        - seconds, advanced every frame in Level2.update()
//   uSeaTexture  - sea.jpg (MirroredRepeatWrapping)
//   uTileSize    - world size (x, z) of one texture tile
//   uShoreDistance - R = distance to nearest rock (0..uShoreMax m)
//   uShoreBounds - x0, z0, width, depth covered by uShoreDistance
//   uShoreMax    - metres that R = 1.0 stands for
//   + three.js fog uniforms (material.fog = true)
// =============================================================


// =============================================================
// SHARED WAVE FUNCTIONS
// =============================================================

const waveFunctions = `

// One travelling wave. Uses exp(sin) so crests are sharp and
// troughs are wide and flat, like real sea swell.
//   dir        - direction of travel (normalized)
//   wavelength - metres between crests
//   amplitude  - height in metres
// Returns height in .x and its x/z slope in .yz
vec3 wave(
    vec2 p,
    vec2 dir,
    float wavelength,
    float amplitude,
    float time
) {

    float k = 6.28318 / wavelength;

    // Deep water dispersion: longer waves travel faster
    float speed = sqrt(9.8 * k);

    float theta = k * dot(dir, p) - speed * time;

    float e = exp(sin(theta) - 1.0);

    float height = amplitude * (e - 0.4);

    float slope = amplitude * e * cos(theta) * k;

    return vec3(
        height,
        slope * dir.x,
        slope * dir.y
    );
}

// Sum of all waves. Total amplitude = 0.655
vec3 seaWaves(vec2 p, float time) {

    vec3 w = vec3(0.0);

    // Long swell
    w += wave(p, normalize(vec2(-1.0,  0.35)), 38.0, 0.300, time);
    w += wave(p, normalize(vec2(-0.6, -1.0 )), 22.0, 0.180, time);

    // Medium waves
    w += wave(p, normalize(vec2(-0.3,  1.0 )), 13.0, 0.100, time);
    w += wave(p, normalize(vec2( 1.0,  0.8 )),  7.5, 0.050, time);

    // Chop
    w += wave(p, normalize(vec2(-0.8, -0.5 )),  4.2, 0.025, time);

    return w;
}

const float TOTAL_AMPLITUDE = 0.655;
`;


// =============================================================
// VERTEX SHADER
// =============================================================

export const riverVertexShader = `

uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vWaveHeight;

#include <fog_pars_vertex>

${waveFunctions}

void main() {

    vUv = uv;

    // ---------------------------------------------------------
    // WAVES ARE BUILT IN WORLD SPACE
    // so neighbouring tiles / rotations always line up
    // ---------------------------------------------------------

    vec4 worldPosition =
        modelMatrix *
        vec4(position, 1.0);

    vec3 w =
        seaWaves(
            worldPosition.xz,
            uTime
        );

    worldPosition.y += w.x;

    // -1 = deepest trough, 1 = highest crest
    vWaveHeight =
        w.x / (TOTAL_AMPLITUDE * 0.6);

    // Normal from the wave slopes
    vNormal =
        normalize(
            vec3(
                -w.y,
                1.0,
                -w.z
            )
        );

    vWorldPosition =
        worldPosition.xyz;

    vec4 mvPosition =
        viewMatrix *
        worldPosition;

    gl_Position =
        projectionMatrix *
        mvPosition;

    #include <fog_vertex>
}
`;


// =============================================================
// FRAGMENT SHADER
// =============================================================

export const riverFragmentShader = `

uniform float uTime;
uniform sampler2D uSeaTexture;
uniform vec2 uTileSize;
uniform sampler2D uShoreDistance;
uniform vec4 uShoreBounds;
uniform float uShoreMax;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vWaveHeight;

#include <fog_pars_fragment>


// =============================================================
// HASH / NOISE (for shimmer and foam breakup)
// =============================================================

float hash(vec2 p) {

    return fract(
        sin(
            dot(
                p,
                vec2(127.1, 311.7)
            )
        ) *
        43758.5453123
    );
}

float noise(vec2 p) {

    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
    );
}


void main() {

    vec2 p = vWorldPosition.xz;

    // ---------------------------------------------------------
    // SMALL RIPPLES ON TOP OF THE VERTEX WAVES
    // (too small for vertices, so done per pixel)
    // ---------------------------------------------------------

    vec3 normal = normalize(vNormal);

    normal.x +=
        0.06 * sin(p.x * 2.1 + p.y * 0.7 + uTime * 2.3) +
        0.04 * sin(p.x * 3.7 - p.y * 1.9 - uTime * 3.1);

    normal.z +=
        0.06 * sin(p.y * 2.4 - p.x * 0.9 + uTime * 2.0) +
        0.04 * sin(p.y * 4.1 + p.x * 1.3 - uTime * 2.7);

    normal = normalize(normal);


    // =========================================================
    // BASE TEXTURE - TWO LAYERS FLOWING IN DIFFERENT DIRECTIONS
    // =========================================================

    // Distort the lookup by the surface slope so the texture
    // bends over the waves instead of sliding flat under them
    vec2 distortion = normal.xz * 0.04;

    vec2 uv1 =
        p / uTileSize +
        vec2(uTime * 0.010, -uTime * 0.018) +
        distortion;

    vec2 uv2 =
        p.yx / (uTileSize.yx * 1.7) +
        vec2(-uTime * 0.014, uTime * 0.006) -
        distortion;

    vec3 tex =
        mix(
            texture2D(uSeaTexture, uv1).rgb,
            texture2D(uSeaTexture, uv2).rgb,
            0.45
        );


    // =========================================================
    // DEPTH - TROUGHS DARKER, CRESTS LIGHTER
    // =========================================================

    vec3 deepWater = vec3(0.004, 0.018, 0.040);
    vec3 surfaceTint = vec3(0.020, 0.110, 0.160);

    float crest =
        smoothstep(
            -1.0,
            1.0,
            vWaveHeight
        );

    vec3 waterColor =
        mix(
            tex * 0.45 + deepWater,
            tex * 1.05 + surfaceTint,
            crest
        );


    // =========================================================
    // LIGHTING - MOONLIGHT
    // =========================================================

    vec3 lightDir = normalize(vec3(-0.35, 0.55, -0.75));
    vec3 moonColor = vec3(0.75, 0.82, 1.0);

    vec3 viewDir =
        normalize(
            cameraPosition -
            vWorldPosition
        );

    float diffuse =
        max(dot(normal, lightDir), 0.0);

    waterColor *= 0.55 + 0.45 * diffuse;


    // ---------------------------------------------------------
    // SPECULAR HIGHLIGHT
    // ---------------------------------------------------------

    vec3 halfDir =
        normalize(lightDir + viewDir);

    float spec =
        pow(
            max(dot(normal, halfDir), 0.0),
            180.0
        );

    waterColor += moonColor * spec * 0.9;


    // ---------------------------------------------------------
    // SHIMMER - small twinkling glints that move with the water
    // ---------------------------------------------------------

    float glintMask =
        smoothstep(
            0.78,
            0.97,
            noise(p * 2.5 + vec2(uTime * 1.3, -uTime * 0.9))
        );

    float glint =
        pow(
            max(dot(normal, halfDir), 0.0),
            24.0
        );

    waterColor += moonColor * glint * glintMask * 0.35;


    // =========================================================
    // WAVE TOPS - LIGHTER, WITH A LITTLE BROKEN-UP FOAM
    // =========================================================

    float foam =
        smoothstep(0.55, 0.95, vWaveHeight) *
        smoothstep(0.45, 0.75, noise(p * 1.6 + uTime * 0.4));

    waterColor =
        mix(
            waterColor,
            vec3(0.55, 0.65, 0.72),
            foam * 0.35
        );


    // =========================================================
    // FRESNEL - REFLECT THE NIGHT SKY AT LOW ANGLES
    // =========================================================

    float fresnel =
        0.02 +
        0.98 *
        pow(
            1.0 - max(dot(normal, viewDir), 0.0),
            5.0
        );

    vec3 skyReflection = vec3(0.045, 0.030, 0.110);

    waterColor =
        mix(
            waterColor,
            skyReflection,
            fresnel * 0.6
        );


    // =========================================================
    // SURF - WHITE FOAM WHERE THE WAVES HIT THE ROCKS
    // =========================================================

    // Distance to the nearest rock in metres
    vec2 shoreUV =
        (p - uShoreBounds.xy) / uShoreBounds.zw;

    float shoreDistance = uShoreMax;

    if (
        shoreUV.x >= 0.0 && shoreUV.x <= 1.0 &&
        shoreUV.y >= 0.0 && shoreUV.y <= 1.0
    ) {
        shoreDistance =
            texture2D(uShoreDistance, shoreUV).r * uShoreMax;
    }

    // Foam breakup pattern, drifting with the water
    float foamNoise =
        noise(p * 1.7 + vec2(uTime * 0.5, -uTime * 0.35)) * 0.6 +
        noise(p * 4.3 - vec2(uTime * 0.8, uTime * 0.6)) * 0.4;

    // Always some churned water right against the rock
    float contact =
        1.0 - smoothstep(0.0, 1.4, shoreDistance);

    // Bands of surf rolling in towards the rocks
    float rolling =
        sin(shoreDistance * 1.9 + uTime * 2.2 + foamNoise * 2.0);

    rolling = smoothstep(0.35, 0.95, rolling);

    // Sets of bigger surges arriving along the coast
    float surge =
        0.55 +
        0.45 * sin(uTime * 0.7 + p.y * 0.045 + foamNoise);

    // Surf is strongest when a wave crest arrives
    float crestBoost =
        0.7 + 0.6 * smoothstep(-0.5, 1.0, vWaveHeight);

    float nearShore =
        1.0 - smoothstep(0.5, 4.5, shoreDistance);

    float surf =
        contact * 0.85 +
        nearShore * rolling * surge * crestBoost;

    // Break the foam up into lacy patches
    surf *=
        smoothstep(0.3, 0.65, foamNoise + contact * 0.35);

    surf = clamp(surf, 0.0, 1.0);

    vec3 foamColor = vec3(0.78, 0.84, 0.90);

    waterColor =
        mix(
            waterColor,
            foamColor,
            surf * 0.9
        );


    // =========================================================
    // FINAL COLOR
    // =========================================================

    gl_FragColor =
        vec4(
            waterColor,
            1.0
        );

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;
