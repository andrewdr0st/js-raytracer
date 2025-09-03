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
};

struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>,
    clear: u32
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(1) var<storage, read_write> rayQueue: array<Ray>;

@compute @workgroup_size(8, 8, 1) fn spawnRay(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= camera.imgW || id.y >= camera.imgH) {
        return;
    }

    var rngState = camera.randomSeed;
    let xRand = randomF(&rngState) - 0.5;
    let yRand = randomF(&rngState) - 0.5; 

    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * (f32(id.x) + xRand) + camera.pixelDeltaV * (f32(id.y) + yRand);

    let ray = Ray(camera.pos, id.x + id.y * camera.imgW, normalize(pCenter - camera.pos), pack4x8unorm(vec4f(1, 1, 1, 0)));
    
    let rayQueueHeader = &queueHeaders[0];
    let index = atomicAdd(&rayQueueHeader.count, 1u);
    rayQueue[index] = ray;
}

fn randomF(state: ptr<function, u32>) -> f32 {
    let s = (*state) * 747796405 + 2891336453;
    *state = s;
    var result = ((s >> ((s >> 28) + 4)) ^ s) * 277803737;
    result = (result >> 22) ^ result;
    return f32(result) / 4294967295.0;
}