class Camera {
    constructor(pos, lookTo, imgW, imgH, fov) {
        this.pos = pos;
        this.lookTo = lookTo;
        this.forward;
        this.right;
        this.imgW = imgW;
        this.imgH = imgH;

        this.backgroundColor = [0, 0, 0];

        this.fov = fov;
        this.up = [0, 1, 0];
        this.focusDist = 1.0;
        this.defocusAngle = 0.15;
        this.defocusU = [0, 0, 0];
        this.defocusV = [0, 0, 0];

        this.raysPerPixel = 16;
        this.bounceCount = 4;
        this.antialiasing = false;
        this.realtimeMode = true;
        this.seed = 0;
        this.frameCount = 1;

        this.init();
    }

    init() {
        let h = Math.tan(deg2rad(this.fov) / 2);
        this.viewportH = 2.0 * h * this.focusDist;
        this.viewportW = this.viewportH * (this.imgW / this.imgH);

        this.lookTo = vnorm(this.lookTo);
        this.lookAt = vadd(this.pos, this.lookTo);
        this.right = vnorm(vcross(this.lookTo, this.up));
        this.forward = vnorm(vcross(this.up, this.right));

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

        let defocusRadius = this.focusDist * Math.tan(deg2rad(this.defocusAngle / 2));
        this.defocusU = vscalar(u, defocusRadius);
        this.defocusV = vscalar(v, defocusRadius);
    }

    updateStatic() {
        this.seed += 7;
        this.frameCount++;
    }

    setP(x, y, theta) {
        theta = deg2rad(theta);
        this.lookTo = [-Math.cos(theta), -0.5, -Math.sin(theta)];
        this.pos = [x * Math.cos(theta), y, x * Math.sin(theta)];
    }

}

