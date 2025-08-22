struct Camera {
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
    gridX: u32,
    defocusV: vec3f,
    gridY: u32,
    imgW: u32,
    imgH: u32
};

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

//When traversing the TLAS, triCount > 0 represents a leaf node which contains an object
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
    count: atomic<u32>,
    clear: u32
}

struct HitRecord {
    pos: vec3f,
    pixelIndex: u32,
    normal: vec3f,
    t: f32,
    dir: vec3f,
    material: u32,
    uv: vec2f,
    texture: u32,
    throughput: u32
}

const EPSILON = 0.000001;
const TMAX = 10000.0;

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;
@group(0) @binding(2) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(3) var<storage, read> bvh: array<BVHNode>;
@group(0) @binding(4) var<storage, read> objectInfos: array<ObjectInfo>;
@group(1) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(1) var<storage, read_write> rayQueue: array<Ray>;
@group(2) @binding(2) var<storage, read_write> hitQueue: array<HitRecord>;

@compute @workgroup_size(64, 1, 1) fn intersect(@builtin(global_invocation_id) id: vec3u) {
    let rayQueueHeader = &queueHeaders[0];
    if (id.x >= atomicLoad(&rayQueueHeader.count)) {
        return;
    }

    let ray = rayQueue[id.x];
    var hr: HitRecord;
    hr.t = TMAX;

    hr = traverseTLAS(ray, hr);

    if (hr.t < TMAX) {
        hr.pos = ray.dir * hr.t + ray.orig;
        hr.dir = ray.dir;
        hr.pixelIndex = ray.pixelIndex;
        hr.throughput = ray.throughput;

        let hitQueueHeader = &queueHeaders[1];
        let index = atomicAdd(&hitQueueHeader.count, 1u);
        hitQueue[index] = hr;
    } else {
        let lightDirection = normalize(vec3f(5, 10, -2));
        let sun = step(0.99, dot(lightDirection, ray.dir));
        let c = mix(camera.backgroundColor, vec3f(1), sun) * pow(unpack4x8unorm(ray.throughput).xyz, vec3f(2.2));
        let imgPos = vec2u(ray.pixelIndex % camera.imgW, ray.pixelIndex / camera.imgW);
        textureStore(outputTexture, imgPos, vec4f(pow(c, vec3f(1.0 / 2.2)), 1));
    }
}

fn traverseTLAS(ray: Ray, hitRec: HitRecord) -> HitRecord {
    let inverseDir = vec3f(1.0) / ray.dir;
    var hr = hitRec;
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
            let objInfo = objectInfos[b.idx];
            var t_ray: Ray;
            t_ray.dir = (objInfo.transformInv * vec4f(ray.dir, 0)).xyz;
            t_ray.orig = (objInfo.transformInv * vec4f(ray.orig, 1)).xyz;
            var hrCopy = HitRecord(hr.pos, hr.pixelIndex, hr.normal, hr.t, hr.dir, hr.material, hr.uv, hr.texture, hr.throughput);
            hrCopy = traverseBVH(t_ray, hrCopy, objInfo.rootNode);
            hrCopy.normal = normalize(objInfo.transform * hrCopy.normal);
            if (hrCopy.t < hr.t) {
                hr = hrCopy;
                hr.material = objInfo.material;
                hr.texture = objInfo.tex;
            }
            bptr--;
        }
    }
    return hr;
}

fn traverseBVH(ray: Ray, hitRec: HitRecord, bvhIdx: u32) -> HitRecord {
    let inverseDir = vec3f(1.0) / ray.dir;
    var hr = hitRec;
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
    return hr;
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
    if (t < 0.01) {
        return hr;
    }
    hr.t = t;
    hr.uv = vec2f(a * v2.u + b * v3.u + c * v1.u, a * v2.v + b * v3.v + c * v1.v);
    hr.normal = a * v1.normal + b * v2.normal + c * v3.normal;
    return hr;
}

fn hitBox(ray: Ray, invDir: vec3f, bvhNode: BVHNode, t: f32) -> f32 {
    let t1 = (bvhNode.a - ray.orig) * invDir;
    let t2 = (bvhNode.b - ray.orig) * invDir;
    let tmin = max(max(min(t1.x, t2.x), min(t1.y, t2.y)), min(t1.z, t2.z));
    let tmax = min(min(max(t1.x, t2.x), max(t1.y, t2.y)), max(t1.z, t2.z));
    return select(TMAX, tmin, tmax >= tmin && tmin < t && tmax > EPSILON);
}

