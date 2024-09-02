
function deg2rad(theta) {
    return theta * Math.PI / 180;
}

function vcreate(x, y, z) {
    return [x, y, z];
}

function vdot(u, v) {
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

function vcross(u, v) {
    return [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
    ];
}

function vlen(v) {
    return Math.sqrt(vlen2(v));
}

function vlen2(v) {
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

function vnorm(v) {
    return vscalar(v, 1 / vlen(v));
}

function vscalar(v, t) {
    return [v[0] * t, v[1] * t, v[2] * t];
}

function vdivide(v, t) {
    return [v[0] / t, v[1] / t, v[2] / t];
}

function vmult(u, v) {
    return [u[0] * v[0], u[1] * v[1], u[2] * v[2]];
}

function vinv(v) {
    return [-v[0], -v[1], -v[2]];
}

function vadd(u, v) {
    return [u[0] + v[0], u[1] + v[1], u[2] + v[2]];
}

function vsub(u, v) {
    return [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
}


