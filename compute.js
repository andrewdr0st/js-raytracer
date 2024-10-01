let adapter;
let device;

let raytracePipeline;
let npPipeline;
let denoisePipeline;

let computeContext;
let normalsTexture;
let positionsTexture;

let uniformLayout;
let raytraceTextureLayout;
let npTextureLayout;
let denoiseTextureLayout;
let objectsLayout;
let materialsLayout;

const workgroupX = 64;

const triangleSize = 16;
const vertexSize = 16;
const sphereSize = 32;

async function loadWGSLShader(f) {
    let response = await fetch("shaders/" + f);
    return await response.text();
}

async function setupGPUDevice(canvas) {
    adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        alert('need a browser that supports WebGPU');
        return false;
    }

    let raytaceCode = await loadWGSLShader("raytrace.wgsl");

    const raytraceModule = device.createShaderModule({
        label: "Raytrace module",
        code: raytaceCode
    });

    uniformLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }
            }
        ]
    });

    raytraceTextureLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba8unorm" }
            }
        ]
    });

    npTextureLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba16float" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba16float" }
            }
        ]
    });

    denoiseTextureLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba8unorm" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba8unorm" }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba16float" }
            }, {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba16float" }
            }
        ]
    });

    objectsLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    materialsLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    const raytracePipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            uniformLayout,
            raytraceTextureLayout,
            objectsLayout,
            materialsLayout
        ]
    });

    raytracePipeline = device.createComputePipeline({
        label: "raytrace pipeline",
        layout: raytracePipelineLayout,
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

    normalsTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "rgba16float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
    });

    positionsTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "rgba16float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
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
        layout: uniformLayout,
        entries: [
            { binding: 0, resource: { buffer: cameraBuffer } }
        ]
    });

    let texture = computeContext.getCurrentTexture();

    const textureBindGroup = device.createBindGroup({
        layout: raytraceTextureLayout,
        entries: [
            { binding: 0, resource: texture.createView() }
        ]
    });

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

    const objectsBindGroup = device.createBindGroup({
        label: "triangles bind group",
        layout: objectsLayout,
        entries: [
            { binding: 0, resource: { buffer: triangleBuffer } },
            { binding: 1, resource: { buffer: trianglePointBuffer } },
            { binding: 2, resource: { buffer: spheresBuffer } }
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

    const materialsBindGroup = device.createBindGroup({
        label: "materials bind group",
        layout: materialsLayout,
        entries: [
            { binding: 0, resource: { buffer : materialBuffer } }
        ]
    });

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(raytracePipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, textureBindGroup);
    pass.setBindGroup(2, objectsBindGroup);
    pass.setBindGroup(3, materialsBindGroup);
    pass.dispatchWorkgroups(Math.ceil(camera.imgW / workgroupX), camera.imgH);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    return true;
}   
