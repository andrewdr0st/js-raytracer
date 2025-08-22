struct QueueHeader {
    dispatch: vec3u,
    count: u32,
    clear: u32
}

@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;

@compute @workgroup_size(1, 1, 1) fn spawnRay(@builtin(global_invocation_id) id: vec3u) {
    let header = &queueHeaders[id.x];
    if (header.clear == 1) {
        header.clear = 0;
        header.count = 0;
    } else if (header.count > 0) {
        header.clear = 1;
        header.dispatch.x = (header.count - 1) / 64 + 1;
    }
}