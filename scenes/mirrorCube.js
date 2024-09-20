class MirrorCube extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([8, 2, 2], [-1, -0.1, -0.1], w, h, 90.0);
        this.camera.backgroundColor = [0.05, 0.05, 0.1];
        this.camera.bounceCount = 24;
        this.camera.raysPerPixel = 1;
    }

    async setupObjects() {
        let mCube = new Mesh();
        mCube.setMaterial(this.materialList[0]);
        await mCube.parseObjFile("cube.obj", true);
        mCube.scale([10, 10, 10]);
        this.meshList.push(mCube);

        let shinyPrism = new Mesh();
        shinyPrism.setMaterial(this.materialList[1]);
        await shinyPrism.parseObjFile("prism.obj");
        shinyPrism.scale([1, 5, 2]);
        shinyPrism.translate([0, -5, 0]);
        this.meshList.push(shinyPrism);

        let cyanSphere = new Sphere(0, 5, 0, 0.75, this.materialList[2]);
        this.sphereList.push(cyanSphere);
    }

    setupMaterials() {
        this.materialList.push(new Material(0.9, 0.9, 0.95, 0, 0.95, 0.0025, 0, 0));
        this.materialList.push(new Material(0.6, 0.6, 0.7, 0.8));
        this.materialList.push(new Material(0.2, 0.9, 0.8, 0, 0.2, 0.2, 0, 0));
    }
}
