function axisAngleToQuaternion(v, theta) {
    return [Math.cos(theta / 2), v[0] * Math.sin(theta / 2), v[1] * Math.sin(theta / 2), v[2] * Math.sin(theta / 2)];
}

function qmult(p, q) {
    let vp = [p[1], p[2], p[3]];
    let vq = [q[1], q[2], q[3]];
    let pdq = vdot(vp, vq);
    let pxq = vcross(vp, vq);
    let sp = vscalar(vp, p[0]);
    let sq = vscalar(vq, q[0]);
    let fv = vadd(vadd(sp, sq), pxq);
    return [p[0] * q[0] - pdq, fv[0], fv[1], fv[2]];
}

function qinv(q) {
    return [q[0], -q[1], -q[2], -q[3]];
}