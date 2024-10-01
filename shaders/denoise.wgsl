
@group(0) @binding(0) var otex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var rtex: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(2) var ntex: texture_storage_2d<rgba16float, read>;
@group(0) @binding(3) var ptex: texture_storage_2d<rgba16float, read>;

@compute @workgroup_size(64, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(ntex).x) {
        return;
    }

    let r = textureLoad(rtex, id.xy);
    let n = textureLoad(ntex, id.xy);
    let p = textureLoad(ptex, id.xy);
    
    textureStore(otex, id.xy, vec4f(r));
    //textureStore(otex, id.xy, vec4f(r * n * p));
    //textureStore(otex, id.xy, vec4f(1.0, 1.0, 0, 1));
}

