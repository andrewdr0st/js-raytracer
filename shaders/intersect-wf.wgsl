struct Ray {
    orig: vec3f,
    pixelIndex: u32,
    dir: vec3f,
    bounceCount: u32
};

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