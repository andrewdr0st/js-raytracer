class CowScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([12, 7, 0], [-1, -0.5, 0], w, h, 90.0);
        this.camera.backgroundColor = [0.1, 0.1, 0.1];
        this.camera.bounceCount = 8;
        this.camera.raysPerPixel = 1;
    }

    async loadMeshes() {
        let cow = new Mesh();
        await cow.parseObjFile("cow.obj");
        this.meshList.push(cow);
        cow.buildBVH();

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
    }

    setupObjects() {
        this.addObject(0, 1);
        this.objectList[0].translate(0, 3.7, 0);
        this.objectList[0].rotate([0, 1, 0], 15);

        this.addObject(1, 2);
        this.objectList[1].scale(30, 1, 30);

        this.addObject(2, 3);
        this.objectList[2].translate(-25, 10, 0);
        this.objectList[2].scale(1, 10, 25);
        this.addObject(2, 3);
        this.objectList[3].translate(25, 10, 0);
        this.objectList[3].scale(1, 10, 25);
        this.addObject(2, 3);
        this.objectList[4].translate(0, 10, -25);
        this.objectList[4].scale(25, 10, 1);
        this.addObject(2, 3);
        this.objectList[5].translate(0, 10, 25);
        this.objectList[5].scale(25, 10, 1);

        this.addObject(2, 4);
        this.objectList[6].translate(0, 5, 0);
        this.objectList[6].scale(6, 5, 6);


        let sun = new Sphere(0, 50, 3, 10, this.materialList[0]);
        this.sphereList.push(sun);

    }


    setupMaterials() {
        this.materialList.push(new Material(1.0, 1.0, 1.0, 1.0));
        this.materialList.push(new Material(0.8, 0.75, 0.2, 0, 0.95, 0.1));
        this.materialList.push(new Material(0.8, 0.8, 0.8, 0, 0, 0.05, 0, -1, -1, 0, 1, 0.9));
        this.materialList.push(new Material(0, 0, 0, 0, 0, 0, 0, 0, 1));
        this.materialList.push(new Material(0.97, 0.97, 0.98, 0, 0, 0, 1.4));
    }
}