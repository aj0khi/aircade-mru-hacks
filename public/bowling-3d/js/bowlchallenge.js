
const CAMERA_FOV = 50.0;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 10.0;

const FRAME_ROLL_TIME = 3.0;

const GRAB_BALL_THRESHOLD_INCH = 0.05;
const GRAB_BALL_THRESHOLD_INCH_SQUARED = GRAB_BALL_THRESHOLD_INCH * GRAB_BALL_THRESHOLD_INCH;
const GRAB_BALL_ROLL_POS_RATIO = Math.tan(BALL_ANGLE_MAX);

const TRACK_DISTANCE = TRACK_WIDTH + 0.1;

const IMITATION_EMERGING_TIME_MIN = 2.0;
const IMITATION_EMERGING_TIME_MAX = 10.0;
const IMITATION_THROW_TIME_MIN = 3.5;
const IMITATION_THROW_TIME_MAX = 7.0;
const IMITATION_THROW_POSITION_MAX = 0.3;
const IMITATION_THROW_ANGLE_MAX = Math.PI / 18.0;

var container, scene, camera, clock, renderer, ppi, statusLabel;
var touchPoint, raycaster, pickPoint, dragPoint, releaseVector, pickSphere;
var trackProtoMesh, ballProtoMesh, pinProtoMesh;
var players, imitations, scoresDiv;

var imitationPlayerId = 0;
var pickingBall = false;
var positioningBall = false;
var rollingBall = false;
var pickX = 0.0;
var pickY = 0.0;
var pickOffset = 0.0;
var pickTime = 0;
var gyroSwingArmed = true;
var gamePaused = false;

class Player {
	constructor(id, local, physics, scores, ballMesh, pinMeshes) {
		this.id = id;
		this.local = local;
		this.physics = physics;
		this.scores = scores;
		this.ballMesh = ballMesh;
		this.pinMeshes = pinMeshes;
	}
}

class Imitation {
	constructor(frames, emergingTime, slot) {
		this.frames = frames;
		this.waitingTime = emergingTime;
		this.slot = slot;
	}
}

function init() {
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0.035, 0.025, 0.09);

	camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight,
			CAMERA_NEAR, CAMERA_FAR);
	camera.position.set(0.0, 1.7, 5.0);
	camera.rotation.x = -25.0 / 180.0 * Math.PI;

	var ambient = new THREE.AmbientLight(0xaaa0ff, 0.7);
	scene.add(ambient);

	var light = new THREE.DirectionalLight(0x64f4ff, 1.05);
	light.position.set(-0.4, 0.8, 1.0);
	scene.add(light);

	var accentLight = new THREE.PointLight(0xff3fba, 0.75, 5.0);
	accentLight.position.set(0.8, 1.5, 1.8);
	scene.add(accentLight);
	var railLight = new THREE.PointLight(0xffe44a, 0.35, 4.0);
	railLight.position.set(-1.2, 1.2, 0.4);
	scene.add(railLight);

	touchPoint = new THREE.Vector2();
	pickPoint = new THREE.Vector3();
	dragPoint = new THREE.Vector3();
	releaseVector = new THREE.Vector3();
	raycaster = new THREE.Raycaster();
	pickSphere = new THREE.Sphere(new THREE.Vector3(), BALL_RADIUS);

	clock = new THREE.Clock();

	container = document.getElementById("container");

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.gammaOutput = true;
	container.appendChild(renderer.domElement);

	scoresDiv = document.createElement("div");
	scoresDiv.style = "position: fixed; left: 50%; top: 58px; transform: translate(-50%, 0); padding: 8px 12px; color: #f7f3ff; background: rgba(13, 10, 30, 0.86); border: 2px solid #41356e; border-radius: 2px; box-shadow: 3px 3px 0 #080614, 0 0 12px rgba(34, 216, 255, 0.22); white-space: pre; font: 700 12px/1.3 Tahoma, Geneva, sans-serif; letter-spacing: 0.12em;";
	container.appendChild(scoresDiv);
	statusLabel = document.getElementById("headpilot-status");

	// XXX How to get pixel density?
	ppi = 96 * window.devicePixelRatio;

	window.addEventListener("resize", resizeViewport, false);

	var loader = new THREE.GLTFLoader();
	loader.load("res/scene.gltf", (gltf) => {
		trackProtoMesh = gltf.scene.children.find(child => child.name == "Track");
		if (!trackProtoMesh) {
			throw new Error("Track not found");
		}
		ballProtoMesh = gltf.scene.children.find(child => child.name == "Ball");
		if (!ballProtoMesh) {
			throw new Error("Ball not found");
		}
		pinProtoMesh = gltf.scene.children.find(child => child.name == "Pin");
		if (!pinProtoMesh) {
			throw new Error("Pin not found");
		}

		var maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
		setAnisotropy(trackProtoMesh, maxAnisotropy);
		setAnisotropy(ballProtoMesh, maxAnisotropy);
		setAnisotropy(pinProtoMesh, maxAnisotropy);

		Ammo().then((Ammo) => {
			initScene();
		});
	});
}

function setAnisotropy(parent, anisotropy) {
	parent.traverse((object) => {
		if (object.isMesh && object.material && object.material.map) {
			object.material.map.anisotropy = anisotropy;
		}
	});
}

function getLocalPlayer() {
	if (!players) {
		return undefined;
	}
	return players.find(p => p.local);
}

function clampMotionValue(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function onHeadPilotMotion(sample) {
	var localPlayer = getLocalPlayer();
	if (!localPlayer || localPlayer.physics.simulationActive) {
		return;
	}

	var horizontal = Number(sample.horizontal);
	var forward = Number(sample.forward);
	if (!Number.isFinite(horizontal) || !Number.isFinite(forward)) {
		return;
	}

	var position = clampMotionValue(horizontal, -1.0, 1.0) * BALL_POSITION_MAX;
	localPlayer.physics.positionBall(position);

	if (forward <= 0.28) {
		gyroSwingArmed = true;
		setBowlingStatus("AIMING");
	}
	if (gyroSwingArmed && forward >= 0.68) {
		gyroSwingArmed = false;
		var velocity = BALL_VELOCITY_MIN
				+ clampMotionValue(forward, 0.0, 1.0) * (BALL_VELOCITY_MAX - BALL_VELOCITY_MIN);
		var angle = clampMotionValue(horizontal, -1.0, 1.0) * BALL_ANGLE_MAX * 0.35;
		localPlayer.physics.releaseBall(velocity, angle);
		setBowlingStatus("ROLLING");
	}
}

function setBowlingStatus(label) {
	if (statusLabel) {
		statusLabel.textContent = label;
	}
}

function addPlayer(id, local, slot) {
	var physics = new BowlPhysics();

	var scores = new Scores();

	var group = new THREE.Group();
	group.position.x = slot * TRACK_DISTANCE;
	scene.add(group);

	var trackMesh = trackProtoMesh.clone();
	group.add(trackMesh);

	var ballMesh = ballProtoMesh.clone();
	group.add(ballMesh);

	var pinMeshes = new Array(PIN_COUNT);
	for (var i = 0; i < pinMeshes.length; i++) {
		var pinMesh = pinProtoMesh.clone();
		group.add(pinMesh);
		pinMeshes[i] = pinMesh;
	}

	var player = new Player(id, local, physics, scores, ballMesh, pinMeshes);

	if (!players) {
		players = new Array();
	}
	players.push(player);

	return player;
}

function removePlayer(id) {
	if (!players) {
		return;
	}
	for (var i = 0; i < players.length; i++) {
		var player = players[i];
		if (player.id === id) {
			scene.remove(player.ballMesh.parent);
			players.splice(i, 1);
			return;
		}
	}
}

function createImitation(slot) {
	var frames = 1 + Math.floor(Math.random() * FRAME_COUNT);
	var emergingTime = IMITATION_EMERGING_TIME_MIN + Math.random()
			* (IMITATION_EMERGING_TIME_MAX - IMITATION_EMERGING_TIME_MIN);
	return new Imitation(frames, emergingTime, slot);
}

function addImitation(slot) {
	var imitation = createImitation(slot);
	if (!imitations) {
		imitations = new Array();
	}
	imitations.push(imitation);
	return imitation;
}

function restartImitation(imitation) {
	if (imitation.player) {
		removePlayer(imitation.player.id);
	}
	if (!imitations) {
		return;
	}
	var imitationIndex = imitations.findIndex(i => i === imitation);
	if (imitationIndex === undefined) {
		return;
	}
	imitations[imitationIndex] = createImitation(imitation.slot);
}

function updateImitation(imitation, dt) {
	imitation.waitingTime -= dt;
	if (imitation.waitingTime > 0.0) {
		return;
	}

	imitation.waitingTime = IMITATION_THROW_TIME_MIN + Math.random()
			* (IMITATION_THROW_TIME_MAX - IMITATION_THROW_TIME_MIN);

	if (!imitation.player) {
		imitation.player = addPlayer(++imitationPlayerId, false, imitation.slot);
	}

	if (imitation.player.scores.gameOver
			|| (imitation.player.scores.frameNumber >= imitation.frames)) {
		restartImitation(imitation);
		return;
	}

	var position = IMITATION_THROW_POSITION_MAX * 2.0 * (Math.random() - 0.5);
	var angle = IMITATION_THROW_ANGLE_MAX * 2.0 * (Math.random() - 0.5);
	var velocity = BALL_VELOCITY_MIN + Math.random() * (BALL_VELOCITY_MAX - BALL_VELOCITY_MIN);
	imitation.player.physics.positionBall(position, false);
	imitation.player.physics.releaseBall(velocity, angle);
}

function initScene() {
	addPlayer(0, true, 0);

	//addImitation(-1);
	//addImitation(1);

	renderer.domElement.addEventListener("mousedown", onDocumentMouseDown, false);
	renderer.domElement.addEventListener("mousemove", onDocumentMouseMove, false);
	renderer.domElement.addEventListener("mouseup", onDocumentMouseUp, false);
	renderer.domElement.addEventListener("touchstart", onDocumentTouchStart, false);
	renderer.domElement.addEventListener("touchmove", onDocumentTouchMove, false);
	renderer.domElement.addEventListener("touchend", onDocumentTouchEnd, false);

	animate();
}

window.addEventListener("message", (event) => {
	if (event.origin !== window.location.origin || !event.data) {
		return;
	}
	if (event.data.type === "headpilot-bowling-motion") {
		onHeadPilotMotion(event.data);
	}
	if (event.data.type === "headpilot-bowling-command") {
		if (event.data.command === "pause") {
			gamePaused = true;
			setBowlingStatus("PAUSED");
		}
		if (event.data.command === "start") {
			gamePaused = false;
			setBowlingStatus("READY");
		}
	}
});

function updateGame(player, dt) {
	player.physics.updatePhysics(dt);

	if (player.physics.simulationActive && (player.physics.simulationTime > FRAME_ROLL_TIME)) {
		var standingPinsMask = player.physics.detectStandingPins();
		var beatenPinsMask = player.physics.currentPinsMask & (~standingPinsMask);
		var beatenPinCount = player.physics.countPins(beatenPinsMask);

		var prevFrameNumber = player.scores.frameNumber;
		player.scores.addThrowResult(beatenPinCount);
		if (player.local) {
			scoresDiv.innerHTML = "  1  2  3  4  5  6  7  8  9  10<br/>| "
					+ player.scores.getResultString() + " | " + player.scores.totalScore + " |";
		}

		if (!player.scores.gameOver) {
			var pinsMask;
			if ((prevFrameNumber != player.scores.frameNumber) || (standingPinsMask == 0)) {
				pinsMask = -1;
			} else {
				pinsMask = standingPinsMask;
			}
			player.physics.resetPhysics(false, pinsMask);
		} else if (player.local) {
			alert("Game over");
			player.scores = new Scores();
			player.physics.resetPhysics();
		}
	}

	syncView(player);
}

function updateScene(dt) {
	if (gamePaused) {
		return;
	}
	if (imitations) {
		for (var i = 0; i < imitations.length; i++) {
			updateImitation(imitations[i], dt);
		}
	}

	if (players) {
		for (var i = 0; i < players.length; i++) {
			updateGame(players[i], dt);
		}
	}
}

function resizeViewport() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function syncMeshToBody(mesh, body) {
	var transform = body.getCenterOfMassTransform();
	var p = transform.getOrigin();
	var q = transform.getRotation();
	mesh.position.set(p.x(), p.y(), p.z());
	mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
}

function syncView(player) {
	if (player.local || player.physics.simulationActive) {
		player.ballMesh.visible = true;
		syncMeshToBody(player.ballMesh, player.physics.ballBody);
	} else {
		player.ballMesh.visible = false;
	}
	for (var i = 0; i < player.physics.pinBodies.length; i++) {
		var pinBody = player.physics.pinBodies[i];
		var pinMesh = player.pinMeshes[i];
		if (pinBody) {
			pinMesh.visible = true;
			syncMeshToBody(pinMesh, pinBody);
		} else {
			pinMesh.visible = false;
		}
	}
}

function render() {
	var dt = clock.getDelta();

	updateScene(dt);

	renderer.render(scene, camera);
}

function animate() {
	requestAnimationFrame(animate);

	render();
}

function updateTouchRay(clientX, clientY) {
	var rect = renderer.domElement.getBoundingClientRect();

	touchPoint.x = ((clientX - rect.left) / rect.width) * 2.0 - 1.0;
	touchPoint.y = -((clientY - rect.top) / rect.height) * 2.0 + 1.0;

	raycaster.setFromCamera(touchPoint, camera);
}

function intersectTouchPlane(ray) {
	if (Math.abs(ray.direction.y) > 1e-5) { // ray direction must not be parallel to base plane
		var t = (BASE_HEIGHT - ray.origin.y) / ray.direction.y;
		if (t >= 0.0) {
			dragPoint.copy(ray.direction).multiplyScalar(t).add(ray.origin);
			return true;
		}
	}
	return false;
}

function onActionDown(clientX, clientY, time) {
	var localPlayer = getLocalPlayer();
	if (!localPlayer) {
		return;
	}

	if (localPlayer.physics.simulationActive) {
		return;
	}

	updateTouchRay(clientX, clientY);

	pickingBall = false;
	positioningBall = false;
	rollingBall = false;

	if (!intersectTouchPlane(raycaster.ray)) {
		return;
	}

	pickSphere.center.set(localPlayer.physics.releasePosition, BALL_HEIGHT, BALL_LINE);
	if (raycaster.ray.intersectsSphere(pickSphere)) {
		pickOffset = dragPoint.x - localPlayer.physics.releasePosition;
		pickPoint.copy(dragPoint);
		pickingBall = true;
		pickX = clientX;
		pickY = clientY;
		pickTime = time;
	}
}

function onActionMove(clientX, clientY, time) {
	var localPlayer = getLocalPlayer();
	if (!localPlayer) {
		return;
	}

	if (localPlayer.physics.simulationActive) {
		return;
	}

	updateTouchRay(clientX, clientY);

	if (!intersectTouchPlane(raycaster.ray)) {
		return;
	}

	if (pickingBall) {
		var distX = clientX - pickX;
		var distY = clientY - pickY;
		var grabDistanceSquared = distX * distX + distY * distY;
		if (grabDistanceSquared > ppi * ppi * GRAB_BALL_THRESHOLD_INCH_SQUARED) {
			if ((pickPoint.z - dragPoint.z) * GRAB_BALL_ROLL_POS_RATIO
					> Math.abs(pickPoint.x - dragPoint.x)) {
				rollingBall = true;
			} else {
				positioningBall = true;
			}
			pickingBall = false;
		}
	}

	if (positioningBall) {
		var position = dragPoint.x - pickOffset;
		localPlayer.physics.positionBall(position);
	}
}

function onActionUp(clientX, clientY, time) {
	var localPlayer = getLocalPlayer();
	if (!localPlayer) {
		return;
	}

	if (localPlayer.physics.simulationActive) {
		return;
	}

	if (rollingBall) {
		releaseVector.copy(dragPoint).sub(pickPoint);
		var velocity = (time > pickTime)
				? releaseVector.length() / (1e-3 * (time - pickTime))
				: BALL_VELOCITY_MAX;
		var angle = Math.atan2(-releaseVector.x, -releaseVector.z);
		localPlayer.physics.releaseBall(velocity, angle);
	}

	pickingBall = false;
	positioningBall = false;
	rollingBall = false;
}

function onDocumentMouseDown(event) {
	event.preventDefault();

	onActionDown(event.clientX, event.clientY, event.timeStamp);
}

function onDocumentMouseMove(event) {
	event.preventDefault();

	onActionMove(event.clientX, event.clientY, event.timeStamp);
}

function onDocumentMouseUp(event) {
	event.preventDefault();

	onActionUp(event.clientX, event.clientY, event.timeStamp);
}

function onDocumentTouchStart(event) {
	var timeStamp = event.timeStamp;
	event.preventDefault();
	event = event.changedTouches[0];

	onActionDown(event.clientX, event.clientY, timeStamp);
}

function onDocumentTouchMove(event) {
	var timeStamp = event.timeStamp;
	event.preventDefault();
	event = event.changedTouches[0];

	onActionMove(event.clientX, event.clientY, timeStamp);
}

function onDocumentTouchEnd(event) {
	var timeStamp = event.timeStamp;
	event.preventDefault();
	event = event.changedTouches[0];

	onActionUp(event.clientX, event.clientY, timeStamp);
}

init();
