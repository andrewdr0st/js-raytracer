import { device } from "./gpuManager.js";
import { cameraBuffer } from "./camera.js";
import { SceneObject, OBJECT_INFO_BYTE_SIZE, OBJECT_TRANSFORM_BYTE_SIZE } from "./structures/sceneObject.js";
import { TLASNode } from "./bvh.js";
const { vec3 } = wgpuMatrix;

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
        //this.buildTLAS();
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

    /**
     * Creates a new scene object, adds it to the scene, and returns the created object
     * @param {Number} meshId 
     * @param {Number} matId 
     * @returns {SceneObject}
     */
    addObject(meshId, matId) {
        let obj = new SceneObject(this.meshList[meshId], matId);
        this.objectList.push(obj);
        this.objectCount++;
        return obj;
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
            size: OBJECT_INFO_BYTE_SIZE * this.objectCount,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        let offset = 0;
        for (let i = 0; i < this.objectCount; i++) {
            device.queue.writeBuffer(objectInfoBuffer, offset, this.objectList[i].infoData);
            offset += OBJECT_INFO_BYTE_SIZE;
        }
    }

    createObjectTransformBuffer() {
            objectTransformBuffer = device.createBuffer({
            label: "object transform buffer",
            size: OBJECT_TRANSFORM_BYTE_SIZE * this.objectCount,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        let offset = 0;
        for (let i = 0; i < this.objectCount; i++) {
            device.queue.writeBuffer(objectTransformBuffer, offset, this.objectList[i].transformData);
            offset += OBJECT_TRANSFORM_BYTE_SIZE;
        }
    }

    buildTLAS() {
        let nodes = [];
        for (let i = 0; i < this.objectCount; i++) {
            let obj = this.objectList[i];
            let n = new TLASNode(obj.a, obj.b);
            n.object = obj;
            nodes.push(n);
        }
        console.log(nodes);
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
                nodes.splice(nodeBIdx, 1);
                let newNode = new TLASNode(vec3.min(nodeA.a, nodeB.a), vec3.max(nodeA.b, nodeB.b));
                newNode.child1 = nodeA;
                this.tlas[endPtr - 1] = nodeA;
                newNode.child2 = nodeB;
                this.tlas[endPtr] = nodeB;
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
        // let finalNode = new TLASNode(vec3.min(nodes[0].a, nodes[1].a), vec3.max(nodes[0].b, nodes[1].b));
        // finalNode.child1 = nodes[0];
        // this.tlas[1] = nodes[0];
        // finalNode.child2 = nodes[1];
        // this.tlas[2] = nodes[1];
        // this.tlas[0] = finalNode;
        console.log(this.tlas);
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
                buffer: { type: "read-only-storage" }
            }, {//object transform
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });
}
