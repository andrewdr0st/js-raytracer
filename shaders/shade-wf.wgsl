struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>
}

struct HitRecord {
    pos: vec3f,
    pixelIndex: u32,
    normal: vec3f,
    t: f32,
    dir: vec3f,
    uv: vec2f
}

@group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(2) var<storage, read_write> hitQueue: array<HitRecord>;
@group(3) @binding(0) var textures16: texture_2d_array<f32>;

@compute @workgroup_size(64, 1, 1) fn shade(@builtin(global_invocation_id) id: vec3u) {
    let hitQueueHeader = &queueHeaders[1];
    if (id.x >= atomicLoad(&hitQueueHeader.count)) {
        return;
    }

    let hitRec = hitQueue[id.x];

    let imgW = textureDimensions(tex).x;
    let imgPos = vec2u(hitRec.pixelIndex % imgW, hitRec.pixelIndex / imgW);
    let tc = vec2u(u32(hitRec.uv.x * 16.0), u32(hitRec.uv.y * 16.0));
    let col = textureLoad(textures16, tc, 0, 0);

    textureStore(tex, imgPos, col);
}