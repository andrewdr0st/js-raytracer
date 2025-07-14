struct cameraData {
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
    gridY: u32
};

struct ray {
    pos: vec3f,
    pixelIndex: u32,
    dir: vec3f,
    bounceCount: u32
};

struct queueHeader {
    count: atomic<u32>
}

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var<storage> qHeader: queueHeader;
@group(1) @binding(1) var<storage, write> rayQueue: array<ray>;

@compute @workgroup_size(8, 8, 1) fn spawnRay(@builtin(global_invocation_id) id: vec3u) {
    let idx = id.x + camera.gridX;
    let idy = id.y + camera.gridY;

    let index = atomicAdd(&qHeader.count, 1u);
    rayQueue[index] = //make ray
}