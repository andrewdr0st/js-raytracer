let adapter;
let device;

let raytracePipeline;
let npPipeline;
let denoisePipeline;
let transformPipeline;

let computeContext;
let raytraceTexture;
let prevTexture;
let normalsTexture;
let positionsTexture;
let finalTexture;

let textureArray8;
let texList8;
let textureArray16;
let texList16;

let uniformLayout;
let raytraceTextureLayout;
let npTextureLayout;
let denoiseTextureLayout;
let denoiseNpLayout;
let objectsLayout;
let materialsLayout;
let denoiseParamsLayout;
let transformLayout;

let raytraceTextureBindGroup;
let objectsBindGroup;
let materialsBindGroup;
let npTextureBindGroup;
let denoiseParamsBindGroup;
let finalTextureBindGroup;
let denoiseNpBindGroup;
let transformBindGroup;

let denoiseParamsBuffer;

const triangleSize = 48;
const vertexSize = 16;
const uvSize = 8;
const normalsSize = 16;
const objectSize = 172;
const objectInfoSize = 64;
const sphereSize = 32;
const materialSize = 48;

const runDenoiser = false;
const denoisePassCount = 3;
let stepw = 1.0;

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

    let t1 = await loadImage("red8x8.png");
    let t2 = await loadImage("blurple8x8.png");
    let t3 = await loadImage("checker8x8.png");
    texList8 = [t1, t2, t3];

    let t4 = await loadImage("brick16x16.png");
    let t5 = await loadImage("planks16x16.png");
    texList16 = [t4, t5];

    return true;
}

function setupBindGroups(scene) {
    createRaytraceTextureBindGroup(!scene.camera.realtimeMode);
    createObjectsBindGroup(scene);
    createMaterialsBindGroup(scene.materialList);
    if (runDenoiser) {
        createDenoiseBindGroups();
    }
}

async function renderGPU(scene, static=false) {
    let camera = scene.camera;

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

    const encoder = device.createCommandEncoder({ label: "raytrace encoder" });

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

async function calculateTransforms() {
    const encoder = device.createCommandEncoder({ label: "transform encoder" });

    const pass = encoder.beginComputePass({ label: "raytrace pass" });

    pass.setPipeline(transformPipeline);
    pass.setBindGroup(0, transformBindGroup);
    pass.dispatchWorkgroups(4);

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
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

    objectsLayout = device.createBindGroupLayout({
        label: "objects bind group layout",
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
            }, {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
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
                buffer: { type: "read-only-storage" }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            }, {
                binding: 3,
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

    let transformCode = await loadWGSLShader("transform.wgsl");
    const transformModule = device.createShaderModule({
        label: "transform module",
        code: transformCode
    })

    const raytracePipelineLayout = device.createPipelineLayout({
        label: "raytrace pipeline layout",
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
        label: "np pipeline layout",
        bindGroupLayouts: [
            uniformLayout,
            npTextureLayout,
            objectsLayout
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
        label: "denoise pipeline layout",
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

    const transformPipelineLayout = device.createPipelineLayout({
        label: "transform pipeline layout",
        bindGroupLayouts: [
            transformLayout
        ]
    });

    transformPipeline = device.createComputePipeline({
        label: "transform pipeline",
        layout: transformPipelineLayout,
        compute: {
            module: transformModule
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

    finalTexture = computeContext.getCurrentTexture();
}

function createRaytraceTextureBindGroup(static) {
    if (static) {
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
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 12, new Int32Array([o.tStart]));
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 16, o.getScale());
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 28, new Int32Array([o.tEnd]));
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 32, o.getRotate());
        console.log(o.getMaterial());
        device.queue.writeBuffer(objectsInfoBuffer, oOffset + 48, o.getMaterial());
        oOffset += objectInfoSize;
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
            { binding: 5, resource: { buffer: spheresBuffer } }
        ]
    });

    transformBindGroup = device.createBindGroup({
        label: "transform bind group",
        layout: transformLayout,
        entries: [
            { binding: 0, resource: { buffer: triangleBuffer } },
            { binding: 1, resource: { buffer: trianglePointBuffer } },
            { binding: 2, resource: { buffer: objectsBuffer } },
            { binding: 3, resource: { buffer: objectsInfoBuffer } }
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
        device.queue.writeBuffer(materialBuffer, (i + 1) * materialSize - 20, t);
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
