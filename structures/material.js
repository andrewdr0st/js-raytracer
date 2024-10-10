let materialId = 0;

class Material {
    constructor(r, g, b, e, reflectC=0, fuzz=0, refractC=0, ri=0) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.e = e;
        this.reflectC = reflectC;
        this.fuzz = fuzz;
        this.refractC = refractC;
        this.ri = ri;
        this.id = materialId++;
    }

    getValues() {
        return [this.r, this.g, this.b, this.e, this.reflectC, this.fuzz, this.refractC, this.ri];
    }
}

async function loadImage(path) {
    const response = await fetch("textures/" + path);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}