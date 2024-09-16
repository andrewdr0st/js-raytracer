
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

const blackBorders = false;
const pixelScaleFactor = 2;

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

canvas.onclick = () => {
    canvas.requestPointerLock();
}

ctx.imageSmoothingEnabled = false;

const w = Math.floor(canvasW / pixelScaleFactor);
const h = Math.floor(canvasH / pixelScaleFactor);

let camera = new Camera([0, 0, 0], [0, 0,-1], w, h, 90.0);

camera.bounceCount = 8;
camera.raysPerPixel = 64;

const tempCanvas = document.createElement('canvas');
tempCanvas.width = w;
tempCanvas.height = h;

let cameraFVel = 0;
let cameraRVel = 0;
let moveSpeed = 1.5;

let cameraTheta = Math.PI;
let cameraPhi = 0;
let cameraPhiBound = Math.PI * 0.475;
let sensitivity = 0.005;

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

let sphereList = [
    new Sphere(0, 0, -1, 0.5, 1, 1, 1, 0),
    new Sphere(-2, 1, -3, 0.75, 0, 0, 1, 0),
    new Sphere(0, 15, -30, 12, 1, 1, 1, 1),
    new Sphere(0, 3, 5, 0.75, 1, 0, 0, 0.9),
    new Sphere(6, -1, 0, 1, 0.8, 0.3, 0.5, 0),
    new Sphere(-2, 0.3, -1, 0.2, 0.1, 0.1, 0.3, 0),
    new Sphere(-2, 0.3, -0.85, 0.1, 0, 0, 0.1, 0),
    new Sphere(0, -50, 0, 49, 0.6, 0.9, 0.5, 0)
];

let triList = [
    new Triangle(-3, 0, -1, -1, 0, -1, -2, 1, -1, 0, 0.4, 0.1),
    new Triangle(5.5, -4, -4, 6, -2, -3, 5.5, -2, -4, 0.5, 0.2, 0),
    new Triangle(5.5, -4, -4, 6, -4, -3, 6, -2, -3, 0.5, 0.2, 0),
    new Triangle(6, -4, -3, 8, -2, -3, 6, -2, -3, 0.4, 0.1, 0),
    new Triangle(6, -4, -3, 8, -4, -3, 8, -2, -3, 0.4, 0.1, 0),
    new Triangle(6, -2, -3, 8, -2, -4, 5.5, -2, -4, 0.2, 0.8, 0.1),
    new Triangle(6, -2, -3, 8, -2, -3, 8, -2, -4, 0.2, 0.8, 0.1)
];

let lastFrameTime = 0;
let fps = 0;

async function loop(currentTime) {
    const deltaTime = (currentTime - lastFrameTime) * 0.001;
    lastFrameTime = currentTime;

    let moveVec = vnorm(vadd(vscalar(camera.forward, cameraFVel), vscalar(camera.right, cameraRVel)));
    camera.pos = vadd(camera.pos, vscalar(moveVec, deltaTime * moveSpeed));

    camera.lookTo = [Math.sin(cameraTheta) * Math.cos(cameraPhi), Math.sin(cameraPhi), Math.cos(cameraTheta) * Math.cos(cameraPhi)];
    camera.init();

    await runGPUThing();

    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    fps = 1 / deltaTime;
    //console.log(`FPS: ${Math.round(fps)}`);

    requestAnimationFrame(loop);
}

async function initGPU() {
    if (await setupGPUDevice(tempCanvas)) {
        requestAnimationFrame(loop);
    }
}

async function runGPUThing() {
    await renderGPU(camera, sphereList, triList);
}

initGPU();