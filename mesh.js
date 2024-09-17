let vertexOffset = 0;

class Mesh {
    constructor() {
        this.triangles = [];
        this.verticies = [];

        this.material;
    }

    async parseObjFile(objFile) {
        const response = await fetch(objFile);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        let data = await response.text();
        const lines = data.split("\n");

        for (let i = 0; i < lines.length; i++) {
            let parts = lines[i].trim().split(/\s+/);
            let type = parts[0];

            if (type == "v") {
                this.verticies = this.verticies.concat([parts[1], parts[2], parts[3], 0]);
            } else if (type == "vt") {
                //texture coords
            } else if (type == "vn") {
                //vertex normals
            } else if (type == "f") {
                this.triangles.push(new Triangle(parts[1] - 1, parts[2] - 1, parts[3] - 1, this.material.id));
            }
        }
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