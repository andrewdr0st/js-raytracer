import { device, computeContext } from "./gpuManager.js";
import { Pipeline } from "./pipeline.js";
import { sceneBindGroupLayout, sceneBindGroup, createSceneBindGroupLayout } from "./scene.js";
import { createCameraBuffer } from "./camera.js";

let raytracePipeline;
let npPipeline;
let denoisePipeline;
let transformPipeline;
let infPipeline;

let spawnPipeline;
let intersectPipeline;
let shadePipeline;
let dispatchPipeline;

let raytraceTexture;
let prevTexture;
let normalsTexture;
let positionsTexture;
let finalTexture;

let textureArray8;
let texList8;
let textureArray16;
let texList16;

let raytraceTextureLayout;
let npTextureLayout;
let denoiseTextureLayout;
let denoiseNpLayout;
let materialsLayout;
let denoiseParamsLayout;
let transformLayout;
let queueLayout;

let raytraceTextureBindGroup;
let materialsBindGroup;
let npTextureBindGroup;
let denoiseParamsBindGroup;
let finalTextureBindGroup;
let denoiseNpBindGroup;
let transformBindGroup;
let queueBindGroup;

let denoiseParamsBuffer;
let headerBuffer;
let dispatchBuffer;

const objectSize = 160;
const objectInfoSize = 48;
const bvhNodeSize = 32;
const materialSize = 48;
const raySize = 32;
const hitRecordSize = 48;
const queueHeaderSize = 16;
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
    //createObjectsBindGroup(scene);
    //createMaterialsBindGroup(scene.materialList);
    createCameraBuffer();
    scene.createBindGroup();
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

    dispatchPipeline.run(encoder, 2);
    encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

    intersectPipeline.runIndirect(encoder, dispatchBuffer, 0);

    dispatchPipeline.run(encoder, 2);
    encoder.copyBufferToBuffer(headerBuffer, 0, dispatchBuffer, 0);

    shadePipeline.runIndirect(encoder, dispatchBuffer, queueHeaderSize);

    /*
    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(raytracePipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, raytraceTextureBindGroup);
    pass.setBindGroup(2, objectsBindGroup);
    pass.setBindGroup(3, materialsBindGroup);
    pass.dispatchWorkgroups(Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));

    pass.end();

    if (runDenoiser) {
        stepw = 1.0;
        const npPass = encoder.beginComputePass({ label: "np pass" });
        npPass.setPipeline(npPipeline);
        npPass.setBindGroup(0, uniformBindGroup);
        npPass.setBindGroup(1, npTextureBindGroup);
        npPass.setBindGroup(2, objectsBindGroup);
        npPass.dispatchWorkgroups(Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));
        npPass.end();

        for (let i = 0; i < denoisePassCount; i++) {
            const dpass = encoder.beginComputePass({ label: "denoise pass "});
            dpass.setPipeline(denoisePipeline);
            dpass.setBindGroup(0, finalTextureBindGroup);
            dpass.setBindGroup(1, denoiseNpBindGroup);
            dpass.setBindGroup(2, denoiseParamsBindGroup);
            dpass.dispatchWorkgroups(Math.ceil(camera.imgW / 8), Math.ceil(camera.imgH / 8));
            dpass.end();

            if (i + 1 < denoisePassCount) {
                encoder.copyTextureToTexture({texture: finalTexture}, {texture: raytraceTexture}, {width: camera.imgW, height: camera.imgH});
                stepw *= 2;
                device.queue.writeBuffer(denoiseParamsBuffer, 78 * 4, new Float32Array([stepw]));
            }
        }
    }
    */
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

    materialsLayout = device.createBindGroupLayout({
        label: "materials bind group layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                texture: {format: "rgba8unorm", viewDimension: "2d-array"}
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                texture: {format: "rgba8unorm", viewDimension: "2d-array"}
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
            }
        ]
    });

    createSceneBindGroupLayout();
}

async function createPipelines() {
    const wavefrontLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            sceneBindGroupLayout,
            raytraceTextureLayout,
            queueLayout
        ]
    });
    const wavefrontBindGroups = [sceneBindGroup, raytraceTextureBindGroup, queueBindGroup, null];

    spawnPipeline = new Pipeline("spawnrays-wf.wgsl", wavefrontLayout, wavefrontBindGroups);
    intersectPipeline = new Pipeline("intersect-wf.wgsl", wavefrontLayout, wavefrontBindGroups);
    shadePipeline = new Pipeline("shade-wf.wgsl", wavefrontLayout, wavefrontBindGroups);
    dispatchPipeline = new Pipeline("queuedispatch-wf.wgsl", wavefrontLayout, wavefrontBindGroups);

    const pipelinePromises = [spawnPipeline.build(), intersectPipeline.build(), shadePipeline.build(), dispatchPipeline.build()];
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

function createObjectsBindGroup(scene) {
    let meshList = scene.meshList;
    let sphereList = scene.sphereList;
    let objectList = scene.objectList;
    let objectCount = scene.objectCount;

    const spheresBuffer = device.createBuffer({
        label: "spheres buffer",
        size: sphereList.length * sphereSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let i = 0; i < sphereList.length; i++) {
        let s = sphereList[i];
        device.queue.writeBuffer(spheresBuffer, i * sphereSize, new Float32Array(s.getValues()));
        device.queue.writeBuffer(spheresBuffer, i * sphereSize + 16, new Int32Array(s.getM()));
    }

    let triOffset = 0;
    let vOffset = 0;
    let uvOffset = 0;
    let nOffset = 0;
    let oOffset = 0;
    let bOffset = 0;

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

    const triangleUvBuffer = device.createBuffer({
        label: "triangle uv buffer",
        size: (tcOffset + 1) * uvSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let i = 0; i < meshList.length; i++) {
        let m = meshList[i];
        device.queue.writeBuffer(triangleUvBuffer, uvOffset, m.getUvs());
        uvOffset += m.tcCount * uvSize;
    }

    const triangleNormalsBuffer = device.createBuffer({
        label: "triangle normals buffer",
        size: (vnormalOffset + 1) * normalsSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let i = 0; i < meshList.length; i++) {
        let m = meshList[i];
        device.queue.writeBuffer(triangleNormalsBuffer, nOffset, m.getNormals());
        nOffset += m.nCount * normalsSize;
    }

    const objectsBuffer = device.createBuffer({
        label: "objects buffer",
        size: objectCount * objectSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });

    const objectsInfoBuffer = device.createBuffer({
        label: "objects info buffer",
        size: objectCount * objectInfoSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let i = 0; i < objectCount; i++) {
        let o = objectList[i];
        device.queue.writeBuffer(objectsInfoBuffer, oOffset, o.getTranslate());
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 12, o.getRootNode());
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 16, o.getScale());
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 28, o.getMaterial());
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 32, o.getRotate());
        oOffset += objectInfoSize;
    }

    const bvhNodeBuffer = device.createBuffer({
        label: "bvh node buffer",
        size: bvhOffset * bvhNodeSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    for (let j = 0; j < meshList.length; j++) {
        let m = meshList[j];
        for (let i = 0; i < m.bvhList.length; i++) {
            let b = m.bvhList[i];
            device.queue.writeBuffer(bvhNodeBuffer, bOffset, new Float32Array(b.a));
            device.queue.writeBuffer(bvhNodeBuffer, bOffset + 12, new Uint32Array([b.triCount]));
            device.queue.writeBuffer(bvhNodeBuffer, bOffset + 16, new Float32Array(b.b));
            device.queue.writeBuffer(bvhNodeBuffer, bOffset + 28, new Uint32Array([b.index]));
            bOffset += bvhNodeSize;
        }
    }

    objectsBindGroup = device.createBindGroup({
        label: "objects bind group",
        layout: objectsLayout,
        entries: [
            { binding: 0, resource: { buffer: triangleBuffer } },
            { binding: 1, resource: { buffer: trianglePointBuffer } },
            { binding: 2, resource: { buffer: triangleUvBuffer } },
            { binding: 3, resource: { buffer: triangleNormalsBuffer } },
            { binding: 4, resource: { buffer: objectsBuffer } },
            { binding: 5, resource: { buffer: bvhNodeBuffer } },
            { binding: 6, resource: { buffer: spheresBuffer } }
        ]
    });

    transformBindGroup = device.createBindGroup({
        label: "transform bind group",
        layout: transformLayout,
        entries: [
            { binding: 0, resource: { buffer: bvhNodeBuffer } },
            { binding: 1, resource: { buffer: objectsBuffer } },
            { binding: 2, resource: { buffer: objectsInfoBuffer } }
        ]
    });
}

function createMaterialsBindGroup(materialList) {
    textureArray8 = device.createTexture({
        size: [8, 8, texList8.length],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });
    for (let i = 0; i < texList8.length; i++) {
        device.queue.copyExternalImageToTexture({source: texList8[i]}, {texture: textureArray8, origin: {z: i}}, [8, 8]);
    }

    textureArray16 = device.createTexture({
        size: [16, 16, texList16.length],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });
    for (let i = 0; i < texList16.length; i++) {
        device.queue.copyExternalImageToTexture({source: texList16[i]}, {texture: textureArray16, origin: {z: i}}, [16, 16]);
    }

    let materials = [];
    for (let i = 0; i < materialList.length; i++) {
        materials = materials.concat(materialList[i].getValues());
    }
    materials = new Float32Array(materials);

    const materialBuffer = device.createBuffer({
        label: "materials buffer",
        size: materialList.length * materialSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(materialBuffer, 0, materials);

    for(let i = 0; i < materialList.length; i++) {
        let t = materialList[i].getTex();
        device.queue.writeBuffer(materialBuffer, (i + 1) * materialSize - 16, t);
    }

    materialsBindGroup = device.createBindGroup({
        label: "materials bind group",
        layout: materialsLayout,
        entries: [
            { binding: 0, resource: { buffer : materialBuffer } },
            { binding: 1, resource: textureArray8.createView() },
            { binding: 2, resource: textureArray16.createView() }
        ]
    });
}

function createQueueBindGroup() {
    dispatchBuffer = device.createBuffer({
        label: "dispatch buffer",
        size: queueHeaderSize * 2,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
    });

    headerBuffer = device.createBuffer({
        label: "header buffer",
        size: queueHeaderSize * 2,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(headerBuffer, 0, new Uint32Array([1, 1, 1, 0, 1, 1, 1, 0]));

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

    queueBindGroup = device.createBindGroup({
        label: "queue bind group",
        layout: queueLayout,
        entries: [
            { binding: 0, resource: { buffer: headerBuffer } },
            { binding: 1, resource: { buffer: rayBuffer } },
            { binding: 2, resource: { buffer: hitBuffer } }
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
