
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

const blackBorders = false;
const staticRender = false;
const pixelScaleFactor = 1;

let debugFramerate = false;

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

let scene = new WavefrontScene();

let cameraFVel = 0;
let cameraRVel = 0;
let moveSpeed = 10.5;

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
    if (debugFramerate) {
        console.log(1 / deltaTime);
    }
    let camera = scene.camera;

    if (!staticRender) {
        let moveVec = vnorm(vadd(vscalar(camera.forward, cameraFVel), vscalar(camera.right, cameraRVel)));
        camera.pos = vadd(camera.pos, vscalar(moveVec, deltaTime * moveSpeed));
        camera.lookTo = [Math.sin(cameraTheta) * Math.cos(cameraPhi), Math.sin(cameraPhi), Math.cos(cameraTheta) * Math.cos(cameraPhi)];
    }

    camera.init();

    await runGPUThing();

    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    if (staticRender) {
        camera.updateStatic();
    } 

    //requestAnimationFrame(loop);
}

async function initGPU() {
    if (await setupGPUDevice(tempCanvas, staticRender)) {
        await scene.setup(w, h);
        if (staticRender) {
            scene.camera.realtimeMode = false;
        } else {
            //scene.camera.pos = [0, 1, 0];
        }
        scene.camera.antialiasing = true;
        setupBindGroups(scene);
        //await calculateTransforms(scene);
        requestAnimationFrame(loop);
    }
}

async function runGPUThing() {
    await renderGPU(scene, staticRender);
}

initGPU();
