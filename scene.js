import { device } from "./gpuManager.js";
import { cameraBuffer } from "./camera.js";

export let sceneBindGroupLayout;
export let sceneBindGroup;
let vertexBuffer;
let triangleBuffer;
let bvhBuffer;

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
        this.createVertexBuffer();
        this.createTriangleBuffer();
        this.createBvhBuffer();
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
                {binding: 3, resource: {buffer: bvhBuffer}}
            ]
        });
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
            }
        ]
    });
}
