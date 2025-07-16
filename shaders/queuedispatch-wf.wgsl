struct QueueHeader {
    dispatch: vec3u,
    count: atomic<u32>
}

@group(2) @binding(0) var<storage, read_write> queueHeaders: array<QueueHeader>;

@compute @workgroup_size(1, 1, 1) fn spawnRay(@builtin(global_invocation_id) id: vec3u) {
    let header = &queueHeaders[id.x];
    let count = atomicLoad(&header.count);
    header.dispatch.x = (count - 1) / 64 + 1;
}