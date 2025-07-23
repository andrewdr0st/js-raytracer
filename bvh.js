const BVH_MAX_DEPTH = 16;
const splitChecks = [0.2, 0.35, 0.5, 0.65, 0.8];


export class GpuBVHNode {
    constructor(a, b, triCount, index) {
        this.a = a;
        this.b = b;
        this.triCount = triCount;
        this.index = index;
    }
}

export class BVHNode {
    constructor(mesh, bvhTris, depth) {
        this.mesh = mesh;
        this.bvhTris = bvhTris;
        this.a;
        this.b;
        this.child1 = null;
        this.child2 = null;
        this.depth = depth;
    }

    findChildrenRecursive() {
        if (this.bvhTris.length > 2 && this.depth < BVH_MAX_DEPTH) {
            this.findChildren();
        }
        if (this.child1 != null) {
            this.child1.findChildrenRecursive();
            this.child2.findChildrenRecursive();
        }
    }

    findChildren() {
        let split = null;
        let bestCost = this.cost();
        for (let d = 0; d < 3; d++) {
            for (let i = 0; i < splitChecks.length; i++) {
                let s = splitChecks[i];
                let splitArray = this.splitTris(d, s);
                if (splitArray[0].length == 0 || splitArray[1].length == 0) {
                    continue;
                }
                let b0 = new BVHNode(this.mesh, splitArray[0], this.depth + 1);
                let b1 = new BVHNode(this.mesh, splitArray[1], this.depth + 1);
                b0.findBounds();
                b1.findBounds();
                let c = b0.cost() + b1.cost();
                if (c < bestCost) {
                    bestCost = c;
                    split = [b0, b1];
                }
            }
        }
        if (split == null) {
            return null;
        }
        this.child1 = split[0];
        this.child2 = split[1];
    }

    splitTris(dim, split) {
        let splitArray = [[], []];
        let splitPoint = vadd(vscalar(this.a, 1 - split), vscalar(this.b, split));
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
        this.a = vsub(this.a, [0.00001, 0.00001, 0.00001]);
        this.b = vadd(this.b, [0.00001, 0.00001, 0.00001]);
    }

    cost() {
        let x = this.b[0] - this.a[0];
        let y = this.b[1] - this.a[1];
        let z = this.b[2] - this.a[2];
        return this.bvhTris.length * (x * (y + z) + y * z);
    }
}