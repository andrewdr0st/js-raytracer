var bvhList = [];

class GpuBVHNode {
    constructor(a, b, triCount, index) {
        this.a = a;
        this.b = b;
        this.triCount = triCount;
        this.index = index;
    }
}

class BVHNode {
    constructor(mesh, bvhTris) {
        this.mesh = mesh;
        this.bvhTris = bvhTris;
        this.a;
        this.b;
        this.child1;
        this.child2;
    }

    findBounds() {
        this.a = this.bvhTris[0].triMin;
        this.b = this.bvhTris[0].triMax;
        for (let i = 1; i < this.bvhTris.length; i++) {
            let t = this.bvhTris[i];
            this.a = vmin(this.a, t.triMin);
            this.b = vmax(this.b, t.triMax);
        }
    }
}