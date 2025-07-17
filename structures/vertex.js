class Vertex {
    constructor(x, y, z, u, v, a, b, c) {
        this.pos = [x, y, z];
        this.uv = [u, v];
        this.normal = [a, b, c];
        this.data = new Float32Array([x, y, z, u, a, b, c, v]);
    }
}