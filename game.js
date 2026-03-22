// ============================================
// STEAK 'N' SHAKE TIP RUSH
// ============================================

const GAME_W = 480;
const GAME_H = 720;

const GAME = {
    state: 'MENU',
    canvas: null,
    ctx: null,
    lastTime: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    player: null,
    francisco: null,
    tips: [],
    powerups: [],
    score: 0,
    highScore: 0,
    elapsed: 0,
    difficulty: 0,
    input: { dx: 0, dy: 0 },
    keys: {},
    selectedChar: 'chris',
    audioCtx: null,
    isMobile: false,
    activePowerup: null,
    powerupTimer: 0,
    nextPowerupSpawn: 15,
    powerupSpawnTimer: 0
};

// Restaurant layout - tables, booths, counter (all as {x, y, w, h})
const WALLS = [
    // Outer walls
    { x: 0, y: 0, w: GAME_W, h: 10 },           // top
    { x: 0, y: GAME_H - 10, w: GAME_W, h: 10 },  // bottom
    { x: 0, y: 0, w: 10, h: GAME_H },             // left
    { x: GAME_W - 10, y: 0, w: 10, h: GAME_H },   // right
];

const COUNTER = { x: 30, y: 50, w: GAME_W - 60, h: 35 };

const STOOLS = [];
for (let i = 0; i < 7; i++) {
    STOOLS.push({ x: 55 + i * 55, y: 92 });
}

// Booths along walls
const BOOTHS = [
    { x: 15, y: 150, w: 80, h: 55 },
    { x: 15, y: 280, w: 80, h: 55 },
    { x: 15, y: 410, w: 80, h: 55 },
    { x: GAME_W - 95, y: 150, w: 80, h: 55 },
    { x: GAME_W - 95, y: 280, w: 80, h: 55 },
    { x: GAME_W - 95, y: 410, w: 80, h: 55 },
];

// Center tables
const TABLES = [
    { x: 170, y: 170, w: 55, h: 40 },
    { x: 260, y: 170, w: 55, h: 40 },
    { x: 170, y: 300, w: 55, h: 40 },
    { x: 260, y: 300, w: 55, h: 40 },
    { x: 170, y: 430, w: 55, h: 40 },
    { x: 260, y: 430, w: 55, h: 40 },
];

// All solid obstacles for collision
const OBSTACLES = [...WALLS, COUNTER, ...BOOTHS, ...TABLES];

// Valid tip positions (centers of tables and booths)
const TIP_POSITIONS = [
    ...TABLES.map(t => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 })),
    ...BOOTHS.map(b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })),
];

// ============================================
// INITIALIZATION
// ============================================

function init() {
    GAME.canvas = document.getElementById('gameCanvas');
    GAME.ctx = GAME.canvas.getContext('2d');
    GAME.highScore = parseInt(localStorage.getItem('steaknshake_highscore') || '0');
    GAME.isMobile = 'ontouchstart' in window;

    updateMenuHighScore();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Keyboard input
    window.addEventListener('keydown', e => { GAME.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { GAME.keys[e.key.toLowerCase()] = false; });

    // Joystick
    if (GAME.isMobile) {
        document.getElementById('joystick-container').style.display = 'block';
        setupJoystick();
    }

    // Start loop
    GAME.lastTime = performance.now();
    requestAnimationFrame(gameLoop);

    // Render static restaurant for menu background
    renderRestaurant();
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;

    // Fit game aspect ratio
    const aspect = GAME_W / GAME_H;
    let drawW, drawH;
    if (containerW / containerH < aspect) {
        drawW = containerW;
        drawH = containerW / aspect;
    } else {
        drawH = containerH;
        drawW = containerH * aspect;
    }

    GAME.canvas.style.width = drawW + 'px';
    GAME.canvas.style.height = drawH + 'px';
    GAME.canvas.width = drawW * dpr;
    GAME.canvas.height = drawH * dpr;

    GAME.scale = (drawW / GAME_W) * dpr;
    GAME.ctx.setTransform(GAME.scale, 0, 0, GAME.scale, 0, 0);
}

function updateMenuHighScore() {
    const el = document.getElementById('menu-highscore');
    if (GAME.highScore > 0) {
        el.textContent = 'High Score: $' + GAME.highScore;
    } else {
        el.textContent = '';
    }
}

// ============================================
// JOYSTICK
// ============================================

function setupJoystick() {
    const base = document.getElementById('joystick-base');
    const thumb = document.getElementById('joystick-thumb');
    let touchId = null;
    let originX = 0, originY = 0;
    const maxDist = 35;

    base.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        const rect = base.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
    });

    window.addEventListener('touchmove', e => {
        if (touchId === null) return;
        for (const touch of e.changedTouches) {
            if (touch.identifier === touchId) {
                e.preventDefault();
                let dx = touch.clientX - originX;
                let dy = touch.clientY - originY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                }
                thumb.style.transform = `translate(${dx}px, ${dy}px)`;
                GAME.input.dx = dx / maxDist;
                GAME.input.dy = dy / maxDist;
            }
        }
    }, { passive: false });

    const endTouch = e => {
        for (const touch of e.changedTouches) {
            if (touch.identifier === touchId) {
                touchId = null;
                thumb.style.transform = 'translate(0, 0)';
                GAME.input.dx = 0;
                GAME.input.dy = 0;
            }
        }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================

function selectCharacter(char) {
    GAME.selectedChar = char;
    initAudio();
    startGame();
}

function startGame() {
    GAME.state = 'PLAYING';
    GAME.score = 0;
    GAME.elapsed = 0;
    GAME.difficulty = 0;
    GAME.tips = [];
    GAME.powerups = [];
    GAME.activePowerup = null;
    GAME.powerupTimer = 0;
    GAME.powerupSpawnTimer = 0;
    GAME.nextPowerupSpawn = 10 + Math.random() * 10;

    // Player setup
    const skinColor = GAME.selectedChar === 'chris' ? '#FDBCB4' : '#C68642';
    GAME.player = {
        x: GAME_W / 2 - 10,
        y: GAME_H - 80,
        w: 20,
        h: 28,
        speed: 150,
        skinColor: skinColor,
        name: GAME.selectedChar === 'chris' ? 'Chris' : 'Jabu',
        dir: { x: 0, y: -1 },
        bobTimer: 0
    };

    // Francisco setup - spawns from behind the counter
    GAME.francisco = {
        x: GAME_W / 2 - 12,
        y: 120,
        w: 24,
        h: 32,
        speed: 80,
        baseSpeed: 80,
        stuckTimer: 0,
        lastX: 0,
        lastY: 0
    };

    // Spawn initial tips
    for (let i = 0; i < 4; i++) {
        spawnTip();
    }

    document.getElementById('menu-overlay').style.display = 'none';
    document.getElementById('gameover-overlay').style.display = 'none';
}

function gameOver() {
    GAME.state = 'GAME_OVER';
    playSound('gameover');

    if (GAME.score > GAME.highScore) {
        GAME.highScore = GAME.score;
        localStorage.setItem('steaknshake_highscore', GAME.highScore.toString());
        document.getElementById('new-highscore').style.display = 'block';
    } else {
        document.getElementById('new-highscore').style.display = 'none';
    }

    document.getElementById('final-score').textContent = GAME.score;
    const mins = Math.floor(GAME.elapsed / 60);
    const secs = Math.floor(GAME.elapsed % 60);
    document.getElementById('time-survived').textContent = mins + ':' + secs.toString().padStart(2, '0');
    document.getElementById('gameover-overlay').style.display = 'flex';
}

function goToMenu() {
    GAME.state = 'MENU';
    updateMenuHighScore();
    document.getElementById('gameover-overlay').style.display = 'none';
    document.getElementById('menu-overlay').style.display = 'flex';
    renderRestaurant();
}

// ============================================
// GAME LOOP
// ============================================

function gameLoop(now) {
    let dt = (now - GAME.lastTime) / 1000;
    GAME.lastTime = now;
    if (dt > 0.05) dt = 0.05;

    if (GAME.state === 'PLAYING') {
        update(dt);
    }

    if (GAME.state === 'PLAYING') {
        render();
    }

    requestAnimationFrame(gameLoop);
}

// ============================================
// UPDATE
// ============================================

function update(dt) {
    GAME.elapsed += dt;
    GAME.difficulty = Math.floor(GAME.elapsed / 10);

    // Process keyboard input
    let kx = 0, ky = 0;
    if (GAME.keys['w'] || GAME.keys['arrowup']) ky -= 1;
    if (GAME.keys['s'] || GAME.keys['arrowdown']) ky += 1;
    if (GAME.keys['a'] || GAME.keys['arrowleft']) kx -= 1;
    if (GAME.keys['d'] || GAME.keys['arrowright']) kx += 1;

    // Combine keyboard and joystick
    let dx = GAME.input.dx + kx;
    let dy = GAME.input.dy + ky;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) { dx /= mag; dy /= mag; }

    // Update player direction for rendering
    if (mag > 0.2) {
        GAME.player.dir.x = dx;
        GAME.player.dir.y = dy;
        GAME.player.bobTimer += dt * 10;
    }

    // Player speed (check powerup)
    let playerSpeed = GAME.player.speed;
    if (GAME.activePowerup === 'speed') playerSpeed *= 2;

    // Move player
    const p = GAME.player;
    const newPX = p.x + dx * playerSpeed * dt;
    const newPY = p.y + dy * playerSpeed * dt;

    // Collision check X
    if (!collidesWithObstacles({ x: newPX, y: p.y, w: p.w, h: p.h })) {
        p.x = newPX;
    }
    // Collision check Y
    if (!collidesWithObstacles({ x: p.x, y: newPY, w: p.w, h: p.h })) {
        p.y = newPY;
    }

    // Clamp to bounds
    p.x = Math.max(12, Math.min(GAME_W - 12 - p.w, p.x));
    p.y = Math.max(12, Math.min(GAME_H - 12 - p.h, p.y));

    // Francisco AI
    updateFrancisco(dt);

    // Check player-francisco collision (forgiving hitbox)
    const pHit = shrinkBox(p, 0.75);
    const fHit = shrinkBox(GAME.francisco, 0.75);
    if (aabb(pHit, fHit)) {
        gameOver();
        return;
    }

    // Check tip collection
    for (let i = GAME.tips.length - 1; i >= 0; i--) {
        const tip = GAME.tips[i];
        if (aabb(p, tip)) {
            GAME.score += tip.value;
            GAME.tips.splice(i, 1);
            playSound('collect');
            // Respawn after delay
            setTimeout(spawnTip, 1000 + Math.random() * 1000);
        }
    }

    // Check powerup collection
    for (let i = GAME.powerups.length - 1; i >= 0; i--) {
        const pu = GAME.powerups[i];
        if (aabb(p, pu)) {
            GAME.activePowerup = pu.type;
            GAME.powerupTimer = pu.type === 'speed' ? 4 : 3;
            GAME.powerups.splice(i, 1);
            playSound('powerup');
        }
    }

    // Update powerup timer
    if (GAME.activePowerup) {
        GAME.powerupTimer -= dt;
        if (GAME.powerupTimer <= 0) {
            GAME.activePowerup = null;
        }
    }

    // Spawn powerups
    GAME.powerupSpawnTimer += dt;
    if (GAME.powerupSpawnTimer >= GAME.nextPowerupSpawn && GAME.powerups.length < 1) {
        spawnPowerup();
        GAME.powerupSpawnTimer = 0;
        GAME.nextPowerupSpawn = 15 + Math.random() * 15;
    }
}

function updateFrancisco(dt) {
    const f = GAME.francisco;
    const p = GAME.player;

    // Freeze check
    if (GAME.activePowerup === 'freeze') {
        f.stuckTimer = 0;
        return;
    }

    // Speed scales with difficulty
    f.speed = Math.min(180, f.baseSpeed + GAME.difficulty * 8);

    let fdx = p.x - f.x;
    let fdy = p.y - f.y;
    const dist = Math.sqrt(fdx * fdx + fdy * fdy);
    if (dist > 0) { fdx /= dist; fdy /= dist; }

    const moveX = fdx * f.speed * dt;
    const moveY = fdy * f.speed * dt;

    let moved = false;

    // Try full movement
    const newX = f.x + moveX;
    const newY = f.y + moveY;
    if (!collidesWithObstacles({ x: newX, y: newY, w: f.w, h: f.h })) {
        f.x = newX;
        f.y = newY;
        moved = true;
    } else {
        // Try X only
        if (!collidesWithObstacles({ x: newX, y: f.y, w: f.w, h: f.h })) {
            f.x = newX;
            moved = true;
        }
        // Try Y only
        if (!collidesWithObstacles({ x: f.x, y: newY, w: f.w, h: f.h })) {
            f.y = newY;
            moved = true;
        }
    }

    // Stuck detection - nudge perpendicular
    const movedDist = Math.abs(f.x - f.lastX) + Math.abs(f.y - f.lastY);
    if (movedDist < 0.5) {
        f.stuckTimer += dt;
        if (f.stuckTimer > 0.3) {
            // Nudge perpendicular
            const nudgeX = -fdy * f.speed * dt * 1.5;
            const nudgeY = fdx * f.speed * dt * 1.5;
            if (!collidesWithObstacles({ x: f.x + nudgeX, y: f.y + nudgeY, w: f.w, h: f.h })) {
                f.x += nudgeX;
                f.y += nudgeY;
            } else if (!collidesWithObstacles({ x: f.x - nudgeX, y: f.y - nudgeY, w: f.w, h: f.h })) {
                f.x -= nudgeX;
                f.y -= nudgeY;
            }
            f.stuckTimer = 0;
        }
    } else {
        f.stuckTimer = 0;
    }

    f.lastX = f.x;
    f.lastY = f.y;

    // Clamp to bounds
    f.x = Math.max(12, Math.min(GAME_W - 12 - f.w, f.x));
    f.y = Math.max(12, Math.min(GAME_H - 12 - f.h, f.y));
}

// ============================================
// SPAWNING
// ============================================

function spawnTip() {
    if (GAME.state !== 'PLAYING') return;
    if (GAME.tips.length >= 5) return;

    // Find unused positions
    const used = new Set(GAME.tips.map(t => t.posIdx));
    const available = TIP_POSITIONS.map((_, i) => i).filter(i => !used.has(i));
    if (available.length === 0) return;

    const idx = available[Math.floor(Math.random() * available.length)];
    const pos = TIP_POSITIONS[idx];
    const isBig = GAME.score >= 15 && Math.random() < 0.2;

    GAME.tips.push({
        x: pos.x - 8,
        y: pos.y - 4,
        w: 16,
        h: 8,
        value: isBig ? 5 : 1,
        isBig: isBig,
        posIdx: idx,
        bobTimer: Math.random() * Math.PI * 2
    });
}

function spawnPowerup() {
    if (GAME.state !== 'PLAYING') return;

    const type = Math.random() < 0.5 ? 'speed' : 'freeze';

    // Find open floor spot
    let x, y, attempts = 0;
    do {
        x = 120 + Math.random() * (GAME_W - 240);
        y = 120 + Math.random() * (GAME_H - 200);
        attempts++;
    } while (collidesWithObstacles({ x: x - 10, y: y - 10, w: 20, h: 20 }) && attempts < 30);

    if (attempts < 30) {
        GAME.powerups.push({ type, x: x - 10, y: y - 10, w: 20, h: 20, bobTimer: 0 });
    }
}

// ============================================
// COLLISION
// ============================================

function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}

function shrinkBox(box, factor) {
    const dw = box.w * (1 - factor) / 2;
    const dh = box.h * (1 - factor) / 2;
    return { x: box.x + dw, y: box.y + dh, w: box.w * factor, h: box.h * factor };
}

function collidesWithObstacles(box) {
    for (const obs of OBSTACLES) {
        if (aabb(box, obs)) return true;
    }
    return false;
}

// ============================================
// RENDERING
// ============================================

function render() {
    const ctx = GAME.ctx;
    ctx.save();

    renderRestaurant();

    // Render tips
    GAME.tips.forEach(tip => {
        tip.bobTimer += 0.05;
        const bob = Math.sin(tip.bobTimer) * 2;
        ctx.save();
        ctx.translate(tip.x + tip.w / 2, tip.y + tip.h / 2 + bob);

        if (tip.isBig) {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-10, -5, 20, 10);
            ctx.strokeStyle = '#B8860B';
            ctx.strokeRect(-10, -5, 20, 10);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Courier New';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$5', 0, 0);
        } else {
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(-8, -4, 16, 8);
            ctx.strokeStyle = '#2E7D32';
            ctx.strokeRect(-8, -4, 16, 8);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 7px Courier New';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
        }
        ctx.restore();
    });

    // Render powerups
    GAME.powerups.forEach(pu => {
        pu.bobTimer += 0.05;
        const bob = Math.sin(pu.bobTimer * 3) * 3;
        ctx.save();
        ctx.translate(pu.x + pu.w / 2, pu.y + pu.h / 2 + bob);

        if (pu.type === 'speed') {
            ctx.fillStyle = 'rgba(33, 150, 243, 0.8)';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1565C0';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Lightning bolt
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(-3, -6);
            ctx.lineTo(2, -1);
            ctx.lineTo(-1, -1);
            ctx.lineTo(3, 6);
            ctx.lineTo(-2, 1);
            ctx.lineTo(1, 1);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(0, 188, 212, 0.8)';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#00838F';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Snowflake
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            for (let a = 0; a < 6; a++) {
                const angle = a * Math.PI / 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
                ctx.stroke();
            }
        }
        ctx.restore();
    });

    // Render Francisco
    renderFrancisco();

    // Render Player
    renderPlayer();

    // Render HUD
    renderHUD();

    ctx.restore();
}

function renderRestaurant() {
    const ctx = GAME.ctx;

    // Floor
    ctx.fillStyle = '#F5E6CC';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Checkerboard strip near counter
    for (let i = 0; i < GAME_W / 15; i++) {
        for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#333' : '#eee';
            ctx.fillRect(i * 15, 88 + j * 15, 15, 15);
        }
    }

    // Floor tiles (subtle)
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < GAME_W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, GAME_H); ctx.stroke();
    }
    for (let y = 120; y < GAME_H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_W, y); ctx.stroke();
    }

    // Walls
    ctx.fillStyle = '#5C3A1E';
    WALLS.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // Kitchen door (gap in top wall)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(GAME_W / 2 - 25, 0, 50, 12);
    ctx.fillStyle = '#888';
    ctx.fillRect(GAME_W / 2 - 20, 2, 40, 8);
    ctx.fillStyle = '#ccc';
    ctx.font = '6px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('KITCHEN', GAME_W / 2, 9);

    // Entry door (bottom)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(GAME_W / 2 - 30, GAME_H - 12, 60, 12);
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(GAME_W / 2 - 25, GAME_H - 10, 50, 8);

    // Counter
    ctx.fillStyle = '#888';
    ctx.fillRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h);
    ctx.fillStyle = '#aaa';
    ctx.fillRect(COUNTER.x + 2, COUNTER.y + 2, COUNTER.w - 4, COUNTER.h - 8);
    // Counter edge
    ctx.fillStyle = '#666';
    ctx.fillRect(COUNTER.x, COUNTER.y + COUNTER.h - 5, COUNTER.w, 5);

    // Stools
    STOOLS.forEach(s => {
        ctx.fillStyle = '#C0392B';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7B241C';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    // Booths
    BOOTHS.forEach(b => {
        // Seat
        ctx.fillStyle = '#8B1A1A';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        // Table surface
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    });

    // Tables
    TABLES.forEach(t => {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(t.x + 3, t.y + 3, t.w, t.h);
        // Table body
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        // Table top
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(t.x + 3, t.y + 3, t.w - 6, t.h - 6);

        // Chairs (small circles around tables)
        ctx.fillStyle = '#654321';
        // Top
        ctx.beginPath(); ctx.arc(t.x + t.w / 2, t.y - 6, 5, 0, Math.PI * 2); ctx.fill();
        // Bottom
        ctx.beginPath(); ctx.arc(t.x + t.w / 2, t.y + t.h + 6, 5, 0, Math.PI * 2); ctx.fill();
    });

    // Steak 'n' Shake sign on counter
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(GAME_W / 2 - 50, COUNTER.y + 5, 100, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("STEAK 'N' SHAKE", GAME_W / 2, COUNTER.y + 14);
}

function renderPlayer() {
    const ctx = GAME.ctx;
    const p = GAME.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const bob = Math.sin(p.bobTimer) * 1.5;

    ctx.save();
    ctx.translate(cx, cy);

    // Speed boost glow
    if (GAME.activePowerup === 'speed') {
        ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    // Body (black shirt)
    ctx.fillStyle = '#222';
    ctx.fillRect(-8, -2 + bob, 16, 16);

    // Apron (red)
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(-6, 2 + bob, 12, 10);

    // Head
    ctx.fillStyle = p.skinColor;
    ctx.beginPath();
    ctx.arc(0, -6 + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Hair
    if (GAME.selectedChar === 'chris') {
        ctx.fillStyle = '#8B6914';
        ctx.beginPath();
        ctx.arc(0, -9 + bob, 8, Math.PI, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(0, -8 + bob, 8.5, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#000';
    const eyeOffX = p.dir.x * 2;
    const eyeOffY = p.dir.y * 1;
    ctx.beginPath();
    ctx.arc(-3 + eyeOffX, -6 + bob + eyeOffY, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 + eyeOffX, -6 + bob + eyeOffY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0 + eyeOffX, -4 + bob + eyeOffY, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Name tag
    ctx.fillStyle = '#fff';
    ctx.fillRect(-10, 5 + bob, 20, 7);
    ctx.fillStyle = '#000';
    ctx.font = '5px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name.toUpperCase(), 0, 8.5 + bob);

    ctx.restore();
}

function renderFrancisco() {
    const ctx = GAME.ctx;
    const f = GAME.francisco;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;

    ctx.save();
    ctx.translate(cx, cy);

    // Freeze effect
    if (GAME.activePowerup === 'freeze') {
        ctx.fillStyle = 'rgba(0, 188, 212, 0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
    }

    // Body (dark green shirt)
    ctx.fillStyle = GAME.activePowerup === 'freeze' ? '#6699AA' : '#2E4A2E';
    ctx.fillRect(-10, -4, 20, 20);

    // Head
    ctx.fillStyle = GAME.activePowerup === 'freeze' ? '#8AACB8' : '#D2A06C';
    ctx.beginPath();
    ctx.arc(0, -8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Gray hair
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.arc(0, -12, 10, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();

    // Eyebrows (angry/creepy)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(-2, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -12);
    ctx.lineTo(2, -10);
    ctx.stroke();

    // Eyes (beady)
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3, -8, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -8, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Red eye glint (gets more intense with difficulty)
    const redIntensity = Math.min(1, GAME.difficulty * 0.1);
    ctx.fillStyle = `rgba(255, 0, 0, ${redIntensity * 0.6})`;
    ctx.beginPath();
    ctx.arc(-3, -8, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -8, 1, 0, Math.PI * 2);
    ctx.fill();

    // Mustache
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.quadraticCurveTo(-3, -2, 0, -4);
    ctx.quadraticCurveTo(3, -2, 6, -5);
    ctx.quadraticCurveTo(3, -1, 0, -2);
    ctx.quadraticCurveTo(-3, -1, -6, -5);
    ctx.fill();

    // Creepy grin
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -3, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Anger lines (increase with difficulty)
    if (GAME.difficulty >= 2) {
        ctx.strokeStyle = `rgba(255, 0, 0, ${Math.min(0.7, GAME.difficulty * 0.08)})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < Math.min(4, GAME.difficulty); i++) {
            const angle = (i / 4) * Math.PI * 2 + GAME.elapsed * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 13, -8 + Math.sin(angle) * 13);
            ctx.lineTo(Math.cos(angle) * 17, -8 + Math.sin(angle) * 17);
            ctx.stroke();
        }
    }

    ctx.restore();
}

function renderHUD() {
    const ctx = GAME.ctx;

    // HUD background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, GAME_W, 30);

    // Score
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + GAME.score, 15, 16);

    // Time
    const mins = Math.floor(GAME.elapsed / 60);
    const secs = Math.floor(GAME.elapsed % 60);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(mins + ':' + secs.toString().padStart(2, '0'), GAME_W / 2, 16);

    // High score
    ctx.fillStyle = '#FFD700';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText('HI:$' + GAME.highScore, GAME_W - 15, 16);

    // Powerup indicator
    if (GAME.activePowerup) {
        const barW = 80;
        const barH = 6;
        const barX = GAME_W / 2 - barW / 2;
        const barY = 33;
        const maxTime = GAME.activePowerup === 'speed' ? 4 : 3;
        const pct = GAME.powerupTimer / maxTime;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = GAME.activePowerup === 'speed' ? '#2196F3' : '#00BCD4';
        ctx.fillRect(barX, barY, barW * pct, barH);

        ctx.fillStyle = '#fff';
        ctx.font = '8px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(GAME.activePowerup === 'speed' ? 'SPEED BOOST!' : 'FRANCISCO FROZEN!', GAME_W / 2, barY + barH + 10);
    }

    // Francisco speed warning
    if (GAME.difficulty >= 5) {
        ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(GAME.elapsed * 5) * 0.3})`;
        ctx.font = '9px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('FRANCISCO IS GETTING FASTER!', GAME_W / 2, GAME_H - 20);
    }
}

// ============================================
// AUDIO
// ============================================

function initAudio() {
    if (GAME.audioCtx) return;
    try {
        GAME.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        // No audio support
    }
}

function playSound(type) {
    if (!GAME.audioCtx) return;
    try {
        const osc = GAME.audioCtx.createOscillator();
        const gain = GAME.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(GAME.audioCtx.destination);
        gain.gain.value = 0.15;

        const now = GAME.audioCtx.currentTime;

        if (type === 'collect') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'powerup') {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
            gain.gain.linearRampToValueAtTime(0, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.5);
            gain.gain.linearRampToValueAtTime(0, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        }
    } catch (e) {
        // Ignore audio errors
    }
}

// ============================================
// START
// ============================================

window.addEventListener('load', init);
