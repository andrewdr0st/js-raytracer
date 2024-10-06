class OrbScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([0, 9, 9], [0, -0.66, -1], w, h, 90.0);
        this.camera.backgroundColor = [0.75, 0.6, 0.8];
        this.camera.bounceCount = 36;
        this.camera.raysPerPixel = 1;
    }

    async setupObjects() {
        let redCube = new Mesh();
        redCube.setMaterial(this.materialList[1]);
        await redCube.parseObjFile("cube.obj");
        redCube.translate([0, 3, 2]);
        this.meshList.push(redCube);

        let floor = new Mesh();
        floor.setMaterial(this.materialList[2]);
        await floor.parseObjFile("plane.obj");
        floor.scale([100, 0, 100]);
        this.meshList.push(floor);

        let bigOrb = new Sphere(0, 5, 0, 5, this.materialList[0]);
        this.sphereList.push(bigOrb);

        let emeraldOrb = new Sphere(12, 5, 0, 5, this.materialList[3]);
        this.sphereList.push(emeraldOrb);

        let rubyOrb = new Sphere(-12, 5, 0, 5, this.materialList[4]);
        this.sphereList.push(rubyOrb);
    }

    setupMaterials() {
        this.materialList.push(new Material(1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.5, 1.5));
        this.materialList.push(new Material(1.0, 0.4, 0.4, 0.0, 0.8, 0.15));
        this.materialList.push(new Material(0.3, 0.3, 0.35, 0.0));
        this.materialList.push(new Material(0.2, 0.8, 0.5, 0.0, 0.7, 0.25));
        this.materialList.push(new Material(0.9, 0.1, 0.5, 0.0, 0.95, 0.025));
    }
}