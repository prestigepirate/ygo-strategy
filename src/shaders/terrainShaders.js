// ── Pro-grade terrain surface shaders ──────────────────────
// Each terrain type: vertex shader + fragment shader pair
// Uses FBM noise, domain warping, and proper diffuse+specular lighting

// ── Shared GLSL utilities (prepended to every fragment shader) ──
const GLSL_UTILS = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbientColor;
  uniform vec3 uCameraPos;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec2 vUv;

  // Hash for pseudo-random values
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Smooth 2D value noise
  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal Brownian Motion — natural multi-scale detail
  float fbm(vec2 p, int octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    float maxVal = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amplitude * noise2D(p * frequency);
      maxVal += amplitude;
      frequency *= lacunarity;
      amplitude *= gain;
    }
    return value / maxVal;
  }

  // Domain warp — distorts noise input for organic shapes
  float domainWarp(vec2 p, float strength) {
    vec2 q = vec2(
      noise2D(p + vec2(0.0, 0.0)),
      noise2D(p + vec2(5.2, 1.3))
    );
    vec2 r = vec2(
      noise2D(p + strength * q + vec2(1.7, 9.2)),
      noise2D(p + strength * q + vec2(8.3, 2.8))
    );
    return noise2D(p + strength * r);
  }

  // Simple diffuse + specular lighting
  vec3 applyLighting(vec3 albedo, vec3 normal, float specularStrength, float shininess) {
    vec3 N = normalize(normal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCameraPos - vPos);
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, shininess) * specularStrength;

    vec3 diffuse = albedo * uLightColor * NdotL;
    vec3 ambient = albedo * uAmbientColor * 1.6;
    vec3 specular = uLightColor * spec;

    return ambient + diffuse + specular;
  }

  // Perturb normal based on height field
  vec3 perturbNormal(vec2 p, float height, float strength) {
    float eps = 0.02;
    float dx = fbm(p + vec2(eps, 0.0), 5, 2.0, 0.5) - fbm(p - vec2(eps, 0.0), 5, 2.0, 0.5);
    float dy = fbm(p + vec2(0.0, eps), 5, 2.0, 0.5) - fbm(p - vec2(0.0, eps), 5, 2.0, 0.5);
    return normalize(vNormal + vec3(-dx * strength, -dy * strength, 0.0));
  }
`;

// ── Shared vertex shader ───────────────────────────────────
const SHARED_VERTEX = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════
// 1. VOLCANIC — Dark basalt with glowing fissures
// ═══════════════════════════════════════════════════════════
const VOLCANIC_FRAGMENT = /* glsl */ `
  void main() {
    vec2 uv = vPos.xz * 1.8;

    // Multi-scale fractured rock surface
    float n1 = fbm(uv, 4, 2.3, 0.55);
    float n2 = fbm(uv + 3.7, 3, 2.8, 0.5);
    float warp = domainWarp(uv * 1.5, 0.6);

    // Ridge lines for basalt columns
    float ridges = abs(fbm(uv * 2.0, 3, 2.5, 0.5) - 0.5) * 2.0;
    ridges = pow(1.0 - ridges, 3.0);

    // Glow fissures — hot magma peeking through cracks
    float fissureMask = smoothstep(0.55, 0.72, warp);
    float fissureGlow = fissureMask * (0.6 + 0.4 * sin(uv.x * 4.0 + uTime * 0.3) * cos(uv.y * 5.0 + uTime * 0.4));
    float pulse = 1.0 + 0.15 * sin(uTime * 1.3 + uv.x * 3.0) * cos(uTime * 0.9 + uv.y * 2.7);

    // Cooled basalt — dark grey with subtle brown
    vec3 basaltDark  = vec3(0.06, 0.05, 0.06);
    vec3 basaltMid   = vec3(0.12, 0.10, 0.11);
    vec3 basaltLight = vec3(0.18, 0.15, 0.16);

    float rockHeight = n1 * 0.8 + ridges * 0.2;
    vec3 rockColor = mix(basaltDark, basaltLight, rockHeight);
    rockColor = mix(rockColor, basaltMid, n2 * 0.5);

    // Glow colors — deep orange to bright yellow at fissure centers
    vec3 glowDeep  = vec3(0.6, 0.12, 0.02);
    vec3 glowBright = vec3(1.0, 0.35, 0.05);

    float glowIntensity = fissureGlow * pulse;
    vec3 glowColor = mix(glowDeep, glowBright, glowIntensity);

    // Mix rock and glow
    vec3 albedo = mix(rockColor, glowColor, glowIntensity * 0.65);

    // Emissive glow from fissures
    float emissive = glowIntensity * 0.5;

    // Perturb normal from surface detail
    vec3 N = perturbNormal(uv, rockHeight, 0.4);
    vec3 lit = applyLighting(albedo, N, 0.15, 16.0);
    lit += glowColor * emissive * 0.4;

    // Subtle heat haze near fissures
    float haze = fissureMask * 0.08 * sin(uTime * 2.0 + uv.x * 6.0);

    gl_FragColor = vec4(lit + haze, 0.96);
  }
`;

// ═══════════════════════════════════════════════════════════
// 2. WATER — Deep dark water with caustics and fresnel
// ═══════════════════════════════════════════════════════════
const WATER_FRAGMENT = /* glsl */ `
  void main() {
    vec2 uv = vPos.xz * 2.0;

    // Multi-layer wave height field
    float swell1 = fbm(uv + uTime * 0.08, 4, 2.0, 0.55);
    float swell2 = fbm(uv * 1.7 - uTime * 0.12, 3, 2.4, 0.5);
    float detail = fbm(uv * 3.0 + uTime * 0.05, 4, 2.6, 0.45);

    // Cross-hatch wave pattern
    float wavesX = sin(uv.x * 5.0 + swell1 * 3.0 + uTime * 0.3) * cos(uv.y * 3.5 + uTime * 0.25);
    float wavesZ = cos(uv.y * 5.5 + swell2 * 2.5 + uTime * 0.35) * sin(uv.x * 3.2 + uTime * 0.28);
    float wavePattern = wavesX * wavesZ * 0.4;

    float height = swell1 * 0.7 + swell2 * 0.2 + detail * 0.1 + wavePattern;

    // Dark water color palette
    vec3 deepWater   = vec3(0.01, 0.04, 0.10);
    vec3 midWater    = vec3(0.02, 0.08, 0.18);
    vec3 surfaceWater = vec3(0.04, 0.14, 0.28);

    float h = height * 0.5 + 0.5;
    vec3 waterColor = mix(deepWater, surfaceWater, h);
    waterColor = mix(waterColor, midWater, detail * 0.4);

    // Caustic light patterns
    float caustic1 = fbm(uv * 4.0 + uTime * 0.15, 3, 2.2, 0.55);
    float caustic2 = fbm(uv * 5.5 - uTime * 0.2, 3, 2.0, 0.5);
    float caustics = pow(caustic1 * caustic2, 2.0) * 0.25;
    waterColor += vec3(0.08, 0.18, 0.35) * caustics;

    // Specular from wave crests
    float specMask = smoothstep(0.55, 0.75, h);
    float specStrength = specMask * 0.6;

    // Fresnel — edges catch more light (use perturbed normal for wave detail)
    vec3 N = perturbNormal(uv, height, 0.5);
    vec3 V = normalize(uCameraPos - vPos);
    float fresnel = pow(1.0 - abs(dot(N, V)), 3.0);
    vec3 fresnelColor = vec3(0.15, 0.3, 0.55) * fresnel * 0.5;

    vec3 lit = applyLighting(waterColor, N, specStrength, 64.0);

    gl_FragColor = vec4(lit + fresnelColor, 0.88);
  }
`;

// ═══════════════════════════════════════════════════════════
// 3. FOREST — Dark woodland floor with dappled light
// ═══════════════════════════════════════════════════════════
const FOREST_FRAGMENT = /* glsl */ `
  void main() {
    vec2 uv = vPos.xz * 2.0;

    // Ground texture layers
    float soil = fbm(uv, 5, 2.2, 0.5);
    float roots = fbm(uv * 1.5 + 2.0, 4, 2.6, 0.45);
    float moss = domainWarp(uv * 1.8, 0.5);
    float litter = fbm(uv * 3.5 - 1.5, 3, 2.3, 0.5);

    // Dark earth palette
    vec3 deepSoil  = vec3(0.04, 0.03, 0.02);
    vec3 midSoil   = vec3(0.08, 0.06, 0.03);
    vec3 lightSoil = vec3(0.13, 0.09, 0.05);
    vec3 mossGreen = vec3(0.03, 0.10, 0.03);
    vec3 leafBrown = vec3(0.09, 0.06, 0.03);

    // Build ground color
    float groundH = soil * 0.6 + roots * 0.2 + moss * 0.2;
    vec3 ground = mix(deepSoil, midSoil, groundH);
    ground = mix(ground, lightSoil, roots * 0.3);
    ground = mix(ground, mossGreen, moss * 0.35);
    ground = mix(ground, leafBrown, litter * 0.2);

    // Dappled light — like sun through canopy
    float dapple1 = fbm(uv * 3.0 - uTime * 0.05, 3, 2.4, 0.55);
    float dapple2 = fbm(uv * 5.0 + uTime * 0.07, 3, 2.2, 0.5);
    float dapple = pow(dapple1 * dapple2, 1.5);
    float lightShafts = smoothstep(0.55, 0.85, dapple) * 0.25;

    // Subtle wind through undergrowth
    float wind = sin(uv.x * 2.0 + uTime * 0.4) * cos(uv.y * 2.5 + uTime * 0.35) * 0.04;

    vec3 albedo = ground + vec3(0.06, 0.09, 0.04) * lightShafts + wind;

    // Occasional small mushroom/fungi spots
    float fungi = step(0.93, hash(floor(uv * 6.0))) * moss * 0.3;
    albedo += vec3(0.1, 0.08, 0.1) * fungi;

    vec3 N = perturbNormal(uv, soil, 0.3);
    vec3 lit = applyLighting(albedo, N, 0.05, 8.0);

    gl_FragColor = vec4(lit, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════
// 4. SWAMP — Murky bog with gas vents and algae
// ═══════════════════════════════════════════════════════════
const SWAMP_FRAGMENT = /* glsl */ `
  void main() {
    vec2 uv = vPos.xz * 2.0;

    // Murk layers
    float murk = fbm(uv, 5, 2.1, 0.5);
    float scum = domainWarp(uv * 1.6 + uTime * 0.03, 0.45);
    float algae = fbm(uv * 2.5 + uTime * 0.04, 4, 2.4, 0.45);
    float depth = fbm(uv * 0.8, 3, 2.0, 0.5);

    // Dark swamp palette
    vec3 deepMurk  = vec3(0.02, 0.02, 0.04);
    vec3 midMurk   = vec3(0.04, 0.03, 0.06);
    vec3 surfaceMurk = vec3(0.06, 0.05, 0.08);
    vec3 algaeGreen = vec3(0.04, 0.09, 0.03);
    vec3 scumYellow = vec3(0.08, 0.07, 0.02);

    float h = murk * 0.5 + scum * 0.3 + depth * 0.2;
    vec3 murkColor = mix(deepMurk, surfaceMurk, h);
    murkColor = mix(murkColor, algaeGreen, algae * 0.4);
    murkColor = mix(murkColor, scumYellow, scum * 0.25);

    // Gas vent bubbles
    float bubbles = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 bubbleCenter = vec2(
        sin(fi * 2.7 + uTime * 0.15) * 1.2,
        cos(fi * 3.1 + uTime * 0.18) * 1.2
      );
      float d = length(uv - bubbleCenter);
      float b = smoothstep(0.25, 0.0, d) * (0.5 + 0.5 * sin(uTime * 2.0 + fi));
      bubbles += b * 0.12;
    }
    murkColor += vec3(0.03, 0.06, 0.04) * bubbles;

    // Stagnant water specular — very subtle
    float specMask = smoothstep(0.6, 0.85, scum);

    // Swamp gas — faint greenish glow
    float gas = fbm(uv + uTime * 0.06, 3, 2.2, 0.5);
    vec3 gasGlow = vec3(0.04, 0.09, 0.02) * gas * 0.15;

    vec3 N = perturbNormal(uv, murk, 0.25);
    vec3 lit = applyLighting(murkColor, N, specMask * 0.3, 32.0);

    gl_FragColor = vec4(lit + gasGlow, 0.94);
  }
`;

// ═══════════════════════════════════════════════════════════
// 5. MOUNTAIN — Jagged rock with snow and ore veins
// ═══════════════════════════════════════════════════════════
const MOUNTAIN_FRAGMENT = /* glsl */ `
  void main() {
    vec2 uv = vPos.xz * 2.0;

    // Rock strata layers
    float base = fbm(uv, 5, 2.3, 0.5);
    float strata = fbm(uv * 0.8 + 1.0, 4, 2.0, 0.55);
    float cracks = domainWarp(uv * 2.0, 0.7);
    float grit = fbm(uv * 4.0, 4, 2.6, 0.45);

    // Sharp ridge detail
    float ridges = abs(fbm(uv * 1.8, 4, 2.4, 0.5) - 0.5) * 2.0;
    ridges = pow(ridges, 2.5);

    // Stone palette
    vec3 darkStone  = vec3(0.08, 0.08, 0.09);
    vec3 midStone   = vec3(0.15, 0.14, 0.16);
    vec3 lightStone = vec3(0.25, 0.24, 0.26);
    vec3 oreShimmer = vec3(0.18, 0.16, 0.14);

    float h = base * 0.5 + strata * 0.25 + ridges * 0.25;
    vec3 stone = mix(darkStone, lightStone, h);
    stone = mix(stone, midStone, grit * 0.4);

    // Metallic ore veins
    float vein = step(0.82, cracks) * (grit * 0.5 + 0.5);
    stone = mix(stone, oreShimmer, vein * 0.3);

    // Snow/ice patches in crevices
    float snowMask = smoothstep(0.65, 0.85, h);
    float snow = snowMask * ridges * 0.5;
    vec3 snowColor = vec3(0.35, 0.36, 0.40);
    stone = mix(stone, snowColor, snow * 0.35);

    // Wind-blown snow streaks
    float streak = sin(uv.x * 3.0 + uv.y * 1.5) * cos(uv.y * 4.0 + uTime * 0.08);
    float streakMask = smoothstep(0.7, 0.95, snowMask) * smoothstep(0.1, 0.5, abs(streak));
    stone += snowColor * streakMask * 0.08;

    vec3 N = perturbNormal(uv, h, 0.5);
    vec3 lit = applyLighting(stone, N, 0.1, 12.0);

    gl_FragColor = vec4(lit, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════
// 6. PLAINS — Wind-swept grassland with subtle grain
// ═══════════════════════════════════════════════════════════
const PLAINS_FRAGMENT = /* glsl */ `
  void main() {
    vec2 uv = vPos.xz * 2.0;

    // Grassland layers
    float fields = fbm(uv, 5, 2.0, 0.5);
    float grain = fbm(uv * 3.0 + uTime * 0.05, 4, 2.5, 0.45);
    float paths = domainWarp(uv * 1.5, 0.4);
    float patches = fbm(uv * 2.5 + 3.0, 3, 2.2, 0.5);

    // Wind through grass
    float wind = sin(uv.x * 3.5 + uTime * 0.3) * cos(uv.y * 3.0 + uTime * 0.35) * 0.5 + 0.5;
    wind = wind * fbm(uv * 2.0 + uTime * 0.1, 3, 2.0, 0.5);

    // Grassland palette — muted, golden-touched
    vec3 dryGrass   = vec3(0.12, 0.10, 0.04);
    vec3 greenGrass = vec3(0.06, 0.11, 0.04);
    vec3 soilPatch  = vec3(0.09, 0.07, 0.04);
    vec3 pathDust   = vec3(0.14, 0.11, 0.06);

    float h = fields * 0.5 + grain * 0.3 + paths * 0.2;
    vec3 grass = mix(dryGrass, greenGrass, h);
    grass = mix(grass, soilPatch, patches * 0.35);
    grass = mix(grass, pathDust, paths * 0.2);

    // Wind highlights
    grass += vec3(0.04, 0.06, 0.02) * wind * 0.15;

    // Subtle crop/field lines
    float cropLines = sin(uv.x * 8.0) * 0.3 + 0.7;
    cropLines *= sin(uv.y * 14.0 + uv.x * 3.0) * 0.3 + 0.7;
    grass += vec3(0.02, 0.04, 0.01) * cropLines * 0.06;

    vec3 N = perturbNormal(uv, fields, 0.2);
    vec3 lit = applyLighting(grass, N, 0.03, 4.0);

    gl_FragColor = vec4(lit, 1.0);
  }
`;

// ── Export map ─────────────────────────────────────────────
export const TERRAIN_SHADERS = {
  volcanic: { vertex: SHARED_VERTEX, fragment: GLSL_UTILS + VOLCANIC_FRAGMENT },
  water:    { vertex: SHARED_VERTEX, fragment: GLSL_UTILS + WATER_FRAGMENT },
  forest:   { vertex: SHARED_VERTEX, fragment: GLSL_UTILS + FOREST_FRAGMENT },
  swamp:    { vertex: SHARED_VERTEX, fragment: GLSL_UTILS + SWAMP_FRAGMENT },
  mountain: { vertex: SHARED_VERTEX, fragment: GLSL_UTILS + MOUNTAIN_FRAGMENT },
  plains:   { vertex: SHARED_VERTEX, fragment: GLSL_UTILS + PLAINS_FRAGMENT },
};

// Default uniforms for the lighting model
export function createTerrainUniforms() {
  return {
    uTime: { value: 0 },
    uLightDir: { value: [0.6, 0.8, 0.4] },
    uLightColor: { value: [1.2, 1.1, 0.95] },
    uAmbientColor: { value: [0.55, 0.50, 0.58] },
    uCameraPos: { value: [0, 5, 10] },
  };
}
