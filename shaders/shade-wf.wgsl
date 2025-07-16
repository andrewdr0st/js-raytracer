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

@group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;
@group(2) @binding(2) var<storage, read_write> hitQueue: array<HitRecord>;

@compute @workgroup_size(64, 1, 1) fn shade(@builtin(global_invocation_id) id: vec3u) {
    let hitQueueHeader = &queueHeaders[1];
    if (id.x >= atomicLoad(&hitQueueHeader.count)) {
        return;
    }

    let hitRec = hitQueue[id.x];

    let imgW = textureDimensions(tex).x;
    let imgPos = vec2u(hitRec.pixelIndex % imgW, hitRec.pixelIndex / imgW);

    textureStore(tex, imgPos, vec4f(1, 1, 1, 1));
}