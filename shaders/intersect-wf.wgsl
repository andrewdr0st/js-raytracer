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
    idx: u32
}

struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>
}

struct HitRecord {
    pos: vec3f,
    pixelIndex: u32,
    normal: vec3f,
    t: f32,
    dir: vec3f
}

const EPSILON = 0.00001;
const TMAX = 10000.0;

@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;
@group(0) @binding(2) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(3) var<storage, read> bvh: array<BVHNode>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(1) var<storage, read_write> rayQueue: array<Ray>;
@group(2) @binding(2) var<storage, read_write> hitQueue: array<HitRecord>;

@compute @workgroup_size(64, 1, 1) fn intersect(@builtin(global_invocation_id) id: vec3u) {
    let rayQueueHeader = &queueHeaders[0];
    if (id.x >= atomicLoad(&rayQueueHeader.count)) {
        return;
    }

    let triCount = arrayLength(&triangles);
    var bvhStack = array<u32, 24>();

    let ray = rayQueue[id.x];
    let inverseDir = vec3f(1.0) / ray.dir;
    var hr: HitRecord;
    hr.t = TMAX;

    var bptr: i32 = 0;
    bvhStack[0] = 0;
    while (bptr >= 0) {
        let b = bvh[bvhStack[bptr]];
        if (b.triCount == 0) {
            let cidx1 = b.idx;
            let cidx2 = b.idx + 1;
            let child1 = bvh[cidx1];
            let child2 = bvh[cidx2];
            let dist1 = hitBox(ray, inverseDir, child1, hr.t);
            let dist2 = hitBox(ray, inverseDir, child2, hr.t);
            let childOrder = select(vec2u(cidx1, cidx2), vec2u(cidx2, cidx1), dist1 > dist2);
            let minDist = min(dist1, dist2);
            let maxDist = max(dist1, dist2);
            if (maxDist < TMAX) {
                bvhStack[bptr] = childOrder.y;
                bvhStack[bptr + 1] = childOrder.x;
                bptr++;
            } else if (minDist < TMAX) {
                bvhStack[bptr] = childOrder.x;
            } else {
                bptr--;
            }
        } else {
            for (var i: u32 = 0; i < b.triCount; i++) {
                let triHr = hitTriangle(triangles[i + b.idx], ray);
                if (triHr.t < hr.t) {
                    hr = triHr;
                }
            }
            bptr--;
        }
    }

    if (hr.t < TMAX) {
        hr.pos = ray.dir * hr.t + ray.orig;
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

fn hitTriangle(tri: Triangle, ray: Ray) -> HitRecord {
    var hr: HitRecord;
    hr.t = TMAX;
    let v1 = vertices[tri.vertices.x];
    let v2 = vertices[tri.vertices.y];
    let v3 = vertices[tri.vertices.z];
    let edge1 = v2.pos - v1.pos;
    let edge2 = v3.pos - v1.pos;
    let raycross = cross(ray.dir, edge2);
    let d = dot(edge1, raycross);
    if (abs(d) < EPSILON) {
        return hr;
    }
    let dinv = 1 / d;
    let s = ray.orig - v1.pos;
    let a = dinv * dot(s, raycross);
    if (a < 0 || a > 1) {
        return hr;
    }
    let q = cross(s, edge1);
    let b = dinv * dot(ray.dir, q);
    if (b < 0 || a + b > 1) {
        return hr;
    }
    let c = 1 - a - b;
    let t = dinv * dot(edge2, q);
    if (t < EPSILON) {
        return hr;
    }
    hr.t = t;
    let tc = vec2f(a * v1.u + b * v2.u + c * v3.u, a * v1.v + b * v2.v + c * v3.v);
    hr.normal = a * v1.normal + b * v2.normal + c * v3.normal;
    return hr;
}

fn hitBox(ray: Ray, invDir: vec3f, bvhNode: BVHNode, t: f32) -> f32 {
    let t1 = (bvhNode.a - ray.orig) * invDir;
    let t2 = (bvhNode.b - ray.orig) * invDir;
    let tmin = min(min(min(t1.x, t2.x), min(t1.y, t2.y)), min(t1.z, t2.z));
    let tmax = max(max(max(t1.x, t2.x), max(t1.y, t2.y)), max(t1.z, t2.z));
    return select(TMAX, tmin, tmax > tmin && tmin < t && tmin > EPSILON);
}

