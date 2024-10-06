let adapter;
let device;

let raytracePipeline;
let npPipeline;
let denoisePipeline;

let computeContext;
let raytraceTexture;
let prevTexture;
let normalsTexture;
let positionsTexture;

let uniformLayout;
let raytraceTextureLayout;
let npTextureLayout;
let denoiseTextureLayout;
let denoiseNpLayout;
let objectsLayout;
let materialsLayout;
let denoiseParamsLayout;

const workgroupX = 64;

const triangleSize = 16;
const vertexSize = 16;
const sphereSize = 32;

const runDenoiser = false;
const denoisePassCount = 3;

async function loadWGSLShader(f) {
    let response = await fetch("shaders/" + f);
    return await response.text();
}

async function setupGPUDevice(canvas, static=false) {
    adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        alert('need a browser that supports WebGPU');
        return false;
    }

    createBindGroupLayouts(static);

    await createPipelines(static);

    computeContext = canvas.getContext("webgpu");
    computeContext.configure({
        device,
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
    });

    createRenderTextures(static);

    return true;
}

async function renderGPU(scene, static=false) {
    let camera = scene.camera;
    let materialList = scene.materialList;
    let meshList = scene.meshList;
    let sphereList = scene.sphereList;

    let finalTexture = computeContext.getCurrentTexture();

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

    if (static) {
        device.queue.writeBuffer(cameraBuffer, 44, new Int32Array([camera.seed]));
        device.queue.writeBuffer(cameraBuffer, 60, new Int32Array([camera.frameCount]));
    }

    const uniformBindGroup = device.createBindGroup({
        layout: uniformLayout,
        entries: [
            { binding: 0, resource: { buffer: cameraBuffer } }
        ]
    });

    let raytraceTextureBindGroup;
    if (static) {
        raytraceTextureBindGroup = device.createBindGroup({
            layout: raytraceTextureLayout,
            entries: [
                { binding: 0, resource: runDenoiser ? raytraceTexture.createView() : finalTexture.createView() },
                { binding: 0, resource: prevTexture.createView() }
            ]
        });
    } else {
        raytraceTextureBindGroup = device.createBindGroup({
            layout: raytraceTextureLayout,
            entries: [
                { binding: 0, resource: runDenoiser ? raytraceTexture.createView() : finalTexture.createView() }
            ]
        });
    }

    const npTextureBindGroup = device.createBindGroup({
        layout: npTextureLayout,
        entries: [
            { binding: 0, resource: normalsTexture.createView() },
            { binding: 1, resource: positionsTexture.createView() }
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

    let cphi = 10.0;
    let nphi = 0.2;
    let pphi = 10.0;
    let stepw = 1.0;
    let params = [
        1/256, 1/64, 3/128, 1/64, 1/256,
        1/64 , 1/16, 3/32 , 1/16, 1/64,
        3/128, 3/32, 9/64 , 3/32, 3/128,
        1/64 , 1/16, 3/32 , 1/16, 1/64,
        1/256, 1/64, 3/128, 1/64, 1/256,
        cphi, nphi, pphi,
        -2, -2, -1, -2, 0, -2, 1, -2, 2, -2,
        -2, -1, -1, -1, 0, -1, 1, -1, 2, -1,
        -2, 0 , -1, 0 , 0,  0,  1, 0,  2, 0,
        -2, 1 , -1, 1 , 0,  1,  1, 1,  2, 1,
        -2, 2 , -1, 2 , 0,  2,  1, 2,  2, 2,
        stepw, 0
    ];
    let paramsF = new Float32Array(params);

    const denoiseParamsBuffer = device.createBuffer({
        label: "denoise params buffer",
        size: paramsF.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(denoiseParamsBuffer, 0, paramsF);

    const denoiseParamsBindGroup = device.createBindGroup({
        label: "denoise params bind group",
        layout: denoiseParamsLayout,
        entries: [
            { binding: 0, resource: { buffer : denoiseParamsBuffer } }
        ]
    });

    const textureBindGroup = device.createBindGroup({
        layout: denoiseTextureLayout,
        entries: [
            { binding: 0, resource: finalTexture.createView() },
            { binding: 1, resource: raytraceTexture.createView() }
        ]
    });

    const denoiseNpBindGroup = device.createBindGroup({
        layout: denoiseNpLayout,
        entries: [
            { binding: 0, resource: normalsTexture.createView() },
            { binding: 1, resource: positionsTexture.createView() }
        ]
    });

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(raytracePipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, raytraceTextureBindGroup);
    pass.setBindGroup(2, objectsBindGroup);
    pass.setBindGroup(3, materialsBindGroup);
    pass.dispatchWorkgroups(Math.ceil(camera.imgW / workgroupX), camera.imgH);

    pass.end();

    if (runDenoiser) {
        const npPass = encoder.beginComputePass({ label: "np pass" });
        npPass.setPipeline(npPipeline);
        npPass.setBindGroup(0, uniformBindGroup);
        npPass.setBindGroup(1, npTextureBindGroup);
        npPass.setBindGroup(2, objectsBindGroup);
        npPass.dispatchWorkgroups(Math.ceil(camera.imgW / workgroupX), camera.imgH);
        npPass.end();

        for (let i = 0; i < denoisePassCount; i++) {
            const dpass = encoder.beginComputePass({ label: "denoise pass "});
            dpass.setPipeline(denoisePipeline);
            dpass.setBindGroup(0, textureBindGroup);
            dpass.setBindGroup(1, denoiseNpBindGroup);
            dpass.setBindGroup(2, denoiseParamsBindGroup);
            dpass.dispatchWorkgroups(Math.ceil(camera.imgW / workgroupX), camera.imgH);
            dpass.end();

            if (i + 1 < denoisePassCount) {
                encoder.copyTextureToTexture({texture: finalTexture}, {texture: raytraceTexture}, {width: camera.imgW, height: camera.imgH});
                stepw++;
                device.queue.writeBuffer(denoiseParamsBuffer, 78 * 4, new Float32Array([stepw]));
            }
        }
    }

    if (static) {
        encoder.copyTextureToTexture({texture: raytraceTexture}, {texture: prevTexture}, {width: camera.imgW, height: camera.imgH});
    }

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    return true;
}


function createBindGroupLayouts(static) {
    uniformLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }
            }
        ]
    });

    if (static) {
        raytraceTextureLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: { format: "rgba8unorm" }
                }, {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: { format: "rgba8unorm" }
                }
            ]
        });
    } else {
        raytraceTextureLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: { format: "rgba8unorm" }
                }
            ]
        });
    }

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
                storageTexture: { format: "rgba8unorm", access: "read-only" }
            }
        ]
    });

    denoiseNpLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba16float", access: "read-only" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba16float", access: "read-only" }
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

    denoiseParamsLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });
}

async function createPipelines(static) {
    let raytaceCode = static ? await loadWGSLShader("raytracestatic.wgsl") : await loadWGSLShader("raytrace.wgsl");
    const raytraceModule = device.createShaderModule({
        label: "Raytrace module",
        code: raytaceCode
    });

    let npCode = await loadWGSLShader("normalspositions.wgsl");
    const npModule = device.createShaderModule({
        label: "normals positions module",
        code: npCode
    });

    let denoiseCode = await loadWGSLShader("denoise.wgsl");
    const denoiseModule = device.createShaderModule({
        label: "denoise module",
        code: denoiseCode
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

    const npPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            uniformLayout,
            npTextureLayout,
            objectsLayout,
        ]
    });

    npPipeline = device.createComputePipeline({
        label: "normals and positions pipeline",
        layout: npPipelineLayout,
        compute: {
            module: npModule
        }
    });

    const denoisePipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            denoiseTextureLayout,
            denoiseNpLayout,
            denoiseParamsLayout
        ]
    });

    denoisePipeline = device.createComputePipeline({
        label: "denoise pipeline",
        layout: denoisePipelineLayout,
        compute: {
            module: denoiseModule
        }
    });
}

function createRenderTextures(static) {
    raytraceTexture = device.createTexture({
        size: {width: canvas.width, height: canvas.height},
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
    });

    if (static) {
        prevTexture = device.createTexture({
            size: {width: canvas.width, height: canvas.height},
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
        });
    }

    normalsTexture = device.createTexture({
        size: {width: canvas.width, height: canvas.height},
        format: "rgba16float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
    });

    positionsTexture = device.createTexture({
        size: {width: canvas.width, height: canvas.height},
        format: "rgba16float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
    });
}