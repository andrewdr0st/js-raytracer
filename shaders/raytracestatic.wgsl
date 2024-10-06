
struct cameraData {
    pos: vec3f,
    raysPerPixel: u32,
    topLeftPixel: vec3f,
    bounceCount: u32,
    pixelDeltaU: vec3f,
    randomSeed: u32,
    pixelDeltaV: vec3f,
    frameCount: u32,
    backgroundColor: vec3f
};

struct material {
    c: vec3f,
    e: f32,
    reflectChance: f32,
    fuzzFactor: f32,
    tex: u32,
    ri: f32
};

struct sphere {
    pos: vec3f,
    radius: f32,
    m: u32
};

struct triangle {
    points: vec3u,
    m: u32
};

struct hitRec {
    p: vec3f,
    t: f32,
    n: vec3f,
    h: bool,
    d: vec3f,
    frontFace: bool,
    m: material
};

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
@group(1) @binding(1) var prevTex: texture_storage_2d<rgba8unorm, read>;
@group(2) @binding(0) var<storage, read> triangles: array<triangle>;
@group(2) @binding(1) var<storage, read> triPoints: array<vec3f>;
@group(2) @binding(2) var<storage, read> spheres: array<sphere>;
@group(3) @binding(0) var<storage, read> materials: array<material>;

@compute @workgroup_size(64, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(tex).x) {
        return;
    }

    var rngState = ((id.x * 2167) ^ (id.y * 31802381)) + (camera.randomSeed * camera.frameCount * 1401);
    let xRand = randomF(&rngState) - 0.5;
    let yRand = randomF(&rngState) - 0.5;
                
    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * (f32(id.x) - xRand) + camera.pixelDeltaV * (f32(id.y) - yRand);
                
    var totalColor = vec3f(0, 0, 0);

    let sphereCount = arrayLength(&spheres);
    let triCount = arrayLength(&triangles);

    let bounceCount: u32 = camera.bounceCount;
    let rayCount: u32 = camera.raysPerPixel;

    for (var a: u32 = 0; a < rayCount; a++) {
        var backgroundColor = camera.backgroundColor;
        var rayColor = vec3f(1, 1, 1);
        var incomingLight = vec3f(0, 0, 0);

        var tMin: f32 = 0.0001;
        var tMax: f32 = 10000.0;

        var hr: hitRec;
        hr.p = camera.pos;
        hr.d = pCenter - camera.pos;

        for (var b: u32 = 0; b < bounceCount; b++) {
            tMin = 0.001;
            tMax = 10000.0;
            var ray = hr.d;
            ray = normalize(ray);
            var orig = hr.p;
            hr.h = false;
            hr.m.c = backgroundColor;
            hr.m.e = 1;

            for (var i: u32 = 0; i < sphereCount; i++) {
                let s = spheres[i];
                let center: vec3f = s.pos;
                let radius: f32 = s.radius;

                let root = hitSphere(center, radius, orig, ray, tMin, tMax);

                if (root < tMax && root > tMin) {
                    tMax = root;
                    hr.t = root;
                    hr.p = ray * root + orig;
                    hr.n = (hr.p - center) / radius;
                    hr.frontFace = dot(ray, hr.n) < 0;
                    if (!hr.frontFace) {
                        hr.n = -hr.n;
                    }
                    hr.h = true;
                    hr.m = materials[s.m];
                }
            }

            for (var i: u32 = 0; i < triCount; i++) {
                let tri = triangles[i];
                let a = triPoints[tri.points.x];
                let b = triPoints[tri.points.y];
                let c = triPoints[tri.points.z];
                var thr = hitTriangle(a, b, c, orig, ray, tMax);

                if (thr.h && thr.t > tMin && thr.t < tMax) {
                    tMax = thr.t;
                    hr.t = thr.t;
                    hr.n = thr.n;
                    hr.frontFace = dot(ray, hr.n) < 0;
                    if (!hr.frontFace) {
                        hr.n = -hr.n;
                    }
                    hr.h = thr.h;
                    hr.p = ray * hr.t + orig;
                    hr.m = materials[tri.m];
                }
            }
            
            let emitLight = hr.m.c * hr.m.e;
            incomingLight += emitLight * rayColor;
            rayColor *= hr.m.c;

            let matRand = randomF(&rngState);
            if (hr.m.ri > 0) {
                let cosTheta = dot(ray, -hr.n);
                let refractiveRatio = select(hr.m.ri, 1.0 / hr.m.ri, hr.frontFace);
                let r = refract(ray, hr.n, refractiveRatio);
                if (all(r == vec3f(0.0)) || schlick(cosTheta, refractiveRatio) > randomF(&rngState)) {
                    hr.d = reflect(ray, hr.n);
                } else {
                    hr.d = r;
                }
            } else if (matRand < hr.m.reflectChance) {
                hr.d = reflect(ray, hr.n);
                if (hr.m.fuzzFactor > 0) {
                    hr.d += randomDir(&rngState) * hr.m.fuzzFactor;
                }
            } else {
                hr.d = hr.n + randomDir(&rngState);
            }
            
            if (tMax > 9999) {
                break;
            }
        }

        totalColor += incomingLight;
    }

    totalColor /= f32(rayCount);

    totalColor = max(totalColor, vec3f(0, 0, 0));
    totalColor = sqrt(totalColor);

    let prevColor = textureLoad(prevTex, id.xy);
    let cFactor = 1 / f32(camera.frameCount);
                
    totalColor = totalColor * cFactor + prevColor.rgb * (1 - cFactor);

    textureStore(tex, id.xy, vec4f(totalColor, 1));
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

fn hitPlane(n: vec3f, p: vec3f, orig: vec3f, dir: vec3f) -> f32 {
    let denominator = dot(n, dir);
    if (abs(denominator) < 0.00001) {
        return -1.0;
    }
    let numerator = dot(-n, orig - p);
    return numerator / denominator;
}

fn hitTriangle(a: vec3f, b: vec3f, c: vec3f, orig: vec3f, dir: vec3f, tMax: f32) -> hitRec {
    var hr: hitRec;
    hr.h = false;
    let n = normalize(cross(b - a, c - a));
    hr.n = n;
    let t = hitPlane(n, a, orig, dir);
    if (t < 0 || t >= tMax) {
        return hr;
    }
    hr.t = t;
    let p = orig + t * dir;
    let na = cross(c - b, p - b);
    let nb = cross(a - c, p - c);
    let nc = cross(b - a, p - a);
    hr.h = dot(n, na) >= 0 && dot(n, nb) >= 0 && dot(n, nc) >= 0;
    return hr;
}

fn schlick(c: f32, ri: f32) -> f32 {
    var r0 = (1 - ri) / (1 + ri);
    r0 = r0 * r0;
    return r0 + (1 - r0) * pow((1 - c), 5);
}

fn randomF(state: ptr<function, u32>) -> f32 {
    let s = (*state) * 747796405 + 2891336453;
    *state = s;
    var result = ((s >> ((s >> 28) + 4)) ^ s) * 277803737;
    result = (result >> 22) ^ result;
    return f32(result) / 4294967295.0;
}

fn randomDir(state: ptr<function, u32>) -> vec3f {
    let theta = randomF(state) * 3.14159;
    let z = randomF(state) * 2 - 1.0;
    let x = sqrt(1 - z * z) * cos(theta);
    let y = sqrt(1 - z * z) * sin(theta);
    return vec3f(x, y, z);
}