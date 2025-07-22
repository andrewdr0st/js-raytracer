import { Vertex } from "./vertex";

export const TRIANGLE_BYTE_SIZE = 16;
export const TRIANGLE_U32_COUNT = 4;

/**
 * @typedef {Object} Triangle
 * @property {Vertex} v1 - vertex 1
 * @property {Vertex} v2 - vertex 2
 * @property {Vertex} v3 - vertex 3
 * @property {Number} index - index into the mesh triangle buffer
 */
export class Triangle {
    /**
     * @param {Number} index
     * @param {Vertex} v1 
     * @param {Vertex} v2 
     * @param {Vertex} v3 
     */
    constructor(index, v1, v2, v3) {
        this.index = index;
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;
        this.data = new Uint32Array([v1.index, v2.index, v3.index, 0]);
    }
}

/**
 * Stores triangle min, max, and midpoints for calculating bvh bounding boxes
 * @typedef {Object} BVHTriangle
 */
export class BVHTriangle {
    /**
     * @param {Triangle} tri 
     */
    constructor(tri) {
        this.index = tri.index;
        let v1 = tri.v1.pos;
        let v2 = tri.v2.pos;
        let v3 = tri.v3.pos;
        this.triMin = vmin(vmin(v1, v2), v3);
        this.triMax = vmax(vmax(v1, v2), v3);
        this.triMid = vscalar(vadd(this.triMin, this.triMax), 0.5);
    }
}
