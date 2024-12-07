
struct parameters {
    kernel: array<f32, 25>,
    cphi: f32,
    nphi: f32,
    pphi: f32,
    offset: array<vec2f, 25>,
    stepwidth: f32
}

@group(0) @binding(0) var otex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var rtex: texture_storage_2d<rgba8unorm, read>;
@group(1) @binding(0) var ntex: texture_storage_2d<rgba16float, read>;
@group(1) @binding(1) var ptex: texture_storage_2d<rgba16float, read>;
@group(2) @binding(0) var<storage, read> params: parameters;

@compute @workgroup_size(8, 8, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(otex).x || id.y > textureDimensions(otex).y) {
        return;
    }

    var sum = vec4f(0.0);
    let cval = textureLoad(rtex, id.xy);
    let nval = textureLoad(ntex, id.xy);
    let pval = textureLoad(ptex, id.xy);
    var cumulative = 0.0;
    var t: vec4f;
    var dist2: f32;

    for (var i = 0; i < 25; i++) {
        let uv = min(id.xy + vec2u(params.offset[i] * params.stepwidth), textureDimensions(otex) - vec2u(1, 1));

        let ctmp = textureLoad(rtex, uv);
        t = cval - ctmp;
        dist2 = dot(t, t);
        let cw = min(exp(-dist2 / params.cphi), 1.0);

        let ntmp = textureLoad(ntex, uv);
        t = nval - ntmp;
        dist2 = max(dot(t, t) / (params.stepwidth * params.stepwidth), 0.0);
        let nw = min(exp(-dist2 / params.nphi), 1.0);

        let ptmp = textureLoad(ptex, uv);
        t = pval - ptmp;
        dist2 = dot(t, t);
        let pw = min(exp(-dist2 / params.pphi), 1.0);

        let weight = cw * nw * pw;
        sum += ctmp * weight * params.kernel[i];
        cumulative += weight * params.kernel[i];
    }
    
    //textureStore(otex, id.xy, pval);
    //textureStore(otex, id.xy, nval);
    textureStore(otex, id.xy, sum / cumulative);
}

