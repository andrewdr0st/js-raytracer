function axisAngleToQuaternion(v, theta) {
    return [Math.cos(theta / 2), v[0] * Math.sin(theta / 2), v[1] * Math.sin(theta / 2), v[2] * Math.sin(theta / 2)];
}

function qmult(p, q) {
    return [
        p[0] * q[0] - p[1] * q[1] - p[2] * q[2] - p[3] * q[3],
        p[0] * q[1] + p[1] * q[0] + p[2] * q[3] - p[3] * q[2],
        p[0] * q[2] - p[1] * q[3] + p[2] * q[0] + p[3] * q[1],
        p[0] * q[3] + p[1] * q[2] - p[2] * q[1] + p[3] * q[0]
    ];
}

function qinv(q) {
    return [q[0], -q[1], -q[2], -q[3]];
}