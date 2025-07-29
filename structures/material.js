export const MATERIAL_BYTE_SIZE = 16;

export class Material {
    /**
     * @param {Number} roughness - value from 0-1 where 0 is fully smooth and 1 is fully rough
     * @param {Number} metallic - value from 0-1 where 0 is nonmetal and 1 is metal
     * @param {Number} refractiveIndex 
     */
    constructor(roughness, metallic, refractiveIndex) {
        this.roughness = roughness;
        this.metallic = metallic;
        this.refractiveIndex = refractiveIndex;
        this.data = new Float32Array([roughness, metallic, refractiveIndex]);
    }
}