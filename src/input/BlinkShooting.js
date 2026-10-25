// Webcam long-blink shooting for Tank Arena (Player 1).
// MediaPipe Face Landmarker blendshapes; no footage is stored.

export const LONG_BLINK_DURATION_MS = 1000;
export const EYE_CLOSED_THRESHOLD = 0.6;
export const EYE_OPEN_THRESHOLD = 0.45;
export const SMOOTHING = 0.4;
export const FIRE_FLASH_MS = 500;

const MEDIAPIPE_VERSION = "0.10.32";
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export function createBlinkTracker() {
  return {
    left: 0,
    right: 0,
    closed: false,
    closedAt: 0,
    firedThisClose: false,
    chargeMs: 0,
    fireFlashUntil: 0,
  };
}

export function resetBlinkTracker(tracker) {
  tracker.closed = false;
  tracker.closedAt = 0;
  tracker.firedThisClose = false;
  tracker.chargeMs = 0;
}

export function tickBlinkTracker(tracker, now, facePresent, leftRaw, rightRaw) {
  if (!facePresent) {
    resetBlinkTracker(tracker);
    tracker.left = 0;
    tracker.right = 0;
    return {
      shouldFire: false,
      eyes: "NO FACE",
      chargeMs: 0,
      fireFlash: now < tracker.fireFlashUntil,
    };
  }

  tracker.left += (Number(leftRaw) - tracker.left) * SMOOTHING;
  tracker.right += (Number(rightRaw) - tracker.right) * SMOOTHING;

  const bothClosed =
    tracker.left >= EYE_CLOSED_THRESHOLD && tracker.right >= EYE_CLOSED_THRESHOLD;
  const bothOpen =
    tracker.left < EYE_OPEN_THRESHOLD && tracker.right < EYE_OPEN_THRESHOLD;

  if (!tracker.closed && bothClosed) {
    tracker.closed = true;
    tracker.closedAt = now;
    tracker.firedThisClose = false;
  } else if (tracker.closed && bothOpen) {
    tracker.closed = false;
    tracker.closedAt = 0;
    tracker.firedThisClose = false;
    tracker.chargeMs = 0;
  }

  let shouldFire = false;
  if (tracker.closed) {
    tracker.chargeMs = Math.min(LONG_BLINK_DURATION_MS, now - tracker.closedAt);
    if (!tracker.firedThisClose && now - tracker.closedAt >= LONG_BLINK_DURATION_MS) {
      tracker.firedThisClose = true;
      shouldFire = true;
      tracker.fireFlashUntil = now + FIRE_FLASH_MS;
    }
  } else {
    tracker.chargeMs = 0;
  }

  return {
    shouldFire,
    eyes: tracker.closed ? "CLOSED" : "OPEN",
    chargeMs: tracker.chargeMs,
    fireFlash: now < tracker.fireFlashUntil,
  };
}

function blendshapeScore(blendshapes, name) {
  const categories = blendshapes?.categories ?? [];
  const hit = categories.find(
    (entry) => entry.categoryName === name || entry.displayName === name,
  );
  return Number(hit?.score) || 0;
}

export class BlinkShooting {
  constructor({ video, onFire, isAllowed, onStatus } = {}) {
    this.video = video;
    this.onFire = onFire;
    this.isAllowed = isAllowed;
    this.onStatus = onStatus;
    this.enabled = false;
    this.camera = "OFF";
    this.error = "";
    this.tracker = createBlinkTracker();
    this.lastResult = {
      shouldFire: false,
      eyes: "--",
      chargeMs: 0,
      fireFlash: false,
    };
    this.landmarker = null;
    this.landmarkerPromise = null;
    this.stream = null;
    this.raf = 0;
    this.lastVideoTime = -1;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      camera: this.camera,
      eyes: this.lastResult.eyes,
      chargeMs: Math.round(this.lastResult.chargeMs),
      fireFlash: this.lastResult.fireFlash,
      error: this.error,
    };
  }

  async enable() {
    if (this.enabled) return;
    this.error = "";
    this.camera = "REQUESTING";
    this.emitStatus();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
    } catch (error) {
      this.camera = "DENIED";
      this.error = permissionMessage(error);
      this.emitStatus();
      return;
    }

    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play().catch(() => {});

    this.camera = "LOADING";
    this.emitStatus();

    try {
      this.landmarker = await this.loadLandmarker();
    } catch (error) {
      this.stopCamera();
      this.camera = "ERROR";
      this.error = "Face tracking failed to load. Check the network and try again.";
      this.emitStatus();
      console.warn("Blink shooting model failed to load.", error);
      return;
    }

    this.enabled = true;
    this.camera = "ACTIVE";
    this.lastVideoTime = -1;
    this.tracker = createBlinkTracker();
    this.emitStatus();
    this.loop();
  }

  disable() {
    this.enabled = false;
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.stopCamera();
    resetBlinkTracker(this.tracker);
    this.lastResult = {
      shouldFire: false,
      eyes: "--",
      chargeMs: 0,
      fireFlash: false,
    };
    this.camera = "OFF";
    this.error = "";
    this.emitStatus();
  }

  stopCamera() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  async loadLandmarker() {
    if (this.landmarker) return this.landmarker;
    if (this.landmarkerPromise) return this.landmarkerPromise;

    this.landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      };
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "GPU" },
        });
      } catch {
        return await FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" },
        });
      }
    })();

    try {
      this.landmarker = await this.landmarkerPromise;
      return this.landmarker;
    } catch (error) {
      this.landmarkerPromise = null;
      throw error;
    }
  }

  loop = () => {
    if (!this.enabled) return;
    this.raf = window.requestAnimationFrame(this.loop);

    const video = this.video;
    if (!video || video.readyState < 2) return;
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;

    const now = performance.now();
    let facePresent = false;
    let left = 0;
    let right = 0;

    try {
      const result = this.landmarker.detectForVideo(video, now);
      const blend = result?.faceBlendshapes?.[0];
      facePresent = Boolean(blend);
      if (facePresent) {
        left = blendshapeScore(blend, "eyeBlinkLeft");
        right = blendshapeScore(blend, "eyeBlinkRight");
      }
    } catch {
      facePresent = false;
    }

    const tick = tickBlinkTracker(this.tracker, now, facePresent, left, right);
    this.lastResult = tick;
    if (tick.shouldFire && this.isAllowed?.()) {
      this.onFire?.();
    }
    this.emitStatus();
  };

  emitStatus() {
    this.onStatus?.(this.getStatus());
  }
}

function permissionMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission denied. Enable the webcam to use blink shooting.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No webcam found.";
  }
  if (name === "NotReadableError") {
    return "Webcam is already in use by another app.";
  }
  if (window.isSecureContext === false) {
    return "Webcam needs localhost or HTTPS.";
  }
  return "Webcam is unavailable.";
}
