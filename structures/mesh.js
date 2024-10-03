let vertexOffset = -1;
let tcOffset = -1;
let vnormalOffset = -1;
let totalTris = 0;

class Mesh {
    constructor() {
        this.triangles = [];
        this.tCount = 0;
        this.verticies = [];
        this.vCount = 0;
        this.textureCoords = [];
        this.tcCount = 0;
        this.normals = [];
        this.nCount = 0;

        this.material;
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
                this.verticies = this.verticies.concat([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]), 0]);
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
                if (v1.length == 1) {
                    if (invert) {
                        this.triangles.push(new Triangle(parseInt(v3[0]) + vertexOffset, parseInt(v2[0]) + vertexOffset, parseInt(v1[0]) + vertexOffset, this.material.id));
                    } else {
                        this.triangles.push(new Triangle(parseInt(v1[0]) + vertexOffset, parseInt(v2[0]) + vertexOffset, parseInt(v3[0]) + vertexOffset, this.material.id));
                    }
                } else if (v1.length == 2) {
                    if (invert) {
                        this.triangles.push(new Triangle(parseInt(v3[0]) + vertexOffset, parseInt(v2[0]) + vertexOffset, parseInt(v1[0]) + vertexOffset, this.material.id, parseInt(v3[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v1[1]) + tcOffset));
                    } else {
                        this.triangles.push(new Triangle(parseInt(v1[0]) + vertexOffset, parseInt(v2[0]) + vertexOffset, parseInt(v3[0]) + vertexOffset, this.material.id, parseInt(v1[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v3[1]) + tcOffset));
                    }
                } else {
                    if (invert) {
                        this.triangles.push(new Triangle(parseInt(v3[0]) + vertexOffset, parseInt(v2[0]) + vertexOffset, parseInt(v1[0]) + vertexOffset, this.material.id, parseInt(v3[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v1[1]) + tcOffset, parseInt(v3[2]) + vnormalOffset, parseInt(v2[2]) + vnormalOffset, parseInt(v1[2]) + vnormalOffset));
                    } else {
                        this.triangles.push(new Triangle(parseInt(v1[0]) + vertexOffset, parseInt(v2[0]) + vertexOffset, parseInt(v3[0]) + vertexOffset, this.material.id, parseInt(v1[1]) + tcOffset, parseInt(v2[1]) + tcOffset, parseInt(v3[1]) + tcOffset, parseInt(v1[2]) + vnormalOffset, parseInt(v2[2]) + vnormalOffset, parseInt(v3[2]) + vnormalOffset));
                    }
                }
                this.tCount++;
            }
        }

        vertexOffset += this.vCount;
        tcOffset += this.tcCount;
        vnormalOffset += this.nCount;
        totalTris += this.tCount;
    }

    setMaterial(m) {
        this.material = m;
    }

    getTriangles() {
        let a = [];
        for (let i = 0; i < this.triangles.length; i++) {
            a = a.concat(this.triangles[i].getValues());
        }
        return new Uint32Array(a);
    }

    getVerticies() {
        return new Float32Array(this.verticies);
    }

    translate(t) {
        for (let i = 0; i < this.verticies.length; i += 4) {
            this.verticies[i] += t[0];
            this.verticies[i + 1] += t[1];
            this.verticies[i + 2] += t[2];
        }
    }

    scale(s) {
        for (let i = 0; i < this.verticies.length; i += 4) {
            this.verticies[i] *= s[0];
            this.verticies[i + 1] *= s[1];
            this.verticies[i + 2] *= s[2];
        }
    }
}