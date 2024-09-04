let adapter;
let device;
let raytraceModule;
let pipeline;

async function setupGPUDevice() {
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
                imgDim: vec2<u32>,
                pos: vec3<f32>,
                lookAt: vec3<f32>,
                topLeftPixel: vec3<f32>,
                pixelDeltaU: vec3<f32>, 
                pixelDeltaV: vec3<f32>
            };

            @group(0) @binding(0) var<uniform> sphere: vec4<f32>;
            @group(0) @binding(1) var<uniform> camera: cameraData;
            @group(1) @binding(0) var<storage, read_write> colors: array<f32>;

            @compute @workgroup_size(1, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3<u32>) {
                let pCenter = camera.topLeftPixel + camera.pixelDeltaU * f32(id.x) + camera.pixelDeltaV * f32(id.y);
                let ray = pCenter - camera.pos;

                let center: vec3<f32> = sphere.xyz;
                let radius: f32 = sphere.w;
                let offset: u32 = (id.x + id.y * camera.imgDim.x) * 3;

                let oc: vec3<f32> = center - camera.pos;
                let a: f32 = dot(ray, ray);
                let b: f32 = -2.0 * dot(ray, oc);
                let c: f32 = dot(oc, oc) - radius * radius;
                let discriminant: f32 = b * b - 4 * a * c;

                let col: vec3<f32> = select(vec3<f32>(0, 0, 0), vec3<f32>(1, 1, 1), discriminant >= 0);

                colors[offset + 0] = col.r;
                colors[offset + 1] = col.g;
                colors[offset + 2] = col.b;
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

    return true;
}

async function renderGPU(camera) {

    const sphereBuffer = device.createBuffer({
        label: "sphere uniform buffer",
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(sphereBuffer, 0, new Float32Array([0, 0, -1, 0.5]));

    const cameraBuffer = device.createBuffer({
        label: "camera uniform buffer",
        size: 96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(cameraBuffer, 0, new Uint32Array([camera.imgW, camera.imgH]));
    device.queue.writeBuffer(cameraBuffer, 16, new Float32Array(camera.pos));
    device.queue.writeBuffer(cameraBuffer, 32, new Float32Array(camera.pos));
    device.queue.writeBuffer(cameraBuffer, 48, new Float32Array(camera.topLeftPixel));
    device.queue.writeBuffer(cameraBuffer, 64, new Float32Array(camera.pixelDeltaU));
    device.queue.writeBuffer(cameraBuffer, 80, new Float32Array(camera.pixelDeltaV));

    colorsList = new Float32Array(camera.imgW * camera.imgH * 3);

    const colorsBuffer = device.createBuffer({
        label: "colors buffer",
        size: colorsList.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(colorsBuffer, 0, colorsList);

    const colorsReadBuffer = device.createBuffer({
        label: "colors read buffer",
        size: colorsList.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST 
    });

    const uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: sphereBuffer } },
            { binding: 1, resource: { buffer: cameraBuffer } }
        ]
    });

    const colorsBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: { buffer: colorsBuffer } }
        ]
    });

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, colorsBindGroup);
    pass.dispatchWorkgroups(camera.imgW, camera.imgH);
    pass.end();

    encoder.copyBufferToBuffer(colorsBuffer, 0, colorsReadBuffer, 0, colorsList.byteLength);

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    await colorsReadBuffer.mapAsync(GPUMapMode.READ);

    let imgColors = new Float32Array(colorsReadBuffer.getMappedRange());

    return imgColors;
}   
