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
}

struct Accumulation {
    color: vec3u,
    count: u32
}

const WHITEINV = 1.0 / 65536.0;

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(1) @binding(1) var<storage, read_write> accumulationBuffer: array<Accumulation>;

@compute @workgroup_size(8, 8, 1) fn textureOutput(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= camera.imgW || id.y >= camera.imgH) {
        return;
    }

    let acc = accumulationBuffer[id.x + id.y * camera.imgW];
    let coloru = acc.color / vec3u(acc.count);
    let color = vec3f(coloru) * WHITEINV;
    textureStore(outputTexture, id.xy, vec4f(pow(color, vec3f(1.0 / 2.2)), 1));
}
