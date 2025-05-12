struct cameraData {
    pos: vec3f,
    raysPerPixel: u32,
    topLeftPixel: vec3f,
    bounceCount: u32,
    pixelDeltaU: vec3f,
    antiAliasing: u32,
    pixelDeltaV: vec3f,
    backgroundColor: vec3f,
    defocusU: vec3f,
    defocusV: vec3f
};

@group(0) @binding(0) var<uniform> camera: cameraData;
@group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;


@compute @workgroup_size(8, 8, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
    if (id.x > textureDimensions(tex).x || id.y > textureDimensions(tex).y) {
        return;
    }

    let radius = 0.35;
    let center = vec3f(0.5, 0.5, 0.5);
    let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
    let dir = normalize(pCenter - camera.pos);
    var col = vec3f(0.5, 0.75, 0.95);
    
    let tplane = hitPlane(vec3f(0, 1, 0), vec3f(0, 1, 0), pCenter, dir);

    if (tplane > 0.1) {
        let pplane = pCenter + dir * tplane;
        var orig = vec3f(fract(pplane.x), 1, fract(pplane.z));
        for (var i: u32 = 0; i < 64; i++) {
            let root = hitSphere(center, radius, orig, dir, 0.001, 1000);
            if (root < 1000 && root > 0.001) {
                let point = dir * root + orig;
                let normal = (point - center) / radius;
                let diffuse = max(0.05, dot(normal, vec3f(0, 1, 0)));
                col = vec3f(0.95, 0.35, 0.25) * diffuse;
                break;
            }
            orig = nextStep(orig, dir);
        }
    }
    
    textureStore(tex, id.xy, vec4f(col, 1));
}

fn nextStep(orig: vec3f, dir: vec3f) -> vec3f {
    let t = step(vec3f(0, 0, 0), dir);
    let p = step(dir, vec3f(0, 0, 0));
    let n = t - orig;
    let d = n / dir;
    let m = min(min(d.x, d.y), d.z) * dir;
    var o = orig + m;
    if (d.x < d.y) {
        if (d.x < d.z) {
            o.x = p.x;
        } else {
            o.z = p.z;
        }
    } else if (d.y < d.z) {
        o.y = p.y;
    } else {
        o.z = p.z;
    }
    return o;
}

fn hitSphere(center: vec3f, r: f32, orig: vec3f, dir: vec3f, tMin: f32, tMax: f32) -> f32 {
    let oc = center - orig;
    let a = dot(dir, dir);
    let h = dot(dir, oc);
    let c = dot(oc, oc) - r * r;
    let d = h * h - a * c;
    let sqrtd = sqrt(d);
    var root = (h - sqrtd) / a;
    if (root <= tMin || root >= tMax) {
        root = (h + sqrtd) / a;
        if (root <= tMin || root >= tMax) {
            return -1.0;
        }
    }
    return root;
}

fn hitPlane(n: vec3f, p: vec3f, orig: vec3f, dir: vec3f) -> f32 {
    let denominator = dot(n, dir);
    if (abs(denominator) < 0.00001) {
        return -1.0;
    }
    let numerator = dot(-n, orig - p);
    return numerator / denominator;
}

