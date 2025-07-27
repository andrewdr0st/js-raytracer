import { device } from "../gpuManager.js";

export let texturesBindGroup;
export let texturesBindGroupLayout;

let textures16Buffer;
let textures16List = [];

export class Texture {
    constructor(bitmap, dimension) {
        this.bitmap = bitmap;
        this.dimension = dimension;
        textures16List.push(this);
    }
}

export async function loadImage(path) {
    const response = await fetch("textures/" + path);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}

export function createTextureArrays() {
    textures16Buffer = device.createTexture({
        size: [16, 16, textures16List.length],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });
    for (let i = 0; i < textures16List.length; i++) {
        device.queue.copyExternalImageToTexture({source: textures16List[i].bitmap}, {texture: textures16Buffer, origin: {z: i}}, [16, 16]);
    }
}

export function createTexturesBindGroup() {
    texturesBindGroup = device.createBindGroup({
        label: "textures bind group",
        layout: texturesBindGroupLayout,
        entries: [
            {binding: 0, resource: textures16Buffer.createView()}
        ]
    });
}

export function createTexturesBindGroupLayout() {
    texturesBindGroupLayout = device.createBindGroupLayout({
        label: "textures layout",
        entries: [
            {   //16x16
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: {format: "rgba8unorm", viewDimension: "2d-array"}
            }
        ]
    });
}