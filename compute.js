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
            @group(0) @binding(0) var<uniform> sphere: vec4<f32>;
            @group(0) @binding(1) var<uniform> camera: vec3<f32>;
            @group(0) @binding(2) var<uniform> dimensions: vec2<u32>;
            @group(1) @binding(0) var<storage, read_write> rays: array<f32>;
            @group(2) @binding(0) var<storage, read_write> colors: array<f32>;

            @compute @workgroup_size(1, 1, 1) fn rayColor(@builtin(global_invocation_id) id: vec3<u32>) {
                let center: vec3<f32> = sphere.xyz;
                let radius: f32 = sphere.w;
                let rOffset: u32 = (id.x + id.y * dimensions.x) * 3;
                let ray: vec3<f32> = vec3<f32>(rays[rOffset], rays[rOffset + 1], rays[rOffset + 2]);

                let oc: vec3<f32> = center - camera;
                let a: f32 = dot(ray, ray);
                let b: f32 = -2.0 * dot(ray, oc);
                let c: f32 = dot(oc, oc) - radius * radius;
                let discriminant: f32 = b * b - 4 * a * c;

                let col: vec3<f32> = select(vec3<f32>(0, 0, 0), vec3<f32>(1, 1, 1), discriminant >= 0);

                colors[rOffset + 0] = col.r;
                colors[rOffset + 1] = col.g;
                colors[rOffset + 2] = col.b;
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
        size: 12,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(cameraBuffer, 0, new Float32Array(camera.pos));

    const dimensionsBuffer = device.createBuffer({
        label: "dimensions unifom buffer",
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(dimensionsBuffer, 0, new Uint32Array([camera.imgW, camera.imgH]));

    let raysList = [];
    for (let y = 0; y < camera.imgH; y++) {
        for (let x = 0; x < camera.imgW; x++) {
            let pCenter = vadd(camera.topLeftPixel, vadd(vscalar(camera.pixelDeltaU, x), vscalar(camera.pixelDeltaV, y)));
            let rayDir = vsub(pCenter, camera.pos);
            let r = new Ray(camera.pos, rayDir);
            raysList.push(r.dir[0]);
            raysList.push(r.dir[1]);
            raysList.push(r.dir[2]);
        }
    }

    raysList = new Float32Array(raysList);

    const raysBuffer = device.createBuffer({
        label: "rays buffer",
        size: raysList.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(raysBuffer, 0, raysList);

    colorsList = new Float32Array(raysList.length);

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
            { binding: 1, resource: { buffer: cameraBuffer } },
            { binding: 2, resource: { buffer: dimensionsBuffer } }
        ]
    });

    const raysBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: { buffer: raysBuffer} }
        ]
    });

    const colorsBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(2),
        entries: [
            { binding: 0, resource: { buffer: colorsBuffer } }
        ]
    });

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, raysBindGroup);
    pass.setBindGroup(2, colorsBindGroup);
    console.log(camera.imgW, camera.imgH);
    pass.dispatchWorkgroups(camera.imgW, camera.imgH);
    pass.end();

    encoder.copyBufferToBuffer(colorsBuffer, 0, colorsReadBuffer, 0, colorsList.byteLength);

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    await colorsReadBuffer.mapAsync(GPUMapMode.READ);

    let imgColors = new Float32Array(colorsReadBuffer.getMappedRange());

    return imgColors;
}   
