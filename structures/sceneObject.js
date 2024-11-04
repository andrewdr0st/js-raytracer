const epsilonV = [0.0001, 0.0001, 0.0001];

class SceneObject {
    constructor(mesh, transformMatrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) {
        this.mesh = mesh;
        this.transformMatrix = transformMatrix;
        this.bbox1 = [0, 0, 0];
        this.bbox2 = [0, 0, 0];
    }

    calculateBbox() {
        let v = this.mesh.verticies;
        this.bbox1 = this.bbox2 = [v[0], v[1], v[2]];
        for(let i = 1; i < this.mesh.vCount; i++) {
            let j = i * 4;
            let vec = [v[j], v[j + 1], v[j + 2]];
            this.bbox1 = vmin(this.bbox1, vec);
            this.bbox2 = vmin(this.bbox2, vec);
        }
        this.bbox1 = vsub(this.bbox1, epsilonV);
        this.bbox2 = vadd(this.bbox2, epsilonV);
    }

    getBbox1() {
        return new Float32Array(this.bbox1);
    }

    getBbox2() {
        return new Float32Array(this.bbox2);
    }

    getTransformMatrix() {
        return new Float32Array(this.transformMatrix);
    }
}