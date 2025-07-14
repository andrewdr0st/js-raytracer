struct ray {
    pos: vec3f,
    pixelIndex: u32,
    dir: vec3f,
    bounceCount: u32
};

@group(1) @binding(0) var<storage, write> rayQueue: array<ray>;

@compute @workgroup_size(8, 8, 1) fn intersect(@builtin(global_invocation_id) id: vec3u) {

}