const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = "BUNKER";
let player = { x: 1500, y: 1500, speed: 250, pockets: [], hp: 100 };
let bullets = [];
let lastShotTime = 0;
let reloadTimer = 0;
const RELOAD_TIME = 2; // 2 seconds to reload
let chests = [];
let mapSize = 3000;
let lastTime = performance.now();
let terrain = [];
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
    // 1. Update the Paper Doll (Silhouette) Slots
    const slotTypes = ['weapon', 'armor', 'helmet'];
    slotTypes.forEach(type => {
        const slotEl = document.getElementById(`slot-${type}`);
        if (!slotEl) return;
        
        const iconLayer = slotEl.querySelector('.icon-layer');
        if (gear[type]) {
            slotEl.classList.add('equipped');
            iconLayer.innerText = gear[type].icon;
        } else {
            slotEl.classList.remove('equipped');
            iconLayer.innerText = "";
        }
    });

    // 2. Render the Stash Grid
    const grid = document.getElementById('stash-grid');
    grid.innerHTML = "";
    stash.forEach((item, index) => {
        let slot = document.createElement('div');
        slot.className = "item-slot";
        slot.innerHTML = `<span>${item.icon}</span>`;
        slot.onclick = () => equipItemFromStash(index);
        grid.appendChild(slot);
    });

    // Update Money
    document.querySelectorAll('.currency-display').forEach(el => {
        el.innerText = currency;
    });
}

function equipItemFromStash(index) {
    let item = stash[index];
    let slot = "";

    // Determine which slot it belongs in
    if (item.type === 'weapon') slot = 'weapon';
    else if (item.type === 'armor') {
        // Distinguish between Helmet and Vest
        slot = item.name.toLowerCase().includes('helmet') ? 'helmet' : 'armor';
    }

    if (slot) {
        // If something is already there, put it back in stash
        if (gear[slot]) stash.push(gear[slot]);
        
        gear[slot] = item;
        stash.splice(index, 1);
        saveData();
        renderBunker();
    }
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
                if (newItem.type === 'weapon') newItem.currentAmmo = newItem.magSize;

                stash.push({ ...item, itemId: key, id: Math.random() });
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

    // Reset player state for the new match
    player.pockets = [];
    player.x = 1500; player.y = 1500;
    bullets = [];
    chests = [];

    // Ensure the HUD starts clean
    updatePocketsUI(); // This will refresh the pocket count and icons
    updateAmmoUI();

    // Create loot boxes
    for(let i=0; i<30; i++) {
        chests.push({ x: Math.random()*mapSize, y: Math.random()*mapSize, item: generateRandomItem(), looted: false });
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

function updateAmmoUI() {
    const ammoVal = document.getElementById('ammo-val');
    const weaponIcon = document.getElementById('weapon-icon');
    const weaponName = document.getElementById('weapon-name');

    if (gear.weapon) {
        if (weaponIcon) weaponIcon.innerText = gear.weapon.icon;
        if (weaponName) weaponName.innerText = gear.weapon.name;
        
        let reserve = player.pockets
            .filter(i => i.type === 'ammo' && i.ammoType === gear.weapon.ammoType)
            .reduce((sum, stack) => sum + (stack.count || 0), 0);
        
        // Use magSize as a fallback if currentAmmo is missing
        let current = gear.weapon.currentAmmo !== undefined ? gear.weapon.currentAmmo : gear.weapon.magSize;
        if (ammoVal) ammoVal.innerText = `${current} / ${reserve}`;
    } else {
        if (weaponIcon) weaponIcon.innerText = "👊";
        if (weaponName) weaponName.innerText = "Fists";
        if (ammoVal) ammoVal.innerText = "0 / 0";
    }
}

function checkInteractions(dt) {
    let nearChest = false;
    chests.forEach(c => {
        if(!c.looted && Math.hypot(c.x - player.x, c.y - player.y) < 50) {
            nearChest = true;
            document.getElementById('prompt').innerText = `[E] LOOT ${c.item.name}`;
            if(Input.keys['e']) {
                player.pockets.push(c.item);
                updateAmmoUI();
                
                // AUTO-EQUIP: If we have no weapon, equip this pick-up immediately
                if (c.item.type === 'weapon' && !gear.weapon) {
                    gear.weapon = c.item;
                    player.pockets.pop(); // Remove from pockets since it's now gear
                }
                
                c.looted = true;
                updatePocketsUI();
                updateAmmoUI()
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
        document.getElementById('prompt').innerText = `SWITCHED TO ${gear.weapon.name}`;
    }
}

function updateEquippedUI() {
    const iconEl = document.getElementById('weapon-icon');
    const nameEl = document.getElementById('weapon-name');
    
    if (gear.weapon) {
        iconEl.innerText = gear.weapon.icon;
        nameEl.innerText = gear.weapon.name;
    } else {
        iconEl.innerText = "👊";
        nameEl.innerText = "Fists";
    }
}

function updatePocketsUI() {
    document.getElementById('pocket-count').innerText = player.pockets.length;
    const bar = document.getElementById('inventory-bar');
    bar.innerHTML = "";
    player.pockets.forEach(item => {
        let slot = document.createElement('div');
        slot.className = "item-slot";
        slot.innerText = item.icon;
        bar.appendChild(slot);
    });
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
    ctx.translate(canvas.width/2 - player.x, canvas.height/2 - player.y);
    ctx.fillStyle = "#2b2620";
    ctx.fillRect(0, 0, mapSize, mapSize);
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, mapSize/2 - 100, mapSize, 200);
    ctx.fillRect(mapSize/2 - 100, 0, 200, mapSize);
    terrain.forEach(patch => {
        ctx.fillStyle = patch.color;
        ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
    });
    chests.forEach(c => { if(!c.looted) { ctx.font = "24px Arial"; ctx.fillText("📦", c.x-12, c.y+10); } });
    // Draw Player
ctx.fillStyle = "#0f0"; 
ctx.fillRect(player.x-15, player.y-15, 30, 30);
    ctx.fillStyle = "yellow"; bullets.forEach(b => ctx.fillRect(b.x-2, b.y-2, 4, 4));
    // Draw Helmet if equipped
if (gear.helmet) {
    ctx.fillStyle = "#555";
    ctx.fillRect(player.x-10, player.y-20, 20, 10); 
}

// Draw "Gun" indicator if a weapon is equipped
if (gear.weapon) {
    ctx.fillStyle = "#fff";
    // Draws a small white rectangle pointing toward the mouse
    let gunAngle = Math.atan2(Input.y - canvas.height/2, Input.x - canvas.width/2);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(gunAngle);
    ctx.fillRect(15, -2, 15, 4); 
    ctx.restore();
}
ctx.restore();
}

function generateTerrain() {
    terrain = [];
    for(let i=0; i<100; i++) {
        terrain.push({
            x: Math.random() * mapSize, y: Math.random() * mapSize,
            w: 100 + Math.random() * 300, h: 100 + Math.random() * 300,
            color: Math.random() > 0.5 ? '#1e1a15' : '#1a1814'
        });
    }
}

init();