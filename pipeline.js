export class Pipeline {
    /**
     * @param {String} shader - shader filename
     * @param {GPUPipelineLayout} layout - pipeline layout
     * @param {Array} bindGroups - array of bind groups
     */
    constructor(shader, layout, bindGroups) {
        this.shader = shader;
        this.layout = layout;
        this.bindGroups = bindGroups;
        this.pipeline;
    }

    /**
     * Loads the pipeline's shader module and builds the compute pipeline
     * @returns {Promise}
     */
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

    /**
     * Runs the pipeline
     * @param {GPUCommandEncoder} encoder 
     * @param {Number} x 
     * @param {Number} y 
     * @param {Number} z 
     */
    run(encoder, x=1, y=1, z=1) {
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        this.setBindGroups(pass);
        pass.dispatchWorkgroups(x, y, z);
        pass.end();
    }

    /**
     * Runs the pipeline with an indirect dispatch
     * @param {GPUCommandEncoder} encoder 
     * @param {GPUBuffer} buffer 
     * @param {Number} offset 
     */
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
                pass.setBindGroup(i, this.bindGroups[i])
            }
        }
    }
}