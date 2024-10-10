class Triangle {
    constructor(v1, v2, v3, m = 0, vt1 = 0, vt2 = 0, vt3 = 0, vn1 = 0, vn2 = 0, vn3 = 0) {
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;

        this.vt1 = vt1;
        this.vt2 = vt2;
        this.vt3 = vt3;

        this.vn1 = vn1;
        this.vn2 = vn2;
        this.vn3 = vn3;

        this.m = m;
    }

    getValues() {
        return [this.v1, this.v2, this.v3, this.m, this.vt1, this.vt2, this.vt3, 0];
    }
}