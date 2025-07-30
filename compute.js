import { device, computeContext } from "./gpuManager.js";
import { Pipeline } from "./pipeline.js";
import { sceneBindGroupLayout, sceneBindGroup, createSceneBindGroupLayout } from "./scene.js";
import { createCameraBuffer } from "./camera.js";
import { texturesBindGroupLayout, texturesBindGroup, createTexturesBindGroup, createTexturesBindGroupLayout } from "./structures/Texture.js";

let raytracePipeline;
let npPipeline;
let denoisePipeline;
let transformPipeline;
let infPipeline;

let spawnPipeline;
let intersectPipeline;
let shadePipeline;
let shadowPipeline;
let dispatchPipeline;

let raytraceTexture;
let prevTexture;
let normalsTexture;
let positionsTexture;
let finalTexture;

let raytraceTextureLayout;
let npTextureLayout;
let denoiseTextureLayout;
let denoiseNpLayout;
let denoiseParamsLayout;
let transformLayout;
let queueLayout;

let raytraceTextureBindGroup;
let npTextureBindGroup;
let denoiseParamsBindGroup;
let finalTextureBindGroup;
let denoiseNpBindGroup;
let transformBindGroup;
let queueBindGroup;

let denoiseParamsBuffer;
let headerBuffer;
let dispatchBuffer;

const QUEUE_HEADER_BYTE_SIZE = 16;
const QUEUE_COUNT = 3;
const bufferMax = 1024 * 1024 * 128;

const runDenoiser = false;
const denoisePassCount = 2;
let stepw = 1.0;

export async function setupGPUData(scene, staticRender=false) {
    createRenderTextures(staticRender);
    createBindGroupLayouts(staticRender);
    setupBindGroups(scene);
    await createPipelines();
}

function setupBindGroups(scene) {
    createRaytraceTextureBindGroup(!scene.camera.realtimeMode);
    createCameraBuffer();
    scene.createBindGroup();
    createTexturesBindGroup();
    createQueueBindGroup();
    if (runDenoiser) {
        createDenoiseBindGroups();
    }
}

export async function renderGPU(scene, staticRender=false) {
    let camera = scene.camera;
    camera.writeToBuffer();

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });

    /*
    const pass = encoder.beginComputePass({label: "inf pass"});
    pass.setPipeline(infPipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, raytraceTextureBindGroup);
    //pass.dispatchWorkgroups(Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));
    pass.dispatchWorkgroups(camera.gridStepX, camera.gridStepY);
    pass.end();
    */

    spawnPipeline.run(encoder, Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));

    dispatchPipeline.run(encoder, 3);
    encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

    intersectPipeline.runIndirect(encoder, dispatchBuffer, 0);

    dispatchPipeline.run(encoder, 3);
    encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

    shadePipeline.runIndirect(encoder, dispatchBuffer, QUEUE_HEADER_BYTE_SIZE);

    dispatchPipeline.run(encoder, 3);
    encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

    shadowPipeline.runIndirect(encoder, dispatchBuffer, QUEUE_HEADER_BYTE_SIZE * 2);

    if (staticRender) {
        encoder.copyTextureToTexture({texture: finalTexture}, {texture: prevTexture}, {width: camera.imgW, height: camera.imgH});
    }
    
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    return true;
}

async function calculateTransforms(scene) {
    const encoder = device.createCommandEncoder({ label: "transform encoder" });

    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(transformPipeline);
    pass.setBindGroup(0, transformBindGroup);
    pass.dispatchWorkgroups(scene.objectCount);

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}

function createBindGroupLayouts(staticRender) {
    if (staticRender) {
        raytraceTextureLayout = device.createBindGroupLayout({
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
        label: "np bind group layout",
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

    denoiseParamsLayout = device.createBindGroupLayout({
        label: "denoise params layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    transformLayout = device.createBindGroupLayout({
        label: "transform bind group layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    queueLayout = device.createBindGroupLayout({
        label: "queue bind group layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            }, {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            }
        ]
    });

    createSceneBindGroupLayout();
    createTexturesBindGroupLayout();
}

async function createPipelines() {
    const wavefrontLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            sceneBindGroupLayout,
            raytraceTextureLayout,
            queueLayout,
            texturesBindGroupLayout
        ]
    });
    const wavefrontBindGroups = [sceneBindGroup, raytraceTextureBindGroup, queueBindGroup, texturesBindGroup];

    spawnPipeline = new Pipeline("spawnrays-wf.wgsl", wavefrontLayout, wavefrontBindGroups);
    intersectPipeline = new Pipeline("intersect-wf.wgsl", wavefrontLayout, wavefrontBindGroups);
    shadePipeline = new Pipeline("shade-wf.wgsl", wavefrontLayout, wavefrontBindGroups);
    shadowPipeline = new Pipeline("shadow-wf.wgsl", wavefrontLayout, wavefrontBindGroups);
    dispatchPipeline = new Pipeline("queuedispatch-wf.wgsl", wavefrontLayout, wavefrontBindGroups);

    const pipelinePromises = [spawnPipeline.build(), intersectPipeline.build(), shadePipeline.build(), shadowPipeline.build(), dispatchPipeline.build()];
    await Promise.all(pipelinePromises);
}

function createRenderTextures(staticRender) {
    raytraceTexture = device.createTexture({
        size: {width: canvas.width, height: canvas.height},
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
    });

    if (staticRender) {
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

    finalTexture = computeContext.getCurrentTexture();
}

function createRaytraceTextureBindGroup(staticRender) {
    if (staticRender) {
        raytraceTextureBindGroup = device.createBindGroup({
            label: "ray trace texture bind group",
            layout: raytraceTextureLayout,
            entries: [
                { binding: 0, resource: runDenoiser ? raytraceTexture.createView() : finalTexture.createView() },
                { binding: 1, resource: prevTexture.createView() }
            ]
        });
    } else {
        raytraceTextureBindGroup = device.createBindGroup({
            label: "ray trace texture bind group",
            layout: raytraceTextureLayout,
            entries: [
                { binding: 0, resource: runDenoiser ? raytraceTexture.createView() : finalTexture.createView() }
            ]
        });
    }
}

function createQueueBindGroup() {
    dispatchBuffer = device.createBuffer({
        label: "dispatch buffer",
        size: QUEUE_HEADER_BYTE_SIZE * QUEUE_COUNT,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
    });

    headerBuffer = device.createBuffer({
        label: "header buffer",
        size: QUEUE_HEADER_BYTE_SIZE * QUEUE_COUNT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(headerBuffer, 0, new Uint32Array([1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0]));

    const rayBuffer = device.createBuffer({
        label: "ray queue buffer",
        size: bufferMax,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    const hitBuffer = device.createBuffer({
        label: "hit queue buffer",
        size: bufferMax,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    const shadowBuffer = device.createBuffer({
        label: "shadow ray buffer",
        size: bufferMax,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });

    queueBindGroup = device.createBindGroup({
        label: "queue bind group",
        layout: queueLayout,
        entries: [
            { binding: 0, resource: { buffer: headerBuffer } },
            { binding: 1, resource: { buffer: rayBuffer } },
            { binding: 2, resource: { buffer: hitBuffer } },
            { binding: 3, resource: { buffer: shadowBuffer } }
        ]
    })
}

function createDenoiseBindGroups() {
    npTextureBindGroup = device.createBindGroup({
        layout: npTextureLayout,
        entries: [
            { binding: 0, resource: normalsTexture.createView() },
            { binding: 1, resource: positionsTexture.createView() }
        ]
    });

    let cphi = 10.0;
    let nphi = 0.2;
    let pphi = 10.0;
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

    denoiseParamsBuffer = device.createBuffer({
        label: "denoise params buffer",
        size: paramsF.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(denoiseParamsBuffer, 0, paramsF);

    denoiseParamsBindGroup = device.createBindGroup({
        label: "denoise params bind group",
        layout: denoiseParamsLayout,
        entries: [
            { binding: 0, resource: { buffer : denoiseParamsBuffer } }
        ]
    });

    finalTextureBindGroup = device.createBindGroup({
        layout: denoiseTextureLayout,
        entries: [
            { binding: 0, resource: finalTexture.createView() },
            { binding: 1, resource: raytraceTexture.createView() }
        ]
    });

    denoiseNpBindGroup = device.createBindGroup({
        layout: denoiseNpLayout,
        entries: [
            { binding: 0, resource: normalsTexture.createView() },
            { binding: 1, resource: positionsTexture.createView() }
        ]
    });
}
