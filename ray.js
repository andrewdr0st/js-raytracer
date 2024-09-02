class Ray {
    constructor(origin, dir) {
        this.origin = origin;
        this.dir = dir;
    }

    at(t) {
        return vadd(this.origin + vscalar(this.dir, t));
    }
}