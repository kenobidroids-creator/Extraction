const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = "BUNKER";
let player = { x: 1500, y: 1500, speed: 250, pockets: [], hp: 100 };
let scavengers = [];
let bullets = [];
let lastShotTime = 0;
let reloadTimer = 0;
const RELOAD_TIME = 2; // 2 seconds to reload
let chests = [];
let mapSize = 5000;
let lastTime = performance.now();
let terrain = [];
let buildings = [];
let extractZone = { x: 200, y: 200, size: 150, timer: 0 };
let stash = JSON.parse(localStorage.getItem('permanent_stash') || "[]");
let currency = parseInt(localStorage.getItem('currency')) || 500;

// --- GLOBAL UI FUNCTIONS ---
window.showTab = function(tabName) {
    document.getElementById('stash-view').style.display = tabName === 'stash' ? 'block' : 'none';
    document.getElementById('market-view').style.display = tabName === 'market' ? 'block' : 'none';
    if(tabName === 'market') renderMarket();
};

window.unequip = function(slot) {
    if (gear[slot]) {
        stash.push(gear[slot]);
        gear[slot] = null;
        saveData();
        renderBunker();
    }
};

function saveData() {
    localStorage.setItem('permanent_stash', JSON.stringify(stash));
    localStorage.setItem('currency', currency);
}

function init() {
    renderBunker();
    document.getElementById('start-raid-btn').onclick = startMatch;
}

function renderBunker() {
    // 1. Update Gear Silhouette (Paper Doll)
    const slotTypes = ['weapon', 'armor', 'helmet'];
    slotTypes.forEach(type => {
        const slotEl = document.getElementById(`slot-${type}`);
        if (!slotEl) return;
        
        const iconLayer = slotEl.querySelector('.icon-layer');
        if (gear[type]) {
            slotEl.classList.add('equipped');
            if (iconLayer) iconLayer.innerText = gear[type].icon;
        } else {
            slotEl.classList.remove('equipped');
            if (iconLayer) iconLayer.innerText = "";
        }
    });

    // 2. Render Permanent Stash (The top grid)
    const grid = document.getElementById('stash-grid');
    if (grid) {
        grid.innerHTML = "";
        stash.forEach((item, index) => {
            let slot = document.createElement('div');
            slot.className = "item-slot";
            slot.innerHTML = `<span>${item.icon}</span>`;
            // Call our harmonized equip function
            slot.onclick = () => equipItemFromStash(index);
            grid.appendChild(slot);
        });
    }

    // 3. Render Pockets (The bottom grid - Items for the Raid)
    const pocketGrid = document.getElementById('pocket-grid');
    if (pocketGrid) {
        pocketGrid.innerHTML = "";
        player.pockets.forEach((item, index) => {
            let slot = document.createElement('div');
            slot.className = "item-slot";
            slot.innerHTML = `<span>${item.icon}</span>`;
            // Click to move back to stash
            slot.onclick = () => {
                stash.push(player.pockets[index]);
                player.pockets.splice(index, 1);
                saveData();
                renderBunker();
            };
            pocketGrid.appendChild(slot);
        });
    }

    // 4. Update Money
    document.querySelectorAll('.currency-display').forEach(el => {
        el.innerText = currency;
    });
}

function equipItemFromStash(index) {
    let item = stash[index];
    let slot = "";

    // 1. Identify the slot based on item properties
    if (item.type === 'weapon') {
        // If hands are empty, equip it. If hands are full, try putting it in pockets.
        if (!gear.weapon) {
            slot = 'weapon';
        } else {
            slot = ""; // Force it to the "else" (pockets) logic below
        }
    } else if (item.type === 'armor') {
        slot = item.name.toLowerCase().includes('helmet') ? 'helmet' : 'armor';
    }

    // 2. Logic for Gear vs. Pockets
    if (slot) {
        // It's a Gear piece (Weapon/Armor/Helmet)
        if (gear[slot]) stash.push(gear[slot]); // Return current gear to stash
        gear[slot] = item;
        stash.splice(index, 1);
    } else {
        // This handles secondary weapons AND ammo/junk
        // It's a Pocket item (Ammo, Junk, etc.)
        if (player.pockets.length < 12) {
            player.pockets.push(item);
            stash.splice(index, 1);
        } else {
            alert("Pockets are full!");
        }
    }

    saveData();
    renderBunker();
}

function renderMarket() {
    const marketDiv = document.getElementById('market-items');
    marketDiv.innerHTML = `<h4>Funds: $${currency}</h4>`;
    const stock = ['pistol_1', 'smg_1', 'vest_1', 'ammo_9mm'];
    stock.forEach(key => {
        const item = ITEM_DB[key];
        let btn = document.createElement('button');
        btn.innerHTML = `${item.icon} ${item.name} ($${item.value})`;
        btn.onclick = () => {
            if (currency >= item.value) {
                currency -= item.value;
                // Add currentAmmo so it's not undefined
                let newItem = { ...item, itemId: key, id: Math.random() };

                // Ensure the gun is loaded upon purchase
                if (newItem.type === 'weapon') newItem.currentAmmo = newItem.magSize;

                stash.push(newItem);
                saveData();
                renderBunker();
                renderMarket();
            }
        };
        marketDiv.appendChild(btn);
    });
}

function startMatch() {
    gameState = "MATCH";
    generateTerrain();
    if ('ontouchstart' in window) {
    document.getElementById('mobile-controls').style.display = 'block';
}

    // Reset player state for the new match
    player.x = 1500; player.y = 1500;
    bullets = [];
    chests = [];

    // Ensure the HUD starts clean
    updatePocketsUI(); // This will refresh the pocket count and icons
    updateAmmoUI();
    updateEquippedUI();

    // Create loot boxes
    for(let i=0; i<40; i++) {
    let spawnX, spawnY;
    
    if (Math.random() > 0.3 && buildings.length > 0) {
        // 70% chance to spawn loot INSIDE or NEAR a building
        let b = buildings[Math.floor(Math.random() * buildings.length)];
        // Padding of 10px ensures it's not touching the walls
        spawnX = b.x + 10 + Math.random() * (b.w - 30);
        spawnY = b.y + 10 + Math.random() * (b.h - 30);
    } else {
        // 30% chance to spawn in the wild
        spawnX = Math.random() * mapSize;
        spawnY = Math.random() * mapSize;
    }
    
    chests.push({ 
        x: spawnX, 
        y: spawnY, 
        item: generateRandomItem(), 
        looted: false 
    });

}
scavengers = []; // Clear any old enemies from previous matches
    
    // Spawn 15 scavengers near random loot chests
    for (let i = 0; i < 15; i++) {
        if (chests.length > 0) {
            let chest = chests[Math.floor(Math.random() * chests.length)];
            // Create a new Scavenger at the chest location
            scavengers.push(new Scavenger(chest.x + 50, chest.y + 50));
        }
    }

    document.getElementById('bunker-ui').style.display = 'none';
    document.getElementById('match-ui').style.display = 'block';
    document.getElementById('inventory-bar').style.display = 'flex';
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if(gameState !== "MATCH") return;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.1) dt = 0.1; 
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // 1. RELOAD TIMER HANDLER (Must be first!)
    if (reloadTimer > 0) {
        reloadTimer -= dt;
        
        const container = document.getElementById('reload-container');
        const bar = document.getElementById('reload-progress');
        
        if (container && bar) {
            container.style.display = 'block';
            let progress = ((RELOAD_TIME - reloadTimer) / RELOAD_TIME) * 100;
            bar.style.width = progress + "%";
        }

        if (reloadTimer <= 0) {
            if (container) container.style.display = 'none';
            completeReload();
        }
        // While reloading, we still allow movement, but we skip shooting
    }

    // 2. MOVEMENT
    player.x += Input.moveX * player.speed * dt;
    player.y += Input.moveY * player.speed * dt;

    // Update AI behavior
    scavengers.forEach((s) => {
        s.update(dt, player); // Runs the Patrol/Chase/Attack logic
    });

    scavengers.forEach((s, sIdx) => {
    s.update(dt, player);
    
    // Check if PLAYER bullets hit this Scavenger
    bullets.forEach((b, bIdx) => {
        if (!b.owner && Math.hypot(b.x - s.x, b.y - s.y) < 20) {
            s.hp -= 20; // Scavenger takes damage
            bullets.splice(bIdx, 1); // Remove bullet
            if (s.hp <= 0) {
                // Drop their loot where they died
                chests.push({ x: s.x, y: s.y, item: s.loot, looted: false });
                scavengers.splice(sIdx, 1);
            }
        }
    });
});

// Check if ENEMY bullets hit the player
bullets.forEach((b, bIdx) => {
    if (b.owner === "ENEMY" && Math.hypot(b.x - player.x, b.y - player.y) < 20) {
        player.hp -= 10;
        bullets.splice(bIdx, 1);
        document.getElementById('hp-val').innerText = player.hp;
        if (player.hp <= 0) finishMatch(false); // Die and lose gear
    }
});

    // Building collision
    buildings.forEach(b => {
    // Optimization: only check buildings near the player
    if (Math.hypot(b.x + b.w/2 - player.x, b.y + b.h/2 - player.y) < 800) {
        b.walls.forEach(w => {
            const pR = 15; // Player half-width
            if (player.x + pR > w.x && player.x - pR < w.x + w.w &&
                player.y + pR > w.y && player.y - pR < w.y + w.h) {
                
                let overlapL = (player.x + pR) - w.x;
                let overlapR = (w.x + w.w) - (player.x - pR);
                let overlapT = (player.y + pR) - w.y;
                let overlapB = (w.y + w.h) - (player.y - pR);

                let min = Math.min(overlapL, overlapR, overlapT, overlapB);
                if (min === overlapL) player.x = w.x - pR;
                else if (min === overlapR) player.x = w.x + w.w + pR;
                else if (min === overlapT) player.y = w.y - pR;
                else if (min === overlapB) player.y = w.y + w.h + pR;
            }
        });
    }
});

    // 3. SHOOTING (Only if NOT reloading)
    if (Input.isFiring && gear.weapon && reloadTimer <= 0) {
        let now = Date.now();
        if (now - lastShotTime > (gear.weapon.fireRate || 400)) {
            if (gear.weapon.currentAmmo > 0) {
                let angle = Math.atan2(Input.y - canvas.height/2, Input.x - canvas.width/2);
                bullets.push({ 
                    x: player.x, 
                    y: player.y, 
                    angle: angle, 
                    speed: gear.weapon.speed || 600 
                });
                gear.weapon.currentAmmo--;
                lastShotTime = now;
                updateAmmoUI(); // Force text update
            } else {
                document.getElementById('prompt').innerText = "EMPTY! PRESS [R]";
            }
        }
    }

    // 4. RELOAD TRIGGER (Press R)
    if (Input.keys['r'] && gear.weapon && reloadTimer <= 0) {
        let hasAmmo = player.pockets.some(i => i.type === 'ammo' && i.ammoType === gear.weapon.ammoType);
        if (hasAmmo && gear.weapon.currentAmmo < gear.weapon.magSize) {
            reloadTimer = RELOAD_TIME;
            document.getElementById('prompt').innerText = "RELOADING...";
        } else if (!hasAmmo) {
            document.getElementById('prompt').innerText = "NO AMMO IN POCKETS";
        }
        Input.keys['r'] = false; // Reset key
    }

    // 3. Quick Weapon Swap (Press Q)
    if (Input.keys['q']) {
        switchWeapon();
        updateEquippedUI();
        updateAmmoUI();
        Input.keys['q'] = false; // Prevent rapid-fire switching
    }

    // 5. PROJECTILES & INTERACTIONS
    bullets.forEach((b, i) => {
        b.x += Math.cos(b.angle) * b.speed * dt;
        b.y += Math.sin(b.angle) * b.speed * dt;
        if(Math.hypot(b.x - player.x, b.y - player.y) > 1000) bullets.splice(i, 1);
    });

    checkInteractions(dt);
}

function reloadWeapon() {
    if (!gear.weapon) return;
    
    // Find the first available ammo stack for this gun
    let ammoIndex = player.pockets.findIndex(i => i.type === 'ammo' && i.ammoType === gear.weapon.ammoType);
    
    if (ammoIndex !== -1) {
        let ammoItem = player.pockets[ammoIndex];
        let needed = gear.weapon.magSize - gear.weapon.currentAmmo;
        
        if (needed <= 0) return; // Already full

        if (ammoItem.count > needed) {
            ammoItem.count -= needed;
            gear.weapon.currentAmmo = gear.weapon.magSize;
        } else {
            gear.weapon.currentAmmo += ammoItem.count;
            player.pockets.splice(ammoIndex, 1); // Remove empty stack
        }
        
        document.getElementById('prompt').innerText = "RELOADED";
        updatePocketsUI();
        updateAmmoUI();
    } else {
        document.getElementById('prompt').innerText = "NO AMMO IN POCKETS";
    }
}

function completeReload() {
    if (!gear.weapon) return;
    
    // 1. Find all matching ammo stacks in pockets
    let ammoStacks = player.pockets.filter(i => i.type === 'ammo' && i.ammoType === gear.weapon.ammoType);
    let needed = gear.weapon.magSize - gear.weapon.currentAmmo;

    if (ammoStacks.length === 0) return;

    // 2. Fill the gun from stacks
    for (let stack of ammoStacks) {
        if (needed <= 0) break;
        if (stack.count > needed) {
            stack.count -= needed;
            gear.weapon.currentAmmo += needed;
            needed = 0;
        } else {
            gear.weapon.currentAmmo += stack.count;
            needed -= stack.count;
            // Remove the empty stack from player pockets
            player.pockets = player.pockets.filter(i => i !== stack);
        }
    }
    
    document.getElementById('prompt').innerText = "";
    updatePocketsUI();
    updateAmmoUI();
}

// Updates the Numbers (Bullets)
function updateAmmoUI() {
    const ammoVal = document.getElementById('ammo-val');
    if (!ammoVal) return;

    if (gear.weapon) {
        let reserve = player.pockets
            .filter(i => i.type === 'ammo' && i.ammoType === gear.weapon.ammoType)
            .reduce((sum, stack) => sum + (stack.count || 0), 0);
        
        // Handle cases where currentAmmo might be missing initially
        let current = gear.weapon.currentAmmo !== undefined ? gear.weapon.currentAmmo : gear.weapon.magSize;
        ammoVal.innerText = `${current} / ${reserve}`;
    } else {
        ammoVal.innerText = "0 / 0";
    }
}

function checkInteractions(dt) {
    let nearChest = false;
    chests.forEach(c => {
        // Check if player is near AND if they just tapped the chest's screen position
    let distToPlayer = Math.hypot(c.x - player.x, c.y - player.y);
        if(!c.looted && Math.hypot(c.x - player.x, c.y - player.y) < 50) {
            nearChest = true;
            document.getElementById('prompt').innerText = `[E] LOOT ${c.item.name}`;
            if(Input.isFiring ||Input.keys['e']) {
                player.pockets.push(c.item);
                updateAmmoUI();
                updateEquippedUI();
                
                // AUTO-EQUIP: If we have no weapon, equip this pick-up immediately
                if (c.item.type === 'weapon' && !gear.weapon) {
                    gear.weapon = c.item;
                    player.pockets.pop(); // Remove from pockets since it's now gear
                }
                
                c.looted = true;
                updatePocketsUI();
                updateAmmoUI()
                updateEquippedUI();
            }
        }
    });

    if(!nearChest) {
        let distEx = Math.hypot(extractZone.x - player.x, extractZone.y - player.y);
        if(distEx < extractZone.size) {
            extractZone.timer += dt;
            document.getElementById('prompt').innerText = `EXTRACTING: ${Math.ceil(5 - extractZone.timer)}s`;
            if(extractZone.timer >= 5) finishMatch(true);
        } else {
            extractZone.timer = 0;
            document.getElementById('prompt').innerText = "";
        }
    }
}

function switchWeapon() {
    // Find weapons in our pockets
    let weaponInPocketIndex = player.pockets.findIndex(i => i.type === 'weapon');
    
    if (weaponInPocketIndex !== -1) {
        let oldWeapon = gear.weapon;
        // Swap gear with pocket item
        gear.weapon = player.pockets[weaponInPocketIndex];
        
        if (oldWeapon) {
            player.pockets[weaponInPocketIndex] = oldWeapon;
        } else {
            player.pockets.splice(weaponInPocketIndex, 1);
        }
        updatePocketsUI();
        updateAmmoUI();
        updateEquippedUI();
        document.getElementById('prompt').innerText = `SWITCHED TO ${gear.weapon.name}`;
    } else {
        document.getElementById('prompt').innerText = "NO SECONDARY WEAPON";
    }
}

// Updates the HUD (Icon/Name)
function updateEquippedUI() {
    const iconEl = document.getElementById('weapon-icon');
    const nameEl = document.getElementById('weapon-name');
    
    if (iconEl && nameEl) {
        iconEl.innerText = gear.weapon ? gear.weapon.icon : "👊";
        nameEl.innerText = gear.weapon ? gear.weapon.name : "Fists";
    }
}

function updatePocketsUI() {
    // 1. Existing count logic
    const pocketCountEl = document.getElementById('pocket-count');
    if (pocketCountEl) {
        pocketCountEl.innerText = player.pockets.length;
    }

    // 2. Visual Item Bar Logic
    const barEl = document.getElementById('inventory-bar');
    if (barEl) {
        barEl.innerHTML = ""; // Clear old icons
        
        player.pockets.forEach((item, index) => {
            let slot = document.createElement('div');
            
            // Syntax check: Use a white border for weapons (secondary) 
            // and green for everything else
            const isWeapon = item.type === 'weapon';
            
            slot.style.cssText = `
                background: ${isWeapon ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.5)'};
                border: 1px solid ${isWeapon ? '#fff' : '#0f0'};
                padding: 4px 8px;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                min-width: 30px;
                height: 30px;
            `;
            
            slot.innerHTML = `<span>${item.icon}</span>`;
            barEl.appendChild(slot);

            // ADDED: Right-click to drop the item
        slot.oncontextmenu = (e) => {
            e.preventDefault(); // Prevents the browser's default menu from popping up
            dropItem(index);
        };
        
        slot.title = "Right-click to drop"; // Helpful hint for players
        barEl.appendChild(slot);

        let lastTap = 0;
slot.addEventListener('touchstart', (e) => {
    let now = Date.now();
    if (now - lastTap < 300) { // 300ms window for double tap
        dropItem(index);
    }
    lastTap = now;
});
        });
    }
}

function dropItem(index) {
    if (player.pockets[index]) {
        let item = player.pockets[index];
        
        // Create a new "chest" object at player's location
        // but mark it as a 'dropped' type so we know to use the icon
        chests.push({
            x: player.x,
            y: player.y,
            item: item,
            looted: false,
            isDropped: true 
        });

        // Remove from pockets
        player.pockets.splice(index, 1);
        
        // Update UI
        updatePocketsUI();
        updateAmmoUI(); // Update in case you dropped your current ammo type
        document.getElementById('prompt').innerText = "DROPPED " + item.name;
    }
}

function finishMatch(success) {
    if(success) {
        stash = [...stash, ...player.pockets];
        saveData();
    }
    gameState = "BUNKER";
    document.getElementById('match-ui').style.display = 'none';
    document.getElementById('inventory-bar').style.display = 'none';
    document.getElementById('bunker-ui').style.display = 'flex';
    renderBunker();
}

function draw() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    ctx.save();

    // Camera follow logic
    ctx.translate(canvas.width/2 - player.x, canvas.height/2 - player.y);
    
    // 1. Draw Map & Terrain
    ctx.fillStyle = "#2b2620";
    ctx.fillRect(0, 0, mapSize, mapSize);
    
    // Draw Roads
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, mapSize/2 - 100, mapSize, 200);
    ctx.fillRect(mapSize/2 - 100, 0, 200, mapSize);
    
    terrain.forEach(patch => {
        ctx.fillStyle = patch.color;
        ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
    });

    // 2. Extraction Zone
    ctx.strokeStyle = extractZone.timer > 0 ? "#f0f" : "#0ff";
    ctx.lineWidth = 5;
    ctx.strokeRect(extractZone.x, extractZone.y, extractZone.size, extractZone.size);

    // 3. Buildings (Internal Walls and Floors)
    buildings.forEach(b => {
    // Floor first
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Then all wall segments
    ctx.fillStyle = "#555"; 
    if (b.walls) {
        b.walls.forEach(w => {
            ctx.fillRect(w.x, w.y, w.w, w.h);
        });
    }
});

    // 4. Draw chests/loot
    chests.forEach(c => {
        if (!c.looted) {
            ctx.font = "24px Arial";
            ctx.textAlign = "center";
            if (c.item && c.item.icon) {
                ctx.fillText(c.item.icon, c.x, c.y + 10);
            } else {
                ctx.fillText("📦", c.x, c.y + 10);
            }
        }
    });
    
    // 5. Draw Player
    ctx.fillStyle = "#0f0"; 
    ctx.fillRect(player.x-15, player.y-15, 30, 30);

    // Draw all active scavengers
    scavengers.forEach(s => {
        s.draw(ctx); // Renders the red square and health bar
    });

    // 6. Draw Equipment (Helmet/Armor)
    if (gear.helmet) {
        ctx.fillStyle = "#555";
        ctx.fillRect(player.x-10, player.y-20, 20, 10); 
    }
    if (gear.armor) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.strokeRect(player.x-10, player.y-10, 20, 20);
    }

    // 7. Draw Gun
    if (gear.weapon) {
        ctx.fillStyle = "#fff";
        let gunAngle = Math.atan2(Input.y - canvas.height/2, Input.x - canvas.width/2);
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(gunAngle);
        ctx.fillRect(15, -2, 15, 4); 
        ctx.restore();
    }

    // 8. Draw bullets
    ctx.fillStyle = "yellow"; 
    bullets.forEach(b => ctx.fillRect(b.x-2, b.y-2, 4, 4));

    ctx.restore();
}


function generateBuildingInternals(b) {
    const thickness = 10;
    const doorSize = 80; // Slightly wider for easier entry
    b.walls = [];

    // 1. OUTER SHELL - Ensuring multiple entry points
    // Top wall with door
    b.walls.push({ x: b.x, y: b.y, w: (b.w * 0.3), h: thickness });
    b.walls.push({ x: b.x + (b.w * 0.3) + doorSize, y: b.y, w: b.w - (b.w * 0.3) - doorSize, h: thickness });
    
    // Bottom wall (Solid)
    b.walls.push({ x: b.x, y: b.y + b.h - thickness, w: b.w, h: thickness });
    
    // Left wall with side door
    b.walls.push({ x: b.x, y: b.y, w: thickness, h: (b.h * 0.4) });
    b.walls.push({ x: b.x, y: b.y + (b.h * 0.4) + doorSize, w: thickness, h: b.h - (b.h * 0.4) - doorSize });
    
    // Right wall (Solid)
    b.walls.push({ x: b.x + b.w - thickness, y: b.y, w: thickness, h: b.h });

    // 2. ASYMMETRICAL INTERNAL ROOMS
    // We pick a random split point between 30% and 70% of the building width/height
    const splitX = b.x + (b.w * (0.3 + Math.random() * 0.4));
    const splitY = b.y + (b.h * (0.3 + Math.random() * 0.4));

    // Vertical Divider (with internal door)
    b.walls.push({ x: splitX, y: b.y, w: thickness, h: (splitY - b.y) - (doorSize/2) });
    b.walls.push({ x: splitX, y: splitY + (doorSize/2), w: thickness, h: (b.y + b.h) - (splitY + doorSize/2) });

    // Horizontal Divider (to one side only, creating a "L" shaped corridor or large room)
    if (Math.random() > 0.5) {
        b.walls.push({ x: b.x, y: splitY, w: (splitX - b.x) - (doorSize/2), h: thickness });
    } else {
        b.walls.push({ x: splitX + (doorSize/2), y: splitY, w: (b.x + b.w) - (splitX + doorSize/2), h: thickness });
    }
}

function generateTerrain() {
    terrain = [];
    buildings = [];
    let attempts = 0;
    const roadCenter = mapSize / 2;

    // Background patches
    for(let i=0; i<80; i++) {
        let tx = Math.random() * mapSize;
        let ty = Math.random() * mapSize;
        // Keep patches off the main roads
        if (Math.abs(tx - roadCenter) > 150 && Math.abs(ty - roadCenter) > 150) {
            terrain.push({
                x: tx, y: ty,
                w: 100 + Math.random() * 300, h: 100 + Math.random() * 300,
                color: Math.random() > 0.5 ? '#1e1a15' : '#1a1814'
            });
        }
    }

    // Generate 8-10 Large Buildings
    while(buildings.length < 10 && attempts < 500) {
        attempts++;
        let bW = 500 + Math.random() * 200;
        let bH = 500 + Math.random() * 200;
        let bx = Math.random() * (mapSize - bW);
        let by = Math.random() * (mapSize - bH);

        // Don't block the roads
        if (Math.abs(bx - roadCenter) < 250 || Math.abs(by - roadCenter) < 250) continue;

        // Don't overlap other buildings
        let overlap = buildings.some(o => bx < o.x + o.w + 100 && bx + bW > o.x - 100 && by < o.y + o.h + 100 && by + bH > o.y - 100);
        if (overlap) continue;

        let b = { x: bx, y: by, w: bW, h: bH, color: '#333' };
        generateBuildingInternals(b); 
        buildings.push(b);
    }
    console.log(`Map generated with ${buildings.length} buildings after ${attempts} attempts.`);
}

init();