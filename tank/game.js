var canv = document.getElementById("gameCanvas"),
	alertBoxContent = document.getElementById("alertBoxContent"),
	c = canv.getContext("2d");
var pressedKeys = {},
KEYS = {
	// Player 1
	ARROW_LEFT: 37,
	ARROW_UP: 38,
	ARROW_RIGHT: 39,
	ARROW_DOWN: 40,
	SPACE: 32,

	// Player 2
	W: 87,
	A: 65,
	S: 83,
	D: 68,
	F: 70
};
const TWO_PI = 2 * Math.PI;
function normalizeRot(rot) {// converts angle to its equivalent from interval [-pi; pi]
	return rot - TWO_PI * Math.floor((rot + Math.PI) / TWO_PI);
}
function alertBoxVisibilitySetter(visibility) {
	return (function() {
		document.body.className = (visibility ? "alert-box-visible" : "");
	});
}
var showAlertBox = alertBoxVisibilitySetter(true),
	hideAlertBox = alertBoxVisibilitySetter(false);
function alertMessage(msg, color) {
	hideAlertBox();
	alertBoxContent.style.color = color || "#000";
	alertBoxContent.innerHTML = msg;
	showAlertBox();
}
document.onkeydown = function(e) {
	pressedKeys[e.keyCode] = true;
}
document.onkeyup = function(e) {
	pressedKeys[e.keyCode] = false;
}
var tank = {
	x: 25,// rotate origin (centre)
	y: 200,
	w: 31,
	h: 23,
	rot: 0,
	speed: 1,
	rSpeed: Math.PI / 90,
	turret: {
		x: 25,
		y: 200,
		rot: 0,
		r: 8,
		w: 7,
		l: 15,
		fireTimeout: 0
	},
	destroyed: false
}
/*
	       ←w / 2→
	┌────────────╱│ ↑
	│         ╱   │ h / 2
	│       ∠fi   │ ↓
	│      X------│
	│   ╱dg       │
	└╱────────────┘
*/
var secondTank = {
    x: 500,
    y: 200,
    w: 31,
    h: 23,

    rot: Math.PI,
    speed: 1,
    rSpeed: Math.PI / 90,

    color: "#dc3545",

    turret: {
        x: 500,
        y: 200,
        rot: Math.PI,
        r: 8,
        w: 7,
        l: 15,
        fireTimeout: 0,
        color: "#dc3545"
    },

    destroyed: false
};
tankFi = Math.atan(tank.h / tank.w),
tankDg = Math.sqrt(tank.w * tank.w + tank.h * tank.h) / 2;// half the diagonal
var bullets = [],
bullet = {
	speed: 3,
	r: 3,
	du: 600
};
var turret = {
    sightRadius: 100,
    rSpeed: Math.PI / 180,
    fireTimeout: 300,
    color: "#0082f3"
};
var smokeParticles = [],
smokeParticle = {
	r: 9,
	distMin: 2,
	distMax: 6,
	spreadSpeed: .03,
	disperseSpeed: .004,
	smokeSetSize: 20
};
var obstacles = [
    // Arena boundaries
    {x: 300, y: 1, w: 600, h: 2},
    {x: 599, y: 200, w: 2, h: 400},
    {x: 300, y: 399, w: 600, h: 2},
    {x: 1, y: 200, w: 2, h: 400},

    // Original corner walls
    {x: 38, y: 75, w: 70, h: 4},
    {x: 75, y: 57, w: 4, h: 40},
    {x: 562, y: 75, w: 70, h: 4},
    {x: 525, y: 57, w: 4, h: 40},
    {x: 38, y: 325, w: 70, h: 4},
    {x: 75, y: 343, w: 4, h: 40},
    {x: 562, y: 325, w: 70, h: 4},
    {x: 525, y: 343, w: 4, h: 40},

    // Top section: two mirrored L-walls and a short center pillar
    {x: 170, y: 85, w: 8, h: 90},
    {x: 215, y: 130, w: 90, h: 8, breakable: true, hp: 3},
    {x: 300, y: 75, w: 8, h: 80},
    {x: 385, y: 130, w: 90, h: 8, breakable: true, hp: 3},
    {x: 430, y: 85, w: 8, h: 90},

    // Middle section: flank cover and a central horizontal barrier
    {x: 135, y: 215, w: 8, h: 105},
    {x: 180, y: 245, w: 90, h: 8, breakable: true, hp: 3},
    {x: 300, y: 200, w: 100, h: 8, breakable: true, hp: 3},
    {x: 465, y: 215, w: 8, h: 105},
    {x: 420, y: 245, w: 90, h: 8, breakable: true, hp: 3},

    // Bottom section: two mirrored L-walls
    {x: 185, y: 345, w: 8, h: 65},
    {x: 230, y: 315, w: 90, h: 8},
    {x: 415, y: 345, w: 8, h: 65},
    {x: 370, y: 315, w: 90, h: 8}
];

function getTankSkeletonPolygon(t = tank) {
    var rotMinusFi = t.rot - tankFi,
        rotPlusFi = t.rot + tankFi;

    return {
        x: t.x,
        y: t.y,
        points: [
            {
                x: Math.cos(rotMinusFi) * tankDg,
                y: Math.sin(rotMinusFi) * tankDg
            },
            {
                x: Math.cos(rotPlusFi) * tankDg,
                y: Math.sin(rotPlusFi) * tankDg
            },
            {
                x: Math.cos(rotMinusFi + Math.PI) * tankDg,
                y: Math.sin(rotMinusFi + Math.PI) * tankDg
            },
            {
                x: Math.cos(rotPlusFi + Math.PI) * tankDg,
                y: Math.sin(rotPlusFi + Math.PI) * tankDg
            }
        ]
    };
}

function getObstaclePolygon(o) {
	var halfw = o.w / 2,
		halfh = o.h / 2;
	return {
		x: o.x,
		y: o.y,
		points: [
			{x: -halfw, y: -halfh},
			{x: halfw, y: -halfh},
			{x: halfw, y: halfh},
			{x: -halfw, y: halfh}
		]
	}
}
function drawTankSkeleton(t = tank) {
	var skPoly = getTankSkeletonPolygon(t);
	c.beginPath();
	for(var i = 0, plen = skPoly.points.length; i < plen; i++) {
		var pFunc = (i === 0) ? c.moveTo : c.lineTo;
		pFunc.call(c, skPoly.x + skPoly.points[i].x, skPoly.y + skPoly.points[i].y);
	}
	c.closePath();
	c.strokeStyle = "#000";
	c.fillStyle = t.color || "#0062b6";
	c.stroke();
	c.fill();
}
function drawTurret(tur) {
	var alpha = Math.asin(tur.w/2 / tur.r),
		beta = Math.atan(tur.w/2 / (tur.r + tur.l)),
		startAngle = tur.rot + alpha,
		endAngle = tur.rot + 2 * Math.PI - alpha;
	c.beginPath();
	c.arc(tur.x, tur.y, tur.r, startAngle, endAngle, false);
	c.lineTo(tur.x + (tur.r + tur.l) * Math.cos(tur.rot - beta), tur.y + (tur.r + tur.l) * Math.sin(tur.rot - beta));
	c.lineTo(tur.x + (tur.r + tur.l) * Math.cos(tur.rot + beta), tur.y + (tur.r + tur.l) * Math.sin(tur.rot + beta));
	c.closePath();
	
	c.strokeStyle = "#000";
	c.fillStyle = tur.color || turret.color;
	c.stroke();
	c.fill();
}
function drawTank(t = tank) {
    drawTankSkeleton(t);
    drawTurret(t.turret);
}
function drawReloadBox(x, y, ftmout) {
	x -= 20;
	y -= 8;
	var ratio = Math.max(0, (turret.fireTimeout - ftmout) / turret.fireTimeout),
		grad = c.createLinearGradient(x, 0, x + 40, 0);
	grad.addColorStop(0, "lime");
	grad.addColorStop(ratio, "lime");
	grad.addColorStop(ratio, "lightgray");
	grad.addColorStop(1, "lightgray");
	c.beginPath();
	c.rect(x, y, 40, 3);
	c.fillStyle = grad;
	c.fill();
}
function drawSightRadius(tur) {
	c.beginPath();
	c.arc(tur.x, tur.y, turret.sightRadius, 0, 2 * Math.PI);
	c.setLineDash([4, 4]);
	c.strokeStyle = tur.color || turret.color;
	c.stroke();
	c.setLineDash([]);
}
function drawBullet(b) {
	c.beginPath();
	c.arc(b.x, b.y, bullet.r, 0, 2 * Math.PI);
	c.fillStyle = (b.du > 25) ? "#000000" : ("rgba(0, 0, 0, " + (b.du / 25) + ")");
	c.fill();
}
function drawSmokeParticle(part) {
	c.beginPath();
	c.arc(part.x, part.y, part.r, 0, 2 * Math.PI);
	c.fillStyle = "rgba("+((part.baseColor >> 16) & 0xff)+", "+((part.baseColor >> 8) & 0xff)+", "+((part.baseColor >> 0) & 0xff)+", " + Math.max(0, part.alpha) + ")";
	c.fill();
}
function drawObstacle(o) {
    c.beginPath();
    c.rect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);

    // Breakable cover has a different color, which lightens as it gets damaged.
    if (o.breakable) {
        c.fillStyle = o.hp === 3 ? "#a96523" : (o.hp === 2 ? "#c48b3b" : "#e6bd78");
    } else {
        c.fillStyle = "#333";
    }
    c.fill();
}
function shiftBullet(b) {
	b.x += bullet.speed * Math.cos(b.pitch);
	b.y += bullet.speed * Math.sin(b.pitch);
	b.du--;
	/*if(b.x < 0 || b.x > canv.width) b.pitch = Math.PI - b.pitch;
	if(b.y < 0 || b.y > canv.height) b.pitch = - b.pitch;*/
}
function shiftSmokeParticle(part) {
	part.x += part.speed * Math.cos(part.dir);
	part.y += part.speed * Math.sin(part.dir);
	part.r += smokeParticle.spreadSpeed;
	part.alpha -= smokeParticle.disperseSpeed;
}
function fireBullet(tur) {
	if(tur.fireTimeout <= 0) {
		var b = {
			x: tur.x + Math.cos(tur.rot) * (tur.r + tur.l),
			y: tur.y + Math.sin(tur.rot) * (tur.r + tur.l),
			pitch: tur.rot,
			du: bullet.du
		};
		tur.fireTimeout = turret.fireTimeout;
		bullets.push(b);
		return b;
	}
	return false;
}
function detonateTank() {
	tank.destroyed = true;
	var dir = 0, posR = 0;
	for(var i = 0; i < smokeParticle.smokeSetSize; i++) {
		dir = (Math.random() * 2 * Math.PI) - Math.PI;
		dist = (Math.random() * (smokeParticle.distMax - smokeParticle.distMin)) + smokeParticle.distMin;
		var part = {
			x: tank.x + Math.cos(dir) * dist, y: tank.y + Math.sin(dir) * dist, r: smokeParticle.r, dir: dir, speed: (Math.random() * .1) + .1, alpha: .4, baseColor: smokeParticle.baseColor
		};
		smokeParticles.push(part);
	}
	alertMessage("You lost! Tank was destroyed.", "#f00");
	setTimeout(function() {
		gameRunning = false;
	}, 5000);
}
function serveBullets() {
	var bulCollsn = null,
		skPoly = getTankSkeletonPolygon();
	for(var i = bullets.length - 1; i >= 0; i--) {
		if(bullets[i].du < 0) {
			bullets.splice(i, 1);
			continue;
		}
		bulCollsn = (!tank.destroyed) ? Collision.circleToPolygon({x: bullets[i].x, y: bullets[i].y, r: bullet.r}, skPoly) : null;
		if(bulCollsn !== null) {
			console.log(bulCollsn);
			detonateTank();
			bullets.splice(i, 1);
			continue;
		}
		shiftBullet(bullets[i]);
		drawBullet(bullets[i]);
	}
}
function serveTurrets() {
	var inSight = null;
	for(var i = 0, tlen = turrets.length; i < tlen; i++) {
		if(turrets[i].fireTimeout > 0) turrets[i].fireTimeout--;
		inSight = (!tank.destroyed) ? Collision.circleToCircle(
			{x: turrets[i].x, y: turrets[i].y, r: turret.sightRadius},
			{x: tank.turret.x, y: tank.turret.y, r: tank.turret.r}
		) : null;
		if(inSight !== null) {
			drawSightRadius(turrets[i]);
			var firingAngle = Math.atan2(inSight.vector.y, inSight.vector.x),
				turRot = turrets[i].rot;
			firingAngle = normalizeRot(firingAngle);
			turRot = normalizeRot(turRot);
			var diff1 = firingAngle - turRot,
				diff2 = firingAngle - (turRot + Math.PI * (turRot < 0 ? 2 : -2));
			var diff = (Math.abs(diff1) > Math.abs(diff2)) ? diff2 : diff1;
			if(Math.abs(diff) < turret.rSpeed) {
				fireBullet(turrets[i]);
			} else {
				turrets[i].rot = turRot + (Math.min(turret.rSpeed, Math.abs(diff)) * (diff < 0 ? -1 : 1));
			}
		}
		drawTurret(turrets[i]);
		drawReloadBox(turrets[i].x, turrets[i].y - (turrets[i].r), turrets[i].fireTimeout);
	}
}
function serveSmokeParticles() {
	for(var i = smokeParticles.length - 1; i >= 0; i--) {
		if(smokeParticles[i].alpha <= 0) {
			smokeParticles.splice(i, 1);
			continue;
		}
		shiftSmokeParticle(smokeParticles[i]);
		drawSmokeParticle(smokeParticles[i]);
	}
}
function serveObstacles() {
    var tanks = [tank, secondTank];

    // Walk backward so destroyed walls can safely be removed from the array.
    for (var i = obstacles.length - 1; i >= 0; i--) {
        var wall = obstacles[i];
        var oPoly = getObstaclePolygon(wall);

        // Both players collide with solid and breakable walls.
        for (var p = 0; p < tanks.length; p++) {
            var currentTank = tanks[p];
            if (currentTank.destroyed) continue;

            var skPoly = getTankSkeletonPolygon(currentTank);
            var tankCollsn = Collision.polygonToPolygon(oPoly, skPoly);

            if (tankCollsn !== null) {
                currentTank.x += tankCollsn.separation.x;
                currentTank.y += tankCollsn.separation.y;
                currentTank.turret.x = currentTank.x;
                currentTank.turret.y = currentTank.y;
            }
        }

        var destroyedThisFrame = false;

        // Bullets ricochet off permanent walls; breakable walls absorb hits.
        for (var j = bullets.length - 1; j >= 0; j--) {
            var b = bullets[j];
            var bulCollsn = Collision.circleToPolygon(
                {x: b.x, y: b.y, r: bullet.r}, oPoly
            );
            if (bulCollsn === null) continue;

            if (wall.breakable) {
                wall.hp--;
                bullets.splice(j, 1);

                if (wall.hp <= 0) {
                    obstacles.splice(i, 1);
                    destroyedThisFrame = true;
                    break;
                }
            } else {
                // Existing bullet bounce behavior for permanent cover.
                var axis = Math.abs(bulCollsn.vector.x) >
                           Math.abs(bulCollsn.vector.y) ? "x" : "y";
                if (axis === "x") b.pitch = Math.PI - b.pitch;
                if (axis === "y") b.pitch = -b.pitch;
            }
        }

        if (!destroyedThisFrame) drawObstacle(wall);
    }
}

var gameRunning = true;

function gameCycle() {
    c.clearRect(0, 0, canv.width, canv.height);

    // Keep existing bullet and obstacle physics
    serveBullets();
    serveObstacles();

    // Player 1 controls
    if (!tank.destroyed) {

        if (pressedKeys[KEYS.ARROW_LEFT] ||
            pressedKeys[KEYS.ARROW_RIGHT]) {

            var dir = pressedKeys[KEYS.ARROW_LEFT] ? -1 : 1;

            tank.turret.rot = tank.rot += tank.rSpeed * dir;
        }

        if (pressedKeys[KEYS.ARROW_UP] ||
            pressedKeys[KEYS.ARROW_DOWN]) {

            var dir = pressedKeys[KEYS.ARROW_DOWN] ? -1 : 1;

            tank.x += tank.speed * dir * Math.cos(tank.rot);
            tank.y += tank.speed * dir * Math.sin(tank.rot);

            tank.turret.x = tank.x;
            tank.turret.y = tank.y;
        }

        if (pressedKeys[KEYS.SPACE]) {
            fireBullet(tank.turret);
        }

        if (tank.turret.fireTimeout > 0) {
            tank.turret.fireTimeout--;
        }

        drawReloadBox(
            tank.x,
            tank.y - (tank.w / 2),
            tank.turret.fireTimeout
        );

        drawTank(tank);
    }
	
    // PLAYER 2 CONTROLS (RED TANK)
    if (!secondTank.destroyed) {

        // Rotate using A and D
        if (pressedKeys[KEYS.A] || pressedKeys[KEYS.D]) {

            var dir = pressedKeys[KEYS.A] ? -1 : 1;

            secondTank.turret.rot =
                secondTank.rot += secondTank.rSpeed * dir;
        }

        // Move forward/backward using W and S
        if (pressedKeys[KEYS.W] || pressedKeys[KEYS.S]) {

            var dir = pressedKeys[KEYS.S] ? -1 : 1;

            secondTank.x += secondTank.speed * dir *
                Math.cos(secondTank.rot);

            secondTank.y += secondTank.speed * dir *
                Math.sin(secondTank.rot);

            secondTank.turret.x = secondTank.x;
            secondTank.turret.y = secondTank.y;
        }

        // Fire using F
        if (pressedKeys[KEYS.F]) {
            fireBullet(secondTank.turret);
        }

        // Reload cooldown
        if (secondTank.turret.fireTimeout > 0) {
            secondTank.turret.fireTimeout--;
        }

        // Draw reload bar
        drawReloadBox(
            secondTank.x,
            secondTank.y - (secondTank.w / 2),
            secondTank.turret.fireTimeout
        );

        // Draw red tank
        drawTank(secondTank);
    }

    serveSmokeParticles();

    if (gameRunning) {
        window.requestAnimationFrame(gameCycle);
    }
}

gameCycle();
