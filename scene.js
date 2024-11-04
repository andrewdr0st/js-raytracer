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

    addObject(m) {
        this.objectList.push(new SceneObject(m));
        this.objectCount++;
    }

    setupMaterials() {

    }
}