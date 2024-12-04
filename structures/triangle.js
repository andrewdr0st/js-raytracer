class Triangle {
    constructor(v1, v2, v3, vt1 = 0, vt2 = 0, vt3 = 0, vn1 = 0, vn2 = 0, vn3 = 0) {
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;

        this.vt1 = vt1;
        this.vt2 = vt2;
        this.vt3 = vt3;

        this.vn1 = vn1;
        this.vn2 = vn2;
        this.vn3 = vn3;

        this.useNorms = vn1 == 0 && vn2 == 0 && vn3 == 0 ? 0 : 1;
    }

    getValues() {
        return [this.v1, this.v2, this.v3, 0, this.vt1, this.vt2, this.vt3, 0, this.vn1, this.vn2, this.vn3, this.useNorms];
    }
}

class BVHTriangle {
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
