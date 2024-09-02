
function linear2gamma(c) {
    return c > 0 ? Math.sqrt(c) : 0;
}

function clerp(a, c1, c2) {
    return vadd(vscalar(c1, 1.0 - a), vscalar(c2, a));
}

function setPixel(imageData, x, y, r, g, b, a) {
    let index = (x + y * w) * 4;
    imageData.data[index + 0] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a;
}

function colorPixel(imageData, x, y, c) {
    c = colorFormat(c);
    setPixel(imageData, x, y, c[0], c[1], c[2], 255);
}

function colorFormat(c) {
    return [
        Math.floor(linear2gamma(c[0]) * 255.999),
        Math.floor(linear2gamma(c[1]) * 255.999),
        Math.floor(linear2gamma(c[2]) * 255.999)
    ];
}
