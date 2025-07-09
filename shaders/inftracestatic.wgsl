struct cameraData {
    pos: vec3f,
    raysPerPixel: u32,
    topLeftPixel: vec3f,
    bounceCount: u32,
    pixelDeltaU: vec3f,
    antiAliasing: u32,
    pixelDeltaV: vec3f,
    randomSeed: u32,
    backgroundColor: vec3f,
    frameCount: u32,
    defocusU: vec3f,
    defocusV: vec3f
};

const PI = 3.14159265359;

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
@group(1) @binding(1) var prevTex: texture_storage_2d<rgba8unorm, read>;

@compute @workgroup_size(8, 8, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(tex).x || id.y > textureDimensions(tex).y) {
        return;
    }

    var rngState = ((id.x * 2167) ^ (id.y * 31802381)) + (camera.randomSeed * camera.frameCount * 1401);

    let tMin = 0.00001;
    let tMax = 2500.0;
    let center = vec3f(0.5, 0.5, 0.5);
    let xRand = randomF(&rngState) - 0.5;
    let yRand = randomF(&rngState) - 0.5;            
    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * (f32(id.x) - xRand) + camera.pixelDeltaV * (f32(id.y) - yRand);
    let sky = vec3f(0.01, 0.02, 0.06);

    var dir = normalize(pCenter - camera.pos);
    var col = vec3f(1, 1, 1);
    
    var hitLight = false;
    var orig = vec3f(0, 0, 0);
    var gridPos = vec3i(0, 7, 0);
    for (var i: u32 = 0; i < 128; i++) {
        var state = wangHash(u32(gridPos.x), u32(gridPos.y), u32(gridPos.z));
        if(randomF(&state) < 0.7) {
            let radius = randomF(&state) * 0.35 + 0.1;
            let root = hitSphere(center, radius, orig, dir, tMin, tMax);
            if (root < tMax && root > tMin) {
                let point = dir * root + orig;
                let normal = (point - center) / radius;
                let material = randomF(&state);
                if (material < 0.015) {
                    hitLight = true;
                    col *= 4;
                    break;
                } else if (material < 0.1) {
                    orig = point;
                    dir = reflect(dir, normal);
                    col *= vec3f(randomF(&state));
                } else {
                    orig = point;
                    dir = normalize(normal + randomDir(&rngState));
                    col *= vec3f(randomF(&state), randomF(&state), randomF(&state));
                }
            }
        }
        orig = nextStep(orig, dir, &gridPos);
    }

    if (!hitLight) {
        col *= sky;
    }
    
    col = pow(col, vec3f(0.454545));
    let prevColor = textureLoad(prevTex, id.xy);
    let cFactor = 1 / f32(camera.frameCount);
    let totalColor = mix(prevColor.rgb, col, cFactor);
    textureStore(tex, id.xy, vec4f(totalColor, 1));
}

fn nextStep(orig: vec3f, dir: vec3f, gridPos: ptr<function, vec3i>) -> vec3f {
    let t = step(vec3f(0, 0, 0), dir);
    let p = step(dir, vec3f(0, 0, 0));
    let c = ceil(abs(dir)) * sign(dir);
    let n = t - orig;
    let d = n / dir;
    let m = min(min(d.x, d.y), d.z) * dir;
    var o = orig + m;
    if (d.x < d.y) {
        if (d.x < d.z) {
            o.x = p.x;
            (*gridPos).x += i32(c.x);
        } else {
            o.z = p.z;
            (*gridPos).z += i32(c.z);
        }
    } else if (d.y < d.z) {
        o.y = p.y;
        (*gridPos).y += i32(c.y);
    } else {
        o.z = p.z;
        (*gridPos).z += i32(c.z);
    }
    return o;
}

fn hitSphere(center: vec3f, r: f32, orig: vec3f, dir: vec3f, tMin: f32, tMax: f32) -> f32 {
    let oc = center - orig;
    let a = dot(dir, dir);
    let h = dot(dir, oc);
    let c = dot(oc, oc) - r * r;
    let d = h * h - a * c;
    let sqrtd = sqrt(d);
    var root = (h - sqrtd) / a;
    if (root <= tMin || root >= tMax) {
        root = (h + sqrtd) / a;
        if (root <= tMin || root >= tMax) {
            return -1.0;
        }
    }
    return root;
}

fn randomDir(state: ptr<function, u32>) -> vec3f {
    let theta = randomF(state) * PI;
    let z = randomF(state) * 2 - 1.0;
    let x = sqrt(1 - z * z) * cos(theta);
    let y = sqrt(1 - z * z) * sin(theta);
    return vec3f(x, y, z);
}

fn randomF(state: ptr<function, u32>) -> f32 {
    let s = (*state) * 747796405 + 2891336453;
    *state = s;
    var result = ((s >> ((s >> 28) + 4)) ^ s) * 277803737;
    result = (result >> 22) ^ result;
    return f32(result) / 4294967295.0;
}

fn wangHash(x: u32, y: u32, z: u32) -> u32 {
    var seed: u32 = x * 1664525u + y * 1013904223u + z * 374761393u;
    seed ^= (seed >> 16u);
    seed *= 2246822519u;
    seed ^= (seed >> 13u);
    seed *= 3266489917u;
    seed ^= (seed >> 16u);
    return seed;
}
