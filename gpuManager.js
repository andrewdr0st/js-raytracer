let adapter;
export let device;
export let computeContext;

export async function setupGPUDevice(canvas) {
    adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        alert('need a browser that supports WebGPU');
        return false;
    }

    computeContext = canvas.getContext("webgpu");
    computeContext.configure({
        device,
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_DST
    });

    return true;
}
