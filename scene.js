class Scene {
    constructor() {
        this.camera;
        this.materialList = [];
        this.meshList = [];
        this.sphereList = [];
    }

    async setup(w, h) {
        this.setupCamera(w, h);
        this.setupMaterials();
        await this.setupObjects();
    }

    setupCamera(w, h) {
        
    }

    async setupObjects() {

    }

    setupMaterials() {

    }
}