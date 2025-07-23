let sceneBindGroupLayout;
let sceneBindGroup;
let vertexBuffer;
let triangleBuffer;

class Scene {
    constructor() {
        this.camera;
        this.materialList = [];
        this.meshList = [];
        this.sphereList = [];
        this.objectList = [];
        this.objectCount = 0;
    }

    async setup(w, h) {
        this.setupCamera(w, h);
        this.setupMaterials();
        await this.loadMeshes();
        this.setupObjects();
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
            layout: sceneBindGroupLayout,
            entries: [
                {binding: 0, resource: {buffer: cameraBuffer}},
                {binding: 1, resource: {buffer: vertexBuffer}},
                {binding: 2, resource: {buffer: triangleBuffer}}
            ]
        });
    }

    createVertexBuffer() {
        vertexBuffer = device.createBuffer({
            size: this.meshList[0].vertexData.byteLength,
            usage: GPUBufferUsage.STORAGE
        });
        device.queue.writeBuffer(vertexBuffer, 0, this.meshList[0].vertexData);
    }

    createTriangleBuffer() {
        triangleBuffer = device.createBuffer({
            size: this.meshList[0].triangleData.byteLength,
            usage: GPUBufferUsage.STORAGE
        });
        device.queue.writeBuffer(triangleBuffer, 0, this.meshList[0].triangleData);
    }
}

function createSceneBindGroupLayout() {
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
            }
        ]
    });
}
