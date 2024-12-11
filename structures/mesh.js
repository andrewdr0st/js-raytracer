let vertexOffset = -1;
let tcOffset = -1;
let vnormalOffset = -1;
let totalTris = 0;

class Mesh {
    constructor() {
        this.triangles = [];
        this.tCount = 0;
        this.vertices = [];
        this.vCount = 0;
        this.textureCoords = [];
        this.tcCount = 0;
        this.normals = [];
        this.nCount = 0;

        this.bvhTriangles = [];

        this.triStart = 0;
        this.triEnd = 0;
    }

    async parseObjFile(objFile, invert=false) {
        const response = await fetch("objects/" + objFile);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        let data = await response.text();
        const lines = data.split("\n");

        for (let i = 0; i < lines.length; i++) {
            let parts = lines[i].trim().split(/\s+/);
            let type = parts[0];

            if (type == "v") {
                this.vertices = this.vertices.concat([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]), 0]);
                this.vCount++;
            } else if (type == "vt") {
                this.textureCoords = this.textureCoords.concat([parseFloat(parts[1]), parseFloat(parts[2])]);
                this.tcCount++;
            } else if (type == "vn") {
                this.normals = this.normals.concat([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]), 0]);
                this.nCount++;
            } else if (type == "f") {
                let v1 = parts[1].split("/");
                let v2 = parts[2].split("/");
                let v3 = parts[3].split("/");
                let v1id = parseInt(v1[0]) + vertexOffset;
                let v2id = parseInt(v2[0]) + vertexOffset;
                let v3id = parseInt(v3[0]) + vertexOffset;
                if (v1.length == 1) {
                    if (invert) {
                        this.triangles.push(new Triangle(v3id, v2id, v1id));
                    } else {
                        this.triangles.push(new Triangle(v1id, v2id, v3id));
                    }
                } else if (v1.length == 2) {
                    if (invert) {
                        this.triangles.push(new Triangle(v3id, v2id, v1id, parseInt(v3[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v1[1]) + tcOffset));
                    } else {
                        this.triangles.push(new Triangle(v1id, v2id, v3id, parseInt(v1[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v3[1]) + tcOffset));
                    }
                } else {
                    if (invert) {
                        this.triangles.push(new Triangle(v3id, v2id, v1id, parseInt(v3[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v1[1]) + tcOffset, parseInt(v3[2]) + vnormalOffset, parseInt(v2[2]) + vnormalOffset, parseInt(v1[2]) + vnormalOffset));
                    } else {
                        this.triangles.push(new Triangle(v1id, v2id, v3id, parseInt(v1[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v3[1]) + tcOffset, parseInt(v1[2]) + vnormalOffset, parseInt(v2[2]) + vnormalOffset, parseInt(v3[2]) + vnormalOffset));
                    }
                }
                this.addBVHTriangle(this.tCount, v1id, v2id, v3id);
                this.tCount++;
            }
        }

        vertexOffset += this.vCount;
        tcOffset += this.tcCount;
        vnormalOffset += this.nCount;

        this.triStart = totalTris;
        totalTris += this.tCount;
        this.triEnd = totalTris - 1;

        console.log(this.vertices);
    }

    getTriangles() {
        let a = [];
        for (let i = 0; i < this.triangles.length; i++) {
            a = a.concat(this.triangles[i].getValues());
        }
        return new Uint32Array(a);
    }

    getVerticies() {
        return new Float32Array(this.vertices);
    }

    getUvs() {
        return new Float32Array(this.textureCoords);
    }

    getNormals() {
        return new Float32Array(this.normals);
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
}