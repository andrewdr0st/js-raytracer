let materialId = 0;

class Material {
    constructor(r, g, b, e, reflectC=0, fuzz=0, ri=0, tex=-1, texA = 0, density = 0, useBDRF = 0, fresnel = 0) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.e = e;
        this.reflectC = reflectC;
        this.fuzz = fuzz;
        this.ri = ri;
        this.density = density > 0 ? -1 / density : 0;
        this.tex = tex;
        this.texA = texA;
        this.useBDRF = useBDRF;
        this.fresnel = fresnel;
        this.id = materialId++;
    }

    getValues() {
        return [this.r, this.g, this.b, this.e, this.reflectC, this.fuzz, this.ri, this.density, 0, 0, 0, this.fresnel];
    }

    getTex() {
        return new Int32Array([this.tex, this.texA, this.useBDRF]);
    }
}

async function loadImage(path) {
    const response = await fetch("textures/" + path);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}