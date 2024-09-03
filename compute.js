let adapter;
let device;
let raytraceModule;
let pipeline;

async function setupGPUDevice() {
    adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        fail('need a browser that supports WebGPU');
        return false;
    }

    raytraceModule = device.createShaderModule({
        label: "Raytrace module",
        code: `
            @group(0) @binding(0) var<uniform> sphere: vec4<f32>;
            @group(0) @binding(1) var<uniform> camera: vec3<f32>;
            @group(0) @binding(2) var<uniform> dimensions: vec2<u32>;
            @group(1) @binding(0) var<storage, read_write> rays: array<f32>;
            @group(2) @binding(0) var<storage, read_write> colors: array<f32>;

            @compute @workgroup_size(1) fn rayColor(@builtin(global_invocation_id) id: vec3u) {
                let center: vec3<f32> = sphere.xyz;
                let radius: f32 = sphere.w;
                let rOffset: u32 = (id.x + dimensions.x * id.y) * 3;
                let ray: vec3<f32> = vec3<f32>(rays[rOffset], rays[rOffset + 1], rays[rOffset + 2]);

                let oc: vec3<f32> = center - camera;
                let a: f32 = dot(ray, ray);
                let b: f32 = -2.0 * dot(ray, oc);
                let c: f32 = dot(oc, oc) - radius * radius;
                let discriminant: f32 = b * b - 4 * a * c;

                let col: vec3<f32> = select(vec3<f32>(0, 0, 0), vec3<f32>(1, 1, 1), discriminant >= 0);

                colors[rOffset + 0] = col.r;
                colors[rOffset + 1] = col.g;
                colors[rOffset + 2] = col.b;
            }
        `
    });

    console.log(raytraceModule);

    pipeline = device.createComputePipeline({
        label: "raytrace pipeline",
        layout: "auto",
        compute: {
            module: raytraceModule
        }
    });

    return true;
}

async function renderGPU(camera) {

    const sphereBuffer = device.createBuffer({
        label: "sphere uniform buffer",
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(sphereBuffer, 0, new Float32Array([0, 0, -1, 0.5]));
}
