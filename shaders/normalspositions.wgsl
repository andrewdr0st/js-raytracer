
struct cameraData {
    pos: vec3f,
    raysPerPixel: u32,
    topLeftPixel: vec3f,
    bounceCount: u32,
    pixelDeltaU: vec3f, 
    pixelDeltaV: vec3f,
    backgroundColor: vec3f
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
    m: i32,
    tMat: mat4x4f,
    tMatInv: mat4x4f
};

struct hitRec {
    p: vec3f,
    t: f32,
    n: vec3f,
    h: bool,
    d: vec3f,
    frontFace: bool,
    uv: vec2f
};

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var ntex: texture_storage_2d<rgba16float, write>;
@group(1) @binding(1) var ptex: texture_storage_2d<rgba16float, write>;
@group(2) @binding(0) var<storage, read> triangles: array<triangle>;
@group(2) @binding(1) var<storage, read> triPoints: array<vec3f>;
@group(2) @binding(2) var<storage, read> triUvs: array<vec2f>;
@group(2) @binding(3) var<storage, read> triNorms: array<vec3f>;
@group(2) @binding(4) var<storage, read> objects: array<object>;
@group(2) @binding(5) var<storage, read> spheres: array<sphere>;

@compute @workgroup_size(8, 8, 1) fn normalsPositions(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(ntex).x || id.y > textureDimensions(ntex).y) {
        return;
    }
    
    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);

    let sphereCount = arrayLength(&spheres);
    let triCount = arrayLength(&triangles);
    let objCount = arrayLength(&objects);

    var tMin: f32 = 0.0001;
    var tMax: f32 = 10000.0;

    var hr: hitRec;
    let orig = camera.pos;
    let ray = pCenter - camera.pos;
    hr.h = false;

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
        }
    }

    for (var i: u32 = 0; i < objCount; i++) {
        let obj = objects[i];
        var ohr = hitObject(obj, orig, ray);

        if (ohr.h) {
            let newO = (obj.tMatInv * vec4f(orig, 1)).xyz;
            let newR = (obj.tMatInv * vec4f(ray, 0)).xyz;
            for (var j: u32 = obj.tStart; j <= obj.tEnd; j++) {
                let tri = triangles[j];
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
                    hr.uv = thr.uv;
                }
            }
        }
    }

    textureStore(ntex, id.xy, vec4f(hr.n, 1));
    textureStore(ptex, id.xy, vec4f(hr.p, 1));
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
    let a = triPoints[tri.points.x];
    let b = triPoints[tri.points.y];
    let c = triPoints[tri.points.z];
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
    if (hr.h && tri.useNorms > 0) {
        let ndn = dot(n, n);
        let beta = dot(n, nb) / ndn;
        let gamma = dot(n, nc) / ndn;
        let norma = triNorms[tri.norms.x];
        let normb = triNorms[tri.norms.y];
        let normc = triNorms[tri.norms.z];
        hr.n = norma + beta * (normb - norma) + gamma * (normc - norma);
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