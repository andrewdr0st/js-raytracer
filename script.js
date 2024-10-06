
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

const blackBorders = false;
const staticRender = true;
const pixelScaleFactor = 1;

canvas.width = Math.floor(window.innerWidth / pixelScaleFactor) * pixelScaleFactor;
canvas.height = Math.floor(window.innerHeight / pixelScaleFactor) * pixelScaleFactor;

if (!blackBorders) {
    if (canvas.width < window.innerWidth) {
        canvas.width += pixelScaleFactor;
    }
    if (canvas.height < window.innerHeight) {
        canvas.height += pixelScaleFactor;
    }
}

const canvasW = ctx.canvas.width;
const canvasH = ctx.canvas.height;

ctx.imageSmoothingEnabled = false;

const w = Math.floor(canvasW / pixelScaleFactor);
const h = Math.floor(canvasH / pixelScaleFactor);

let scene = new OrbScene();

let cameraFVel = 0;
let cameraRVel = 0;
let moveSpeed = 1.5;

let cameraTheta = Math.PI;
let cameraPhi = 0;
let cameraPhiBound = Math.PI * 0.475;
let sensitivity = 0.005;

if (!staticRender) {
    canvas.onclick = () => {
        canvas.requestPointerLock();
    }

    document.addEventListener("keydown", (e) => {
        if (e.key == 'w') {
            cameraFVel = 1;
        } else if (e.key == 's') {
            cameraFVel = -1;
        } else if (e.key == 'a') {
            cameraRVel = -1;
        } else if (e.key == 'd') {
            cameraRVel = 1;
        }
    });

    document.addEventListener("keyup", (e) => {
        if (e.key == 'w') {
            cameraFVel = 0;
        } else if (e.key == 's') {
            cameraFVel = 0;
        } else if (e.key == 'a') {
            cameraRVel = 0;
        } else if (e.key == 'd') {
            cameraRVel = 0;
        }
    });

    document.addEventListener("mousemove", (e) => {
        let deltaTheta = -e.movementX * sensitivity;
        cameraTheta += deltaTheta;
        if (cameraTheta < -Math.PI) {
            cameraTheta += Math.PI * 2;
        } else if (cameraTheta > Math.PI) {
            cameraTheta -= Math.PI * 2;
        }
        let deltaPhi = -e.movementY * sensitivity;
        cameraPhi += deltaPhi;
        cameraPhi = Math.min(Math.max(cameraPhi, -cameraPhiBound), cameraPhiBound);
    });
}

const tempCanvas = document.createElement('canvas');
tempCanvas.width = w;
tempCanvas.height = h;

let lastFrameTime = 0;



async function loop(currentTime) {
    const deltaTime = (currentTime - lastFrameTime) * 0.001;
    lastFrameTime = currentTime;
    let camera = scene.camera;

    if (staticRender) {
        camera.updateStatic();
    } else {
        let moveVec = vnorm(vadd(vscalar(camera.forward, cameraFVel), vscalar(camera.right, cameraRVel)));
        camera.pos = vadd(camera.pos, vscalar(moveVec, deltaTime * moveSpeed));
        camera.lookTo = [Math.sin(cameraTheta) * Math.cos(cameraPhi), Math.sin(cameraPhi), Math.cos(cameraTheta) * Math.cos(cameraPhi)];
    }

    camera.init();

    await runGPUThing();

    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    requestAnimationFrame(loop);
}

async function initGPU() {
    if (staticRender) {
        if (await setupGPUDeviceStaticRender(tempCanvas)) {
            await scene.setup(w, h);
            requestAnimationFrame(loop);
        }
    } else {
        if (await setupGPUDevice(tempCanvas)) {
            await scene.setup(w, h);
            scene.camera.pos = [0, 1, 0];
            requestAnimationFrame(loop);
        }
    }
}

async function runGPUThing() {
    if (staticRender) {
        await renderGPUStatic(scene);
    } else {
        await renderGPU(scene);
    }
}

initGPU();
