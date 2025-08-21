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
    count: atomic<u32>
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(1) var<storage, read_write> rayQueue: array<Ray>;

@compute @workgroup_size(8, 8, 1) fn spawnRay(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= camera.imgW || id.y >= camera.imgH) {
        return;
    }

    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
    let target1 = pCenter + 0.125 * camera.pixelDeltaU + 0.375 * camera.pixelDeltaV;
    let target2 = pCenter - 0.125 * camera.pixelDeltaU - 0.375 * camera.pixelDeltaV;
    let target3 = pCenter - 0.375 * camera.pixelDeltaU + 0.125 * camera.pixelDeltaV;
    let target4 = pCenter + 0.375 * camera.pixelDeltaU - 0.125 * camera.pixelDeltaV;

    let ray1 = Ray(camera.pos, id.x + id.y * camera.imgW, normalize(target1 - camera.pos), 0);
    let ray2 = Ray(camera.pos, id.x + id.y * camera.imgW, normalize(target2 - camera.pos), 0);
    let ray3 = Ray(camera.pos, id.x + id.y * camera.imgW, normalize(target3 - camera.pos), 0);
    let ray4 = Ray(camera.pos, id.x + id.y * camera.imgW, normalize(target4 - camera.pos), 0);
    
    let rayQueueHeader = &queueHeaders[0];
    let index = atomicAdd(&rayQueueHeader.count, 4u);
    rayQueue[index] = ray1;
    rayQueue[index + 1] = ray2;
    rayQueue[index + 2] = ray3;
    rayQueue[index + 3] = ray4;

    textureStore(outputTexture, id.xy, vec4f(camera.backgroundColor, 1));
}