import { Scene } from "../scene.js";
import { Mesh } from "../structures/mesh.js";
import { Camera } from "../camera.js";
import { SceneObject } from "../structures/sceneObject.js";
import { Texture, createTextureArrays, loadImage } from "../structures/Texture.js";
import { Material } from "../structures/material.js";

export class WavefrontScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([4, 5, 9], [-0.3, -0.75, -1], w, h, 90.0);
        this.camera.backgroundColor = [0.05, 0.05, 0.05];
        this.camera.bounceCount = 1;
        this.camera.raysPerPixel = 1;

        this.accumTime = 0;
        this.sunSpeed = 0.02;
    }

    async loadMeshes() {
        let plane = new Mesh();
        await plane.parseObjFile("plane.obj");
        let cube = new Mesh();
        await cube.parseObjFile("cube.obj");
        let cylinder = new Mesh();
        await cylinder.parseObjFile("cylinder.obj");
        this.addMesh(plane);
        this.addMesh(cube);
        this.addMesh(cylinder);
    }

    async loadTextures() {
        let brick = await loadImage("brick16x16.png");
        let plank = await loadImage("planks16x16.png");
        let metal = await loadImage("metal16x16.png");
        let t = new Texture(brick, 16);
        let p = new Texture(plank, 16);
        let m = new Texture(metal, 16);
        createTextureArrays();
    }

    setupObjects() {
        const cube1 = this.addObject(1, 2, 2);
        cube1.translate(2, 3, 2.5);
        cube1.rotate([0, 1, 0], 234);
        cube1.scale(2.6, 2.4, 0.9);
        
        const floorPlane = this.addObject(0, 0, 0);
        floorPlane.translate(0, -2, 0);
        floorPlane.scale(40, 1, 40);

        const cube2 = this.addObject(1, 1, 1);
        cube2.translate(5, 4, -3);
        cube2.rotate([1, 0, 0], 10);
        cube2.scale(2, 2, 2);

        const bigWall = this.addObject(1, 0, 1);
        bigWall.translate(0, 5, 30);
        bigWall.scale(40, 10, 1);

        const mirror = this.addObject(1, 2, 2);
        mirror.translate(0, 6, 29.5);
        mirror.scale(5, 5, 1);

        const cylinder = this.addObject(2, 0, 0);
        cylinder.translate(-10, 1, -3);

        super.setupObjects();
    }

    setupMaterials() {
        this.materialList.push(new Material(0.5, 0, 0));
        this.materialList.push(new Material(0.05, 0, 0));
        this.materialList.push(new Material(0.01, 1, 0));
    }

    update(deltaTime) {
        this.accumTime += deltaTime;
        this.sunDirection.set([Math.sin(this.accumTime * this.sunSpeed), Math.cos(this.accumTime * this.sunSpeed)], 0);
        super.update(deltaTime);
    }
}