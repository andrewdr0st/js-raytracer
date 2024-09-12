class Camera {
    constructor(pos, forward, imgW, imgH, fov) {
        this.pos = pos;
        this.forward = forward;
        this.imgW = imgW;
        this.imgH = imgH;

        this.fov = fov;
        this.up = [0, 1, 0];
        this.focusDist = 1.0;

        this.init();
    }

    init() {
        let h = Math.tan(deg2rad(this.fov) / 2);
        this.viewportH = 2.0 * h * this.focusDist;
        this.viewportW = this.viewportH * (this.imgW / this.imgH);

        this.lookAt = vadd(this.pos, this.forward);

        let w = vnorm(vsub(this.pos, this.lookAt));
        let u = vnorm(vcross(this.up, w));
        let v = vcross(w, u);

        this.viewportU = vscalar(u, this.viewportW);
        this.viewportV = vscalar(vinv(v), this.viewportH);

        this.pixelDeltaU = vdivide(this.viewportU, this.imgW);
        this.pixelDeltaV = vdivide(this.viewportV, this.imgH);

        let viewplanePos = vsub(this.pos, vscalar(w, this.focusDist));
        let viewplaneVec = vadd(vdivide(this.viewportU, 2), vdivide(this.viewportV, 2));
        this.viewportUpperLeft = vsub(viewplanePos, viewplaneVec);
        this.topLeftPixel = vadd(this.viewportUpperLeft, vscalar(vadd(this.pixelDeltaU, this.pixelDeltaV), 0.5));
    }

    render(imgData) {
        for (let y = 0; y < this.imgH; y++) {
            for (let x = 0; x < this.imgW; x++) {
                let pCenter = vadd(this.topLeftPixel, vadd(vscalar(this.pixelDeltaU, x), vscalar(this.pixelDeltaV, y)));
                let rayDir = vsub(pCenter, this.pos);
                let r = new Ray(this.pos, rayDir);
                let c = rayColor(r);
                colorPixel(imgData, x, y, c);
            }
        }
    }

    
}

function hitSphere(center, radius, ray) {
    let oc = vsub(center, ray.origin);
    let a = vdot(ray.dir, ray.dir);
    let b = -2.0 * vdot(ray.dir, oc);
    let c = vdot(oc, oc) - radius * radius;
    let discriminant = b * b - 4 * a * c;
    return discriminant >= 0;
}

function rayColor(r) {
    if (hitSphere([0, 0, -1], 0.5, r)) {
        return [1.0, 0, 0];
    }

    let unitDir = vnorm(r.dir);
    return clerp((unitDir[1] + 1) * 0.5, [0.0, 1.0, 0.25], [0.25, 0.5, 1.0]);
}
