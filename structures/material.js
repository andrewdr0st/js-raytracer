export class Material {
    constructor(roughness, metallic, refractiveIndex) {
        this.roughness = roughness;
        this.metallic = metallic;
        this.refractiveIndex = refractiveIndex;
        this.data = new Float32Array([roughness, metallic, refractiveIndex]);
    }
}