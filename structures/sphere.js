class Sphere {
    constructor(x, y, z, radius, m) {
        this.pos = [x, y, z];
        this.r = radius;
        this.m = m;
    }

    getValues() {
        return [this.pos[0], this.pos[1], this.pos[2], this.r];
    }

    getM() {
        return [this.m, 0, 0, 0];
    }
}