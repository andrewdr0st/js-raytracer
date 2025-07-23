export class Pipeline {
    constructor(shader, layout, bindGroups) {
        this.shader = shader;
        this.layout = layout;
        this.bindGroups = bindGroups;
        this.pipeline;
    }

    async build() {
        return loadWGSLShader(this.shader).then(shader => {
            const module = device.createShaderModule({code: shader});
            const pipelineLayout = device.createPipelineLayout({bindGroupLayouts: layout});
            this.pipeline = device.createComputePipeline({
                layout: pipelineLayout,
                compute: {module: module}
            });
        });
    }

    run(encoder, x=1, y=1, z=1) {
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        this.setBindGroups(pass);
        pass.dispatchWorkgroups(x, y, z);
        pass.end();
    }

    runIndirect(encoder, buffer, offset) {
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        this.setBindGroups(pass);
        pass.dispatchWorkgroupsIndirect(buffer, offset);
        pass.end();
    }

    setBindGroups(pass) {
        for (let i = 0; i < 4; i++) {
            if (this.bindGroups[i]) {
                pass.setBindGroup(i, this.bindGroups[i].group)
            }
        }
    }
}