struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>,
    clear: u32
}

struct Ray {
    orig: vec3f,
    pixelIndex: u32,
    dir: vec3f,
    throughput: u32
}

struct HitRecord {
    pos: vec3f,
    pixelIndex: u32,
    normal: vec3f,
    t: f32,
    dir: vec3f,
    material: u32,
    uv: vec2f,
    texture: u32,
    throughput: u32
}

struct Material {
    roughness: f32,
    metallic: f32,
    ri: f32,
    filler: f32
}

struct SceneData {
    lightDirection: vec3f
}

const EPSILON = 0.000001;
const PI = 3.14159265359;

@group(0) @binding(5) var<uniform> materials: array<Material, 3>;
@group(0) @binding(6) var<uniform> scene: SceneData;
@group(1) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(1) var<storage, read_write> rayQueue: array<Ray>;
@group(2) @binding(2) var<storage, read_write> hitQueue: array<HitRecord>;
@group(2) @binding(3) var<storage, read_write> shadowQueue: array<Ray>;
@group(3) @binding(0) var textures16: texture_2d_array<f32>;

@compute @workgroup_size(64, 1, 1) fn shade(@builtin(global_invocation_id) id: vec3u) {
    let hitQueueHeader = &queueHeaders[1];
    if (id.x >= atomicLoad(&hitQueueHeader.count)) {
        return;
    }

    let hitRec = hitQueue[id.x];
    let lightDirection = scene.lightDirection;

    let rtput = pow(unpack4x8unorm(hitRec.throughput).xyz, vec3f(2.2));
    let material = materials[hitRec.material];
    let inDir = select(lightDirection, reflect(hitRec.dir, hitRec.normal), material.metallic > 0);
    let tc = vec2u(u32(hitRec.uv.x * 16.0), u32(hitRec.uv.y * 16.0));
    let albedo = pow(textureLoad(textures16, tc, hitRec.texture, 0).xyz, vec3f(2.2));
    let outDir = hitRec.dir * -1;
    let halfVector = normalize(outDir + inDir);
    let ndotl = max(dot(hitRec.normal, inDir), 0);
    let ambient = albedo * 0.03 * rtput;
    let col = brdf(hitRec.normal, inDir, outDir, halfVector, albedo, material.roughness, material.metallic) * ndotl * rtput + ambient;
    let throughput = pack4x8unorm(vec4f(pow(col, vec3f(1.0 / 2.2)), 0));
    if (material.metallic > 0) {
        let reflectRay = Ray(hitRec.pos, hitRec.pixelIndex, reflect(hitRec.dir, hitRec.normal), throughput);
        let rayQueueHeader = &queueHeaders[0];
        let index = atomicAdd(&rayQueueHeader.count, 1u);
        rayQueue[index] = reflectRay;
    } else if (ndotl > 0) {
        let shadowRay = Ray(hitRec.pos, hitRec.pixelIndex, lightDirection, throughput);
        let shadowQueueHeader = &queueHeaders[2];
        let index = atomicAdd(&shadowQueueHeader.count, 1u);
        shadowQueue[index] = shadowRay;
    } else {
        let imgW = textureDimensions(outputTexture).x;
        let imgPos = vec2u(hitRec.pixelIndex % imgW, hitRec.pixelIndex / imgW);
        textureStore(outputTexture, imgPos, vec4f(pow(ambient, vec3f(1.0 / 2.2)), 1));
    }
}

fn brdf(normal: vec3f, wi: vec3f, wo: vec3f, half: vec3f, albedo: vec3f, a: f32, metallic: f32) -> vec3f {
    let k = (a + 1) * (a + 1) / 8;
    let ndotwo = max(dot(normal, wo), 0);
    let ndotwi = max(dot(normal, wi), 0);
    let d = ndf(max(dot(normal, half), 0), a);
    let g1 = geometry(ndotwo, k);
    let g2 = geometry(ndotwi, k);
    let g = g1 * g2;
    let f = schlick(max(dot(half, wo), 0), mix(vec3f(0.04), albedo, metallic));
    let kd = (vec3f(1) - f) * 1 - metallic;
    let numerator = d * g * f;
    let denom = 4 * ndotwo * ndotwi + EPSILON;
    let specular = numerator / denom;
    let diffuse = kd * albedo / PI;
    return diffuse + specular;
}

fn ndf(ndoth: f32, a: f32) -> f32 {
    let a2 = a * a;
    let nh2 = ndoth * ndoth;
    let d = nh2 * (a2 - 1) + 1;
    let denom = PI * d * d;
    return a2 / denom;
}

fn geometry(ndotv: f32, k: f32) -> f32 {
    let denom = ndotv * (1 - k) + k;
    return ndotv / denom;
}

fn schlick(hdotv: f32, f0: vec3f) -> vec3f {
    let s = pow(1 - hdotv, 5);
    return f0 + (vec3f(1.0) - f0) * s;
} 