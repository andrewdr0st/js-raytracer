
struct cameraData {
    pos: vec3f,
    raysPerPixel: u32,
    topLeftPixel: vec3f,
    bounceCount: u32,
    pixelDeltaU: vec3f,
    antiAliasing: u32,
    pixelDeltaV: vec3f,
    backgroundColor: vec3f,
    defocusU: vec3f,
    defocusV: vec3f
};

struct material {
    c: vec3f,
    e: f32,
    reflectChance: f32,
    fuzzFactor: f32,
    ri: f32,
    density: f32,
    tex: i32,
    texArray: i32,
    matType: u32,
    fresnel: f32
};

struct sphere {
    pos: vec3f,
    radius: f32,
    m: i32
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
    rootNode: u32,
    bbox2: vec3f,
    m: i32,
    tMat: mat4x4f,
    tMatInv: mat4x4f
};

struct bvhNode {
    bbox1: vec3f,
    triCount: u32,
    bbox2: vec3f,
    idx: u32
}

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
const EPSILON = 0.00001;

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read> triangles: array<triangle>;
@group(2) @binding(1) var<storage, read> triPoints: array<vec3f>;
@group(2) @binding(2) var<storage, read> triUvs: array<vec2f>;
@group(2) @binding(3) var<storage, read> triNorms: array<vec3f>;
@group(2) @binding(4) var<storage, read> objects: array<object>;
@group(2) @binding(5) var<storage, read> bvhNodes: array<bvhNode>;
@group(2) @binding(6) var<storage, read> spheres: array<sphere>;
@group(3) @binding(0) var<storage, read> materials: array<material>;
@group(3) @binding(1) var textures8: texture_2d_array<f32>;
@group(3) @binding(2) var textures16: texture_2d_array<f32>;

@compute @workgroup_size(8, 8, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(tex).x || id.y > textureDimensions(tex).y) {
        return;
    }
    
    var pCenter: vec3f;
    var rngState = u32((id.x * 2167) ^ ((id.y * 31802381) << 1)) + u32((camera.pos.x - 1340.23) * 123457.0 + (camera.pos.y - 8501.921) * 157141.0 + (camera.pos.z + 1749.3847) * 403831.0);
    
    var totalColor = vec3f(0, 0, 0);

    let sphereCount = arrayLength(&spheres);
    let triCount = arrayLength(&triangles);
    let objCount = arrayLength(&objects);

    var bvhStack = array<u32, 24>();

    let bounceCount: u32 = camera.bounceCount;
    let rayCount: u32 = camera.raysPerPixel;

    let sunSurfaceArea = spheres[0].radius * spheres[0].radius * PI * 4;

    for (var a: u32 = 0; a < rayCount; a++) {
        var backgroundColor = camera.backgroundColor;
        var rayColor = vec3f(1, 1, 1);
        var incomingLight = vec3f(0, 0, 0);
        var pw: f32 = 1.0;
        var bdrf: f32 = 1.0;
        var bdrfDone = 0;

        let randomC = randomPointInCircle(&rngState);
        let defocusOrig = camera.pos + randomC.x * camera.defocusU + randomC.y * camera.defocusV;

        if (camera.antiAliasing > 0) {
            let xRand = randomF(&rngState) - 0.5;
            let yRand = randomF(&rngState) - 0.5;            
            pCenter = camera.topLeftPixel + camera.pixelDeltaU * (f32(id.x) - xRand) + camera.pixelDeltaV * (f32(id.y) - yRand);
        } else {
            pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
        }

        var tMin: f32 = 0.0001;
        var tMax: f32 = 10000.0;

        var inVolume: bool = false;
        var importanceRay: bool = false;

        var hr: hitRec;
        hr.p = defocusOrig;
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
                var ohr = hitBox(obj.bbox1, obj.bbox2, orig, ray, tMax);

                if (ohr.h) {
                    let newO = (obj.tMatInv * vec4f(orig, 1)).xyz;
                    let newR = (obj.tMatInv * vec4f(ray, 0)).xyz;
                    var bp: i32 = 0;
                    bvhStack[0] = obj.rootNode;
                    while (bp >= 0) {
                        let b = bvhNodes[bvhStack[bp]];
                        let bhr = hitBox(b.bbox1, b.bbox2, newO, newR, tMax);
                        if (bhr.h) {
                            if (b.triCount == 0) {
                                bvhStack[bp] = b.idx + 1;
                                bvhStack[bp + 1] = b.idx;
                                bp++;
                            } else {
                                for (var j: u32 = 0; j <= b.triCount; j++) {
                                    let tri = triangles[j + b.idx];
                                    var thr = hitTriangle(tri, newO, newR, tMax);

                                    if (thr.h && thr.t > tMin && thr.t < tMax) {
                                        tMax = thr.t;
                                        hr.t = thr.t;
                                        hr.n = thr.n;
                                        hr.frontFace = dot(newR, hr.n) < 0;
                                        if (!hr.frontFace) {
                                            hr.n = -hr.n;
                                        }
                                        hr.n = normalize(obj.tMat * vec4f(hr.n, 0)).xyz;
                                        hr.h = thr.h;
                                        hr.p = newR * hr.t + newO;
                                        hr.p = (obj.tMat * vec4f(hr.p, 1)).xyz;
                                        hr.m = materials[obj.m];
                                        hr.uv = thr.uv;
                                    }
                                }
                                bp--;
                            }
                        } else {
                            bp--;
                        }
                    }
                }
            }
            
            let emitLight = hr.m.c * (hr.m.e * pw);
            incomingLight += emitLight * rayColor;
            if (importanceRay || tMax > 9999) {
                break;
            }

            if (hr.m.tex >= 0) {
                if (hr.m.texArray == 0) {
                    let tc = vec2u(u32(hr.uv.x * 8.0), u32(hr.uv.y * 8.0));
                    rayColor *= textureLoad(textures8, tc, hr.m.tex, 0).xyz;
                } else {
                    let tc = vec2u(u32(hr.uv.x * 16.0), u32(hr.uv.y * 16.0));
                    rayColor *= textureLoad(textures16, tc, hr.m.tex, 0).xyz;
                }
                //rayColor *= vec3f(hr.uv.x, 0, hr.uv.y);
                //rayColor *= hr.n;
            } else {
                rayColor *= hr.m.c;
            }

            if (inVolume) {
                let distToHit = hr.m.density * log(randomF(&rngState));
                if (distToHit < hr.t) {
                    hr.d = randomDir(&rngState);
                    hr.p = orig + ray * distToHit;
                } else {
                    hr.d = ray;
                    inVolume = false;
                }
            } else {
                let matRand = randomF(&rngState);
                if (hr.m.matType == 1 && bdrfDone == 0) {
                    if (a == 0 && hr.m.e < EPSILON) {
                        let p = sampleSun(&rngState);
                        let d = p - hr.p;
                        let dist_squared = dot(d, d);
                        hr.d = normalize(d);
                        let cos_theta = dot(hr.d, hr.n);
                        pw = select(0.0, (cos_theta * sunSurfaceArea) / dist_squared, cos_theta > 0);
                        importanceRay = true;
                    } else {
                        hr.d = hr.n + randomDir(&rngState);
                    }
                    hr.d = normalize(hr.d);
                    bdrf = cookTorranceBDRF(hr.d, -ray, hr.n, hr.m.fuzzFactor, hr.m.fresnel) * dot(hr.d, hr.n);
                    bdrfDone = 1;
                } else if (hr.m.ri > 0.01) {
                    let cosTheta = dot(-ray, hr.n);
                    let refractiveRatio = select(hr.m.ri, 1.0 / hr.m.ri, hr.frontFace);
                    let r = refract(ray, hr.n, refractiveRatio);
                    var r0 = (1 - refractiveRatio) / (1 + refractiveRatio);
                    r0 = r0 * r0;
                    if (all(r == vec3f(0.0)) || schlick(cosTheta, r0) > randomF(&rngState)) {
                        hr.d = reflect(ray, hr.n);
                    } else {
                        hr.d = r;
                    }
                } else if (matRand < hr.m.reflectChance) {
                    hr.d = reflect(ray, hr.n);
                    if (hr.m.fuzzFactor > 0) {
                        hr.d += randomDir(&rngState) * hr.m.fuzzFactor;
                    }
                } else if (hr.m.density < 0) {
                    hr.d = ray;
                    inVolume = true;
                } else {
                    if (a == 0 && hr.m.e < EPSILON) {
                        let p = sampleSun(&rngState);
                        let d = p - hr.p;
                        let dist_squared = dot(d, d);
                        hr.d = normalize(d);
                        let cos_theta = dot(hr.d, hr.n);
                        pw = select(0.0, (cos_theta * sunSurfaceArea) / dist_squared, cos_theta > 0);
                        importanceRay = true;
                    } else {
                        hr.d = hr.n + randomDir(&rngState);
                    }
                }
            }
        }

        totalColor += incomingLight * bdrf;
    }

    totalColor /= f32(rayCount);

    totalColor = max(totalColor, vec3f(0, 0, 0));
    totalColor = sqrt(totalColor);

    textureStore(tex, id.xy, vec4f(totalColor, 1));
    //textureStore(tex, id.xy, vec4f(camera.defocusU, 1));
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

fn hitBox(bbox1: vec3f, bbox2: vec3f, orig: vec3f, dir: vec3f, tMax: f32) -> hitRec {
    var hr: hitRec;
    let x0 = (bbox1.x - orig.x) / dir.x;
    let x1 = (bbox2.x - orig.x) / dir.x;
    let minx = min(x0, x1);
    let maxx = max(x0, x1);
    let y0 = (bbox1.y - orig.y) / dir.y;
    let y1 = (bbox2.y - orig.y) / dir.y;
    let miny = min(y0, y1);
    let maxy = max(y0, y1);
    let z0 = (bbox1.z - orig.z) / dir.z;
    let z1 = (bbox2.z - orig.z) / dir.z;
    let minz = min(z0, z1);
    let maxz = max(z0, z1);
    let tenter = max(max(minx, miny), minz);
    let texit = min(min(maxx, maxy), maxz);

    hr.h = tenter <= texit && texit >= 0 && tenter < tMax;
    hr.p = orig + tenter * dir;
    return hr;
}

fn schlick(c: f32, fresnel: f32) -> f32 {
    return fresnel + (1 - fresnel) * pow(1 - c, 5);
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

fn randomPointInCircle(state: ptr<function, u32>) -> vec2f {
    let theta = randomF(state) * PI * 2;
    let mag = sqrt(randomF(state));
    return vec2f(cos(theta), sin(theta)) * mag;
}

fn sampleSun(state: ptr<function, u32>) -> vec3f {
    let s = spheres[0];
    let center: vec3f = s.pos;
    let radius: f32 = s.radius;
    let d = randomDir(state);
    return center + d * radius;
}

fn cookTorranceBDRF(in: vec3f, out: vec3f, n: vec3f, alpha: f32, fresnel: f32) -> f32 {
    let h = normalize(in + out);
    let d = ndf(n, h, alpha);
    //let g = ggx(in, out, n, alpha);
    let g = 1.0;
    let f = schlick(dot(in, h), fresnel);
    //let f = 1.0;
    let denominator = max(4.0 * dot(in, n) * dot(out, n), EPSILON);
    return d * g * f / denominator;
}

fn ndf(n: vec3f, h: vec3f, alpha: f32) -> f32 {
    let nh = dot(n, h);
    let denominator = nh * nh * (alpha - 1.0) + 1.0;
    return alpha / (PI * denominator * denominator);
}

fn ggx1(n: vec3f, v: vec3f, alpha: f32) -> f32 {
    let nv = dot(n, v);
    let denominator = nv + sqrt(alpha + (1.0 - alpha) * nv * nv);
    return 2.0 * nv / denominator;
}

fn ggx(in: vec3f, out: vec3f, n: vec3f, alpha: f32) -> f32 {
    return ggx1(n, in, alpha) * ggx1(n, out, alpha);
}
