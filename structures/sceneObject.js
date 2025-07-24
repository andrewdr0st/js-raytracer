const epsilonV = [0.0001, 0.0001, 0.0001];

export class SceneObject {
    /**
     * @param {Mesh} mesh 
     * @param {Material} mat 
     */
    constructor(mesh, mat) {
        this.translateV = [0, 0, 0];
        this.scaleV = [1, 1, 1];
        this.rotateQ = [1, 0, 0, 0];
        this.infoData = new Uint32Array([mesh.rootNode, mat.id]);
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
}