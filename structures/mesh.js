import { Triangle } from "./triangle";
import { Vertex } from "./vertex";

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
        this.bvhList = [];
        this.rootNode = 0;
    }

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
                        vert = new Vertex(positions[p], textureCoords[t], normals[n]);
                        this.vertices.push(vert);
                        vertexMap.set(s, vert);
                    }
                    vList.push(vert);
                }
                const tri = invert ? new Triangle(vList[2], vList[1], vList[1]) : new Triangle(vList[0], vList[1], vList[2]);
                this.triangles.push(tri);
            }
        }
    }

    getTriangles() {
        let a = [];
        for (let i = 0; i < this.triangles.length; i++) {
            a = a.concat(this.triangles[i].getValues());
        }
        return new Uint32Array(a);
    }

    addBVHTriangle(index, v1, v2, v3) {
        v1 = (v1 - (vertexOffset + 1)) * 4;
        v2 = (v2 - (vertexOffset + 1)) * 4;
        v3 = (v3 - (vertexOffset + 1)) * 4;
        let v01 = [this.vertices[v1], this.vertices[v1 + 1], this.vertices[v1 + 2]];
        let v02 = [this.vertices[v2], this.vertices[v2 + 1], this.vertices[v2 + 2]];
        let v03 = [this.vertices[v3], this.vertices[v3 + 1], this.vertices[v3 + 2]];
        this.bvhTriangles.push(new BVHTriangle(index, v01, v02, v03));
    }

    buildBVH() {
        this.bvhNode = new BVHNode(this, this.bvhTriangles, 0);
        this.bvhNode.findBounds();
        this.bvhNode.findChildrenRecursive();
        this.prepareGPUBVH();
    }

    prepareGPUBVH() {
        let newTriList = [];
        let nodeQueue = [this.bvhNode];
        let i = 1;
        let tCount = 0;
        while (nodeQueue.length > 0) {
            let n = nodeQueue.shift();
            if (n.child1 == null) {
                let l = n.bvhTris.length;
                this.bvhList.push(new GpuBVHNode(n.a, n.b, l, tCount + this.triStart));
                tCount += l;
                for (let j = 0; j < l; j++) {
                    newTriList.push(this.triangles[n.bvhTris[j].index]);
                }
            } else {
                this.bvhList.push(new GpuBVHNode(n.a, n.b, 0, i + bvhOffset));
                i += 2;
                nodeQueue.push(n.child1);
                nodeQueue.push(n.child2);
            }
        }
        this.triangles = newTriList;
        this.rootNode = bvhOffset;
        bvhOffset += this.bvhList.length;
    }
}