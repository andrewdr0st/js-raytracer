import { device } from "./gpuManager.js";
import { cameraBuffer } from "./camera.js";
import { SceneObject, OBJECT_INFO_BYTE_SIZE } from "./structures/sceneObject.js";
import { TLASNode } from "./bvh.js";
import { MATERIAL_BYTE_SIZE } from "./structures/material.js";
const { vec3 } = wgpuMatrix;

export let sceneBindGroupLayout;
export let sceneBindGroup;
let vertexBuffer;
let triangleBuffer;
let bvhBuffer;
let objectInfoBuffer;
let materialsBuffer;
let sceneBuffer;

const SCENE_BUFFER_BYTE_SIZE = 16;
const TLAS_NODE_FIELD_COUNT = 8;
const MAX_OBJECT_COUNT = 64;

export class Scene {
    constructor() {
        this.camera;
        this.materialList = [];
        this.meshList = [];
        this.vertexSize = 0;
        this.triangleSize = 0;
        this.bvhSize = 0;
        this.objectList = [];
        this.objectCount = 0;
        this.sunDirection = new Float32Array([0, 1, 0]);
    }

    async setup(w, h) {
        this.setupCamera(w, h);
        await this.loadMeshes();
        await this.loadTextures();
        this.setupMaterials();
        this.setupObjects();
        this.buildTLAS();
        this.createBuffers();
    }

    setupCamera(w, h) {
        
    }

    async loadMeshes() {

    }

    async loadTextures() {

    }

    update(deltaTime) {
        device.queue.writeBuffer(sceneBuffer, 0, this.sunDirection);
    }

    /**
     * Set up the object in the scene. Must call super.setupObjects() at end of function.
     */
    setupObjects() {
        let bOffset = this.objectCount * 2 - 1;
        for (let i = 0; i < this.meshList.length; i++) {
            let m = this.meshList[i];
            m.offsetBVH(bOffset);
            bOffset += m.bvhSize;
        }
        for (let i = 0; i < this.objectCount; i++) {
            this.objectList[i].writeInfo();
            this.objectList[i].setTransform();
        }
    }

    setupMaterials() {

    }

    /**
     * Creates a new scene object, adds it to the scene, and returns the created object
     * @param {Number} meshId 
     * @param {Number} matId 
     * @param {texId} texId
     * @returns {SceneObject}
     */
    addObject(meshId, matId, texId) {
        let obj = new SceneObject(this.meshList[meshId], matId, texId);
        this.objectList.push(obj);
        this.objectCount++;
        return obj;
    }

    addMesh(mesh) {
        this.meshList.push(mesh);
        this.vertexSize += mesh.vertexData.byteLength;
        this.triangleSize += mesh.triangleData.byteLength;
        this.bvhSize += mesh.bvhData.byteLength;
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
                {binding: 5, resource: {buffer: materialsBuffer}},
                {binding: 6, resource: {buffer: sceneBuffer}}
            ]
        });
    }

    createBuffers() {
        this.createVertexBuffer();
        this.createTriangleBuffer();
        this.createBvhBuffer();
        this.writeMeshBuffers();
        this.createObjectInfoBuffer();
        this.createMaterialsBuffer();
        this.createSceneBuffer();
    }

    createSceneBuffer() {
        sceneBuffer = device.createBuffer({
            label: "scene buffer",
            size: SCENE_BUFFER_BYTE_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(sceneBuffer, 0, this.sunDirection);
    }

    createVertexBuffer() {
        vertexBuffer = device.createBuffer({
            label: "vetex buffer",
            size: this.vertexSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
    }

    createTriangleBuffer() {
        triangleBuffer = device.createBuffer({
            label: "triangle buffer",
            size: this.triangleSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
    }

    createBvhBuffer() {
        bvhBuffer = device.createBuffer({
            label: "bvh buffer",
            size: this.tlasData.byteLength + this.bvhSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(bvhBuffer, 0, this.tlasData);
    }

    writeMeshBuffers() {
        let vOffset = 0;
        let tOffset = 0;
        let bOffset = this.tlasData.byteLength;
        for (let i = 0; i < this.meshList.length; i++) {
            let m = this.meshList[i];
            device.queue.writeBuffer(vertexBuffer, vOffset, m.vertexData);
            vOffset += m.vertexData.byteLength;
            device.queue.writeBuffer(triangleBuffer, tOffset, m.triangleData);
            tOffset += m.triangleData.byteLength;
            device.queue.writeBuffer(bvhBuffer, bOffset, m.bvhData);
            bOffset += m.bvhData.byteLength;
        }
    }

    createObjectInfoBuffer() {
        objectInfoBuffer = device.createBuffer({
            label: "object info buffer",
            size: OBJECT_INFO_BYTE_SIZE * MAX_OBJECT_COUNT,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        let offset = 0;
        let maxIters = Math.min(this.objectCount, MAX_OBJECT_COUNT);
        for (let i = 0; i < maxIters; i++) {
            device.queue.writeBuffer(objectInfoBuffer, offset, this.objectList[i].infoData);
            offset += OBJECT_INFO_BYTE_SIZE;
        }
    }

    createMaterialsBuffer() {
        materialsBuffer = device.createBuffer({
            label: "materials buffer",
            size: MATERIAL_BYTE_SIZE * this.materialList.length,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        let offset = 0;
        for (let i = 0; i < this.materialList.length; i++) {
            device.queue.writeBuffer(materialsBuffer, offset, this.materialList[i].data);
            offset += MATERIAL_BYTE_SIZE;
        }
    }

    buildTLAS() {
        let nodes = [];
        for (let i = 0; i < this.objectCount; i++) {
            let obj = this.objectList[i];
            let n = new TLASNode(obj.a, obj.b);
            n.object = obj;
            n.index = i;
            nodes.push(n);
        }
        this.tlas = new Array(this.objectCount * 2 - 1);
        let endPtr = this.objectCount * 2 - 2;
        let nodeAIdx = 0;
        let nodeA = nodes[0];
        let nodeBIdx = findBestMatch(nodeA, 0, nodes);
        let nodeB = nodes[nodeBIdx];
        while (nodes.length > 1) {
            let nodeCIdx = findBestMatch(nodeB, nodeBIdx, nodes);
            if (nodeAIdx == nodeCIdx) {
                nodes.splice(nodeAIdx, 1);
                let bIdx = nodeAIdx < nodeBIdx ? nodeBIdx - 1 : nodeBIdx;
                nodes.splice(bIdx, 1);
                let newNode = new TLASNode(vec3.min(nodeA.a, nodeB.a), vec3.max(nodeA.b, nodeB.b));
                newNode.child1 = nodeA;
                this.tlas[endPtr - 1] = nodeA;
                newNode.child2 = nodeB;
                this.tlas[endPtr] = nodeB;
                newNode.index = endPtr - 1;
                endPtr -= 2;
                nodes.push(newNode);
                nodeAIdx = 0;
                nodeA = nodes[0];
                nodeBIdx = findBestMatch(nodeA, 0, nodes);
                nodeB = nodes[nodeBIdx];
            } else {
                nodeAIdx = nodeBIdx;
                nodeA = nodeB;
                nodeBIdx = nodeCIdx;
                nodeB = nodes[nodeBIdx];
            }
        }
        this.tlas[0] = nodes[0];
        this.tlasData = new Float32Array(this.tlas.length * TLAS_NODE_FIELD_COUNT);
        const u32View = new Uint32Array(this.tlasData.buffer);
        for (let i = 0; i < this.tlas.length; i++) {
            let node = this.tlas[i];
            let offset = i * 8;
            this.tlasData.set(node.a, offset);
            this.tlasData.set(node.b, offset + 4);
            u32View.set([node.object ? 1 : 0], offset + 3);
            u32View.set([node.index], offset + 7);
        }
    }
}

function findBestMatch(node, nodeIdx, nodeList) {
    let best = 1e+30;
    let matchIdx = -1;
    for (let i = 0; i < nodeList.length; i++) {
        let n = nodeList[i];
        if (i == nodeIdx) {
            continue;
        }
        let combined = new TLASNode(vec3.min(node.a, n.a), vec3.max(node.b, n.b));
        let cost = combined.cost();
        if (cost < best) {
            matchIdx = i;
            best = cost;
        }
    }
    return matchIdx;
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
                buffer: { type: "uniform" }
            }, {//materials
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }
            }, {//scene data
                binding: 6,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }
            }
        ]
    });
}
