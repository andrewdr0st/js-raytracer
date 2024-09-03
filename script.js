
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

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

ctx.imageSmoothingEnabled = false;

const w = Math.floor(canvasW / pixelScaleFactor);
const h = Math.floor(canvasH / pixelScaleFactor);

let imageData = ctx.createImageData(w, h);

let camera = new Camera([0, 0, 0], [0, 0, -1], w, h, 90.0);

const tempCanvas = document.createElement('canvas');
tempCanvas.width = w;
tempCanvas.height = h
const tmpCtx = tempCanvas.getContext('2d');

camera.render(imageData);
tmpCtx.putImageData(imageData, 0, 0);
ctx.drawImage(tempCanvas, 0, 0, w, h, 0, 0, canvasW, canvasH);

let lastFrameTime = 0;
let fps = 0;
let cameraTilt = 0;
let ctd = 10;

function loop(currentTime) {
    const deltaTime = (currentTime - lastFrameTime) * 0.001;
    lastFrameTime = currentTime;

    cameraTilt += ctd * deltaTime;
    if ((cameraTilt > 45 && ctd > 0) || (cameraTilt < -45 && ctd < 0)) {
        ctd *= -1;
    }
    camera.lookAt[1] = Math.tan(deg2rad(cameraTilt));
    camera.init();

    camera.render(imageData);
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, w, h, 0, 0, canvasW, canvasH);

    fps = 1 / deltaTime;
    console.log(`FPS: ${Math.round(fps)}`);

    requestAnimationFrame(loop);
}

//requestAnimationFrame(loop);
async function runGPUThing() {
    if (await setupGPUDevice()) {
        renderGPU(camera)
    } else {
        console.log("NOOOO");
    }
}

runGPUThing();