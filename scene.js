import { device } from "./gpuManager.js";
import { cameraBuffer } from "./camera.js";

export let sceneBindGroupLayout;
export let sceneBindGroup;
let vertexBuffer;
let triangleBuffer;
let bvhBuffer;
let objectInfoBuffer;
let objectTransformBuffer;

export class Scene {
    constructor() {
        this.camera;
        this.materialList = [];
        this.meshList = [];
        this.objectList = [];
        this.objectCount = 0;
    }

    async setup(w, h) {
        this.setupCamera(w, h);
        this.setupMaterials();
        await this.loadMeshes();
        this.setupObjects();
        this.createBuffers();
    }

    setupCamera(w, h) {
        
    }

    async loadMeshes() {

    }

    setupObjects() {

    }

    setupMaterials() {

    }

    addObject(meshId, matId) {
        this.objectList.push(new SceneObject(this.meshList[meshId], matId));
        this.objectCount++;
    }

    createBindGroup() {
        sceneBindGroup = device.createBindGroup({
            label: "scene bind group",
            layout: sceneBindGroupLayout,
            entries: [
                {binding: 0, resource: {buffer: cameraBuffer}},
                {binding: 1, resource: {buffer: vertexBuffer}},
                {binding: 2, resource: {buffer: triangleBuffer}},
                {binding: 3, resource: {buffer: bvhBuffer}},
                {binding: 4, resource: {buffer: objectInfoBuffer}},
                {binding: 5, resource: {buffer: objectTransformBuffer}}
            ]
        });
    }

    createBuffers() {
        this.createVertexBuffer();
        this.createTriangleBuffer();
        this.createBvhBuffer();
        this.createObjectInfoBuffer();
        this.createObjectTransformBuffer();
    }

    createVertexBuffer() {
        vertexBuffer = device.createBuffer({
            label: "vetex buffer",
            size: this.meshList[0].vertexData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(vertexBuffer, 0, this.meshList[0].vertexData);
    }

    createTriangleBuffer() {
        triangleBuffer = device.createBuffer({
            label: "triangle buffer",
            size: this.meshList[0].triangleData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(triangleBuffer, 0, this.meshList[0].triangleData);
    }

    createBvhBuffer() {
        bvhBuffer = device.createBuffer({
            label: "bvh buffer",
            size: this.meshList[0].bvhData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(bvhBuffer, 0, this.meshList[0].bvhData);
    }

    createObjectInfoBuffer() {
        objectInfoBuffer = device.createBuffer({
            label: "object info buffer",
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
    }

    createObjectTransformBuffer() {
            objectTransformBuffer = device.createBuffer({
            label: "object transform buffer",
            size: 128,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
    }
}

export function createSceneBindGroupLayout() {
    sceneBindGroupLayout = device.createBindGroupLayout({
        label: "scene layout",
        entries: [
            {   //camera
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }
            }, {//vertices
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {//triangles
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {//bvh
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {//object info
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }, {//object transform
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });
}
