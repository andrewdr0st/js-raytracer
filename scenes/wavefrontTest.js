import { Scene } from "../scene.js";
import { Mesh } from "../structures/mesh.js";
import { Camera } from "../camera.js";

export class WavefrontScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([0, 0, 5], [0, 0, -1], w, h, 70.0);
        this.camera.backgroundColor = [0.1, 0.1, 0.1];
        this.camera.bounceCount = 1;
        this.camera.raysPerPixel = 1;
    }

    async loadMeshes() {
        let cube = new Mesh();
        await cube.parseObjFile("cube.obj");
        this.meshList.push(cube);
    }
}