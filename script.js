const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// UI Elements
const scoreElement = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const healthFill = document.getElementById('health-fill');

let animationId;
let score = 0;
let basePlayerHealth = 100;

// Game Entities
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let stars = [];
let frames = 0;
let isGameActive = false;

// Inputs
const keys = {
    w: false, a: false, s: false, d: false, ' ': false
};
const mouse = {
    x: canvas.width / 2, y: canvas.height / 2, down: false
};

// Listeners
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = false;
    }
});

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true; // Left click
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
});

// Utility
function getDistance(x1, y1, x2, y2) {
    const xDist = x2 - x1;
    const yDist = y2 - y1;
    return Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
}

function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Classes
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = '#00f3ff';
        this.velocity = { x: 0, y: 0 };
        this.speed = 5;
        this.friction = 0.9;
        this.angle = 0;
        this.health = basePlayerHealth;
        this.lastShot = 0;
        this.fireRate = 12; // frames
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        ctx.moveTo(20, 0); // Tip
        ctx.lineTo(-15, 15); // Right wing
        ctx.lineTo(-5, 0); // Back center
        ctx.lineTo(-15, -15); // Left wing
        ctx.closePath();
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.fill();

        // Engine glow
        if (keys.w || keys.a || keys.s || keys.d) {
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(-25, Math.random() * 10 - 5);
            ctx.lineTo(-6, 0);
            ctx.strokeStyle = '#ff00ea';
            ctx.stroke();
        }

        ctx.restore();
    }

    update() {
        // Movement
        if (keys.w) this.velocity.y -= this.speed * 0.1;
        if (keys.s) this.velocity.y += this.speed * 0.1;
        if (keys.a) this.velocity.x -= this.speed * 0.1;
        if (keys.d) this.velocity.x += this.speed * 0.1;

        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Boundaries
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Rotation
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        // Shooting
        if ((mouse.down || keys[' ']) && frames - this.lastShot > this.fireRate) {
            this.shoot();
            this.lastShot = frames;
        }

        this.draw();
    }

    shoot() {
        const speed = 15;
        const velocity = {
            x: Math.cos(this.angle) * speed,
            y: Math.sin(this.angle) * speed
        };
        // Shoot from the tip
        const tipX = this.x + Math.cos(this.angle) * 20;
        const tipY = this.y + Math.sin(this.angle) * 20;
        
        projectiles.push(new Projectile(tipX, tipY, 4, this.color, velocity));
        
        // Minor recoil
        this.velocity.x -= Math.cos(this.angle) * 1.5;
        this.velocity.y -= Math.sin(this.angle) * 1.5;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) this.health = 0;
        updateHealthUI();
        if (this.health === 0) {
            endGame();
        }
    }
}

class Projectile {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Enemy {
    constructor(x, y, radius, color, velocity, type) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.type = type; // 'scout', 'tank', 'asteroid'
        this.angle = 0;
        
        if (type === 'scout') {
            this.health = 1;
            this.scoreVal = 20;
            this.speed = randRange(2, 4);
        } else if (type === 'tank') {
            this.health = 5;
            this.scoreVal = 50;
            this.speed = randRange(0.5, 1.5);
        } else if (type === 'asteroid') {
            this.health = 3;
            this.scoreVal = 10;
            this.speed = randRange(1, 2.5);
            // Asteroids don't seek player, they just drift
            const driftAngle = Math.atan2(canvas.height/2 - y, canvas.width/2 - x) + randRange(-0.5, 0.5);
            this.velocity = {
                x: Math.cos(driftAngle) * this.speed,
                y: Math.sin(driftAngle) * this.speed
            };
            this.rotSpeed = randRange(-0.05, 0.05);
            
            // Generate random jagged shape
            this.points = [];
            const numPoints = 8;
            for(let i=0; i<numPoints; i++){
                const ang = (i / numPoints) * Math.PI * 2;
                const r = this.radius * randRange(0.8, 1.2);
                this.points.push({x: Math.cos(ang)*r, y: Math.sin(ang)*r});
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        if (this.type === 'asteroid') {
            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for(let i=1; i<this.points.length; i++){
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            ctx.closePath();
            ctx.stroke();
            this.angle += this.rotSpeed;
        } else if (this.type === 'tank') {
            // Hexagon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                ctx.lineTo(this.radius * Math.cos(i * Math.PI / 3), this.radius * Math.sin(i * Math.PI / 3));
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 0, 102, 0.2)';
            ctx.fill();
        } else { // scout
            ctx.beginPath();
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(-this.radius, this.radius);
            ctx.lineTo(-this.radius, -this.radius);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();
    }

    update() {
        this.draw();
        
        if (this.type !== 'asteroid') {
            // Seek player
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.angle = angle; // look at player
            this.velocity.x = Math.cos(angle) * this.speed;
            this.velocity.y = Math.sin(angle) * this.speed;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
        this.friction = 0.98;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.draw();
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.01;
    }
}

class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = Math.random() * 1.5;
        this.alpha = Math.random();
        this.speed = this.radius * 0.5;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    update() {
        this.draw();
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.y = 0;
            this.x = Math.random() * canvas.width;
        }
    }
}

// Subsystems
function createExplosion(x, y, color, radius) {
    const pCount = radius * 2;
    for (let i = 0; i < pCount; i++) {
        particles.push(new Particle(x, y, Math.random() * 3, color, {
            x: (Math.random() - 0.5) * (Math.random() * 8),
            y: (Math.random() - 0.5) * (Math.random() * 8)
        }));
    }
}

function spawnEnemy() {
    if (!isGameActive) return;
    
    // Initial static setInterval to prevent recursive overflow, but we make it dynamic
    const spawner = setInterval(() => {
        if (!isGameActive) {
            clearInterval(spawner);
            return;
        }
        
        let typeVal = Math.random();
        let type = 'scout';
        let radius = 15;
        let color = '#ff0055';
        
        if (typeVal > 0.8) {
            type = 'tank';
            radius = 25;
            color = '#ff0066';
        } else if (typeVal > 0.5) {
            type = 'asteroid';
            radius = randRange(20, 40);
            color = '#ff9900';
        }

        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
        }

        enemies.push(new Enemy(x, y, radius, color, {x:0, y:0}, type));
    }, Math.max(400, 1000 - (frames/10))); // Gets faster over time, min 400ms
}

function updateHealthUI() {
    let pct = (player.health / basePlayerHealth) * 100;
    healthFill.style.width = pct + '%';
    if (pct < 30) {
        healthFill.style.backgroundColor = '#ff0000';
        healthFill.style.boxShadow = '0 0 10px #ff0000';
    } else {
        healthFill.style.backgroundColor = 'var(--neon-green)';
        healthFill.style.boxShadow = '0 0 10px var(--neon-green)';
    }
}

function updateScore(points) {
    score += points;
    scoreElement.innerText = score;
}

// Game Core
function init() {
    player = new Player(canvas.width / 2, canvas.height / 2);
    projectiles = [];
    enemies = [];
    particles = [];
    score = 0;
    frames = 0;
    updateScore(0);
    updateHealthUI();
    
    stars = [];
    for(let i=0; i<150; i++) stars.push(new Star());

    isGameActive = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    spawnEnemy();
    animate();
}

function endGame() {
    isGameActive = false;
    cancelAnimationFrame(animationId);
    finalScoreElement.innerText = score;
    gameOverScreen.classList.remove('hidden');
    
    createExplosion(player.x, player.y, player.color, 30);
    
    // Draw one last frame to show the player explosion
    ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => p.draw());
}

function animate() {
    if (!isGameActive) return;
    animationId = requestAnimationFrame(animate);
    frames++;

    ctx.fillStyle = 'rgba(10, 10, 20, 0.3)'; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    stars.forEach(star => star.update());

    player.update();

    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
        }
    });

    projectiles.forEach((projectile, index) => {
        projectile.update();

        // Remove off-screen lasers
        if (projectile.x + projectile.radius < 0 ||
            projectile.x - projectile.radius > canvas.width ||
            projectile.y + projectile.radius < 0 ||
            projectile.y - projectile.radius > canvas.height) {
            setTimeout(() => {
                projectiles.splice(index, 1);
            }, 0);
        }
    });

    enemies.forEach((enemy, index) => {
        enemy.update();

        // Enemy collision with player
        const dist = getDistance(player.x, player.y, enemy.x, enemy.y);
        if (dist - enemy.radius - player.radius < 1) {
            createExplosion(enemy.x, enemy.y, enemy.color, 15);
            player.takeDamage(enemy.type === 'tank' ? 30 : 15);
            setTimeout(() => {
                enemies.splice(index, 1);
            }, 0);
        }

        // Projectile collision with enemy
        projectiles.forEach((projectile, pIndex) => {
            const distProj = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            
            if (distProj - enemy.radius - projectile.radius < 1) {
                // Hit!
                enemy.health -= 1;
                
                // Creates small hit sparks
                for(let i=0; i<3; i++) {
                    particles.push(new Particle(projectile.x, projectile.y, 1.5, projectile.color, {x: (Math.random()-0.5)*3, y:(Math.random()-0.5)*3}));
                }

                setTimeout(() => {
                    projectiles.splice(pIndex, 1);
                }, 0);

                if (enemy.health <= 0) {
                    createExplosion(enemy.x, enemy.y, enemy.color, enemy.radius);
                    updateScore(enemy.scoreVal);

                    // Asteroid splitting
                    if (enemy.type === 'asteroid' && enemy.radius > 15) {
                        enemies.push(new Enemy(enemy.x, enemy.y, enemy.radius/1.5, enemy.color, {x:0, y:0}, 'asteroid'));
                        enemies.push(new Enemy(enemy.x, enemy.y, enemy.radius/1.5, enemy.color, {x:0, y:0}, 'asteroid'));
                    }

                    setTimeout(() => {
                        enemies.splice(index, 1);
                    }, 0);
                }
            }
        });
    });
}

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw for background before start
ctx.fillStyle = 'rgba(10, 10, 20, 1)';
ctx.fillRect(0, 0, canvas.width, canvas.height);
for(let i=0; i<150; i++) stars.push(new Star());
stars.forEach(s => s.update());
