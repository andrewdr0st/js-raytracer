class TestScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([0, 15, -20], [0, -0.75, 1], w, h, 90.0);
        this.camera.backgroundColor = [0.1, 0.1, 0.1];
        this.camera.bounceCount = 8;
        this.camera.raysPerPixel = 2;
    }

    async loadMeshes() {
        let floor = new Mesh();
        await floor.parseObjFile("plane.obj");
        this.meshList.push(floor);
        floor.buildBVH();

        let cube = new Mesh();
        await cube.parseObjFile("cube.obj");
        this.meshList.push(cube);
        cube.buildBVH();

        let cylinder = new Mesh();
        await cylinder.parseObjFile("cylinder.obj");
        this.meshList.push(cylinder);
        cylinder.buildBVH();
        
        let teapot = new Mesh();
        await teapot.parseObjFile("teapot.obj");
        this.meshList.push(teapot);
        teapot.buildBVH();
    }

    setupObjects() {
        this.addObject(0, 8);
        this.objectList[0].scale(20, 1, 20);

        this.addObject(3, 7);
        this.objectList[1].translate(1, 0.5, 6);
        //this.objectList[1].scale(0.5, 0.5, 0.5);

        this.addObject(2, 5);
        this.objectList[2].translate(10, 1, -8);
        this.objectList[2].rotate([0, 0, 1], deg2rad(90));
        this.objectList[2].rotate([1, 0, 0], deg2rad(-60));

        this.addObject(1, 3);
        this.objectList[3].scale(5, 2, 0.2);
        this.objectList[3].translate(-10, 2, -6);
        this.objectList[3].rotate([1, 0, 0], deg2rad(30));

        //this.addObject(1, 6);
        //this.objectList[4].translate(0, 1, -10);

        let sun = new Sphere(0, 150, -50, 40, this.materialList[1]);
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
        this.materialList.push(new Material(0.4, 0.65, 0.95, 0, 0, 0.3, 1.4, 1, 1, 0, 1, 0.6));
        this.materialList.push(new Material(1.0, 1.0, 1.0, 0, 0, 0, 1.5));
        this.materialList.push(new Material(0.5, 0.5, 0.6, 0, 0, 0, 0, 0, 1));
        this.materialList.push(new Material(0.7, 0.7, 0.7, 0, 0, 0, 0, -1, -1, 1));
        this.materialList.push(new Material(0.9, 0.8, 0.7, 0.9, 1.0, 0.05));
        this.materialList.push(new Material(0.6, 0.6, 0.6, 0, 0, 0.02, 2.5, -1, -1, 0, 1, 0.9));
    }
}