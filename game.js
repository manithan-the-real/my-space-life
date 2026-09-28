const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const finalScoreEl = document.getElementById("finalScore");

const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

let width = 0;
let height = 0;
let animationId = null;
let lastTime = 0;

let gameRunning = false;
let score = 0;
let lives = 3;
let level = 1;
let elapsed = 0;

let highScore = Number(localStorage.getItem("mySpaceLifeHighScore")) || 0;

const keys = {};
const bullets = [];
const enemies = [];
const particles = [];
const stars = [];
const powerUps = [];

const player = {
  x: 0,
  y: 0,
  width: 34,
  height: 52,
  speed: 360,
  cooldown: 0,
  invincible: 0,
  tilt: 0
};

const enemyTypes = {
  asteroid: {
    radius: 22,
    speedMin: 90,
    speedMax: 170,
    score: 15
  },
  fighter: {
    width: 32,
    height: 34,
    speedMin: 130,
    speedMax: 210,
    score: 30
  }
};

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!gameRunning) {
    player.x = width / 2;
    player.y = height - 100;
  }
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createStars() {
  stars.length = 0;

  const count = Math.max(90, Math.floor((width * height) / 11000));

  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: random(0.5, 2.2),
      speed: random(15, 75),
      alpha: random(0.25, 0.95)
    });
  }
}

createStars();

function resetGame() {
  score = 0;
  lives = 3;
  level = 1;
  elapsed = 0;

  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  powerUps.length = 0;

  player.x = width / 2;
  player.y = height - 100;
  player.cooldown = 0;
  player.invincible = 0;
  player.tilt = 0;

  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = "♥".repeat(lives) + "♡".repeat(3 - lives);
}

function startGame() {
  resetGame();

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  gameRunning = true;
  lastTime = performance.now();

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("mySpaceLifeHighScore", String(highScore));
  }

  finalScoreEl.textContent = score;
  gameOverScreen.classList.remove("hidden");
}

function fireBullet() {
  if (player.cooldown > 0) {
    return;
  }

  bullets.push({
    x: player.x,
    y: player.y - player.height / 2,
    width: 4,
    height: 18,
    speed: 720,
    damage: 1
  });

  player.cooldown = 0.14;

  createParticles(
    player.x,
    player.y - 25,
    4,
    {
      minSpeed: 30,
      maxSpeed: 80,
      sizeMin: 1,
      sizeMax: 2.5,
      life: 0.25
    }
  );
}

function spawnEnemy() {
  const fighterChance = Math.min(0.45, 0.18 + level * 0.02);
  const isFighter = Math.random() < fighterChance;

  if (isFighter) {
    enemies.push({
      type: "fighter",
      x: random(30, width - 30),
      y: -50,
      width: enemyTypes.fighter.width,
      height: enemyTypes.fighter.height,
      speed: random(
        enemyTypes.fighter.speedMin,
        enemyTypes.fighter.speedMax + level * 8
      ),
      hp: level >= 7 ? 2 : 1,
      phase: Math.random() * Math.PI * 2,
      score: enemyTypes.fighter.score + level * 2,
      rotation: 0
    });
  } else {
    const radius = random(15, 30);

    enemies.push({
      type: "asteroid",
      x: random(radius, width - radius),
      y: -radius - 10,
      radius,
      speed: random(
        enemyTypes.asteroid.speedMin,
        enemyTypes.asteroid.speedMax + level * 9
      ),
      hp: radius > 25 ? 2 : 1,
      score: enemyTypes.asteroid.score + level,
      rotation: random(0, Math.PI * 2),
      rotationSpeed: random(-1.2, 1.2),
      vertices: createAsteroidVertices(radius)
    });
  }
}

function createAsteroidVertices(radius) {
  const vertices = [];
  const count = Math.floor(random(8, 12));

  for (let i = 0; i < count; i++) {
    vertices.push({
      angle: (Math.PI * 2 * i) / count,
      distance: radius * random(0.72, 1.15)
    });
  }

  return vertices;
}

function spawnPowerUp(x, y) {
  if (Math.random() > 0.08) {
    return;
  }

  const types = ["shield", "rapid", "score"];
  const type = types[Math.floor(Math.random() * types.length)];

  powerUps.push({
    x,
    y,
    radius: 11,
    type,
    speed: 100,
    pulse: Math.random() * Math.PI * 2
  });
}

function collectPowerUp(powerUp) {
  if (powerUp.type === "shield") {
    player.invincible = Math.max(player.invincible, 4);
  }

  if (powerUp.type === "rapid") {
    player.cooldown = -3;
  }

  if (powerUp.type === "score") {
    score += 100;
  }

  createParticles(
    powerUp.x,
    powerUp.y,
    18,
    {
      minSpeed: 70,
      maxSpeed: 180,
      sizeMin: 1,
      sizeMax: 4,
      life: 0.55
    }
  );

  updateHUD();
}

function createParticles(x, y, count, options = {}) {
  const {
    minSpeed = 40,
    maxSpeed = 140,
    sizeMin = 1,
    sizeMax = 3,
    life = 0.5
  } = options;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = random(minSpeed, maxSpeed);

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: random(sizeMin, sizeMax),
      life: random(life * 0.55, life),
      maxLife: life
    });
  }
}

function loseLife() {
  if (player.invincible > 0) {
    return;
  }

  lives--;

  player.invincible = 2;

  createParticles(player.x, player.y, 35, {
    minSpeed: 70,
    maxSpeed: 240,
    sizeMin: 1,
    sizeMax: 4,
    life: 0.8
  });

  updateHUD();

  if (lives <= 0) {
    endGame();
  }
}

function rectsOverlap(a, b) {
  return (
    a.x - a.width / 2 < b.x + b.width / 2 &&
    a.x + a.width / 2 > b.x - b.width / 2 &&
    a.y - a.height / 2 < b.y + b.height / 2 &&
    a.y + a.height / 2 > b.y - b.height / 2
  );
}

function bulletHitsEnemy(bullet, enemy) {
  if (enemy.type === "fighter") {
    return (
      bullet.x > enemy.x - enemy.width / 2 &&
      bullet.x < enemy.x + enemy.width / 2 &&
      bullet.y > enemy.y - enemy.height / 2 &&
      bullet.y < enemy.y + enemy.height / 2
    );
  }

  const dx = bullet.x - enemy.x;
  const dy = bullet.y - enemy.y;
  return Math.sqrt(dx * dx + dy * dy) < enemy.radius;
}

function playerHitsEnemy(enemy) {
  const playerBox = {
    x: player.x,
    y: player.y,
    width: player.width * 0.7,
    height: player.height * 0.72
  };

  if (enemy.type === "fighter") {
    return rectsOverlap(playerBox, enemy);
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance < enemy.radius + 15;
}

function update(dt) {
  elapsed += dt;

  level = 1 + Math.floor(elapsed / 18);

  if (player.cooldown > 0) {
    player.cooldown -= dt;
  }

  if (player.invincible > 0) {
    player.invincible -= dt;
  }

  const moveSpeed = player.speed * dt;

  let dx = 0;
  let dy = 0;

  if (keys.ArrowLeft || keys.a) dx -= 1;
  if (keys.ArrowRight || keys.d) dx += 1;
  if (keys.ArrowUp || keys.w) dy -= 1;
  if (keys.ArrowDown || keys.s) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);

    dx /= length;
    dy /= length;

    player.x += dx * moveSpeed;
    player.y += dy * moveSpeed;

    player.tilt += (dx * 0.25 - player.tilt) * 0.18;
  } else {
    player.tilt += (0 - player.tilt) * 0.12;
  }

  player.x = clamp(player.x, 24, width - 24);
  player.y = clamp(player.y, 70, height - 45);

  if (keys[" "] || keys.Space) {
    fireBullet();
  }

  updateStars(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePowerUps(dt);
  updateParticles(dt);

  const spawnRate = Math.max(0.16, 0.75 - level * 0.035);

  if (Math.random() < dt / spawnRate) {
    spawnEnemy();
  }

  checkCollisions();
}

function updateStars(dt) {
  for (const star of stars) {
    star.y += star.speed * dt;

    if (star.y > height + 3) {
      star.y = -3;
      star.x = Math.random() * width;
    }
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= bullets[i].speed * dt;

    if (bullets[i].y < -30) {
      bullets.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (enemy.type === "fighter") {
      enemy.y += enemy.speed * dt;
      enemy.phase += dt * 2;
      enemy.x += Math.sin(enemy.phase) * 45 * dt;
      enemy.rotation = Math.sin(enemy.phase) * 0.12;
    } else {
      enemy.y += enemy.speed * dt;
      enemy.rotation += enemy.rotationSpeed * dt;
    }

    if (enemy.y > height + 80) {
      enemies.splice(i, 1);
    }
  }
}

function updatePowerUps(dt) {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];

    powerUp.y += powerUp.speed * dt;
    powerUp.pulse += dt * 4;

    if (powerUp.y > height + 30) {
      powerUps.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.vx *= 0.985;
    p.vy *= 0.985;

    p.life -= dt;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function checkCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    let hit = false;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];

      if (!bulletHitsEnemy(bullet, enemy)) {
        continue;
      }

      bullet.y = -999;

      enemy.hp--;

      createParticles(bullet.x, bullet.y + 10, 5, {
        minSpeed: 50,
        maxSpeed: 130,
        sizeMin: 1,
        sizeMax: 3,
        life: 0.3
      });

      hit = true;

      if (enemy.hp <= 0) {
        score += enemy.score;

        spawnPowerUp(enemy.x, enemy.y);

        createParticles(enemy.x, enemy.y, 24, {
          minSpeed: 70,
          maxSpeed: 250,
          sizeMin: 1,
          sizeMax: 4,
          life: 0.7
        });

        enemies.splice(j, 1);
      }

      break;
    }

    if (hit) {
      bullets.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (!playerHitsEnemy(enemy)) {
      continue;
    }

    enemies.splice(i, 1);

    if (player.invincible <= 0) {
      loseLife();
    }

    if (!gameRunning) {
      return;
    }
  }

  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];

    const dx = player.x - powerUp.x;
    const dy = player.y - powerUp.y;

    if (Math.hypot(dx, dy) < 28) {
      collectPowerUp(powerUp);
      powerUps.splice(i, 1);
    }
  }

  updateHUD();
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  drawStars();
  drawNebula();
  drawPowerUps();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();

  drawVignette();
}

function drawStars() {
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    if (star.size > 1.5) {
      ctx.globalAlpha = star.alpha * 0.25;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#9dbdff";
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

function drawNebula() {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.35,
    20,
    width * 0.5,
    height * 0.35,
    width * 0.6
  );

  gradient.addColorStop(0, "rgba(83, 76, 190, 0.08)");
  gradient.addColorStop(0.45, "rgba(40, 90, 180, 0.025)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawPlayer() {
  ctx.save();

  ctx.translate(player.x, player.y);
  ctx.rotate(player.tilt);

  const blinking =
    player.invincible > 0 &&
    Math.floor(player.invincible * 10) % 2 === 0;

  if (blinking) {
    ctx.globalAlpha = 0.45;
  }

  const flame = 13 + Math.sin(elapsed * 22) * 5;

  const flameGradient = ctx.createLinearGradient(0, 18, 0, 38);
  flameGradient.addColorStop(0, "rgba(180, 235, 255, 0.95)");
  flameGradient.addColorStop(0.5, "rgba(80, 150, 255, 0.75)");
  flameGradient.addColorStop(1, "rgba(95, 50, 255, 0)");

  ctx.beginPath();
  ctx.moveTo(-7, 20);
  ctx.lineTo(0, 20 + flame);
  ctx.lineTo(7, 20);
  ctx.closePath();

  ctx.fillStyle = flameGradient;
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(90, 160, 255, 0.8)";
  ctx.fill();
  ctx.shadowBlur = 0;

  const bodyGradient = ctx.createLinearGradient(-18, -28, 18, 26);
  bodyGradient.addColorStop(0, "#eaf4ff");
  bodyGradient.addColorStop(0.45, "#8fb8ff");
  bodyGradient.addColorStop(1, "#4d5fc4");

  ctx.beginPath();
  ctx.moveTo(0, -29);
  ctx.lineTo(16, 20);
  ctx.lineTo(8, 17);
  ctx.lineTo(0, 25);
  ctx.lineTo(-8, 17);
  ctx.lineTo(-16, 20);
  ctx.closePath();

  ctx.fillStyle = bodyGradient;
  ctx.strokeStyle = "rgba(210, 230, 255, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "rgba(90, 150, 255, 0.45)";
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.ellipse(0, -8, 7, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#19254f";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-2, -10, 3.7, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(180, 225, 255, 0.85)";
  ctx.fill();

  ctx.restore();

  if (player.invincible > 0) {
    ctx.save();

    ctx.globalAlpha = 0.28 + Math.sin(elapsed * 12) * 0.08;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 34, 0, Math.PI * 2);
    ctx.strokeStyle = "#8fd7ff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#68baff";
    ctx.stroke();

    ctx.restore();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    const gradient = ctx.createLinearGradient(
      bullet.x,
      bullet.y - 14,
      bullet.x,
      bullet.y + 10
    );

    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.35, "#9ad7ff");
    gradient.addColorStop(1, "rgba(80, 120, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#74c8ff";

    ctx.fillRect(
      bullet.x - bullet.width / 2,
      bullet.y - bullet.height / 2,
      bullet.width,
      bullet.height
    );

    ctx.shadowBlur = 0;
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    if (enemy.type === "asteroid") {
      drawAsteroid(enemy);
    } else {
      drawFighter(enemy);
    }
  }
}

function drawAsteroid(enemy) {
  ctx.save();

  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.rotation);

  const gradient = ctx.createRadialGradient(
    -enemy.radius * 0.35,
    -enemy.radius * 0.4,
    3,
    0,
    0,
    enemy.radius * 1.2
  );

  gradient.addColorStop(0, "#777f9b");
  gradient.addColorStop(0.45, "#3e455f");
  gradient.addColorStop(1, "#171b2c");

  ctx.beginPath();

  enemy.vertices.forEach((vertex, index) => {
    const x = Math.cos(vertex.angle) * vertex.distance;
    const y = Math.sin(vertex.angle) * vertex.distance;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(170, 180, 205, 0.38)";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(110, 130, 180, 0.15)";
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawFighter(enemy) {
  ctx.save();

  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.rotation);

  const gradient = ctx.createLinearGradient(0, -22, 0, 22);
  gradient.addColorStop(0, "#ffccd8");
  gradient.addColorStop(0.35, "#e75f83");
  gradient.addColorStop(1, "#62233d");

  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(15, 16);
  ctx.lineTo(4, 12);
  ctx.lineTo(0, 20);
  ctx.lineTo(-4, 12);
  ctx.lineTo(-15, 16);
  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(255, 190, 210, 0.75)";
  ctx.lineWidth = 1.3;
  ctx.shadowBlur = 16;
  ctx.shadowColor = "rgba(255, 70, 120, 0.35)";
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ffb2c5";
  ctx.beginPath();
  ctx.arc(0, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPowerUps() {
  for (const powerUp of powerUps) {
    const scale = 1 + Math.sin(powerUp.pulse) * 0.08;

    ctx.save();
    ctx.translate(powerUp.x, powerUp.y);
    ctx.scale(scale, scale);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
    glow.addColorStop(0, "rgba(170, 220, 255, 0.35)");
    glow.addColorStop(1, "rgba(50, 100, 255, 0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#172754";
    ctx.strokeStyle = "#9bd2ff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#68baff";
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const symbol =
      powerUp.type === "shield"
        ? "S"
        : powerUp.type === "rapid"
        ? "R"
        : "+";

    ctx.fillText(symbol, 0, 1);

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);

    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = "#c6dcff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#75b7ff";
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.48)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function gameLoop(timestamp) {
  if (!gameRunning) {
    draw();
    return;
  }

  const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  update(dt);
  draw();

  animationId = requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  keys[event.key] = true;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
      event.key
    )
  ) {
    event.preventDefault();
  }

  if (event.key === "Enter" && !gameRunning) {
    startGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key] = false;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

scoreEl.textContent = "0";
livesEl.textContent = "♥♥♥";

draw();
