export const VERTEX_BYTE_SIZE = 32;
export const VERTEX_F32_COUNT = 8;

/**
 * Stores vertex position, uv, and normal
 * @typedef {Object} Vertex
 * @property {Array} pos - positon [x, y, z]
 * @property {Array} uv - texture coordinates [u, v]
 * @property {Array} normal - normal [x, y, z]
 * @property {Float32Array} data - array formatted for being sent to the gpu
 * @property {Number} index - index into the mesh vertex buffer
 */
export class Vertex {
    /**
     * @param {Number} index - index of vertex in mesh
     * @param {Array} pos - [x, y, z]
     * @param {Array} uv - [u, v]
     * @param {Array} normal - [x, y, z]
     */
    constructor(index, pos, uv, normal) {
        this.index = index;
        this.pos = pos;
        this.uv = uv;
        this.normal = normal;
        this.data = new Float32Array([pos[0], pos[1], pos[2], uv[0], normal[0], normal[1], normal[2], uv[1]]);
    }
}