import { Triangle, TRIANGLE_U32_COUNT, BVHTriangle } from "./triangle.js";
import { Vertex, VERTEX_F32_COUNT } from "./vertex.js";
import { BVHNode, GpuBVHNode } from "../bvh.js";

let bvhOffset = 0;

/**
 * @typedef {Object} Mesh
 */
export class Mesh {
    constructor() {
        this.triangles = [];
        this.vertices = [];

        this.bvhTriangles = [];
        this.bvhNode = null;
        this.bvhData;
        this.rootNode = 0;
    }

    /**
     * Parses the given obj file and creates the required vertex and triangle array buffers
     * @param {String} objFile - obj file name
     * @param {Boolean} invert - if true, inverts the triangle winding for the mesh
     */
    async parseObjFile(objFile, invert=false) {
        const response = await fetch("objects/" + objFile);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        let data = await response.text();
        const lines = data.split("\n");
        const positions = [];
        const textureCoords = [];
        const normals = [];
        const vertexMap = new Map();
        let vIdx = 0;
        let tIdx = 0;

        for (let i = 0; i < lines.length; i++) {
            let parts = lines[i].trim().split(/\s+/);
            let type = parts[0];

            if (type == "v") {
                positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type == "vt") {
                textureCoords.push([parseFloat(parts[1]), parseFloat(parts[2])]);
            } else if (type == "vn") {
                normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type == "f") {
                let vList = [];
                for (let j = 1; j <= 3; j++) {
                    let s = parts[j];
                    let vert = vertexMap.get(s);
                    if (vert == undefined) {
                        let v = parts[j].split("/");
                        let p = parseInt(v[0]) - 1;
                        let t = parseInt(v[1]) - 1;
                        let n = parseInt(v[2]) - 1;
                        vert = new Vertex(vIdx++, positions[p], textureCoords[t], normals[n]);
                        this.vertices.push(vert);
                        vertexMap.set(s, vert);
                    }
                    vList.push(vert);
                }
                const tri = invert ? new Triangle(tIdx++, vList[2], vList[1], vList[0]) : new Triangle(tIdx++, vList[0], vList[1], vList[2]);
                this.triangles.push(tri);
                this.bvhTriangles.push(new BVHTriangle(tri));
            }
        }
        this.buildBVH();
        this.setData();
    }

    /**
     * Creates the vertexData and triangle data ArrayBuffers that can be sent to the gpu
     */
    setData() {
        this.vertexData = new Float32Array(this.vertices.length * VERTEX_F32_COUNT);
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertexData.set(this.vertices[i].data, i * VERTEX_F32_COUNT);
        }
        this.triangleData = new Uint32Array(this.triangles.length * TRIANGLE_U32_COUNT);
        for (let i = 0; i < this.triangles.length; i++) {
            this.triangleData.set(this.triangles[i].data, i * TRIANGLE_U32_COUNT);
        }
    }

    buildBVH() {
        this.bvhNode = new BVHNode(this, this.bvhTriangles, 0);
        this.bvhNode.findBounds();
        this.bvhNode.findChildrenRecursive();
        this.prepareGPUBVH();
    }

    prepareGPUBVH() {
        let bvhList = [];
        let newTriList = [];
        let nodeQueue = [this.bvhNode];
        let i = 1;
        let tCount = 0;
        while (nodeQueue.length > 0) {
            let n = nodeQueue.shift();
            if (n.child1 == null) {
                let l = n.bvhTris.length;
                bvhList.push(new GpuBVHNode(n.a, n.b, l, tCount));
                tCount += l;
                for (let j = 0; j < l; j++) {
                    newTriList.push(this.triangles[n.bvhTris[j].index]);
                }
            } else {
                bvhList.push(new GpuBVHNode(n.a, n.b, 0, i + bvhOffset));
                i += 2;
                nodeQueue.push(n.child1);
                nodeQueue.push(n.child2);
            }
        }
        this.bvhData = new Float32Array(bvhList.length * 8);
        const u32View = new Uint32Array(this.bvhData.buffer);
        for (let i = 0; i < bvhList.length; i++) {
            let node = bvhList[i];
            let offset = i * 8;
            this.bvhData.set(node.a, offset);
            this.bvhData.set(node.b, offset + 4);
            u32View.set([node.triCount], offset + 3);
            u32View.set([node.index], offset + 7);
        }

        this.triangles = newTriList;
        this.rootNode = bvhOffset;
        bvhOffset += bvhList.length;
    }
}