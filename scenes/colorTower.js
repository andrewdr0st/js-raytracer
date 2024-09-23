class ColorTower extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([2, -10, 13], [-0.1, 5, -1], w, h, 60.0);
        this.camera.backgroundColor = [0.6, 0.6, 0.7];
        this.camera.bounceCount = 16;
        this.camera.raysPerPixel = 1;
    }

    async setupObjects() {
        let sun = new Sphere(100, 100, 200, 30, this.materialList[0]);
        this.sphereList.push(sun);

        for (let i = 0; i < 20; i++) {
            let cube = new Mesh();
            cube.setMaterial(this.materialList[i % 12 + 1]);
            await cube.parseObjFile("cube.obj");
            cube.scale([4 - i * 0.2, 1, 4 - i * 0.2])
            cube.translate([0, i, 0]);
            this.meshList.push(cube);
        }
    }

    setupMaterials() {
        this.materialList.push(new Material(1, 1, 0.95, 1));
        for (let i = 0; i < 12; i++) {
            let c = hsv2rgb(i * 30, 0.75, 0.5);
            this.materialList.push(new Material(c[0], c[1], c[2], 0))
        }
    }
}