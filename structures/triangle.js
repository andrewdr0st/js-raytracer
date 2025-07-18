import { Vertex } from "./vertex";

let triIndex = 0;

/**
 * @typedef {Object} Triangle
 * @property {Vertex} v1 - vertex 1
 * @property {Vertex} v2 - vertex 2
 * @property {Vertex} v3 - vertex 3
 * @property {Material} material - material
 * @property {Number} index - index into the global triangle buffer
 */
export class Triangle {
    /**
     * @param {Vertex} v1 
     * @param {Vertex} v2 
     * @param {Vertex} v3 
     * @param {Material} material 
     */
    constructor(v1, v2, v3, material) {
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;
        this.material = material;
        this.data = new Uint32Array([v1.index, v2.index, v3.index, material.index]);
        this.index = triIndex++;
    }
}

export class BVHTriangle {
    constructor(index, v1, v2, v3) {
        this.index = index;
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;

        this.triMin = vmin(vmin(v1, v2), v3);
        this.triMax = vmax(vmax(v1, v2), v3);
        this.triMid = vscalar(vadd(this.triMin, this.triMax), 0.5);
    }
}
