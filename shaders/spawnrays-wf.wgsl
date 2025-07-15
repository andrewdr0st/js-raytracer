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
    pos: vec3f,
    pixelIndex: u32,
    dir: vec3f,
    bounceCount: u32
};

struct QueueHeader {
    count: atomic<u32>
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read_write> queueHeader: QueueHeader;
@group(1) @binding(1) var<storage, write> rayQueue: array<Ray>;

@compute @workgroup_size(8, 8, 1) fn spawnRay(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= camera.imgW || id.y >= camera.imgH) {
        return;
    }

    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);

    var ray: Ray;
    ray.pos = camera.pos;
    ray.dir = normalize(pCenter - camera.pos);
    ray.pixelIndex = idx + idy * camera.imgW;
    
    let index = atomicAdd(&queueHeader.count, 1u);
    rayQueue[index] = ray;
}