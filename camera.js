import { device } from "./gpuManager.js";
const { vec3, utils } = wgpuMatrix;

const CAMERA_BYTE_SIZE = 128;
export let cameraBuffer;

export class Camera {
    constructor(pos, lookTo, imgW, imgH, fov) {
        this.pos = pos;
        this.lookTo = lookTo;
        this.forward;
        this.right;
        this.imgW = imgW;
        this.imgH = imgH;

        this.backgroundColor = [0, 0, 0];

        this.fov = fov;
        this.up = [0, 1, 0];
        this.focusDist = 1.0;
        this.defocusAngle = 0.15;
        this.defocusU = [0, 0, 0];
        this.defocusV = [0, 0, 0];

        this.gridX = 0;
        this.gridStepX = 1;
        this.gridY = 0;
        this.gridStepY = 1;

        this.raysPerPixel = 16;
        this.bounceCount = 4;
        this.antialiasing = false;
        this.realtimeMode = true;
        this.seed = 0;
        this.frameCount = 1;

        this.init();
    }

    init() {
        let h = Math.tan(utils.degToRad(this.fov) / 2);
        this.viewportH = 2.0 * h * this.focusDist;
        this.viewportW = this.viewportH * (this.imgW / this.imgH);

        this.lookTo = vec3.normalize(this.lookTo);
        this.lookAt = vec3.add(this.pos, this.lookTo);
        this.right = vec3.normalize(vec3.cross(this.lookTo, this.up));
        this.forward = vec3.normalize(vec3.cross(this.up, this.right));

        let w = vec3.normalize(vec3.sub(this.pos, this.lookAt));
        let u = vec3.normalize(vec3.cross(this.up, w));
        let v = vec3.cross(w, u);

        this.viewportU = vec3.scale(u, this.viewportW);
        this.viewportV = vec3.scale(vec3.scale(v, -1), this.viewportH);

        this.pixelDeltaU = vec3.divScalar(this.viewportU, this.imgW);
        this.pixelDeltaV = vec3.divScalar(this.viewportV, this.imgH);

        let viewplanePos = vec3.sub(this.pos, vec3.scale(w, this.focusDist));
        let viewplaneVec = vec3.add(vec3.divScalar(this.viewportU, 2), vec3.divScalar(this.viewportV, 2));
        this.viewportUpperLeft = vec3.sub(viewplanePos, viewplaneVec);
        this.topLeftPixel = vec3.add(this.viewportUpperLeft, vec3.scale(vec3.add(this.pixelDeltaU, this.pixelDeltaV), 0.5));

        let defocusRadius = this.focusDist * Math.tan(utils.degToRad(this.defocusAngle / 2));
        this.defocusU = vec3.scale(u, defocusRadius);
        this.defocusV = vec3.scale(v, defocusRadius);
    }

    /**
     * Writes the camera's data to the camera buffer
     */
    writeToBuffer() {
        device.queue.writeBuffer(cameraBuffer, 0, new Float32Array(this.pos));
        device.queue.writeBuffer(cameraBuffer, 12, new Int32Array([this.raysPerPixel]));
        device.queue.writeBuffer(cameraBuffer, 16, new Float32Array(this.topLeftPixel));
        device.queue.writeBuffer(cameraBuffer, 28, new Int32Array([this.bounceCount]));
        device.queue.writeBuffer(cameraBuffer, 32, new Float32Array(this.pixelDeltaU));
        if (this.antialiasing) {
            device.queue.writeBuffer(cameraBuffer, 44, new Uint32Array([1]));
        } else {
            device.queue.writeBuffer(cameraBuffer, 44, new Uint32Array([0]));
        }
        device.queue.writeBuffer(cameraBuffer, 48, new Float32Array(this.pixelDeltaV));
        device.queue.writeBuffer(cameraBuffer, 64, new Float32Array(this.backgroundColor));

        if (!this.realtimeMode) {
            device.queue.writeBuffer(cameraBuffer, 60, new Int32Array([this.seed]));
            device.queue.writeBuffer(cameraBuffer, 76, new Int32Array([this.frameCount]));
            device.queue.writeBuffer(cameraBuffer, 92, new Uint32Array([this.gridX]));
            device.queue.writeBuffer(cameraBuffer, 108, new Uint32Array([this.gridY]));
        }
        device.queue.writeBuffer(cameraBuffer, 80, new Float32Array(this.defocusU));
        device.queue.writeBuffer(cameraBuffer, 96, new Float32Array(this.defocusV));
        device.queue.writeBuffer(cameraBuffer, 112, new Uint32Array([this.imgW, this.imgH]));
    }

    updateStatic() {
        // this.gridX += 8 * this.gridStepX;
        // if (this.gridX >= this.imgW) {
        //     this.gridX = 0;
        //     this.gridY += 8 * this.gridStepY;
        //     if (this.gridY >= this.imgH) {
        //         this.gridY = 0;
        //         this.seed += 7;
        //         this.frameCount++;
        //     }
        // }
        this.seed++;
    }

    setP(x, y, theta) {
        theta = utils.degToRad(theta);
        this.lookTo = [-Math.cos(theta), -0.5, -Math.sin(theta)];
        this.pos = [x * Math.cos(theta), y, x * Math.sin(theta)];
    }

}

/**
 * Creates the camera buffer. Only needs to be called once.
 */
export function createCameraBuffer() {
    cameraBuffer = device.createBuffer({
        size: CAMERA_BYTE_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
}

