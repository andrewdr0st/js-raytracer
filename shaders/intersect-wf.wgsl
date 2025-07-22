struct Ray {
    orig: vec3f,
    pixelIndex: u32,
    dir: vec3f,
    bounceCount: u32
};

struct Vertex {
    pos: vec3f,
    u: f32,
    normal: vec3f,
    v: f32
};

struct Triangle {
    vertices: vec3u
};

struct BVHNode {
    a: vec3f,
    triCount: u32,
    b: vec3f,
    index: u32
}

struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>
}

struct HitRecord {
    pos: vec3f,
    pixelIndex: u32,
    normal: vec3f,
    dir: vec3f
}

const EPSILON = 0.00001;

@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;
@group(0) @binding(2) var<storage, read> triangles: array<Triangle>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(1) var<storage, read_write> rayQueue: array<Ray>;
@group(2) @binding(2) var<storage, read_write> hitQueue: array<HitRecord>;

@compute @workgroup_size(64, 1, 1) fn intersect(@builtin(global_invocation_id) id: vec3u) {
    let rayQueueHeader = &queueHeaders[0];
    if (id.x >= atomicLoad(&rayQueueHeader.count)) {
        return;
    }

    let sphereCenter = vec3f(0);
    let sphereRadius = 1.0;
    let tMin = 0.1;
    let tMax = 1000.0;

    let ray = rayQueue[id.x];
    
    let root = hitSphere(sphereCenter, sphereRadius, ray.orig, ray.dir, tMin, tMax);
    if (root > 0) {
        var hr: HitRecord;
        hr.pos = ray.dir * root + ray.orig;
        hr.normal = (hr.pos - sphereCenter) / sphereRadius;
        hr.dir = ray.dir;
        hr.pixelIndex = ray.pixelIndex;

        let hitQueueHeader = &queueHeaders[1];
        let index = atomicAdd(&hitQueueHeader.count, 1u);
        hitQueue[index] = hr;
    }
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

fn hitTriangle(tri: Triangle, ray: Ray) -> f32 {
    let v1 = vertices[tri.vertices.x];
    let v2 = vertices[tri.vertices.y];
    let v3 = vertices[tri.vertices.z];
    let edge1 = v2.pos - v1.pos;
    let edge2 = v3.pos - v1.pos;
    let raycross = cross(ray.dir, edge2);
    let d = dot(edge1, raycross);
    if (abs(d) < EPSILON) {
        return -1.0;
    }
    let dinv = 1 / d;
    let s = ray.orig - v1.pos;
    let a = dinv * dot(s, raycross);
    if (a < 0 || a > 1) {
        return -1.0;
    }
    let q = cross(s, edge1);
    let b = dinv * dot(ray.dir, q);
    if (b < 0 || a + b > 1) {
        return -1.0;
    }
    let c = 1 - a - b;
    let t = f * dot(edge2, q);
    let tc = vec2f(a * v1.u + b * v2.u + c * v3.u, a * v1.v + b * v2.v + c * v3.v);
    let normal = a * v1.normal + b * v2.normal + c * v3.normal;
    return t;
}