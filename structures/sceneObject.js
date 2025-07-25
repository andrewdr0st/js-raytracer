const { vec3, quat, mat4 } = wgpuMatrix;

const epsilonV = [0.0001, 0.0001, 0.0001];
const MAT4_F32_COUNT = 16;
const OBJECT_TRANSFORM_F32_COUNT = 32;

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
        this.transformData = new Float32Array(OBJECT_TRANSFORM_F32_COUNT);
    }

    translate(x, y, z) {
        this.translateV = vec3.add(this.translateV, [x, y, z]);
    }

    scale(x, y, z) {
        this.scaleV = vec3.multiply(this.scaleV, [x, y, z]);
    }

    rotate(axis, theta) {
        this.rotateQ = quat.multiply(this.rotateQ, quat.fromAxisAngle(axis, deg2rad(theta)));
    }

    setTransform() {
        const t = mat4.translation(this.translateV);
        const s = mat4.scaling(this.scaleV);
        const r = mat4.fromQuat(this.rotateQ);
        const transform = mat4.multiply(t, mat4.multiply(r, s));
        const inv = mat4.inverse(transform);
        this.transformData.set(transform, 0);
        this.transformData.set(inv, MAT4_F32_COUNT);
    }
}