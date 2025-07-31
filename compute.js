import { device, computeContext } from "./gpuManager.js";
import { Pipeline } from "./pipeline.js";
import { sceneBindGroupLayout, sceneBindGroup, createSceneBindGroupLayout } from "./scene.js";
import { createCameraBuffer } from "./camera.js";
import { texturesBindGroupLayout, texturesBindGroup, createTexturesBindGroup, createTexturesBindGroupLayout } from "./structures/Texture.js";

let spawnPipeline;
let intersectPipeline;
let shadePipeline;
let shadowPipeline;
let dispatchPipeline;

let prevTexture;
let finalTexture;

let raytraceTextureLayout;
let queueLayout;

let raytraceTextureBindGroup;
let queueBindGroup;

let headerBuffer;
let dispatchBuffer;

const QUEUE_HEADER_BYTE_SIZE = 16;
const QUEUE_COUNT = 3;
const bufferMax = 1024 * 1024 * 128;


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
}

export async function renderGPU(scene, staticRender=false) {
    let camera = scene.camera;
    camera.writeToBuffer();
    resetQueues();

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
    if (staticRender) {
        prevTexture = device.createTexture({
            size: {width: canvas.width, height: canvas.height},
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
        });
    }

    finalTexture = computeContext.getCurrentTexture();
}

function createRaytraceTextureBindGroup(staticRender) {
    if (staticRender) {
        raytraceTextureBindGroup = device.createBindGroup({
            label: "ray trace texture bind group",
            layout: raytraceTextureLayout,
            entries: [
                { binding: 0, resource: finalTexture.createView() },
                { binding: 1, resource: prevTexture.createView() }
            ]
        });
    } else {
        raytraceTextureBindGroup = device.createBindGroup({
            label: "ray trace texture bind group",
            layout: raytraceTextureLayout,
            entries: [
                { binding: 0, resource: finalTexture.createView() }
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

function resetQueues() {
    device.queue.writeBuffer(headerBuffer, 0, new Uint32Array([1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0]));
}
