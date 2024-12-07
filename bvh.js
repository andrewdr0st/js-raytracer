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
    constructor(mesh, bvhTris, depth) {
        this.mesh = mesh;
        this.bvhTris = bvhTris;
        this.a;
        this.b;
        this.child1 = null;
        this.child2 = null;
        this.depth = depth;
    }

    findChildren() {
        let dim = 0;
        let split = 0;
        let bestCost = 100000000000000.0;
        for (let d = 0; d < 3; d++) {
            for (let i = 1; i < 3; i++) {
                
            }
        }
    }

    splitTris(dim, split) {
        let splitArray = [[], []];
        let splitPoint = vsum(vscalar(this.a, 1 - split), vscalar(this.b, split));
        for (let i = 0; i < this.bvhTris.length; i++) {
            let t = this.bvhTris[i];
            if (t.triMid[dim] < splitPoint[dim]) {
                splitArray[0].push(t);
            } else {
                splitArray[1].push(t);
            }
        }
        return splitArray;
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

    cost() {
        let x = this.b[0] - this.a[0];
        let y = this.b[1] - this.a[1];
        let z = this.b[2] - this.a[2];
        return this.bvhTris.length * 2 * (x * (y + z) + y * z);
    }
}