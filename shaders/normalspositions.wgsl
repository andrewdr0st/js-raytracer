
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
    m: u32
};

struct hitRec {
    p: vec3f,
    t: f32,
    n: vec3f,
    h: bool,
    frontFace: bool
};

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var ntex: texture_storage_2d<rgba16float, write>;
@group(1) @binding(1) var ptex: texture_storage_2d<rgba16float, write>;
@group(2) @binding(0) var<storage, read> triangles: array<triangle>;
@group(2) @binding(1) var<storage, read> triPoints: array<vec3f>;
@group(2) @binding(2) var<storage, read> spheres: array<sphere>;

@compute @workgroup_size(64, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(ntex).x) {
        return;
    }
    
    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
    let sphereCount = arrayLength(&spheres);
    let triCount = arrayLength(&triangles);

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