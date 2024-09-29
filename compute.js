let adapter;
let device;
let raytraceModule;
let pipeline;
let computeContext;

const workgroupX = 64;

const triangleSize = 16;
const vertexSize = 16;
const sphereSize = 32;

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
                raysPerPixel: u32,
                topLeftPixel: vec3f,
                bounceCount: u32,
                pixelDeltaU: vec3f, 
                pixelDeltaV: vec3f,
                backgroundColor: vec3f
            };

            struct material {
                c: vec3f,
                e: f32,
                reflectChance: f32,
                fuzzFactor: f32,
                refractChance: f32,
                ri: f32
            };

            struct sphere {
                pos: vec3f,
                radius: f32,
                m: u32
            };

            struct triangle {
                points: vec3u,
                m: u32
            };

            struct hitRec {
                p: vec3f,
                t: f32,
                n: vec3f,
                h: bool,
                d: vec3f,
                frontFace: bool,
                m: material
            };

            @group(0) @binding(0) var<uniform> camera: cameraData;
            @group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
            @group(2) @binding(0) var<storage, read> spheres: array<sphere>;
            @group(2) @binding(1) var<storage, read> materials: array<material>;
            @group(3) @binding(0) var<storage, read> triangles: array<triangle>;
            @group(3) @binding(1) var<storage, read> triPoints: array<vec3f>;

            @compute @workgroup_size(${workgroupX}, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
                if (id.x > textureDimensions(tex).x) {
                    return;
                }
                
                let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
                var rngState = ((id.x * 2167) ^ (id.y * 31802381)) + u32((camera.pos.x + 17.93258) * 123457 - (camera.pos.y - 93.11646) * 157141 - (camera.pos.z + 572.0248) * 403831);
                

                var totalColor = vec3f(0, 0, 0);

                let sphereCount = arrayLength(&spheres);
                let triCount = arrayLength(&triangles);

                let bounceCount: u32 = camera.bounceCount;
                let rayCount: u32 = camera.raysPerPixel;

                for (var a: u32 = 0; a < rayCount; a++) {
                    var backgroundColor = camera.backgroundColor;
                    var rayColor = vec3f(1, 1, 1);
                    var incomingLight = vec3f(0, 0, 0);

                    var tMin: f32 = 0.0001;
                    var tMax: f32 = 10000.0;

                    var hr: hitRec;
                    hr.p = camera.pos;
                    hr.d = pCenter - camera.pos;

                    for (var b: u32 = 0; b < bounceCount; b++) {
                        tMin = 0.001;
                        tMax = 10000.0;
                        var ray = hr.d;
                        var orig = hr.p;
                        hr.h = false;
                        hr.m.c = backgroundColor;
                        hr.m.e = 1;

                        for (var i: u32 = 0; i < sphereCount; i++) {
                            let s = spheres[i];
                            let center: vec3f = s.pos;
                            let radius: f32 = s.radius;

                            let root = hitSphere(center, radius, orig, ray, tMin, tMax);

                            if (root >= 0 && root < tMax && root > tMin) {
                                tMax = root;
                                hr.t = root;
                                hr.p = ray * root + orig;
                                hr.n = (hr.p - center) / radius;
                                hr.frontFace = dot(ray, hr.n) < 0;
                                if (!hr.frontFace) {
                                    hr.n = -hr.n;
                                }
                                hr.h = true;
                                hr.m = materials[s.m];
                            }
                        }

                        for (var i: u32 = 0; i < triCount; i++) {
                            let tri = triangles[i];
                            let a = triPoints[tri.points.x];
                            let b = triPoints[tri.points.y];
                            let c = triPoints[tri.points.z];
                            var thr = hitTriangle(a, b, c, orig, ray, tMax);

                            if (thr.h && thr.t > tMin && thr.t < tMax) {
                                tMax = thr.t;
                                hr.t = thr.t;
                                hr.n = thr.n;
                                hr.h = thr.h;
                                hr.p = ray * hr.t + orig;
                                hr.m = materials[tri.m];
                            }
                        }
                        
                        let emitLight = hr.m.c * hr.m.e;
                        incomingLight += emitLight * rayColor;
                        rayColor *= hr.m.c;

                        let matRand = randomF(&rngState);
                        if (matRand < hr.m.refractChance) {
                            ray = normalize(ray);
                            let cosTheta = dot(ray, -hr.n);
                            var ri = hr.m.ri;
                            if (hr.frontFace) {
                                ri = 1.0 / ri;
                            }
                            let r = refract(ray, hr.n, 1.0 / hr.m.ri);
                            if (all(r == vec3f(0.0)) || schlick(cosTheta, ri) > randomF(&rngState)) {
                                hr.d = reflect(ray, hr.n);
                            } else {
                                hr.d = r;
                            }
                        } else if (matRand < hr.m.reflectChance) {
                            hr.d = reflect(ray, hr.n);
                            if (hr.m.fuzzFactor > 0) {
                                hr.d += randomDir(&rngState) * hr.m.fuzzFactor;
                            }
                        } else {
                            hr.d = hr.n + randomDir(&rngState);
                        }
                        
                        if (tMax > 9999) {
                            break;
                        }
                    }

                    totalColor += incomingLight;
                }

                totalColor /= f32(rayCount);

                totalColor = max(totalColor, vec3f(0, 0, 0));
                totalColor = sqrt(totalColor);

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

            fn hitTriangle(a: vec3f, b: vec3f, c: vec3f, orig: vec3f, dir: vec3f, tMax: f32) -> hitRec {
                var hr: hitRec;
                hr.h = false;
                let n = normalize(cross(b - a, c - a));
                hr.n = n;
                let t = hitPlane(n, a, orig, dir);
                if (t < 0 || t >= tMax) {
                    return hr;
                }
                hr.t = t;
                let p = orig + t * dir;
                let na = cross(c - b, p - b);
                let nb = cross(a - c, p - c);
                let nc = cross(b - a, p - a);
                hr.h = dot(n, na) >= 0 && dot(n, nb) >= 0 && dot(n, nc) >= 0;
                return hr;
            }

            fn schlick(c: f32, ri: f32) -> f32 {
                var r0 = (1 - ri) / (1 + ri);
                r0 = r0 * r0;
                return r0 + (1 - r0) * pow((1 - c), 5);
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

async function renderGPU(scene) {
    let camera = scene.camera;
    let materialList = scene.materialList;
    let meshList = scene.meshList;
    let sphereList = scene.sphereList;

    const cameraBuffer = device.createBuffer({
        label: "camera uniform buffer",
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(cameraBuffer, 0, new Float32Array(camera.pos));
    device.queue.writeBuffer(cameraBuffer, 12, new Int32Array([camera.raysPerPixel]));
    device.queue.writeBuffer(cameraBuffer, 16, new Float32Array(camera.topLeftPixel));
    device.queue.writeBuffer(cameraBuffer, 28, new Int32Array([camera.bounceCount]));
    device.queue.writeBuffer(cameraBuffer, 32, new Float32Array(camera.pixelDeltaU));
    device.queue.writeBuffer(cameraBuffer, 48, new Float32Array(camera.pixelDeltaV));
    device.queue.writeBuffer(cameraBuffer, 64, new Float32Array(camera.backgroundColor));

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

    let materials = [];
    for (let i = 0; i < materialList.length; i++) {
        materials = materials.concat(materialList[i].getValues());
    }
    materials = new Float32Array(materials);

    const materialBuffer = device.createBuffer({
        label: "materials buffer",
        size: materials.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(materialBuffer, 0, materials);

    const spheresBuffer = device.createBuffer({
        label: "spheres buffer",
        size: sphereList.length * sphereSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let i = 0; i < sphereList.length; i++) {
        let s = sphereList[i];
        device.queue.writeBuffer(spheresBuffer, i * sphereSize, new Float32Array(s.getValues()));
        device.queue.writeBuffer(spheresBuffer, i * sphereSize + 16, new Uint32Array(s.getM()));
    }

    const spheresBindGroup = device.createBindGroup({
        label: "sphere bind group",
        layout: pipeline.getBindGroupLayout(2),
        entries: [
            { binding: 0, resource: { buffer: spheresBuffer } },
            { binding: 1, resource: { buffer: materialBuffer } }
        ]
    });

    let triOffset = 0;
    let vOffset = 0;

    const triangleBuffer = device.createBuffer({
        label: "triangle buffer",
        size: totalTris * triangleSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let i = 0; i < meshList.length; i++) {
        let m = meshList[i];
        device.queue.writeBuffer(triangleBuffer, triOffset, m.getTriangles());
        triOffset += m.tCount * triangleSize;
    }    

    const trianglePointBuffer = device.createBuffer({
        label: "triangle point buffer",
        size: (vertexOffset + 1) * vertexSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let i = 0; i < meshList.length; i++) {
        let m = meshList[i];
        device.queue.writeBuffer(trianglePointBuffer, vOffset, m.getVerticies());
        vOffset += m.vCount * vertexSize;
    }

    const trianglesBindGroup = device.createBindGroup({
        label: "triangles bind group",
        layout: pipeline.getBindGroupLayout(3),
        entries: [
            { binding: 0, resource: { buffer: triangleBuffer } },
            { binding: 1, resource: { buffer: trianglePointBuffer} }
        ]
    });


    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, textureBindGroup);
    pass.setBindGroup(2, spheresBindGroup);
    pass.setBindGroup(3, trianglesBindGroup);
    pass.dispatchWorkgroups(Math.ceil(camera.imgW / workgroupX), camera.imgH);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    return true;
}   
