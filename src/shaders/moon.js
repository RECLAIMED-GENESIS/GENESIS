export const moonVertexShader = `
precision highp float;

varying vec3 fNormal;

void main()
{
    fNormal = normalize(normalMatrix * normal);

    gl_Position =
        projectionMatrix *
        modelViewMatrix *
        vec4(position, 1.0);
}
`;

export const moonFragmentShader = `
precision highp float;

varying vec3 fNormal;

float hash(vec3 p)
{
    return fract(
        sin(dot(p, vec3(127.1, 311.7, 74.7)))
        * 43758.5453
    );
}

float noise(vec3 p)
{
    vec3 i = floor(p);
    vec3 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec3(1.0,0.0,0.0));
    float c = hash(i + vec3(0.0,1.0,0.0));
    float d = hash(i + vec3(1.0,1.0,0.0));

    float e = hash(i + vec3(0.0,0.0,1.0));
    float f1 = hash(i + vec3(1.0,0.0,1.0));
    float g = hash(i + vec3(0.0,1.0,1.0));
    float h = hash(i + vec3(1.0,1.0,1.0));

    float x1 = mix(a,b,f.x);
    float x2 = mix(c,d,f.x);
    float x3 = mix(e,f1,f.x);
    float x4 = mix(g,h,f.x);

    return mix(
        mix(x1,x2,f.y),
        mix(x3,x4,f.y),
        f.z
    );
}


float crater(
    vec3 p,
    vec3 center,
    float size,
    float strength
)
{
    float d = acos(
        clamp(dot(p,center),-1.0,1.0)
    );

    float distortion =
        noise(p * 18.0) * 0.10 +
        noise(p * 37.0) * 0.045;

    float radius =
        size * (1.0 + distortion);

    float x = d / radius;

    float bowl =
        1.0 -
        smoothstep(
            0.08,
            1.0,
            x
        );

    float floorShape =
        1.0 -
        smoothstep(
            0.0,
            0.34,
            x
        );

    float rimNoise =
        noise(p * 32.0);

    float rim =
        smoothstep(
            0.68 + rimNoise * 0.06,
            0.82 + rimNoise * 0.06,
            x
        )
        *
        (
            1.0 -
            smoothstep(
                0.82,
                1.08,
                x
            )
        );

    return
        bowl * strength +
        floorShape * strength * 0.18 -
        rim * strength * 0.10;
}


float craterMap(vec3 p)
{
    float h = 0.0;


    /* LARGE CRATERS */

    h -= crater(
        p,
        normalize(vec3(-0.62,0.25,0.72)),
        0.27,
        0.72
    );

    h -= crater(
        p,
        normalize(vec3(0.34,0.38,0.86)),
        0.20,
        0.65
    );

    h -= crater(
        p,
        normalize(vec3(-0.12,-0.52,0.84)),
        0.17,
        0.62
    );

    h -= crater(
        p,
        normalize(vec3(0.58,-0.25,0.77)),
        0.13,
        0.58
    );

    h -= crater(
        p,
        normalize(vec3(-0.70,-0.25,0.66)),
        0.095,
        0.52
    );

    h -= crater(
        p,
        normalize(vec3(0.05,0.67,0.74)),
        0.085,
        0.50
    );


    /* MEDIUM CRATERS */

    for(int i = 0; i < 45; i++)
    {
        float n = float(i);

        vec3 center =
            normalize(vec3(
                hash(vec3(n,11.0,2.0))*2.0-1.0,
                hash(vec3(n,17.0,5.0))*2.0-1.0,
                hash(vec3(n,23.0,8.0))*2.0-1.0
            ));

        float size =
            0.012 +
            hash(vec3(n,31.0,4.0))*0.035;

        float strength =
            0.25 +
            hash(vec3(n,42.0,7.0))*0.35;

        h -= crater(
            p,
            center,
            size,
            strength
        );
    }


    /* TINY CRATERS */

    for(int i = 0; i < 65; i++)
    {
        float n = float(i) + 100.0;

        vec3 center =
            normalize(vec3(
                hash(vec3(n,4.0,13.0))*2.0-1.0,
                hash(vec3(n,8.0,27.0))*2.0-1.0,
                hash(vec3(n,15.0,39.0))*2.0-1.0
            ));

        float size =
            0.003 +
            hash(vec3(n,19.0,5.0))*0.012;

        float strength =
            0.12 +
            hash(vec3(n,28.0,9.0))*0.20;

        h -= crater(
            p,
            center,
            size,
            strength
        );
    }

    return h;
}


void main()
{
    vec3 p =
        normalize(fNormal);


    /* ROCKY LUNAR SURFACE */

    float largeTerrain =
        noise(p * 3.5);

    float mediumTerrain =
        noise(p * 9.0);

    float smallTerrain =
        noise(p * 24.0);

    float fineTerrain =
        noise(p * 55.0);

    float terrain =
        largeTerrain * 0.45 +
        mediumTerrain * 0.28 +
        smallTerrain * 0.18 +
        fineTerrain * 0.09;


    /* DARKER LUNAR MARIA */

    float mariaNoise =
        noise(p * 2.4) * 0.65 +
        noise(p * 5.0) * 0.35;

    float maria =
        smoothstep(
            0.42,
            0.68,
            mariaNoise
        );


    vec3 brightRock =
        vec3(
            0.72,
            0.71,
            0.67
        );

    vec3 darkRock =
        vec3(
            0.40,
            0.40,
            0.38
        );

    vec3 moon =
        mix(
            brightRock,
            darkRock,
            maria * 0.55
        );

    moon *=
        0.78 +
        terrain * 0.32;


    /* CRATER HEIGHT */

    float h =
        craterMap(p);


    /* SAMPLE AROUND THE SURFACE */

    float s = 0.004;

    vec3 tangent =
        cross(
            p,
            vec3(0.0,1.0,0.0)
        );

    if(length(tangent) < 0.1)
    {
        tangent =
            cross(
                p,
                vec3(1.0,0.0,0.0)
            );
    }

    tangent =
        normalize(tangent);

    vec3 tangent2 =
        normalize(
            cross(
                p,
                tangent
            )
        );

    float h1 =
        craterMap(
            normalize(
                p + tangent * s
            )
        );

    float h2 =
        craterMap(
            normalize(
                p + tangent2 * s
            )
        );


    /* CRATER NORMAL */

    vec3 normal =
        normalize(
            p
            - tangent *
              ((h1-h)/s) *
              0.55
            - tangent2 *
              ((h2-h)/s) *
              0.55
        );


    /* MATTE MOON LIGHTING */

    vec3 lightDir =
        normalize(
            vec3(
                -0.65,
                0.35,
                1.0
            )
        );

    float diffuse =
        max(
            dot(
                normal,
                lightDir
            ),
            0.0
        );

    float lighting =
        0.48 +
        diffuse * 0.52;

    moon *=
        lighting;


    /* CRATER FLOOR */

    float craterDark =
        clamp(
            -h,
            0.0,
            0.8
        );

    moon *=
        1.0 -
        craterDark * 0.22;


    /* FINE LUNAR DUST */

    float dust =
        noise(p * 110.0);

    moon +=
        (dust - 0.5) *
        0.035;


    /* MICRO IMPACT SPECKLES */

    float speckles =
        noise(p * 180.0);

    moon +=
        smoothstep(
            0.68,
            0.92,
            speckles
        ) * 0.018;


    /* FINAL COLOR */

    moon =
        clamp(
            moon,
            vec3(0.0),
            vec3(1.0)
        );

    gl_FragColor =
        vec4(
            moon,
            1.0
        );
}
`;
