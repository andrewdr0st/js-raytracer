let materialId = 0;

class Material {
    constructor(r, g, b, e) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.e = e;
        this.id = materialId++;
    }

    getValues() {
        return [this.r, this.g, this.b, this.e];
    }
}