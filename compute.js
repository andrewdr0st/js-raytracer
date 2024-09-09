let adapter;
let device;
let raytraceModule;
let pipeline;
let computeContext;

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
                pos: vec3<f32>,
                topLeftPixel: vec3<f32>,
                pixelDeltaU: vec3<f32>, 
                pixelDeltaV: vec3<f32>
            };

            @group(0) @binding(0) var<uniform> camera: cameraData;
            @group(1) @binding(0) var tex: texture_storage_2d<rgba8unorm, write>;
            @group(2) @binding(0) var<storage, read> spheres: array<vec4<f32>>;

            @compute @workgroup_size(1, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3<u32>) {
                let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
                let ray = pCenter - camera.pos;
                var col: vec4<f32> = vec4<f32>(0, 0, 0, 1);
                let sphereCount = arrayLength(&spheres);
                var closestHit: f32 = 10000.0;

                for (var i: u32 = 0; i < sphereCount; i += 2) {
                    let sphere = spheres[i];
                    let center: vec3<f32> = sphere.xyz;
                    let radius: f32 = sphere.w;

                    let discriminant = hitSphere(center, radius, camera.pos, ray);

                    col = select(col, spheres[i + 1], discriminant < closestHit);
                    closestHit = min(closestHit, discriminant);
                }

                textureStore(tex, id.xy, col);
            }

            fn hitSphere(center: vec3f, r: f32, orig: vec3f, dir: vec3f) -> f32 {
                let oc = center - orig;
                let a = dot(dir, dir);
                let h = dot(dir, oc);
                let c = dot(oc, oc) - r * r;
                let d = h * h - a * c;

                return select((h - sqrt(d)) / a, -1.0, d >= 0);
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

async function renderGPU(camera) {
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

    let spheres = new Float32Array([0, 0, -1, 0.5, 1, 1, 1, 1, -2, 0.5, -4, 0.75, 0.25, 0.25, 1, 1]);

    const spheresBuffer = device.createBuffer({
        label: "spheres buffer",
        size: spheres.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(spheresBuffer, 0, spheres);

    const spheresBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(2),
        entries: [
            { binding: 0, resource: {buffer: spheresBuffer } }
        ]
    });

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, textureBindGroup);
    pass.setBindGroup(2, spheresBindGroup);
    pass.dispatchWorkgroups(camera.imgW, camera.imgH);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    return true;
}   
