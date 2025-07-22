export class BindGroup {
    constructor(layout, buffers) {
        this.layout = layout;
        this.group;
        this.buffers = buffers;
    }

    build() {
        let bufferEntries = [];
        for (let i = 0; i < this.buffers.length; i++) {
            if (this.buffers[i]) {
                bufferEntries.push({ binding: i, resource: { buffer: this.buffers[i] } });
            }
        }
        this.group = device.createBindGroup({
            layout: this.layout,
            entries: bufferEntries
        });
    }
}