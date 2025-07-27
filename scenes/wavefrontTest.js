import { Scene } from "../scene.js";
import { Mesh } from "../structures/mesh.js";
import { Camera } from "../camera.js";
import { SceneObject } from "../structures/sceneObject.js";

export class WavefrontScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([4, 7, 9], [-0.3, -0.75, -1], w, h, 90.0);
        this.camera.backgroundColor = [0.1, 0.1, 0.1];
        this.camera.bounceCount = 1;
        this.camera.raysPerPixel = 1;
    }

    async loadMeshes() {
        let cube = new Mesh();
        await cube.parseObjFile("cube.obj");
        this.meshList.push(cube);
    }

    setupObjects() {
        const cube1 = this.addObject(0, 0);
        cube1.translate(3, 2, 2.5);
        cube1.rotate([0, 1, 0], 234);
        cube1.scale(2.6, 2.4, 0.9);
        cube1.setTransform();
        const cube2 = this.addObject(0, 0);
        cube2.translate(-5, 0, 0);
        cube2.rotate([1, 0, 0], 10);
        cube2.scale(2, 2, 2);
        cube2.setTransform();
    }
}