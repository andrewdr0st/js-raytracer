struct triangle {
    points: vec3u,
    m: u32,
    uvs: vec3u,
    norms: vec3u,
    useNorms: u32
};

struct object {
    bbox1: vec3f,
    tStart: u32,
    bbox2: vec3f,
    tEnd: u32,
    tMat: mat4x4f,
    tMatInv: mat4x4f
};

struct objectInfo {
    translate: vec3f,
    tStart: u32,
    scale: vec3f,
    tEnd: u32,
    rotate: vec4f
}

const EPSILON = 0.0001;
const EPSILONV = vec3f(EPSILON, EPSILON, EPSILON);
const HUGE = 100000.0;

@group(0) @binding(0) var<storage, read> triangles: array<triangle>;
@group(0) @binding(1) var<storage, read> triPoints: array<vec3f>;
@group(0) @binding(2) var<storage, read_write> objects: array<object>;
@group(0) @binding(3) var<storage, read> objectsInfo: array<objectInfo>;

@compute @workgroup_size(1) fn transform(@builtin(global_invocation_id) id: vec3u) {
    var obj: object;
    let objInfo = objectsInfo[id.x];
    let t = objInfo.translate;
    let s = objInfo.scale;

    var bbox1 = vec3f(HUGE, HUGE, HUGE);
    var bbox2 = vec3f(-HUGE, -HUGE, -HUGE);

    for (var i: u32 = objInfo.tStart; i <= objInfo.tEnd; i++) {
        let tri = triangles[i];
        let p1 = triPoints[tri.points.x];
        let p2 = triPoints[tri.points.y];
        let p3 = triPoints[tri.points.z];
        bbox1 = min(bbox1, p1);
        bbox1 = min(bbox1, p2);
        bbox1 = min(bbox1, p3);
        bbox2 = max(bbox2, p1);
        bbox2 = max(bbox2, p2);
        bbox2 = max(bbox2, p3);
    }

    bbox1 *= s;
    bbox1 += t;

    bbox2 *= s;
    bbox2 += t;

    bbox1 -= EPSILONV;
    bbox2 += EPSILONV;

    obj.bbox1 = bbox1;
    obj.bbox2 = bbox2;
    obj.tStart = objInfo.tStart;
    obj.tEnd = objInfo.tEnd;

    obj.tMat = mat4x4f(s.x, 0, 0, 0, 0, s.y, 0, 0, 0, 0, s.z, 0, t.x, t.y, t.z, 1);
    obj.tMatInv = inverse(obj.tMat);

    objects[id.x] = obj;
}

  fn inverse(m: mat4x4f) -> mat4x4f {
    let a00 = m[0][0]; let a01 = m[0][1]; let a02 = m[0][2]; let a03 = m[0][3];
    let a10 = m[1][0]; let a11 = m[1][1]; let a12 = m[1][2]; let a13 = m[1][3];
    let a20 = m[2][0]; let a21 = m[2][1]; let a22 = m[2][2]; let a23 = m[2][3];
    let a30 = m[3][0]; let a31 = m[3][1]; let a32 = m[3][2]; let a33 = m[3][3];

    let b00 = a00 * a11 - a01 * a10;
    let b01 = a00 * a12 - a02 * a10;
    let b02 = a00 * a13 - a03 * a10;
    let b03 = a01 * a12 - a02 * a11;
    let b04 = a01 * a13 - a03 * a11;
    let b05 = a02 * a13 - a03 * a12;
    let b06 = a20 * a31 - a21 * a30;
    let b07 = a20 * a32 - a22 * a30;
    let b08 = a20 * a33 - a23 * a30;
    let b09 = a21 * a32 - a22 * a31;
    let b10 = a21 * a33 - a23 * a31;
    let b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    return mat4x4f(
        a11 * b11 - a12 * b10 + a13 * b09,
        a02 * b10 - a01 * b11 - a03 * b09,
        a31 * b05 - a32 * b04 + a33 * b03,
        a22 * b04 - a21 * b05 - a23 * b03,
        a12 * b08 - a10 * b11 - a13 * b07,
        a00 * b11 - a02 * b08 + a03 * b07,
        a32 * b02 - a30 * b05 - a33 * b01,
        a20 * b05 - a22 * b02 + a23 * b01,
        a10 * b10 - a11 * b08 + a13 * b06,
        a01 * b08 - a00 * b10 - a03 * b06,
        a30 * b04 - a31 * b02 + a33 * b00,
        a21 * b02 - a20 * b04 - a23 * b00,
        a11 * b07 - a10 * b09 - a12 * b06,
        a00 * b09 - a01 * b07 + a02 * b06,
        a31 * b01 - a30 * b03 - a32 * b00,
        a20 * b03 - a21 * b01 + a22 * b00) * (1 / det);
  }
