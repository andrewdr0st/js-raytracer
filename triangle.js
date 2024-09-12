class Triangle {
    constructor(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
        this.a = [ax, ay, az];
        this.b = [bx, by, bz];
        this.c = [cx, cy, cz];
        this.col = [r, g, b];
    }

    getValues() {
        return [
            this.a[0], this.a[1], this.a[2], 0,
            this.b[0], this.b[1], this.b[2], 0,
            this.c[0], this.c[1], this.c[2], 0,
            this.col[0], this.col[1], this.col[2], 1
        ];
    }
}