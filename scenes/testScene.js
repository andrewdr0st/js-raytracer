class TestScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([12, 15, 5], [-1, -0.75, 0], w, h, 90.0);
        this.camera.backgroundColor = [0.2, 0.2, 0.25];
        this.camera.bounceCount = 8;
        this.camera.raysPerPixel = 12;
    }

    async loadMeshes() {
        let floor = new Mesh();
        floor.setMaterial(this.materialList[0]);
        await floor.parseObjFile("plane.obj");
        this.meshList.push(floor);

        let cube = new Mesh();
        cube.setMaterial(this.materialList[3]);
        await cube.parseObjFile("cube.obj");
        this.meshList.push(cube);

        let cylinder = new Mesh();
        cylinder.setMaterial(this.materialList[5]);
        await cylinder.parseObjFile("cylinder.obj");
        this.meshList.push(cylinder);
    }

    setupObjects() {
        
        this.meshList[0].scale([20, 1, 20]);
        this.addObject(this.meshList[0]);

        this.meshList[1].translate([1, 2.25, 6]);
        this.addObject(this.meshList[1]);

        this.meshList[2].translate([10, 1.0, -8]);
        this.addObject(this.meshList[2]);

        let sun = new Sphere(0, 100, -50, 30, this.materialList[1]);
        this.sphereList.push(sun);

        let metalBall = new Sphere(-5, 2, 0, 2, this.materialList[2]);
        this.sphereList.push(metalBall);

        let glassBall = new Sphere(5, 1.5, -1, 1.5, this.materialList[4]);
        this.sphereList.push(glassBall);
    }


    setupMaterials() {
        this.materialList.push(new Material(0.2, 0.4, 0.25, 0));
        this.materialList.push(new Material(1.0, 1.0, 1.0, 1.0));
        this.materialList.push(new Material(0.8, 0.8, 0.6, 0, 0.9, 0.1, 0, 1));
        this.materialList.push(new Material(0.4, 0.65, 0.95, 0, 0, 0, 0, 0));
        this.materialList.push(new Material(1.0, 1.0, 1.0, 0, 0, 0, 1.5));
        this.materialList.push(new Material(0.5, 0.5, 0.6, 0, 0, 0, 0, 1));
    }
}