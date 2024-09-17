let vertexOffset = -1;
let totalTris = 0;

class Mesh {
    constructor() {
        this.triangles = [];
        this.tCount = 0;
        this.verticies = [];
        this.vCount = 0;

        this.material;
    }

    async parseObjFile(objFile) {
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
                //texture coords
            } else if (type == "vn") {
                //vertex normals
            } else if (type == "f") {
                this.triangles.push(new Triangle(parseInt(parts[1]) + vertexOffset, parseInt(parts[2]) + vertexOffset, parseInt(parts[3]) + vertexOffset, this.material.id));
                this.tCount++;
            }
        }

        vertexOffset += this.vCount;
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
}