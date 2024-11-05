
struct cameraData {
    pos: vec3f,
    raysPerPixel: u32,
    topLeftPixel: vec3f,
    bounceCount: u32,
    pixelDeltaU: vec3f,
    pixelDeltaV: vec3f,
    backgroundColor: vec3f
};

struct material {
    c: vec3f,
    e: f32,
    reflectChance: f32,
    fuzzFactor: f32,
    ri: f32,
    tex: i32
};

struct sphere {
    pos: vec3f,
    radius: f32,
    m: u32
};

struct triangle {
    points: vec3u,
    m: u32,
    uvs: vec3u,
    norms: vec3u,
    useNorms: u32
};

struct object {
    bbox1: vec3f,
    tStart: u32,
    bbox2: vec3f,
    tEnd: u32,
    tMat: mat4x4f
};

struct hitRec {
    p: vec3f,
    t: f32,
    n: vec3f,
    h: bool,
    d: vec3f,
    frontFace: bool,
    m: material,
    uv: vec2f
};

const PI = 3.14159265359;

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read> triangles: array<triangle>;
@group(2) @binding(1) var<storage, read> triPoints: array<vec3f>;
@group(2) @binding(2) var<storage, read> triUvs: array<vec2f>;
@group(2) @binding(3) var<storage, read> triNorms: array<vec3f>;
@group(2) @binding(4) var<storage, read> objects: array<object>;
@group(2) @binding(5) var<storage, read> spheres: array<sphere>;
@group(3) @binding(0) var<storage, read> materials: array<material>;
@group(3) @binding(1) var textures: texture_2d_array<f32>;

@compute @workgroup_size(8, 8, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(tex).x || id.y > textureDimensions(tex).y) {
        return;
    }
    
    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
    var rngState = u32((id.x * 2167) ^ ((id.y * 31802381) << 1)) + u32((camera.pos.x - 1340.23) * 123457.0 + (camera.pos.y - 8501.921) * 157141.0 + (camera.pos.z + 1749.3847) * 403831.0);
    
    var totalColor = vec3f(0, 0, 0);

    let sphereCount = arrayLength(&spheres);
    let triCount = arrayLength(&triangles);
    let objCount = arrayLength(&objects);

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
            var ray = normalize(hr.d);
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
                    let theta = acos(-hr.n.y);
                    let phi = atan2(-hr.n.z, hr.n.x) + PI;
                    hr.uv = vec2f(phi / (2 * PI), theta / PI);
                }
            }

            for (var i: u32 = 0; i < objCount; i++) {
                let obj = objects[i];
                var ohr = hitObject(obj, orig, ray);

                if (ohr.h) {
                    for (var j: u32 = obj.tStart; j <= obj.tEnd; j++) {
                        let tri = triangles[j];
                        var thr = hitTriangle(tri, orig, ray, tMax);

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
                            hr.uv = thr.uv;
                        }
                    }
                }
            }
            
            let emitLight = hr.m.c * hr.m.e;
            incomingLight += emitLight * rayColor;
            if (hr.m.tex >= 0) {
                let tc = vec2u(u32(hr.uv.x * 8.0), u32(hr.uv.y * 8.0));
                rayColor *= textureLoad(textures, tc, hr.m.tex, 0).xyz;
                //rayColor *= vec3f(hr.uv.x, 0, hr.uv.y);
                //rayColor *= hr.n;
            } else {
                rayColor *= hr.m.c;
            }

            let matRand = randomF(&rngState);
            if (hr.m.ri > 0.01) {
                let cosTheta = dot(-ray, hr.n);
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

fn hitTriangle(tri: triangle, orig: vec3f, dir: vec3f, tMax: f32) -> hitRec {
    var hr: hitRec;
    hr.h = false;
    let a = triPoints[tri.points.x];
    let b = triPoints[tri.points.y];
    let c = triPoints[tri.points.z];
    let n = cross(b - a, c - a);
    hr.n = normalize(n);
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
    if (hr.h) {
        let ndn = dot(n, n);
        let beta = dot(n, nb) / ndn;
        let gamma = dot(n, nc) / ndn;
        let ta = triUvs[tri.uvs.x];
        let tb = triUvs[tri.uvs.y];
        let tc = triUvs[tri.uvs.z];
        hr.uv = ta + beta * (tb - ta) + gamma * (tc - ta);
        if (tri.useNorms > 0) {
            let norma = triNorms[tri.norms.x];
            let normb = triNorms[tri.norms.y];
            let normc = triNorms[tri.norms.z];
            hr.n = norma + beta * (normb - norma) + gamma * (normc - norma);
        }
    }
    return hr;
}

fn hitObject(obj: object, orig: vec3f, dir: vec3f) -> hitRec {
    var hr: hitRec;
    let x0 = (obj.bbox1.x - orig.x) / dir.x;
    let x1 = (obj.bbox2.x - orig.x) / dir.x;
    let minx = min(x0, x1);
    let maxx = max(x0, x1);
    let y0 = (obj.bbox1.y - orig.y) / dir.y;
    let y1 = (obj.bbox2.y - orig.y) / dir.y;
    let miny = min(y0, y1);
    let maxy = max(y0, y1);
    let z0 = (obj.bbox1.z - orig.z) / dir.z;
    let z1 = (obj.bbox2.z - orig.z) / dir.z;
    let minz = min(z0, z1);
    let maxz = max(z0, z1);
    let tenter = max(max(minx, miny), minz);
    let texit = min(min(maxx, maxy), maxz);

    hr.h = tenter <= texit && texit >= 0;
    hr.p = orig + tenter * dir;
    return hr;
}

fn schlick(c: f32, ri: f32) -> f32 {
    var r0 = (1 - ri) / (1 + ri);
    r0 = r0 * r0;
    return r0 + (1 - r0) * pow(1 - c, 5);
}

fn randomF(state: ptr<function, u32>) -> f32 {
    let s = (*state) * 747796405 + 2891336453;
    *state = s;
    var result = ((s >> ((s >> 28) + 4)) ^ s) * 277803737;
    result = (result >> 22) ^ result;
    return f32(result) / 4294967295.0;
}

fn randomDir(state: ptr<function, u32>) -> vec3f {
    let theta = randomF(state) * PI;
    let z = randomF(state) * 2 - 1.0;
    let x = sqrt(1 - z * z) * cos(theta);
    let y = sqrt(1 - z * z) * sin(theta);
    return vec3f(x, y, z);
}