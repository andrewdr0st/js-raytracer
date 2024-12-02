class TestScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([12, 15, 5], [-1, -0.75, 0], w, h, 90.0);
        this.camera.backgroundColor = [0.1, 0.1, 0.1];
        this.camera.bounceCount = 8;
        this.camera.raysPerPixel = 2;
    }

    async loadMeshes() {
        let floor = new Mesh();
        await floor.parseObjFile("plane.obj");
        this.meshList.push(floor);

        let cube = new Mesh();
        await cube.parseObjFile("cube.obj");
        this.meshList.push(cube);

        let cylinder = new Mesh();
        await cylinder.parseObjFile("cylinder.obj");
        this.meshList.push(cylinder);
    }

    setupObjects() {
        this.addObject(0, 0);
        this.objectList[0].scale(20, 1, 20);

        this.addObject(1, 3);
        this.objectList[1].translate(1, 2.25, 6);
        this.objectList[1].rotate([0, 1, 0], deg2rad(45));

        this.addObject(2, 5);
        this.objectList[2].translate(10, 1, -8);
        this.objectList[2].rotate([0, 0, 1], deg2rad(90));
        this.objectList[2].rotate([1, 0, 0], deg2rad(-60));

        this.addObject(1, 5);
        this.objectList[3].scale(5, 2, 0.2);
        this.objectList[3].translate(-10, 2, -6);
        this.objectList[3].rotate([1, 0, 0], deg2rad(30));

        this.addObject(1, 6);
        this.objectList[4].translate(0, 1, -10);

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
        this.materialList.push(new Material(0.4, 0.65, 0.95, 0, 0, 0, 0, 1, 1));
        this.materialList.push(new Material(1.0, 1.0, 1.0, 0, 0, 0, 1.5));
        this.materialList.push(new Material(0.5, 0.5, 0.6, 0, 0, 0, 0, 0, 1));
        this.materialList.push(new Material(0.7, 0.7, 0.7, 0, 0, 0, 0, -1, -1, 1));
    }
}