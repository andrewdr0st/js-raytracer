let adapter;
let device;
let raytraceModule;
let pipeline;
let computeContext;

const workgroupX = 64;

async function setupGPUDevice(canvas) {
    adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        fail('need a browser that supports WebGPU');
        return false;
    }

    raytraceModule = device.createShaderModule({
        label: "Raytrace module",
        code: `
            struct cameraData {
                pos: vec3f,
                topLeftPixel: vec3f,
                pixelDeltaU: vec3f, 
                pixelDeltaV: vec3f
            };

            struct sphere {
                pos: vec3f,
                radius: f32,
                col: vec3f,
                emission: f32
            };

            struct triangle {
                a: vec3f,
                b: vec3f,
                c: vec3f,
                col: vec4f
            };

            struct hitRec {
                p: vec3f,
                t: f32,
                n: vec3f,
                h: bool,
                c: vec3f,
                e: f32
            };

            @group(0) @binding(0) var<uniform> camera: cameraData;
            @group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
            @group(2) @binding(0) var<storage, read> spheres: array<sphere>;
            @group(2) @binding(1) var<storage, read> triangles: array<triangle>;

            @compute @workgroup_size(${workgroupX}, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
                if (id.x > textureDimensions(tex).x) {
                    return;
                }

                var rngState = id.x * 2167 + id.y * 31802381;
                let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);

                var totalColor = vec3f(0, 0, 0);

                let sphereCount = arrayLength(&spheres);
                let triCount = arrayLength(&triangles);

                let bounceCount: u32 = 8;
                let rayCount: u32 = 32;

                for (var a: u32 = 0; a < rayCount; a++) {
                    var backgroundColor = vec3f(0.3, 0.2, 0.4);
                    var rayColor = vec3f(1, 1, 1);
                    var incomingLight = vec3f(0, 0, 0);

                    var tMin: f32 = 0.0001;
                    var tMax: f32 = 10000.0;

                    var hr: hitRec;
                    hr.p = camera.pos;
                    hr.n = pCenter - camera.pos;

                    for (var b: u32 = 0; b < bounceCount; b++) {
                        tMin = 0.0001;
                        tMax = 10000.0;
                        var ray = hr.n;
                        var orig = hr.p;
                        hr.h = false;
                        hr.c = backgroundColor;
                        hr.e = 1;

                        for (var i: u32 = 0; i < sphereCount; i++) {
                            let s = spheres[i];
                            let center: vec3f = s.pos;
                            let radius: f32 = s.radius;

                            let root = hitSphere(center, radius, orig, ray, tMin, tMax);

                            if (root >= 0 && root < tMax) {
                                tMax = root;
                                hr.t = root;
                                hr.p = ray * root + camera.pos;
                                hr.n = (hr.p - center) / radius;
                                hr.h = true;
                                hr.c = s.col;
                                hr.e = s.emission;
                            }
                        }
                        
                        let emitLight = hr.c * hr.e;
                        incomingLight += emitLight * rayColor;
                        rayColor *= hr.c;

                        hr.n += randomDir(&rngState);
                        
                        if (tMax > 9999) {
                            break;
                        }
                    }

                    totalColor += incomingLight;
                }

                totalColor /= f32(rayCount);

                /*
                for (var i: u32 = 0; i < triCount; i++) {
                    let tri = triangles[i];
                    let hr = hitTriangle(tri, camera.pos, ray, tMax);
                    if (hr.h) {
                        col = tri.col.xyz;
                        tMax = hr.t;
                    }
                }
                */

                textureStore(tex, id.xy, vec4f(totalColor, 1));
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
                    return -1;
                }
                let numerator = dot(-n, orig - p);
                return numerator / denominator;
            }

            fn hitTriangle(tri: triangle, orig: vec3f, dir: vec3f, tMax: f32) -> hitRec {
                var hr: hitRec;
                hr.h = false;
                let n = normalize(cross(tri.b - tri.a, tri.c - tri.a));
                let t = hitPlane(n, tri.a, orig, dir);
                if (t < 0 || t >= tMax) {
                    return hr;
                }
                hr.t = t;
                let p = orig + t * dir;
                let na = cross(tri.c - tri.b, p - tri.b);
                let nb = cross(tri.a - tri.c, p - tri.c);
                let nc = cross(tri.b - tri.a, p - tri.a);
                hr.h = dot(n, na) >= 0 && dot(n, nb) >= 0 && dot(n, nc) >= 0;
                return hr;
            }

            fn randomF(state: ptr<function, u32>) -> f32 {
                let s = (*state) * 747796405 + 2891336453;
                *state = s;
                var result = ((s >> ((s >> 28) + 4)) ^ s) * 277803737;
                result = (result >> 22) ^ result;
                return f32(result) / 4294967295.0;
            }

            fn randomDir(state: ptr<function, u32>) -> vec3f {
                let theta = randomF(state) * 3.14159;
                let z = randomF(state) * 2 - 1.0;
                let x = sqrt(1 - z * z) * cos(theta);
                let y = sqrt(1 - z * z) * sin(theta);
                return vec3f(x, y, z);
            }
        `
    });

    pipeline = device.createComputePipeline({
        label: "raytrace pipeline",
        layout: "auto",
        compute: {
            module: raytraceModule
        }
    });

    computeContext = canvas.getContext("webgpu");
    computeContext.configure({
        device,
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    });

    return true;
}

async function renderGPU(camera, sphereList, triangleList) {
    const cameraBuffer = device.createBuffer({
        label: "camera uniform buffer",
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(cameraBuffer, 0, new Float32Array(camera.pos));
    device.queue.writeBuffer(cameraBuffer, 16, new Float32Array(camera.topLeftPixel));
    device.queue.writeBuffer(cameraBuffer, 32, new Float32Array(camera.pixelDeltaU));
    device.queue.writeBuffer(cameraBuffer, 48, new Float32Array(camera.pixelDeltaV));

    const uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: cameraBuffer } }
        ]
    });

    let texture = computeContext.getCurrentTexture();

    const textureBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: texture.createView() }
        ]
    });

    let spheres = [];
    for (let i = 0; i < sphereList.length; i++) {
        spheres = spheres.concat(sphereList[i].getValues());
    }
    spheres = new Float32Array(spheres);

    const spheresBuffer = device.createBuffer({
        label: "spheres buffer",
        size: spheres.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(spheresBuffer, 0, spheres);

    let triangles = [];
    for (let i = 0; i < triangleList.length; i++) {
        triangles = triangles.concat(triangleList[i].getValues());
    }
    triangles = new Float32Array(triangles);

    const triangleBuffer = device.createBuffer({
        label: "triangle buffer",
        size: triangles.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(triangleBuffer, 0, triangles);

    const objectsBindGroup = device.createBindGroup({
        label: "objects bind group",
        layout: pipeline.getBindGroupLayout(2),
        entries: [
            { binding: 0, resource: { buffer: spheresBuffer } },
            { binding: 1, resource: { buffer: triangleBuffer} }
        ]
    });

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, textureBindGroup);
    pass.setBindGroup(2, objectsBindGroup);
    pass.dispatchWorkgroups(Math.ceil(camera.imgW / workgroupX), camera.imgH);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    return true;
}   
