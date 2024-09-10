class Sphere {
    constructor(x, y, z, radius, r, g, b) {
        this.pos = [x, y, z];
        this.r = radius;
        this.col = [r, g, b, 1];
    }

    getValues() {
        return [this.pos[0], this.pos[1], this.pos[2], this.r, this.col[0], this.col[1], this.col[2], this.col[3]];
    }
}