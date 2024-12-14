const epsilonV = [0.0001, 0.0001, 0.0001];

class SceneObject {
    constructor(mesh, mat) {
        this.translateV = [0, 0, 0];
        this.scaleV = [1, 1, 1];
        this.rotateQ = [1, 0, 0, 0];
        this.rootNode = mesh.rootNode;
        this.material = mat;
    }

    translate(x, y, z) {
        this.translateV = vadd(this.translateV, [x, y, z]);
    }

    scale(x, y, z) {
        this.scaleV = vmult(this.scaleV, [x, y, z]);
    }

    rotate(axis, theta) {
        this.rotateQ = qmult(this.rotateQ, axisAngleToQuaternion(axis, deg2rad(theta)));
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

    getMaterial() {
        return new Int32Array([this.material]);
    }

    getRootNode() {
        return new Uint32Array([this.rootNode])
    }
}