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
let outputPipeline;

let megaKernelPipeline;

let finalTexture;
let accumulationBuffer;
let accumulationBufferSize;

let raytraceTextureLayout;
let queueLayout;

let raytraceTextureBindGroup;
let queueBindGroup;

let headerBuffer;
let dispatchBuffer;

const RUN_MEGA_KERNEL = false;

const QUEUE_HEADER_BYTE_SIZE = 32;
const QUEUE_COUNT = 3;
const bufferMax = 1024 * 1024 * 128;
const ACCUMULATION_SIZE = 16;


export async function setupGPUData(scene) {
    createBindGroupLayouts();
    setupBindGroups(scene);
    await createPipelines();
}

function setupBindGroups(scene) {
    createRaytraceTextureBindGroup();
    createCameraBuffer();
    scene.createBindGroup();
    createTexturesBindGroup();
    createQueueBindGroup();
}

export function renderGPU(scene) {
    let camera = scene.camera;
    camera.writeToBuffer();
    resetQueues();

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });

    if (RUN_MEGA_KERNEL) {
        megaKernelPipeline.run(encoder, Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));
    } else {
        spawnPipeline.run(encoder, Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));

        dispatchPipeline.run(encoder, 3);
        encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

        intersectPipeline.runIndirect(encoder, dispatchBuffer, 0);

        dispatchPipeline.run(encoder, 3);
        encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

        shadePipeline.runIndirect(encoder, dispatchBuffer, QUEUE_HEADER_BYTE_SIZE);

        for (let i = 0; i < 3; i++) {
            runBouncePass(encoder);
        }

        dispatchPipeline.run(encoder, 3);
        encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

        shadowPipeline.runIndirect(encoder, dispatchBuffer, QUEUE_HEADER_BYTE_SIZE * 2);

        outputPipeline.run(encoder, Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));
    }

    const canvasTexture = computeContext.getCurrentTexture();
    encoder.copyTextureToTexture({texture: finalTexture}, {texture: canvasTexture}, [camera.imgW, camera.imgH]);
    
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}

function runBouncePass(encoder) {
    dispatchPipeline.run(encoder, 3);
    encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

    shadowPipeline.runIndirect(encoder, dispatchBuffer, QUEUE_HEADER_BYTE_SIZE * 2);
    intersectPipeline.runIndirect(encoder, dispatchBuffer, 0);

    dispatchPipeline.run(encoder, 3);
    encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

    shadePipeline.runIndirect(encoder, dispatchBuffer, QUEUE_HEADER_BYTE_SIZE);
}

function createBindGroupLayouts() {
    raytraceTextureLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { format: "rgba8unorm" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage" }
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
    outputPipeline = new Pipeline("textureoutput.wgsl", wavefrontLayout, wavefrontBindGroups);

    const pipelinePromises = [spawnPipeline.build(), intersectPipeline.build(), shadePipeline.build(), shadowPipeline.build(), dispatchPipeline.build(), outputPipeline.build()];
    await Promise.all(pipelinePromises);

    if (RUN_MEGA_KERNEL) {
        megaKernelPipeline = new Pipeline("megakernel.wgsl", wavefrontLayout, wavefrontBindGroups);
        await megaKernelPipeline.build();
    }
}

function createRaytraceTextureBindGroup() {
    finalTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
    });

    accumulationBufferSize = ACCUMULATION_SIZE * canvas.width * canvas.height
    accumulationBuffer = device.createBuffer({
        label: "accumulation buffer",
        size: accumulationBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    clearAccumulationBuffer();

    raytraceTextureBindGroup = device.createBindGroup({
        label: "ray trace texture bind group",
        layout: raytraceTextureLayout,
        entries: [
            { binding: 0, resource: finalTexture.createView() },
            { binding: 1, resource: { buffer: accumulationBuffer } }
        ]
    });
}

export function clearAccumulationBuffer() {
    device.queue.writeBuffer(accumulationBuffer, 0, new Uint8Array(accumulationBufferSize));
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
    });
}

function resetQueues() {
    device.queue.writeBuffer(headerBuffer, 0, new Uint32Array([1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0]));
}
