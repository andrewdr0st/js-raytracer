const { vec3, quat, mat3, mat4, utils } = wgpuMatrix;

const EPSILON_V = [0.0001, 0.0001, 0.0001];
const MAT4_F32_COUNT = 16;
const MAT3_F32_COUNT = 12;
const OBJECT_INFO_F32_COUNT = 32;
export const OBJECT_INFO_BYTE_SIZE = 128;

/**
 * @typedef {Object} SceneObject
 */
export class SceneObject {
    /**
     * @param {Mesh} mesh 
     * @param {Material} mat 
     */
    constructor(mesh, mat, texture) {
        this.translateV = [0, 0, 0];
        this.scaleV = [1, 1, 1];
        this.rotateQ = [1, 0, 0, 0];
        this.mesh = mesh;
        this.mat = mat;
        this.texture = texture;
        this.infoData = new Float32Array(OBJECT_INFO_F32_COUNT);
    }

    /**
     * @param {Number} x 
     * @param {Number} y 
     * @param {Number} z 
     */
    translate(x, y, z) {
        this.translateV = vec3.add(this.translateV, [x, y, z]);
    }

    /**
     * @param {Number} x 
     * @param {Number} y 
     * @param {Number} z 
     */
    scale(x, y, z) {
        this.scaleV = vec3.multiply(this.scaleV, [x, y, z]);
    }

    /**
     * @param {Array} axis - vector to rotate about
     * @param {Number} theta - degrees of rotation
     */
    rotate(axis, theta) {
        this.rotateQ = quat.multiply(this.rotateQ, quat.fromAxisAngle(axis, utils.degToRad(theta)));
    }

    setTransform() {
        const t = mat4.translation(this.translateV);
        const s = mat4.scaling(this.scaleV);
        const r = mat4.fromQuat(this.rotateQ);
        const transform = mat4.multiply(t, mat4.multiply(r, s));
        const inv = mat4.inverse(transform);
        this.infoData.set(mat3.fromMat4(transform), 0);
        this.infoData.set(inv, MAT4_F32_COUNT);
        this.createOBB(transform);
    }

    /**
     * Creates an oriented bounding box for the object and then finds min and max for its bvh
     * @param {Float32Array} transform - transform matrix
     */
    createOBB(transform) {
        let a = this.mesh.bvhNode.a;
        let b = this.mesh.bvhNode.b;
        let center = vec3.midpoint(a, b);
        let ux = [center[0] - a[0], 0, 0];
        let uy = [0, center[1] - a[1], 0];
        let uz = [0, 0, center[2] - a[2]];
        center = vec3.add(mat4.getTranslation(transform), center);
        const transform3 = mat3.fromMat4(transform);
        ux = vec3.transformMat3(ux, transform3);
        uy = vec3.transformMat3(uy, transform3);
        uz = vec3.transformMat3(uz, transform3);
        const obbVerts = [
            vec3add4(center, vec3.scale(ux, -1), vec3.scale(uy, -1), vec3.scale(uz, -1)),
            vec3add4(center, vec3.scale(ux, -1), vec3.scale(uy, -1), uz),
            vec3add4(center, vec3.scale(ux, -1), uy, vec3.scale(uz, -1)),
            vec3add4(center, vec3.scale(ux, -1), uy, uz),
            vec3add4(center, ux, vec3.scale(uy, -1), vec3.scale(uz, -1)),
            vec3add4(center, ux, vec3.scale(uy, -1), uz),
            vec3add4(center, ux, uy, vec3.scale(uz, -1)),
            vec3add4(center, ux, uy, uz)
        ];
        let minV = obbVerts[0];
        let maxV = obbVerts[0];
        for (let i = 1; i < 8; i++) {
            minV = vec3.min(minV, obbVerts[i]);
            maxV = vec3.max(maxV, obbVerts[i]);
        }
        this.a = vec3.sub(minV, EPSILON_V);
        this.b = vec3.add(maxV, EPSILON_V);
    }

    /**
     * Sets the BVH root node, material id, and texture id of the object's info buffer
     */
    writeInfo() {
        let u32View = new Uint32Array(this.infoData.buffer);
        u32View.set([this.mesh.rootNode, this.mat, this.texture], MAT3_F32_COUNT);
    }
}

function vec3add4(a, b, c, d) {
    return [
        a[0] + b[0] + c[0] + d[0],
        a[1] + b[1] + c[1] + d[1],
        a[2] + b[2] + c[2] + d[2]
    ]
}