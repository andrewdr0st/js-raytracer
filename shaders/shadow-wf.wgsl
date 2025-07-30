struct Ray {
    orig: vec3f,
    pixelIndex: u32,
    dir: vec3f,
    throughput: u32
}

struct Vertex {
    pos: vec3f,
    u: f32,
    normal: vec3f,
    v: f32
}

struct Triangle {
    vertices: vec3u
}

struct BVHNode {
    a: vec3f,
    triCount: u32,
    b: vec3f,
    idx: u32
}

struct ObjectInfo {
    transform: mat3x3f,
    rootNode: u32,
    material: u32,
    tex: u32,
    transformInv: mat4x4f
}

struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>
}

const EPSILON = 0.000001;
const TMAX = 10000.0;

@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;
@group(0) @binding(2) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(3) var<storage, read> bvh: array<BVHNode>;
@group(0) @binding(4) var<storage, read> objectInfos: array<ObjectInfo>;
@group(1) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(3) var<storage, read_write> shadowQueue: array<Ray>;

@compute @workgroup_size(64, 1, 1) fn shadow(@builtin(global_invocation_id) id: vec3u) {
    let shadowQueueHeader = &queueHeaders[2];
    if (id.x >= atomicLoad(&shadowQueueHeader.count)) {
        return;
    }

    let ray = shadowQueue[id.x];

    let t = traverseTLAS(ray);

    let incomingLuminance = select(1, 0.33, t < TMAX);
    let color = unpack4x8unorm(ray.throughput).xyz * incomingLuminance;
    let corrected = pow(color, vec3f(1.0 / 2.2));

    let imgW = textureDimensions(outputTexture).x;
    let imgPos = vec2u(ray.pixelIndex % imgW, ray.pixelIndex / imgW);
    textureStore(outputTexture, imgPos, vec4f(corrected, 1));
    //textureStore(outputTexture, imgPos, vec4f(ray.orig * 0.25, 1));
}

fn traverseTLAS(ray: Ray) -> f32 {
    let inverseDir = vec3f(1.0) / ray.dir;
    var t = TMAX;
    var bvhStack = array<u32, 24>();
    var bptr: i32 = 0;
    bvhStack[0] = 0;
    while (bptr >= 0) {
        let b = bvh[bvhStack[bptr]];
        if (b.triCount == 0) {
            let cidx1 = b.idx;
            let cidx2 = b.idx + 1;
            let child1 = bvh[cidx1];
            let child2 = bvh[cidx2];
            let dist1 = hitBox(ray, inverseDir, child1, t);
            let dist2 = hitBox(ray, inverseDir, child2, t);
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
            let objInfo = objectInfos[b.idx];
            var t_ray: Ray;
            t_ray.dir = (objInfo.transformInv * vec4f(ray.dir, 0)).xyz;
            t_ray.orig = (objInfo.transformInv * vec4f(ray.orig, 1)).xyz;
            t = traverseBVH(t_ray, objInfo.rootNode);
            if (t < TMAX) {
                return t;
            }
            bptr--;
        }
    }
    return t;
}

fn traverseBVH(ray: Ray, bvhIdx: u32) -> f32 {
    let inverseDir = vec3f(1.0) / ray.dir;
    var t = TMAX;
    var bvhStack = array<u32, 24>();
    var bptr: i32 = 0;
    bvhStack[0] = bvhIdx;
    while (bptr >= 0) {
        let b = bvh[bvhStack[bptr]];
        if (b.triCount == 0) {
            let cidx1 = b.idx;
            let cidx2 = b.idx + 1;
            let child1 = bvh[cidx1];
            let child2 = bvh[cidx2];
            let dist1 = hitBox(ray, inverseDir, child1, t);
            let dist2 = hitBox(ray, inverseDir, child2, t);
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
                t = hitTriangle(triangles[i + b.idx], ray);
                if (t < TMAX) {
                    return t;
                }
            }
            bptr--;
        }
    }
    return t;
}

fn hitTriangle(tri: Triangle, ray: Ray) -> f32 {
    var t = TMAX;
    let v1 = vertices[tri.vertices.x];
    let v2 = vertices[tri.vertices.y];
    let v3 = vertices[tri.vertices.z];
    let edge1 = v2.pos - v1.pos;
    let edge2 = v3.pos - v1.pos;
    let raycross = cross(ray.dir, edge2);
    let d = dot(edge1, raycross);
    if (abs(d) < EPSILON) {
        return t;
    }
    let dinv = 1 / d;
    let s = ray.orig - v1.pos;
    let a = dinv * dot(s, raycross);
    if (a < 0 || a > 1) {
        return t;
    }
    let q = cross(s, edge1);
    let b = dinv * dot(ray.dir, q);
    if (b < 0 || a + b > 1) {
        return t;
    }
    let newt = dinv * dot(edge2, q);
    return select(newt, t, t > EPSILON);
}

fn hitBox(ray: Ray, invDir: vec3f, bvhNode: BVHNode, t: f32) -> f32 {
    let t1 = (bvhNode.a - ray.orig) * invDir;
    let t2 = (bvhNode.b - ray.orig) * invDir;
    let tmin = max(max(min(t1.x, t2.x), min(t1.y, t2.y)), min(t1.z, t2.z));
    let tmax = min(min(max(t1.x, t2.x), max(t1.y, t2.y)), max(t1.z, t2.z));
    return select(TMAX, tmin, tmax >= tmin && tmin < t && tmax > EPSILON);
}