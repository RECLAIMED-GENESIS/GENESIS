// =============================================================
// LUNAR GROUND
// Used by Level3.createMoonSurface() on the 700 x 700 ground.
//
// - moon.jpg tiled twice (two scales, rotated, mirrored repeat)
//   and blended by large-scale noise so tiles don't repeat
// - procedural maria, regolith and small craters, all based on
//   WORLD position so nothing slides when the camera turns
// - lit by the scene's own lights (the sun and the hemisphere
//   fill) with the sun's shadow map
//
// Uniforms (plus three.js light uniforms, material.lights = true):
//   uMoonTexture - moon.jpg (sRGB, MirroredRepeatWrapping)
//   uTileSizes   - world size of one tile for the two layers
// =============================================================

export const moonVertexShader = `

#include <common>
#include <shadowmap_pars_vertex>

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewPosition;

void main()
{
    vec3 transformedNormal =
        normalMatrix * normal;

    vec4 worldPosition =
        modelMatrix * vec4(position, 1.0);

    vWorldPosition =
        worldPosition.xyz;

    vWorldNormal =
        normalize(mat3(modelMatrix) * normal);

    vec4 mvPosition =
        viewMatrix * worldPosition;

    vViewPosition =
        -mvPosition.xyz;

    gl_Position =
        projectionMatrix * mvPosition;

    #include <shadowmap_vertex>
}
`;


export const moonFragmentShader = `

#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

uniform sampler2D uMoonTexture;
uniform vec2 uTileSizes;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewPosition;


// =============================================================
// NOISE (world x/z)
// =============================================================

float hash21(vec2 p)
{
    return fract(
        sin(dot(p, vec2(127.1, 311.7)))
        * 43758.5453
    );
}

vec2 hash22(vec2 p)
{
    return vec2(
        hash21(p),
        hash21(p + vec2(37.3, 91.7))
    );
}

float noise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
    );
}


// =============================================================
// SMALL CRATERS
// Same bowl / floor / rim profile as before, now laid out on a
// world-space grid: at most one crater per 7 m cell, 0.5 - 3 m
// across. The geometry already has the big craters.
// =============================================================

float craterProfile(float x, vec2 p)
{
    float rimNoise =
        noise(p * 2.1);

    float bowl =
        1.0 - smoothstep(0.08, 1.0, x);

    float floorShape =
        1.0 - smoothstep(0.0, 0.34, x);

    float rim =
        smoothstep(0.68 + rimNoise * 0.06, 0.82 + rimNoise * 0.06, x) *
        (1.0 - smoothstep(0.82, 1.08, x));

    return
        -bowl
        - floorShape * 0.18
        + rim * 0.35;
}

float craterField(vec2 p)
{
    const float CELL = 7.0;

    vec2 cell = floor(p / CELL);

    float h = 0.0;

    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            vec2 c = cell + vec2(float(x), float(y));

            vec2 r = hash22(c);

            // Only some cells get a crater
            if (hash21(c + 5.1) > 0.55) continue;

            vec2 center = (c + 0.15 + r * 0.7) * CELL;

            float radius =
                0.5 + pow(hash21(c + 9.7), 2.0) * 2.5;

            float d = length(p - center);

            // Slightly irregular outline
            d *= 1.0 + (noise(p * 1.3 + c) - 0.5) * 0.18;

            float depth = radius * 0.18;

            h += craterProfile(d / radius, p) * depth;
        }
    }

    return h;
}


float luminance3(vec3 c)
{
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}


void main()
{
    vec2 p = vWorldPosition.xz;


    // =========================================================
    // MOON.JPG - TWO LAYERS SO TILES DON'T REPEAT
    // =========================================================

    // Layer A: axis aligned
    vec2 uvA =
        p / uTileSizes.x;

    // Layer B: bigger and rotated 37 degrees
    const float ANGLE = 0.6458;

    mat2 rotation =
        mat2(cos(ANGLE), -sin(ANGLE), sin(ANGLE), cos(ANGLE));

    vec2 uvB =
        (rotation * p) / uTileSizes.y + vec2(0.37, 0.61);

    vec3 texA = texture2D(uMoonTexture, uvA).rgb;
    vec3 texB = texture2D(uMoonTexture, uvB).rgb;

    // Slow noise decides which layer shows where
    float layerMix =
        smoothstep(
            0.3,
            0.7,
            noise(p * 0.011) * 0.7 + noise(p * 0.037) * 0.3
        );

    vec3 tex =
        mix(texA, texB, layerMix);

    // The texture's crater shadows are slightly blue; keep it
    // mostly grey so it matches the lunar rock colours
    float texLum = luminance3(tex);

    tex = mix(vec3(texLum), tex, 0.25);


    // =========================================================
    // PROCEDURAL ROCK COLOUR (world based)
    // =========================================================

    float terrain =
        noise(p * 0.020) * 0.45 +
        noise(p * 0.070) * 0.28 +
        noise(p * 0.250) * 0.18 +
        noise(p * 0.900) * 0.09;

    // Darker lunar maria
    float mariaNoise =
        noise(p * 0.006) * 0.65 +
        noise(p * 0.015) * 0.35;

    float maria =
        smoothstep(0.42, 0.68, mariaNoise);

    vec3 brightRock = vec3(0.72, 0.71, 0.67);
    vec3 darkRock = vec3(0.40, 0.40, 0.38);

    vec3 rock =
        mix(brightRock, darkRock, maria * 0.55);

    rock *= 0.78 + terrain * 0.32;

    // Texture detail on top of the procedural colour.
    // Scaled so the lit ground sits in the same grey range as
    // the rest of Level 3 instead of washing out to white.
    vec3 albedo =
        rock * (0.25 + tex * 0.75);


    // =========================================================
    // SURFACE RELIEF
    // Small procedural craters + bumps from the texture
    // =========================================================

    const float E = 0.12;

    float h0 = craterField(p);
    float hx = craterField(p + vec2(E, 0.0));
    float hz = craterField(p + vec2(0.0, E));

    // Fade the small craters out with distance so they don't
    // shimmer on far ground and the distant ridge
    float detailFade =
        1.0 - smoothstep(60.0, 200.0, length(vViewPosition));

    vec2 craterSlope =
        vec2(hx - h0, hz - h0) / E * detailFade;

    // Texture bump: brightness gradient of layer A and B
    vec2 duA = vec2(1.5 / 1024.0, 0.0);

    float tA  = luminance3(texture2D(uMoonTexture, uvA).rgb);
    float tAx = luminance3(texture2D(uMoonTexture, uvA + duA.xy).rgb);
    float tAz = luminance3(texture2D(uMoonTexture, uvA + duA.yx).rgb);

    float tB  = luminance3(texture2D(uMoonTexture, uvB).rgb);
    float tBx = luminance3(texture2D(uMoonTexture, uvB + duA.xy).rgb);
    float tBz = luminance3(texture2D(uMoonTexture, uvB + duA.yx).rgb);

    vec2 slopeA =
        vec2(tAx - tA, tAz - tA) / (duA.x * uTileSizes.x);

    // Layer B's gradient is in rotated texture space; turn it
    // back into world x/z
    vec2 slopeB =
        (vec2(tBx - tB, tBz - tB) / (duA.x * uTileSizes.y)) * rotation;

    vec2 textureSlope =
        mix(slopeA, slopeB, layerMix);

    // Crater floors are a little darker
    albedo *=
        1.0 - clamp(-h0, 0.0, 0.6) * 0.25 * detailFade;

    vec3 worldNormal =
        normalize(vWorldNormal);

    worldNormal =
        normalize(
            worldNormal -
            vec3(
                craterSlope.x * 0.9 + textureSlope.x * 0.35,
                0.0,
                craterSlope.y * 0.9 + textureSlope.y * 0.35
            )
        );

    vec3 normal =
        normalize((viewMatrix * vec4(worldNormal, 0.0)).xyz);

    vec3 viewDir =
        normalize(vViewPosition);


    // =========================================================
    // LIGHTING - THE SCENE'S OWN LIGHTS
    // =========================================================

    vec3 directLight = vec3(0.0);

    #if NUM_DIR_LIGHTS > 0

        #pragma unroll_loop_start
        for (int i = 0; i < NUM_DIR_LIGHTS; i++)
        {
            float NdotL =
                max(dot(normal, directionalLights[ i ].direction), 0.0);

            float NdotV =
                max(dot(normal, viewDir), 0.001);

            // Lunar-Lambert: half Lambert, half Lommel-Seeliger,
            // which is how dusty regolith scatters sunlight
            float lommel =
                2.0 * NdotL / (NdotL + NdotV + 0.0001);

            float lunar =
                mix(NdotL, lommel, 0.5);

            directLight +=
                directionalLights[ i ].color * lunar;
        }
        #pragma unroll_loop_end

    #endif

    // Sun shadow (the only shadow-casting light)
    directLight *=
        getShadowMask();

    vec3 ambientLight = vec3(0.0);

    #if NUM_HEMI_LIGHTS > 0

        #pragma unroll_loop_start
        for (int i = 0; i < NUM_HEMI_LIGHTS; i++)
        {
            ambientLight +=
                getHemisphereLightIrradiance(hemisphereLights[ i ], normal);
        }
        #pragma unroll_loop_end

    #endif

    ambientLight +=
        ambientLightColor;

    // Same energy scale as three's standard materials
    vec3 color =
        albedo * RECIPROCAL_PI * (directLight + ambientLight);


    // =========================================================
    // FINE DUST AND MICRO SPECKLES
    // =========================================================

    float dust =
        noise(p * 3.1);

    color *=
        1.0 + (dust - 0.5) * 0.06;

    float speckles =
        noise(p * 7.3);

    color +=
        smoothstep(0.78, 0.95, speckles) * 0.012 * directLight * RECIPROCAL_PI;


    gl_FragColor =
        vec4(color, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;
