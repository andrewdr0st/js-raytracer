let vertIndex = 0;

/**
 * Stores vertex position, uv, and normal
 * @typedef {Object} Vertex
 * @property {Array} pos - positon [x, y, z]
 * @property {Array} uv - texture coordinates [u, v]
 * @property {Array} normal - normal [x, y, z]
 * @property {Float32Array} data - array formatted for being sent to the gpu
 * @property {Number} index - index into the global vertex buffer
 */
export class Vertex {
    /**
     * @param {Array} pos - [x, y, z]
     * @param {Array} uv - [u, v]
     * @param {Array} normal - [x, y, z]
     */
    constructor(pos, uv, normal) {
        this.pos = pos;
        this.uv = uv;
        this.normal = normal;
        this.data = new Float32Array([pos[0], pos[1], pos[2], uv[0], normal[0], normal[1], normal[2], uv[1]]);
        this.index = vertIndex++;
    }
}