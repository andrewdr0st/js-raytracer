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

    setupBindGroup() {
        
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
            },
        ]
    })
}
