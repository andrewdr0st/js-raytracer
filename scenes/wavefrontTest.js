import { Scene } from "../scene.js";
import { Mesh } from "../structures/mesh.js";
import { Camera } from "../camera.js";
import { SceneObject } from "../structures/sceneObject.js";
import { Texture, createTextureArrays, loadImage } from "../structures/Texture.js";

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

    async loadTextures() {
        let brick = await loadImage("brick16x16.png");
        let plank = await loadImage("planks16x16.png");
        let t = new Texture(brick, 16);
        let p = new Texture(plank, 16);
        createTextureArrays();
    }

    setupObjects() {
        const cube1 = this.addObject(0, 0, 0);
        cube1.translate(3, 2, 2.5);
        cube1.rotate([0, 1, 0], 234);
        cube1.scale(2.6, 2.4, 0.9);
        cube1.setTransform();
        
        const floorCube = this.addObject(0, 0, 1);
        floorCube.translate(0, -2, 0);
        floorCube.scale(40, 1, 40);
        floorCube.setTransform();

        const cube2 = this.addObject(0, 0, 0);
        cube2.translate(5, 4, -3);
        cube2.rotate([1, 0, 0], 10);
        cube2.scale(2, 2, 2);
        cube2.setTransform();
    }
}