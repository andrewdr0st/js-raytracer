class InfScene extends Scene {
    setupCamera(w, h) {
        this.camera = new Camera([0, 16, 0], [0, -1, -0.1], w, h, 70.0);
        this.camera.backgroundColor = [0.1, 0.1, 0.1];
        this.camera.bounceCount = 1;
        this.camera.raysPerPixel = 1;
    }
}