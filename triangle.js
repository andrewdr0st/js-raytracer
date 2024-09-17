class Triangle {
    constructor(v1, v2, v3, m) {
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;
        this.m = m;
    }

    getValues() {
        return [this.v1, this.v2, this.v3, this.m];
    }
}