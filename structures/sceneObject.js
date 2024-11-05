const epsilonV = [0.0001, 0.0001, 0.0001];

class SceneObject {
    constructor(mesh) {
        this.translateV = [0, 0, 0];
        this.scaleV = [1, 1, 1];
        this.rotateQ = [0, 0, 0, 0];
        this.tStart = mesh.triStart;
        this.tEnd = mesh.triEnd;
    }

    translate(x, y, z) {
        this.translateV = vadd(this.translateV, [x, y, z]);
    }

    scale(x, y, z) {
        this.scaleV = vmult(this.scaleV, [x, y, z]);
    }

    rotate() {
        
    }

    getTranslate() {
        return new Float32Array(this.translateV);
    }

    getScale() {
        return new Float32Array(this.scaleV);
    }

    getRotate() {
        return new Float32Array(this.rotateQ);
    }
}