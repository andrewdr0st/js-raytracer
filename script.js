
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

const tempCanvas = document.createElement('canvas');
tempCanvas.width = w;
tempCanvas.height = h;

let cameraZVel = 0;
let cameraXVel = 0;

document.addEventListener("keydown", (e) => {
    if (e.key == 'w') {
        cameraZVel = -1;
    } else if (e.key == 's') {
        cameraZVel = 1;
    } else if (e.key == 'a') {
        cameraXVel = -1;
    } else if (e.key == 'd') {
        cameraXVel = 1;
    }
});

document.addEventListener("keyup", (e) => {
    if (e.key == 'w') {
        cameraZVel = 0;
    } else if (e.key == 's') {
        cameraZVel = 0;
    } else if (e.key == 'a') {
        cameraXVel = 0;
    } else if (e.key == 'd') {
        cameraXVel = 0;
    }
});

let sphereList = [
    new Sphere(0, 0, -1, 0.5, 1, 1, 1),
    new Sphere(-2, 1, -3, 0.75, 0, 0, 1),
    new Sphere(0, 10, -20, 8, 1, 1, 0.5),
    new Sphere(0, 3, 4, 0.5, 1, 0, 0),
    new Sphere(6, -1, 0, 1, 0.8, 0.3, 0.5),
    new Sphere(-2, 0.3, -1, 0.2, 0.1, 0.1, 0.3),
    new Sphere(-2, 0.3, -0.85, 0.1, 0, 0, 0.1)
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
let cameraTilt = 0;
let ctd = 10;

async function loop(currentTime) {
    const deltaTime = (currentTime - lastFrameTime) * 0.001;
    lastFrameTime = currentTime;

    cameraTilt += ctd * deltaTime;
    if ((cameraTilt > 45 && ctd > 0) || (cameraTilt < -45 && ctd < 0)) {
        ctd *= -1;
    }
    //camera.lookAt[1] = Math.tan(deg2rad(cameraTilt));
    let cameraZMove = cameraZVel * deltaTime;
    let cameraXMove = cameraXVel * deltaTime;
    camera.pos[2] = camera.pos[2] + cameraZMove;
    camera.pos[0] = camera.pos[0] + cameraXMove;
    camera.lookAt[2] = camera.pos[2] - 1;
    camera.lookAt[0] = camera.pos[0];
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