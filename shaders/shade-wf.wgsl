struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>
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
    texture: u32
}

struct Material {
    roughness: f32,
    metallic: f32,
    ri: f32,
    filler: f32
}

const EPSILON = 0.000001;
const PI = 3.14159265359;

@group(0) @binding(5) var<uniform> materials: array<Material, 2>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(2) var<storage, read_write> hitQueue: array<HitRecord>;
@group(2) @binding(3) var<storage, read_write> shadowQueue: array<Ray>;
@group(3) @binding(0) var textures16: texture_2d_array<f32>;

@compute @workgroup_size(64, 1, 1) fn shade(@builtin(global_invocation_id) id: vec3u) {
    let hitQueueHeader = &queueHeaders[1];
    if (id.x >= atomicLoad(&hitQueueHeader.count)) {
        return;
    }

    let hitRec = hitQueue[id.x];
    let lightDirection = normalize(vec3f(5, 10, -3));

    let material = materials[hitRec.material];
    let tc = vec2u(u32(hitRec.uv.x * 16.0), u32(hitRec.uv.y * 16.0));
    let albedo = pow(textureLoad(textures16, tc, hitRec.texture, 0).xyz, vec3f(2.2));
    let outDir = hitRec.dir * -1;
    let halfVector = normalize(outDir + lightDirection);
    let ndotl = max(dot(hitRec.normal, lightDirection), 0);
    let col = brdf(hitRec.normal, lightDirection, outDir, halfVector, albedo, material.roughness) * ndotl;
    let throughput = pack4x8unorm(vec4f(col, 0));
    
    if (ndotl > 0) {
        let shadowRay = Ray(hitRec.pos, hitRec.pixelIndex, lightDirection, throughput);
        let shadowQueueHeader = &queueHeaders[2];
        let index = atomicAdd(&shadowQueueHeader.count, 1u);
        shadowQueue[index] = shadowRay;
    }
    // let corrected = pow(col, vec3f(1.0 / 2.2));
    // let imgW = textureDimensions(tex).x;
    // let imgPos = vec2u(hitRec.pixelIndex % imgW, hitRec.pixelIndex / imgW);
    // textureStore(tex, imgPos, vec4f(corrected, 1));
}

fn brdf(normal: vec3f, wi: vec3f, wo: vec3f, half: vec3f, albedo: vec3f, a: f32) -> vec3f {
    let k = (a + 1) * (a + 1) / 8;
    let ndotwo = max(dot(normal, wo), 0);
    let ndotwi = max(dot(normal, wi), 0);
    let d = ndf(max(dot(normal, half), 0), a);
    let g1 = geometry(ndotwo, k);
    let g2 = geometry(ndotwi, k);
    let g = g1 * g2;
    let f = schlick(max(dot(half, wo), 0), vec3f(0.04));
    let kd = vec3f(1) - f;
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