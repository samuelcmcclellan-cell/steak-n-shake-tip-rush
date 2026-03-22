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
    tips: [],           // tips on the floor to collect
    orders: [],         // tables waiting for food (flashing icon)
    score: 0,
    highScore: 0,
    elapsed: 0,
    difficulty: 0,
    input: { dx: 0, dy: 0 },
    keys: {},
    selectedChar: 'chris',
    audioCtx: null,
    isMobile: false,
    milkshake: null,    // milkshake powerup object near counter
    milkshakeTimer: 0,  // active milkshake speed boost timer
    milkshakeSpawnTimer: 0,
    logo: null,
    logoLoaded: false,
    orderSpawnTimer: 0,
    nextOrderSpawn: 3
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

// All tables and booths that can receive food orders
const ALL_SEATING = [...TABLES, ...BOOTHS];

const OBSTACLES = [...WALLS, COUNTER, ...BOOTHS, ...TABLES];

// Food pickup zone (near counter)
const FOOD_PICKUP = { x: GAME_W / 2 - 40, y: 88, w: 80, h: 30 };

// Tip spawn positions (on floor next to seating)
const TIP_POSITIONS = [
    ...TABLES.map(t => ({ x: t.x - 18, y: t.y + t.h / 2 })),
    ...TABLES.map(t => ({ x: t.x + t.w + 4, y: t.y + t.h / 2 })),
    ...BOOTHS.filter(b => b.x < GAME_W / 2).map(b => ({ x: b.x + b.w + 4, y: b.y + b.h / 2 })),
    ...BOOTHS.filter(b => b.x > GAME_W / 2).map(b => ({ x: b.x - 18, y: b.y + b.h / 2 })),
];

// Milkshake spawn positions (along the counter front)
const MILKSHAKE_POSITIONS = [
    { x: 60, y: 90 }, { x: 140, y: 90 }, { x: 220, y: 90 },
    { x: 300, y: 90 }, { x: 380, y: 90 }
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
        drawW = containerW; drawH = containerW / aspect;
    } else {
        drawH = containerH; drawW = containerH * aspect;
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
// GAME STATE
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
    GAME.orders = [];
    GAME.milkshake = null;
    GAME.milkshakeTimer = 0;
    GAME.milkshakeSpawnTimer = 0;
    GAME.orderSpawnTimer = 0;
    GAME.nextOrderSpawn = 2;

    const skinColor = GAME.selectedChar === 'chris' ? '#FDBCB4' : '#C68642';
    GAME.player = {
        x: GAME_W / 2 - 16, y: GAME_H - 100,
        w: 32, h: 44,
        speed: 140,
        skinColor: skinColor,
        hairColor: GAME.selectedChar === 'chris' ? '#8B6914' : '#1a1a1a',
        name: GAME.selectedChar === 'chris' ? 'Chris' : 'Jabu',
        dir: { x: 0, y: -1 },
        bobTimer: 0, walkFrame: 0,
        carryingFood: false  // whether player is carrying food from counter
    };

    // Francisco: FATTER and OLDER, faster base for harder game
    GAME.francisco = {
        x: GAME_W / 2 - 24, y: 95,
        w: 48, h: 56,
        speed: 65, baseSpeed: 65, maxSpeed: 160,
        stuckTimer: 0, lastX: 0, lastY: 0
    };

    // Spawn first orders
    for (let i = 0; i < 3; i++) spawnOrder();

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
    GAME.difficulty = Math.floor(GAME.elapsed / 8); // faster difficulty ramp (was /10)

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

    // Player speed: base, or boosted by milkshake
    let playerSpeed = GAME.player.speed;
    if (GAME.milkshakeTimer > 0) playerSpeed *= 1.8;

    const p = GAME.player;
    const newPX = p.x + dx * playerSpeed * dt;
    const newPY = p.y + dy * playerSpeed * dt;

    if (!collidesWithObstacles({ x: newPX, y: p.y, w: p.w, h: p.h })) p.x = newPX;
    if (!collidesWithObstacles({ x: p.x, y: newPY, w: p.w, h: p.h })) p.y = newPY;

    p.x = Math.max(12, Math.min(GAME_W - 12 - p.w, p.x));
    p.y = Math.max(12, Math.min(GAME_H - 12 - p.h, p.y));

    // Francisco AI
    updateFrancisco(dt);

    // Francisco catches player
    const pHit = shrinkBox(p, 0.55);
    const fHit = shrinkBox(GAME.francisco, 0.55);
    if (aabb(pHit, fHit)) { gameOver(); return; }

    // --- FOOD DELIVERY MECHANIC ---
    const collectBox = { x: p.x - 8, y: p.y - 8, w: p.w + 16, h: p.h + 16 };

    // Pick up food at counter
    if (!p.carryingFood && aabb(collectBox, FOOD_PICKUP)) {
        p.carryingFood = true;
        playSound('pickup');
    }

    // Deliver food to table with an order -> get tip
    if (p.carryingFood) {
        for (let i = GAME.orders.length - 1; i >= 0; i--) {
            const order = GAME.orders[i];
            const tableBox = { x: order.table.x - 10, y: order.table.y - 10, w: order.table.w + 20, h: order.table.h + 20 };
            if (aabb(collectBox, tableBox)) {
                // Deliver! Spawn a tip on the floor nearby
                p.carryingFood = false;
                spawnTipNearTable(order.table, order.tipValue);
                GAME.orders.splice(i, 1);
                playSound('deliver');
                break;
            }
        }
    }

    // Pick up tips from floor
    for (let i = GAME.tips.length - 1; i >= 0; i--) {
        const tip = GAME.tips[i];
        if (aabb(collectBox, tip)) {
            GAME.score += tip.value;
            GAME.tips.splice(i, 1);
            playSound('collect');
        }
    }

    // Milkshake pickup
    if (GAME.milkshake && aabb(collectBox, GAME.milkshake)) {
        GAME.milkshakeTimer = 5;
        GAME.milkshake = null;
        playSound('powerup');
    }

    // Milkshake timer
    if (GAME.milkshakeTimer > 0) {
        GAME.milkshakeTimer -= dt;
        if (GAME.milkshakeTimer <= 0) GAME.milkshakeTimer = 0;
    }

    // Spawn milkshakes near counter periodically
    GAME.milkshakeSpawnTimer += dt;
    if (GAME.milkshakeSpawnTimer >= 12 && !GAME.milkshake && GAME.milkshakeTimer <= 0) {
        const pos = MILKSHAKE_POSITIONS[Math.floor(Math.random() * MILKSHAKE_POSITIONS.length)];
        GAME.milkshake = { x: pos.x - 8, y: pos.y - 8, w: 16, h: 16, bobTimer: 0 };
        GAME.milkshakeSpawnTimer = 0;
    }

    // Spawn new orders on tables
    GAME.orderSpawnTimer += dt;
    if (GAME.orderSpawnTimer >= GAME.nextOrderSpawn && GAME.orders.length < 4) {
        spawnOrder();
        GAME.orderSpawnTimer = 0;
        // Orders come faster as difficulty increases
        GAME.nextOrderSpawn = Math.max(2, 5 - GAME.difficulty * 0.3);
    }

    // Orders expire if not delivered (makes game harder)
    for (let i = GAME.orders.length - 1; i >= 0; i--) {
        GAME.orders[i].timer -= dt;
        if (GAME.orders[i].timer <= 0) {
            GAME.orders.splice(i, 1); // customer left, missed tip!
        }
    }
}

function updateFrancisco(dt) {
    const f = GAME.francisco;
    const p = GAME.player;

    if (GAME.milkshakeTimer > 0) {
        // Francisco slows slightly when player has milkshake (confused)
    }

    // Speed ramps faster: +7 per difficulty level (every 8 sec)
    f.speed = Math.min(f.maxSpeed, f.baseSpeed + GAME.difficulty * 7);

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
        if (f.stuckTimer > 0.25) {
            const nudgeX = -fdy * f.speed * dt * 2.5;
            const nudgeY = fdx * f.speed * dt * 2.5;
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

function spawnOrder() {
    if (GAME.state !== 'PLAYING') return;
    // Pick a random table/booth that doesn't already have an order
    const usedTables = new Set(GAME.orders.map(o => o.tableIdx));
    const available = ALL_SEATING.map((_, i) => i).filter(i => !usedTables.has(i));
    if (available.length === 0) return;

    const idx = available[Math.floor(Math.random() * available.length)];
    const table = ALL_SEATING[idx];
    // Tip value: mostly $2, sometimes $5
    const tipValue = Math.random() < 0.3 ? 5 : 2;
    // Timer: orders expire faster as game gets harder
    const timer = Math.max(8, 15 - GAME.difficulty * 0.5);

    GAME.orders.push({ table, tableIdx: idx, tipValue, timer, maxTimer: timer });
}

function spawnTipNearTable(table, value) {
    // Spawn tip on walkable floor near the table
    let tx, ty;
    if (table.x < GAME_W / 2) {
        tx = table.x + table.w + 6;
    } else {
        tx = table.x - 20;
    }
    ty = table.y + table.h / 2 - 5;

    GAME.tips.push({
        x: tx, y: ty, w: 18, h: 10,
        value: value,
        bobTimer: Math.random() * Math.PI * 2
    });
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
    for (const obs of OBSTACLES) { if (aabb(box, obs)) return true; }
    return false;
}

// ============================================
// RENDERING
// ============================================

function render() {
    const ctx = GAME.ctx;
    ctx.save();
    renderRestaurant();

    // Render order indicators on tables
    GAME.orders.forEach(order => {
        const t = order.table;
        const cx = t.x + t.w / 2;
        const cy = t.y - 14;
        const pct = order.timer / order.maxTimer;
        const flash = Math.sin(GAME.elapsed * 6) > 0;

        // Exclamation bubble
        ctx.fillStyle = flash ? '#FF6B35' : '#FF9800';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E65100';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Food icon
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍔', cx, cy);

        // Timer bar
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(cx - 15, cy + 12, 30, 4);
        ctx.fillStyle = pct > 0.3 ? '#4CAF50' : '#FF5252';
        ctx.fillRect(cx - 15, cy + 12, 30 * pct, 4);

        // Tip value label
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 8px Arial';
        ctx.fillText('$' + order.tipValue, cx, cy + 22);
    });

    // Floor glow under tips
    GAME.tips.forEach(tip => {
        ctx.save();
        ctx.fillStyle = 'rgba(76, 175, 80, 0.15)';
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

        ctx.fillStyle = tip.value >= 5 ? '#2E7D32' : '#4CAF50';
        ctx.fillRect(-9, -5, 18, 10);
        ctx.strokeStyle = '#1B5E20';
        ctx.lineWidth = 1;
        ctx.strokeRect(-9, -5, 18, 10);
        ctx.fillStyle = '#E8F5E9';
        ctx.fillRect(-7, -3, 14, 6);
        ctx.fillStyle = '#1B5E20';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$' + tip.value, 0, 0);
        ctx.restore();
    });

    // Render milkshake
    if (GAME.milkshake) {
        const ms = GAME.milkshake;
        ms.bobTimer += 0.06;
        const bob = Math.sin(ms.bobTimer * 3) * 3;
        ctx.save();
        ctx.translate(ms.x + ms.w / 2, ms.y + ms.h / 2 + bob);

        // Glow
        ctx.fillStyle = 'rgba(255, 182, 193, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        // Cup
        ctx.fillStyle = '#fff';
        ctx.fillRect(-5, -4, 10, 12);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(-5, -4, 10, 12);

        // Shake top (pink)
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.arc(0, -5, 6, 0, Math.PI * 2);
        ctx.fill();

        // Straw
        ctx.strokeStyle = '#CC0000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(2, -5);
        ctx.lineTo(4, -12);
        ctx.stroke();

        // Cherry
        ctx.fillStyle = '#CC0000';
        ctx.beginPath();
        ctx.arc(0, -9, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Food pickup zone indicator
    if (!GAME.player.carryingFood) {
        const flash = Math.sin(GAME.elapsed * 4) * 0.15 + 0.2;
        ctx.fillStyle = `rgba(76, 175, 80, ${flash})`;
        ctx.fillRect(FOOD_PICKUP.x, FOOD_PICKUP.y, FOOD_PICKUP.w, FOOD_PICKUP.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PICK UP FOOD', FOOD_PICKUP.x + FOOD_PICKUP.w / 2, FOOD_PICKUP.y + FOOD_PICKUP.h / 2);
    }

    // Shadows
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

    // Floor
    ctx.fillStyle = '#F5E6CC';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Checkerboard strip
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

    // Walls
    ctx.fillStyle = '#4A2810';
    WALLS.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));
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

    // Logo on counter
    if (GAME.logoLoaded) {
        ctx.drawImage(GAME.logo, GAME_W / 2 - 45, COUNTER.y + 4, 90, 25);
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
        ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#A52A2A';
        ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.stroke();
    });

    // Booths
    BOOTHS.forEach(b => {
        ctx.fillStyle = '#6B1515';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#8B2020'; ctx.lineWidth = 1;
        for (let ly = b.y + 10; ly < b.y + b.h; ly += 12) {
            ctx.beginPath(); ctx.moveTo(b.x + 4, ly); ctx.lineTo(b.x + b.w - 4, ly); ctx.stroke();
        }
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
        ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(b.x + b.w / 2 - 4, b.y + b.h / 2 - 3, 8, 6);
    });

    // Tables
    TABLES.forEach(t => {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(t.x + 3, t.y + 3, t.w, t.h);
        ctx.fillStyle = '#5C4033';
        ctx.fillRect(t.x + 3, t.y + 3, 4, 4);
        ctx.fillRect(t.x + t.w - 7, t.y + 3, 4, 4);
        ctx.fillRect(t.x + 3, t.y + t.h - 7, 4, 4);
        ctx.fillRect(t.x + t.w - 7, t.y + t.h - 7, 4, 4);
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(t.x + 3, t.y + 3, t.w - 6, t.h - 6);
        // Condiments
        ctx.fillStyle = '#CC0000';
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y + t.h / 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y + t.h / 2, 3, 0, Math.PI * 2); ctx.fill();
        // Chairs
        ctx.fillStyle = '#5C4033';
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y - 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y - 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y + t.h + 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y + t.h + 8, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8B2020';
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y - 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y - 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 - 10, t.y + t.h + 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(t.x + t.w / 2 + 10, t.y + t.h + 8, 4, 0, Math.PI * 2); ctx.fill();
    });
}

// ============================================
// CHARACTER RENDERING - UNIFORM: white shirt, black pants, black apron, red bowtie
// ============================================

function drawUniform(ctx, bob, isMoving, walkCycle, wide) {
    const bodyW = wide ? 18 : 14;
    const shoulderW = wide ? 20 : 16;

    // BLACK PANTS / LEGS
    ctx.fillStyle = '#1a1a1a';
    if (isMoving && !wide) {
        ctx.fillRect(-8, 8 + bob, 7, 14 + walkCycle);
        ctx.fillRect(1, 8 + bob, 7, 14 - walkCycle);
    } else if (wide) {
        ctx.fillRect(-12, 8 + bob, 11, 14);
        ctx.fillRect(1, 8 + bob, 11, 14);
    } else {
        ctx.fillRect(-8, 8 + bob, 7, 14);
        ctx.fillRect(1, 8 + bob, 7, 14);
    }

    // BLACK SHOES
    ctx.fillStyle = '#111';
    const so1 = isMoving && !wide ? walkCycle : 0;
    const so2 = isMoving && !wide ? -walkCycle : 0;
    if (wide) {
        ctx.fillRect(-13, 20 + bob, 12, 5);
        ctx.fillRect(1, 20 + bob, 12, 5);
    } else {
        ctx.fillRect(-9, 20 + bob + so1, 8, 4);
        ctx.fillRect(1, 20 + bob + so2, 8, 4);
    }

    // WHITE SHIRT (torso)
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(-bodyW + 2, -6 + bob, (bodyW - 2) * 2, 16);
    // Shoulders
    ctx.fillRect(-shoulderW, -4 + bob, 4, 8);
    ctx.fillRect(shoulderW - 4, -4 + bob, 4, 8);
    // Shirt outline
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-bodyW + 2, -6 + bob, (bodyW - 2) * 2, 16);

    // BLACK APRON over shirt
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-bodyW + 4, 0 + bob, (bodyW - 4) * 2, 10);
    // Apron strings
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-bodyW + 4, 2 + bob);
    ctx.lineTo(-shoulderW, 0 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bodyW - 4, 2 + bob);
    ctx.lineTo(shoulderW, 0 + bob);
    ctx.stroke();
}

function drawBowtie(ctx, bob, y) {
    // RED BOWTIE at collar
    ctx.fillStyle = '#CC0000';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(0, y + bob);
    ctx.lineTo(-5, y - 3 + bob);
    ctx.lineTo(-5, y + 3 + bob);
    ctx.closePath();
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(0, y + bob);
    ctx.lineTo(5, y - 3 + bob);
    ctx.lineTo(5, y + 3 + bob);
    ctx.closePath();
    ctx.fill();
    // Center knot
    ctx.fillStyle = '#990000';
    ctx.beginPath();
    ctx.arc(0, y + bob, 2, 0, Math.PI * 2);
    ctx.fill();
}

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

    // Milkshake speed aura
    if (GAME.milkshakeTimer > 0) {
        ctx.fillStyle = 'rgba(255, 105, 180, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 105, 180, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Uniform (white shirt, black pants, black apron)
    drawUniform(ctx, bob, isMoving, walkCycle, false);

    // ARMS (skin color)
    ctx.fillStyle = p.skinColor;
    const armSwing = isMoving ? walkCycle * 0.6 : 0;
    ctx.save();
    ctx.translate(-16, -2 + bob);
    ctx.rotate(armSwing * 0.05);
    ctx.fillRect(-2, 0, 5, 12);
    ctx.restore();
    ctx.save();
    ctx.translate(11, -2 + bob);
    ctx.rotate(-armSwing * 0.05);
    ctx.fillRect(0, 0, 5, 12);
    ctx.restore();

    // Carrying food indicator
    if (p.carryingFood) {
        // Tray above head
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(-10, -30 + bob, 20, 3);
        // Plate
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -33 + bob, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.stroke();
        // Burger
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-4, -37 + bob, 8, 3);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(-5, -35 + bob, 10, 2);
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(-4, -34 + bob, 8, 3);
    }

    // HEAD
    const headR = 11;
    ctx.fillStyle = p.skinColor;
    ctx.beginPath();
    ctx.arc(0, -14 + bob, headR, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath(); ctx.arc(-headR + 1, -14 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR - 1, -14 + bob, 3, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -14 + bob, headR, 0, Math.PI * 2); ctx.stroke();

    // HAIR - sits on TOP of head, not covering the face
    ctx.fillStyle = p.hairColor;
    if (GAME.selectedChar === 'chris') {
        // Short neat hair on top only
        ctx.beginPath();
        ctx.arc(0, -18 + bob, headR - 1, Math.PI * 1.0, Math.PI * 2.0);
        ctx.fill();
    } else {
        // Jabu - short tight hair on top
        ctx.beginPath();
        ctx.arc(0, -17 + bob, headR, Math.PI * 1.0, Math.PI * 2.0);
        ctx.fill();
    }

    // FACE
    const eyeOffX = p.dir.x * 2.5;
    const eyeOffY = p.dir.y * 1.5;

    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4 + eyeOffX * 0.3, -15 + bob + eyeOffY * 0.3, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4 + eyeOffX * 0.3, -15 + bob + eyeOffY * 0.3, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    // Pupils
    ctx.fillStyle = '#2C1810';
    ctx.beginPath(); ctx.arc(-4 + eyeOffX, -15 + bob + eyeOffY, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4 + eyeOffX, -15 + bob + eyeOffY, 1.5, 0, Math.PI * 2); ctx.fill();

    // Subtle eyebrows (same color as skin, just a slight ridge)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7, -18.5 + bob); ctx.lineTo(-2, -18 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -18.5 + bob); ctx.lineTo(2, -18 + bob); ctx.stroke();

    // Mouth
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -10 + bob, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // RED BOWTIE
    drawBowtie(ctx, bob, -5);

    // NAME TAG on apron
    ctx.fillStyle = '#fff';
    ctx.fillRect(-12, 1 + bob, 24, 7);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-12, 1 + bob, 24, 7);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 6px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name.toUpperCase(), 0, 4.5 + bob);

    ctx.restore();
}

function renderFrancisco() {
    const ctx = GAME.ctx;
    const f = GAME.francisco;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const breathe = Math.sin(GAME.elapsed * 1.5) * 1.5;

    ctx.save();
    ctx.translate(cx, cy);

    // Uniform (white shirt, black pants, black apron) - WIDE/FAT version
    drawUniform(ctx, breathe, false, 0, true);

    // FAT BELLY bulge over apron
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath();
    ctx.ellipse(0, 2 + breathe, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(0, 4 + breathe, 14, 7, 0, 0, Math.PI);
    ctx.fill();

    // THICK ARMS (skin color)
    ctx.fillStyle = '#D2A06C';
    ctx.fillRect(-22, -4 + breathe, 8, 16);
    ctx.fillRect(14, -4 + breathe, 8, 16);
    // Big hands
    ctx.fillRect(-23, 10 + breathe, 9, 7);
    ctx.fillRect(14, 10 + breathe, 9, 7);

    // RED BOWTIE
    drawBowtie(ctx, breathe, -7);

    // HEAD - BIG, FAT, OLD
    const headR = 16;
    ctx.fillStyle = '#D2A06C';
    ctx.beginPath();
    ctx.arc(0, -20 + breathe, headR, 0, Math.PI * 2);
    ctx.fill();

    // Double chin / fat neck
    ctx.beginPath();
    ctx.ellipse(0, -6 + breathe, 14, 8, 0, 0, Math.PI);
    ctx.fill();

    // Jowls
    ctx.beginPath();
    ctx.ellipse(-12, -14 + breathe, 6, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12, -14 + breathe, 6, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Big ears
    ctx.beginPath(); ctx.arc(-headR + 1, -20 + breathe, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR - 1, -20 + breathe, 5, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -20 + breathe, headR, 0, Math.PI * 2); ctx.stroke();

    // GRAY/WHITE thin hair (very bald)
    ctx.fillStyle = '#AAA';
    ctx.beginPath();
    ctx.arc(0, -25 + breathe, headR - 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();
    // Side wisps
    ctx.fillRect(-headR + 2, -24 + breathe, 5, 8);
    ctx.fillRect(headR - 7, -24 + breathe, 5, 8);

    // WRINKLES (forehead lines)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.7;
    for (let wy = -28; wy <= -24; wy += 2) {
        ctx.beginPath();
        ctx.moveTo(-8, wy + breathe);
        ctx.quadraticCurveTo(0, wy + 1 + breathe, 8, wy + breathe);
        ctx.stroke();
    }
    // Crow's feet
    ctx.beginPath(); ctx.moveTo(-12, -22 + breathe); ctx.lineTo(-15, -24 + breathe); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -20 + breathe); ctx.lineTo(-15, -20 + breathe); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -22 + breathe); ctx.lineTo(15, -24 + breathe); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -20 + breathe); ctx.lineTo(15, -20 + breathe); ctx.stroke();

    // EYES (menacing, staring at player)
    ctx.fillStyle = '#FFFFEE';
    ctx.beginPath(); ctx.ellipse(-6, -21 + breathe, 4.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -21 + breathe, 4.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // Bags under eyes
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-6, -18 + breathe, 4, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, -18 + breathe, 4, 0.3, Math.PI - 0.3); ctx.stroke();

    const dirToPlayer = GAME.player ? {
        x: (GAME.player.x + GAME.player.w / 2 - (f.x + f.w / 2)),
        y: (GAME.player.y + GAME.player.h / 2 - (f.y + f.h / 2))
    } : { x: 0, y: 1 };
    const dirMag = Math.sqrt(dirToPlayer.x * dirToPlayer.x + dirToPlayer.y * dirToPlayer.y) || 1;
    const eX = (dirToPlayer.x / dirMag) * 2.5;
    const eY = (dirToPlayer.y / dirMag) * 1.5;

    ctx.fillStyle = '#1a0000';
    ctx.beginPath(); ctx.arc(-6 + eX, -21 + breathe + eY, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6 + eX, -21 + breathe + eY, 2.5, 0, Math.PI * 2); ctx.fill();

    // Red glint
    const redI = Math.min(1, GAME.difficulty * 0.1);
    if (redI > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${redI * 0.6})`;
        ctx.beginPath(); ctx.arc(-6 + eX, -21 + breathe + eY, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6 + eX, -21 + breathe + eY, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // Heavy angry eyebrows
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-11, -27 + breathe); ctx.lineTo(-2, -24 + breathe); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, -27 + breathe); ctx.lineTo(2, -24 + breathe); ctx.stroke();

    // BIG THICK MUSTACHE
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(-12, -16 + breathe);
    ctx.quadraticCurveTo(-6, -11 + breathe, 0, -14 + breathe);
    ctx.quadraticCurveTo(6, -11 + breathe, 12, -16 + breathe);
    ctx.quadraticCurveTo(6, -9 + breathe, 0, -12 + breathe);
    ctx.quadraticCurveTo(-6, -9 + breathe, -12, -16 + breathe);
    ctx.fill();
    // Mustache curls at ends
    ctx.beginPath(); ctx.arc(-12, -15 + breathe, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -15 + breathe, 2, 0, Math.PI * 2); ctx.fill();

    // Creepy smile with teeth
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -11 + breathe, 6, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = '#FFFFCC';
    ctx.fillRect(-5, -11 + breathe, 10, 3);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let tx = -4; tx <= 4; tx += 2) {
        ctx.beginPath(); ctx.moveTo(tx, -11 + breathe); ctx.lineTo(tx, -8 + breathe); ctx.stroke();
    }

    // Age spots
    ctx.fillStyle = 'rgba(139, 90, 43, 0.2)';
    ctx.beginPath(); ctx.arc(-9, -26 + breathe, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -16 + breathe, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -28 + breathe, 1.5, 0, Math.PI * 2); ctx.fill();

    // Anger lines
    if (GAME.difficulty >= 2) {
        ctx.strokeStyle = `rgba(255, 50, 0, ${Math.min(0.5, GAME.difficulty * 0.05)})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < Math.min(6, GAME.difficulty); i++) {
            const angle = (i / 6) * Math.PI * 2 + GAME.elapsed * 1.5;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 22, -20 + Math.sin(angle) * 22);
            ctx.lineTo(Math.cos(angle) * 28, -20 + Math.sin(angle) * 28);
            ctx.stroke();
        }
    }

    ctx.restore();
}

function renderHUD() {
    const ctx = GAME.ctx;

    const grad = ctx.createLinearGradient(0, 0, 0, 38);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, 38);

    // Score
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + GAME.score, 15, 14);

    // Carrying food indicator
    if (GAME.player && GAME.player.carryingFood) {
        ctx.fillStyle = '#FF9800';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('🍔 DELIVERING...', 15, 30);
    } else if (GAME.player) {
        ctx.fillStyle = '#888';
        ctx.font = '9px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Go to counter for food', 15, 30);
    }

    // Time
    const mins = Math.floor(GAME.elapsed / 60);
    const secs = Math.floor(GAME.elapsed % 60);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(mins + ':' + secs.toString().padStart(2, '0'), GAME_W / 2, 14);

    // Orders waiting
    ctx.fillStyle = '#FF9800';
    ctx.font = '10px Arial';
    ctx.fillText(GAME.orders.length + ' orders', GAME_W / 2, 30);

    // High score
    ctx.fillStyle = '#FFD700';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('BEST: $' + GAME.highScore, GAME_W - 15, 14);

    // Milkshake timer
    if (GAME.milkshakeTimer > 0) {
        const barW = 100;
        const barH = 8;
        const barX = GAME_W / 2 - barW / 2;
        const barY = 40;
        const pct = GAME.milkshakeTimer / 5;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(barX, barY, barW * pct, barH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🥤 MILKSHAKE SPEED!', GAME_W / 2, barY + barH + 12);
    }

    // Francisco speed warning
    if (GAME.difficulty >= 3) {
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
        gain.gain.value = 0.12;
        const now = GAME.audioCtx.currentTime;

        if (type === 'collect') {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.linearRampToValueAtTime(900, now + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'pickup') {
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(500, now + 0.08);
            gain.gain.linearRampToValueAtTime(0, now + 0.12);
            osc.start(now); osc.stop(now + 0.12);
        } else if (type === 'deliver') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(700, now + 0.1);
            osc.frequency.linearRampToValueAtTime(900, now + 0.2);
            gain.gain.linearRampToValueAtTime(0, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        } else if (type === 'powerup') {
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.15);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.5);
            gain.gain.linearRampToValueAtTime(0, now + 0.6);
            osc.start(now); osc.stop(now + 0.6);
        }
    } catch (e) {}
}

window.addEventListener('load', init);
