
struct parameters {
    cphi: f32,
    nphi: f32,
    pphi: f32,
    kernel: array<f32, 25>
}

@group(0) @binding(0) var otex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var rtex: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(2) var ntex: texture_storage_2d<rgba16float, read>;
@group(0) @binding(3) var ptex: texture_storage_2d<rgba16float, read>;
@group(1) @binding(0) var<uniform> params: parameters;

@compute @workgroup_size(64, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(otex).x) {
        return;
    }

    var sum = vec4f(0.0);
    let step = vec2f(1.0 / f32(textureDimensions(otex).x), 1.0 / f32(textureDimensions(otex).y));
    let cval = textureLoad(rtex, id.xy);
    let nval = textureLoad(ntex, id.xy);
    let pval = textureLoad(ptex, id.xy);
    var cumulative = 0.0;
    
    textureStore(otex, id.xy, vec4f(rval));
    //textureStore(otex, id.xy, vec4f(r * n * p));
    //textureStore(otex, id.xy, vec4f(1.0, 1.0, 0, 1));
}

