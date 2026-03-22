// ============================================
// STEAK 'N' SHAKE TIP RUSH - GTA STYLE
// ============================================

const GAME_W = 480;
const GAME_H = 720;

const GAME = {
    state: 'MENU',
    canvas: null,
    ctx: null,
    lastTime: 0,
    scale: 1,
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
    powerupSpawnTimer: 0,
    logo: null,
    logoLoaded: false
};

// Load Steak 'n' Shake logo
const logoImg = new Image();
logoImg.crossOrigin = 'anonymous';
logoImg.onload = () => { GAME.logo = logoImg; GAME.logoLoaded = true; };
logoImg.src = 'https://cdn.freebiesupply.com/logos/large/2x/steak-n-shake-logo-png-transparent.png';

// Restaurant layout
const WALLS = [
    { x: 0, y: 0, w: GAME_W, h: 10 },
    { x: 0, y: GAME_H - 10, w: GAME_W, h: 10 },
    { x: 0, y: 0, w: 10, h: GAME_H },
    { x: GAME_W - 10, y: 0, w: 10, h: GAME_H },
];

const COUNTER = { x: 30, y: 50, w: GAME_W - 60, h: 35 };

const STOOLS = [];
for (let i = 0; i < 7; i++) {
    STOOLS.push({ x: 55 + i * 55, y: 92 });
}

const BOOTHS = [
    { x: 15, y: 180, w: 80, h: 55 },
    { x: 15, y: 320, w: 80, h: 55 },
    { x: 15, y: 460, w: 80, h: 55 },
    { x: GAME_W - 95, y: 180, w: 80, h: 55 },
    { x: GAME_W - 95, y: 320, w: 80, h: 55 },
    { x: GAME_W - 95, y: 460, w: 80, h: 55 },
];

const TABLES = [
    { x: 160, y: 200, w: 50, h: 35 },
    { x: 275, y: 200, w: 50, h: 35 },
    { x: 160, y: 345, w: 50, h: 35 },
    { x: 275, y: 345, w: 50, h: 35 },
    { x: 160, y: 485, w: 50, h: 35 },
    { x: 275, y: 485, w: 50, h: 35 },
];

const OBSTACLES = [...WALLS, COUNTER, ...BOOTHS, ...TABLES];

// Tips spawn NEXT TO tables/booths on the floor, not inside them
const TIP_POSITIONS = [
    // Next to center tables (on the walkable side)
    ...TABLES.map(t => ({ x: t.x - 20, y: t.y + t.h / 2 })),
    ...TABLES.map(t => ({ x: t.x + t.w + 4, y: t.y + t.h / 2 })),
    // Next to booths (on the inner walkable side)
    ...BOOTHS.filter(b => b.x < GAME_W / 2).map(b => ({ x: b.x + b.w + 4, y: b.y + b.h / 2 })),
    ...BOOTHS.filter(b => b.x > GAME_W / 2).map(b => ({ x: b.x - 20, y: b.y + b.h / 2 })),
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

    window.addEventListener('keydown', e => { GAME.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { GAME.keys[e.key.toLowerCase()] = false; });

    if (GAME.isMobile) {
        document.getElementById('joystick-container').style.display = 'block';
        setupJoystick();
    }

    GAME.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
    renderRestaurant();
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;
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
    el.textContent = GAME.highScore > 0 ? 'High Score: $' + GAME.highScore : '';
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
                if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
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

    // BIGGER player (was 20x28, now 32x44)
    const skinColor = GAME.selectedChar === 'chris' ? '#FDBCB4' : '#C68642';
    GAME.player = {
        x: GAME_W / 2 - 16,
        y: GAME_H - 100,
        w: 32,
        h: 44,
        speed: 140,
        skinColor: skinColor,
        hairColor: GAME.selectedChar === 'chris' ? '#8B6914' : '#1a1a1a',
        name: GAME.selectedChar === 'chris' ? 'Chris' : 'Jabu',
        dir: { x: 0, y: -1 },
        bobTimer: 0,
        walkFrame: 0
    };

    // BIGGER and SLOWER Francisco (was 24x32 speed 80, now 40x52 speed 55)
    GAME.francisco = {
        x: GAME_W / 2 - 20,
        y: 95,
        w: 40,
        h: 52,
        speed: 55,
        baseSpeed: 55,
        maxSpeed: 140,
        stuckTimer: 0,
        lastX: 0,
        lastY: 0
    };

    for (let i = 0; i < 5; i++) spawnTip();

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

    let kx = 0, ky = 0;
    if (GAME.keys['w'] || GAME.keys['arrowup']) ky -= 1;
    if (GAME.keys['s'] || GAME.keys['arrowdown']) ky += 1;
    if (GAME.keys['a'] || GAME.keys['arrowleft']) kx -= 1;
    if (GAME.keys['d'] || GAME.keys['arrowright']) kx += 1;

    let dx = GAME.input.dx + kx;
    let dy = GAME.input.dy + ky;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) { dx /= mag; dy /= mag; }

    if (mag > 0.2) {
        GAME.player.dir.x = dx;
        GAME.player.dir.y = dy;
        GAME.player.bobTimer += dt * 10;
        GAME.player.walkFrame += dt * 8;
    }

    let playerSpeed = GAME.player.speed;
    if (GAME.activePowerup === 'speed') playerSpeed *= 2;

    const p = GAME.player;
    const newPX = p.x + dx * playerSpeed * dt;
    const newPY = p.y + dy * playerSpeed * dt;

    if (!collidesWithObstacles({ x: newPX, y: p.y, w: p.w, h: p.h })) p.x = newPX;
    if (!collidesWithObstacles({ x: p.x, y: newPY, w: p.w, h: p.h })) p.y = newPY;

    p.x = Math.max(12, Math.min(GAME_W - 12 - p.w, p.x));
    p.y = Math.max(12, Math.min(GAME_H - 12 - p.h, p.y));

    updateFrancisco(dt);

    // Forgiving collision for Francisco catching player
    const pHit = shrinkBox(p, 0.6);
    const fHit = shrinkBox(GAME.francisco, 0.6);
    if (aabb(pHit, fHit)) {
        gameOver();
        return;
    }

    // GENEROUS tip collection radius - use expanded hitbox
    const collectBox = {
        x: p.x - 10,
        y: p.y - 10,
        w: p.w + 20,
        h: p.h + 20
    };
    for (let i = GAME.tips.length - 1; i >= 0; i--) {
        const tip = GAME.tips[i];
        if (aabb(collectBox, tip)) {
            GAME.score += tip.value;
            GAME.tips.splice(i, 1);
            playSound('collect');
            setTimeout(spawnTip, 800 + Math.random() * 800);
        }
    }

    // Powerup collection
    for (let i = GAME.powerups.length - 1; i >= 0; i--) {
        const pu = GAME.powerups[i];
        if (aabb(collectBox, pu)) {
            GAME.activePowerup = pu.type;
            GAME.powerupTimer = pu.type === 'speed' ? 4 : 3;
            GAME.powerups.splice(i, 1);
            playSound('powerup');
        }
    }

    if (GAME.activePowerup) {
        GAME.powerupTimer -= dt;
        if (GAME.powerupTimer <= 0) GAME.activePowerup = null;
    }

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

    if (GAME.activePowerup === 'freeze') { f.stuckTimer = 0; return; }

    // Slower speed scaling: starts at 55, gains +5 per 10 sec, caps at 140
    f.speed = Math.min(f.maxSpeed, f.baseSpeed + GAME.difficulty * 5);

    let fdx = p.x - f.x;
    let fdy = p.y - f.y;
    const dist = Math.sqrt(fdx * fdx + fdy * fdy);
    if (dist > 0) { fdx /= dist; fdy /= dist; }

    const moveX = fdx * f.speed * dt;
    const moveY = fdy * f.speed * dt;

    const newX = f.x + moveX;
    const newY = f.y + moveY;
    if (!collidesWithObstacles({ x: newX, y: newY, w: f.w, h: f.h })) {
        f.x = newX; f.y = newY;
    } else {
        if (!collidesWithObstacles({ x: newX, y: f.y, w: f.w, h: f.h })) f.x = newX;
        if (!collidesWithObstacles({ x: f.x, y: newY, w: f.w, h: f.h })) f.y = newY;
    }

    const movedDist = Math.abs(f.x - f.lastX) + Math.abs(f.y - f.lastY);
    if (movedDist < 0.5) {
        f.stuckTimer += dt;
        if (f.stuckTimer > 0.3) {
            const nudgeX = -fdy * f.speed * dt * 2;
            const nudgeY = fdx * f.speed * dt * 2;
            if (!collidesWithObstacles({ x: f.x + nudgeX, y: f.y + nudgeY, w: f.w, h: f.h })) {
                f.x += nudgeX; f.y += nudgeY;
            } else if (!collidesWithObstacles({ x: f.x - nudgeX, y: f.y - nudgeY, w: f.w, h: f.h })) {
                f.x -= nudgeX; f.y -= nudgeY;
            }
            f.stuckTimer = 0;
        }
    } else {
        f.stuckTimer = 0;
    }

    f.lastX = f.x; f.lastY = f.y;
    f.x = Math.max(12, Math.min(GAME_W - 12 - f.w, f.x));
    f.y = Math.max(12, Math.min(GAME_H - 12 - f.h, f.y));
}

// ============================================
// SPAWNING
// ============================================

function spawnTip() {
    if (GAME.state !== 'PLAYING') return;
    if (GAME.tips.length >= 6) return;

    const used = new Set(GAME.tips.map(t => t.posIdx));
    const available = TIP_POSITIONS.map((_, i) => i).filter(i => !used.has(i));
    if (available.length === 0) return;

    const idx = available[Math.floor(Math.random() * available.length)];
    const pos = TIP_POSITIONS[idx];
    const isBig = GAME.score >= 15 && Math.random() < 0.2;
    const tipW = isBig ? 22 : 18;
    const tipH = isBig ? 12 : 10;

    GAME.tips.push({
        x: pos.x - tipW / 2,
        y: pos.y - tipH / 2,
        w: tipW,
        h: tipH,
        value: isBig ? 5 : 1,
        isBig: isBig,
        posIdx: idx,
        bobTimer: Math.random() * Math.PI * 2
    });
}

function spawnPowerup() {
    if (GAME.state !== 'PLAYING') return;
    const type = Math.random() < 0.5 ? 'speed' : 'freeze';
    let x, y, attempts = 0;
    do {
        x = 120 + Math.random() * (GAME_W - 240);
        y = 120 + Math.random() * (GAME_H - 200);
        attempts++;
    } while (collidesWithObstacles({ x: x - 12, y: y - 12, w: 24, h: 24 }) && attempts < 30);

    if (attempts < 30) {
        GAME.powerups.push({ type, x: x - 12, y: y - 12, w: 24, h: 24, bobTimer: 0 });
    }
}

// ============================================
// COLLISION
// ============================================

function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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

    // Render tip glow indicators on floor
    GAME.tips.forEach(tip => {
        ctx.save();
        ctx.fillStyle = tip.isBig ? 'rgba(255, 215, 0, 0.15)' : 'rgba(76, 175, 80, 0.12)';
        ctx.beginPath();
        ctx.arc(tip.x + tip.w / 2, tip.y + tip.h / 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Render tips
    GAME.tips.forEach(tip => {
        tip.bobTimer += 0.05;
        const bob = Math.sin(tip.bobTimer) * 2;
        ctx.save();
        ctx.translate(tip.x + tip.w / 2, tip.y + tip.h / 2 + bob);

        if (tip.isBig) {
            // Gold $5 bill
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(-11, -6, 22, 12);
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-11, -6, 22, 12);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-9, -4, 18, 8);
            ctx.fillStyle = '#1B5E20';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$5', 0, 1);
        } else {
            // Green $1 bill
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(-9, -5, 18, 10);
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = 1;
            ctx.strokeRect(-9, -5, 18, 10);
            ctx.fillStyle = '#E8F5E9';
            ctx.fillRect(-7, -3, 14, 6);
            ctx.fillStyle = '#1B5E20';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$1', 0, 0);
        }
        ctx.restore();
    });

    // Render powerups
    GAME.powerups.forEach(pu => {
        pu.bobTimer += 0.05;
        const bob = Math.sin(pu.bobTimer * 3) * 3;
        ctx.save();
        ctx.translate(pu.x + pu.w / 2, pu.y + pu.h / 2 + bob);

        // Glow
        ctx.fillStyle = pu.type === 'speed' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(0, 188, 212, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = pu.type === 'speed' ? 'rgba(33, 150, 243, 0.9)' : 'rgba(0, 188, 212, 0.9)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pu.type === 'speed' ? '#1565C0' : '#00838F';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (pu.type === 'speed') {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(-4, -8); ctx.lineTo(3, -2); ctx.lineTo(-1, -1);
            ctx.lineTo(4, 8); ctx.lineTo(-3, 2); ctx.lineTo(1, 1);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            for (let a = 0; a < 6; a++) {
                const angle = a * Math.PI / 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * 7, Math.sin(angle) * 7);
                ctx.stroke();
            }
        }
        ctx.restore();
    });

    // Render shadows
    renderShadow(GAME.francisco.x, GAME.francisco.y, GAME.francisco.w, GAME.francisco.h);
    renderShadow(GAME.player.x, GAME.player.y, GAME.player.w, GAME.player.h);

    renderFrancisco();
    renderPlayer();
    renderHUD();
    ctx.restore();
}

function renderShadow(x, y, w, h) {
    const ctx = GAME.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 2, w / 2 + 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function renderRestaurant() {
    const ctx = GAME.ctx;

    // Floor - warm restaurant tile
    ctx.fillStyle = '#F5E6CC';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Checkerboard strip (Steak 'n' Shake signature)
    for (let i = 0; i < GAME_W / 15; i++) {
        for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#333' : '#eee';
            ctx.fillRect(i * 15, 88 + j * 15, 15, 15);
        }
    }

    // Floor tiles
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < GAME_W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, GAME_H); ctx.stroke();
    }
    for (let y = 120; y < GAME_H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_W, y); ctx.stroke();
    }

    // Walls (thicker, darker)
    ctx.fillStyle = '#4A2810';
    WALLS.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // Wall trim
    ctx.fillStyle = '#6B3A1F';
    ctx.fillRect(10, 10, GAME_W - 20, 3);
    ctx.fillRect(10, GAME_H - 13, GAME_W - 20, 3);

    // Kitchen door
    ctx.fillStyle = '#555';
    ctx.fillRect(GAME_W / 2 - 30, 0, 60, 12);
    ctx.fillStyle = '#888';
    ctx.fillRect(GAME_W / 2 - 25, 2, 50, 8);
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('KITCHEN', GAME_W / 2, 9);

    // Entry door
    ctx.fillStyle = '#555';
    ctx.fillRect(GAME_W / 2 - 35, GAME_H - 12, 70, 12);
    ctx.fillStyle = '#87CEEB';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(GAME_W / 2 - 30, GAME_H - 10, 60, 8);
    ctx.globalAlpha = 1;

    // Counter
    ctx.fillStyle = '#777';
    ctx.fillRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h);
    ctx.fillStyle = '#999';
    ctx.fillRect(COUNTER.x + 2, COUNTER.y + 2, COUNTER.w - 4, COUNTER.h - 10);
    ctx.fillStyle = '#555';
    ctx.fillRect(COUNTER.x, COUNTER.y + COUNTER.h - 6, COUNTER.w, 6);

    // Steak 'n' Shake logo on counter
    if (GAME.logoLoaded) {
        const logoW = 90;
        const logoH = 25;
        ctx.drawImage(GAME.logo, GAME_W / 2 - logoW / 2, COUNTER.y + 4, logoW, logoH);
    } else {
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(GAME_W / 2 - 50, COUNTER.y + 5, 100, 18);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("STEAK 'N' SHAKE", GAME_W / 2, COUNTER.y + 14);
    }

    // Stools
    STOOLS.forEach(s => {
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A52A2A';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // Booths (more detailed)
    BOOTHS.forEach(b => {
        ctx.fillStyle = '#6B1515';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        // Cushion lines
        ctx.strokeStyle = '#8B2020';
        ctx.lineWidth = 1;
        for (let ly = b.y + 10; ly < b.y + b.h; ly += 12) {
            ctx.beginPath(); ctx.moveTo(b.x + 4, ly); ctx.lineTo(b.x + b.w - 4, ly); ctx.stroke();
        }
        // Table surface
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
        // Napkin holder
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(b.x + b.w / 2 - 4, b.y + b.h / 2 - 3, 8, 6);
    });

    // Tables (more realistic)
    TABLES.forEach(t => {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(t.x + 3, t.y + 3, t.w, t.h);
        // Table legs
        ctx.fillStyle = '#5C4033';
        ctx.fillRect(t.x + 3, t.y + 3, 4, 4);
        ctx.fillRect(t.x + t.w - 7, t.y + 3, 4, 4);
        ctx.fillRect(t.x + 3, t.y + t.h - 7, 4, 4);
        ctx.fillRect(t.x + t.w - 7, t.y + t.h - 7, 4, 4);
        // Table body
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(t.x + 3, t.y + 3, t.w - 6, t.h - 6);
        // Napkin/condiments
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(t.x + t.w / 2 - 3, t.y + t.h / 2 - 2, 6, 4);
        ctx.fillStyle = '#CC0000';
        ctx.beginPath();
        ctx.arc(t.x + t.w / 2 + 10, t.y + t.h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(t.x + t.w / 2 - 10, t.y + t.h / 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Chairs
        ctx.fillStyle = '#5C4033';
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y - 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y - 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y + t.h + 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y + t.h + 8, 6, 0, Math.PI * 2); ctx.fill();
        // Chair cushions
        ctx.fillStyle = '#8B2020';
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y - 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y - 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y + t.h + 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y + t.h + 8, 4, 0, Math.PI * 2); ctx.fill();
    });
}

// ============================================
// GTA-STYLE CHARACTER RENDERING
// ============================================

function renderPlayer() {
    const ctx = GAME.ctx;
    const p = GAME.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const bob = Math.sin(p.bobTimer) * 1.5;
    const walkCycle = Math.sin(p.walkFrame) * 3;
    const isMoving = Math.abs(GAME.input.dx) > 0.1 || Math.abs(GAME.input.dy) > 0.1 ||
        GAME.keys['w'] || GAME.keys['s'] || GAME.keys['a'] || GAME.keys['d'] ||
        GAME.keys['arrowup'] || GAME.keys['arrowdown'] || GAME.keys['arrowleft'] || GAME.keys['arrowright'];

    ctx.save();
    ctx.translate(cx, cy);

    // Speed boost aura
    if (GAME.activePowerup === 'speed') {
        ctx.fillStyle = 'rgba(33, 150, 243, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(33, 150, 243, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // LEGS (GTA top-down style)
    ctx.fillStyle = '#1a1a5e'; // dark jeans
    if (isMoving) {
        // Walking animation - legs alternate
        ctx.fillRect(-8, 8 + bob, 7, 14 + walkCycle);
        ctx.fillRect(1, 8 + bob, 7, 14 - walkCycle);
    } else {
        ctx.fillRect(-8, 8 + bob, 7, 14);
        ctx.fillRect(1, 8 + bob, 7, 14);
    }
    // Shoes
    ctx.fillStyle = '#333';
    const shoeOff1 = isMoving ? walkCycle : 0;
    const shoeOff2 = isMoving ? -walkCycle : 0;
    ctx.fillRect(-9, 20 + bob + shoeOff1, 8, 4);
    ctx.fillRect(1, 20 + bob + shoeOff2, 8, 4);

    // TORSO (black uniform shirt)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-12, -6 + bob, 24, 16);
    // Shoulders
    ctx.fillRect(-14, -4 + bob, 4, 8);
    ctx.fillRect(10, -4 + bob, 4, 8);

    // APRON (Steak 'n' Shake red)
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(-10, 0 + bob, 20, 10);
    // Apron strings
    ctx.strokeStyle = '#CC0000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, 2 + bob);
    ctx.lineTo(-14, 0 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 2 + bob);
    ctx.lineTo(14, 0 + bob);
    ctx.stroke();

    // ARMS
    ctx.fillStyle = p.skinColor;
    const armSwing = isMoving ? walkCycle * 0.6 : 0;
    // Left arm
    ctx.save();
    ctx.translate(-14, -2 + bob);
    ctx.rotate(armSwing * 0.05);
    ctx.fillRect(-2, 0, 5, 12);
    ctx.restore();
    // Right arm
    ctx.save();
    ctx.translate(9, -2 + bob);
    ctx.rotate(-armSwing * 0.05);
    ctx.fillRect(0, 0, 5, 12);
    ctx.restore();

    // HEAD (bigger, more detailed)
    const headR = 11;
    ctx.fillStyle = p.skinColor;
    ctx.beginPath();
    ctx.arc(0, -14 + bob, headR, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.beginPath();
    ctx.arc(-headR + 1, -14 + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headR - 1, -14 + bob, 3, 0, Math.PI * 2);
    ctx.fill();

    // Head outline
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -14 + bob, headR, 0, Math.PI * 2);
    ctx.stroke();

    // HAIR
    ctx.fillStyle = p.hairColor;
    if (GAME.selectedChar === 'chris') {
        // Short neat hair
        ctx.beginPath();
        ctx.arc(0, -17 + bob, headR, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();
        // Side part
        ctx.fillRect(-2, -26 + bob, 8, 4);
    } else {
        // Jabu - short fade style
        ctx.beginPath();
        ctx.arc(0, -15 + bob, headR + 1, Math.PI * 0.75, Math.PI * 2.25);
        ctx.fill();
    }

    // FACE
    const eyeOffX = p.dir.x * 2.5;
    const eyeOffY = p.dir.y * 1.5;

    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-4 + eyeOffX * 0.3, -15 + bob + eyeOffY * 0.3, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4 + eyeOffX * 0.3, -15 + bob + eyeOffY * 0.3, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (follow direction)
    ctx.fillStyle = '#2C1810';
    ctx.beginPath();
    ctx.arc(-4 + eyeOffX, -15 + bob + eyeOffY, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4 + eyeOffX, -15 + bob + eyeOffY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = p.hairColor === '#1a1a1a' ? '#333' : '#6B4914';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, -19 + bob);
    ctx.lineTo(-2, -18 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, -19 + bob);
    ctx.lineTo(2, -18 + bob);
    ctx.stroke();

    // Mouth
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -11 + bob, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // NAME TAG on shirt
    ctx.fillStyle = '#fff';
    ctx.fillRect(-12, -2 + bob, 24, 8);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-12, -2 + bob, 24, 8);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 6px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name.toUpperCase(), 0, 2 + bob);

    ctx.restore();
}

function renderFrancisco() {
    const ctx = GAME.ctx;
    const f = GAME.francisco;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const frozen = GAME.activePowerup === 'freeze';
    const breathe = Math.sin(GAME.elapsed * 2) * 1;

    ctx.save();
    ctx.translate(cx, cy);

    // Freeze aura
    if (frozen) {
        ctx.fillStyle = 'rgba(0, 188, 212, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        // Ice crystals
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        for (let a = 0; a < 8; a++) {
            const angle = a * Math.PI / 4 + GAME.elapsed;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 26, Math.sin(angle) * 26);
            ctx.lineTo(Math.cos(angle) * 32, Math.sin(angle) * 32);
            ctx.stroke();
        }
    }

    // LEGS (bigger, heavier build)
    ctx.fillStyle = frozen ? '#5A7A8A' : '#3D2B1F';
    ctx.fillRect(-10, 10 + breathe, 9, 16);
    ctx.fillRect(1, 10 + breathe, 9, 16);
    // Boots
    ctx.fillStyle = frozen ? '#4A6A7A' : '#222';
    ctx.fillRect(-11, 24 + breathe, 10, 5);
    ctx.fillRect(1, 24 + breathe, 10, 5);

    // TORSO (big guy, dark jacket)
    ctx.fillStyle = frozen ? '#5A7A8A' : '#2E3D2E';
    ctx.fillRect(-16, -8 + breathe, 32, 20);
    // Shoulders (wide)
    ctx.fillRect(-18, -6 + breathe, 5, 10);
    ctx.fillRect(13, -6 + breathe, 5, 10);

    // Belt
    ctx.fillStyle = frozen ? '#4A5A4A' : '#1a1a1a';
    ctx.fillRect(-14, 8 + breathe, 28, 4);
    ctx.fillStyle = frozen ? '#8A9A8A' : '#C0A000';
    ctx.fillRect(-3, 8 + breathe, 6, 4); // buckle

    // ARMS (thick)
    ctx.fillStyle = frozen ? '#7A9AAA' : '#D2A06C';
    ctx.fillRect(-18, -4 + breathe, 6, 14);
    ctx.fillRect(12, -4 + breathe, 6, 14);
    // Hands
    ctx.fillRect(-19, 8 + breathe, 7, 6);
    ctx.fillRect(12, 8 + breathe, 7, 6);

    // HEAD (big, intimidating)
    const headR = 14;
    ctx.fillStyle = frozen ? '#8AACB8' : '#D2A06C';
    ctx.beginPath();
    ctx.arc(0, -18 + breathe, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ears
    ctx.beginPath();
    ctx.arc(-headR + 1, -18 + breathe, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headR - 1, -18 + breathe, 4, 0, Math.PI * 2);
    ctx.fill();

    // Gray/white hair (balding)
    ctx.fillStyle = frozen ? '#AAC0CC' : '#999';
    ctx.beginPath();
    ctx.arc(0, -22 + breathe, headR - 1, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    // Bald spot
    ctx.fillStyle = frozen ? '#8AACB8' : '#D2A06C';
    ctx.beginPath();
    ctx.arc(0, -25 + breathe, 6, 0, Math.PI * 2);
    ctx.fill();

    // EYES (menacing)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-5, -19 + breathe, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, -19 + breathe, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (staring at player)
    const dirToPlayer = GAME.player ? {
        x: (GAME.player.x + GAME.player.w / 2 - (f.x + f.w / 2)),
        y: (GAME.player.y + GAME.player.h / 2 - (f.y + f.h / 2))
    } : { x: 0, y: 1 };
    const dirMag = Math.sqrt(dirToPlayer.x * dirToPlayer.x + dirToPlayer.y * dirToPlayer.y) || 1;
    const eX = (dirToPlayer.x / dirMag) * 2;
    const eY = (dirToPlayer.y / dirMag) * 1.5;

    ctx.fillStyle = '#1a0000';
    ctx.beginPath();
    ctx.arc(-5 + eX, -19 + breathe + eY, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5 + eX, -19 + breathe + eY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Red glint in eyes
    const redIntensity = Math.min(1, GAME.difficulty * 0.12);
    if (redIntensity > 0 && !frozen) {
        ctx.fillStyle = `rgba(255, 0, 0, ${redIntensity * 0.7})`;
        ctx.beginPath();
        ctx.arc(-5 + eX, -19 + breathe + eY, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5 + eX, -19 + breathe + eY, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Angry eyebrows
    ctx.strokeStyle = frozen ? '#667' : '#444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-9, -25 + breathe);
    ctx.lineTo(-2, -22 + breathe);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, -25 + breathe);
    ctx.lineTo(2, -22 + breathe);
    ctx.stroke();

    // BIG MUSTACHE
    ctx.fillStyle = frozen ? '#556' : '#333';
    ctx.beginPath();
    ctx.moveTo(-10, -14 + breathe);
    ctx.quadraticCurveTo(-5, -9 + breathe, 0, -12 + breathe);
    ctx.quadraticCurveTo(5, -9 + breathe, 10, -14 + breathe);
    ctx.quadraticCurveTo(5, -8 + breathe, 0, -10 + breathe);
    ctx.quadraticCurveTo(-5, -8 + breathe, -10, -14 + breathe);
    ctx.fill();

    // Creepy grin
    ctx.strokeStyle = frozen ? '#556' : '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -10 + breathe, 5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // Teeth
    ctx.fillStyle = '#FFFFCC';
    ctx.fillRect(-4, -10 + breathe, 8, 3);
    ctx.strokeStyle = frozen ? '#556' : '#222';
    ctx.lineWidth = 0.5;
    for (let tx = -3; tx <= 3; tx += 2) {
        ctx.beginPath();
        ctx.moveTo(tx, -10 + breathe);
        ctx.lineTo(tx, -7 + breathe);
        ctx.stroke();
    }

    // Anger lines (radiate outward with difficulty)
    if (GAME.difficulty >= 2 && !frozen) {
        ctx.strokeStyle = `rgba(255, 50, 0, ${Math.min(0.6, GAME.difficulty * 0.06)})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < Math.min(6, GAME.difficulty); i++) {
            const angle = (i / 6) * Math.PI * 2 + GAME.elapsed * 1.5;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 18, -18 + Math.sin(angle) * 18);
            ctx.lineTo(Math.cos(angle) * 24, -18 + Math.sin(angle) * 24);
            ctx.stroke();
        }
    }

    ctx.restore();
}

function renderHUD() {
    const ctx = GAME.ctx;

    // HUD background - darker, more GTA style
    const grad = ctx.createLinearGradient(0, 0, 0, 35);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, 35);

    // Score
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + GAME.score, 15, 18);

    // Time
    const mins = Math.floor(GAME.elapsed / 60);
    const secs = Math.floor(GAME.elapsed % 60);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(mins + ':' + secs.toString().padStart(2, '0'), GAME_W / 2, 18);

    // High score
    ctx.fillStyle = '#FFD700';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('BEST: $' + GAME.highScore, GAME_W - 15, 18);

    // Powerup indicator
    if (GAME.activePowerup) {
        const barW = 100;
        const barH = 8;
        const barX = GAME_W / 2 - barW / 2;
        const barY = 38;
        const maxTime = GAME.activePowerup === 'speed' ? 4 : 3;
        const pct = GAME.powerupTimer / maxTime;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = GAME.activePowerup === 'speed' ? '#2196F3' : '#00BCD4';
        ctx.fillRect(barX, barY, barW * pct, barH);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(GAME.activePowerup === 'speed' ? 'SPEED BOOST!' : 'FRANCISCO FROZEN!', GAME_W / 2, barY + barH + 12);
    }

    // Francisco speed warning
    if (GAME.difficulty >= 4) {
        ctx.fillStyle = `rgba(255, 0, 0, ${0.4 + Math.sin(GAME.elapsed * 4) * 0.3})`;
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('! FRANCISCO IS SPEEDING UP !', GAME_W / 2, GAME_H - 22);
    }
}

// ============================================
// AUDIO
// ============================================

function initAudio() {
    if (GAME.audioCtx) return;
    try { GAME.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
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
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'powerup') {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
            gain.gain.linearRampToValueAtTime(0, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.5);
            gain.gain.linearRampToValueAtTime(0, now + 0.6);
            osc.start(now); osc.stop(now + 0.6);
        }
    } catch (e) {}
}

// ============================================
// START
// ============================================

window.addEventListener('load', init);
