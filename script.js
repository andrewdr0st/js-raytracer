
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

const blackBorders = false;
const pixelScaleFactor = 4;

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

let camera = new Camera([0, 0, 2], [0, 0,-1], w, h, 90.0);

camera.backgroundColor = [0.45, 0.45, 0.82];

camera.bounceCount = 4;
camera.raysPerPixel = 16;

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

let greenMat = new Material(0.05, 0.4, 0.1, 0);
let grayMat = new Material(0.5, 0.5, 0.5, 0);
let glowMat = new Material(0.6, 0.6, 0.7, 0.8);
let blueMat = new Material(0, 0, 1, 0);
let sunMat = new Material(1, 1, 1, 1);
let metalMat = new Material(0.8, 0.3, 0.5, 0, 0.9, 0.1, 0, 0);

let materialList = [
    greenMat, grayMat, glowMat
];

let cubeGuy = new Mesh();
cubeGuy.setMaterial(grayMat);

let groundGuy = new Mesh();
groundGuy.setMaterial(greenMat);

let prismGuy = new Mesh();
prismGuy.setMaterial(glowMat);

let meshList = [
    cubeGuy,
    groundGuy,
    prismGuy
];

let sphereList = [
    new Sphere(-2, 1, -3, 0.75, blueMat.id),
    new Sphere(0, 15, -30, 12, sunMat.id),
    new Sphere(6, -1, 0, 1, metalMat.id)
];

const tempCanvas = document.createElement('canvas');
tempCanvas.width = w;
tempCanvas.height = h;

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

async function loadObjs() {
    await cubeGuy.parseObjFile("cube.obj");
    await groundGuy.parseObjFile("plane.obj");
    groundGuy.scale([15, 1, 10]);
    groundGuy.translate([0, -1, 0]);
    await prismGuy.parseObjFile("prism.obj");
    prismGuy.scale([1, 2, 1]);
    prismGuy.translate([-5, 2, 2]);
    initGPU();
}

async function initGPU() {
    if (await setupGPUDevice(tempCanvas)) {
        requestAnimationFrame(loop);
    }
}

async function runGPUThing() {
    await renderGPU(camera, materialList, meshList, sphereList);
}

loadObjs();
