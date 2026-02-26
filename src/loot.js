const ITEM_DB = {
    'pistol_1': { name: "Pistol", icon: "🔫", type: "weapon", fireRate: 400, speed: 600, magSize: 12, ammoType: "9mm", value: 200 },
    'smg_1': { name: "SMG", icon: "📠", type: "weapon", fireRate: 100, speed: 800, magSize: 30, ammoType: "9mm", value: 500 },
    'vest_1': { name: "Light Vest", icon: "🛡️", type: "armor", defense: 10, value: 150 },
    'helmet_1': { name: "Militia Helmet", icon: "🪖", type: "armor", defense: 5, value: 100 },
    'junk_battery': { name: "Old Battery", icon: "🔋", type: "junk", value: 50 },
    'ammo_9mm': { name: "9mm Ammo", icon: "🍬", type: "ammo", ammoType: "9mm", count: 30, value: 30 }
};

// Player's equipped gear state
let gear = {
    weapon: null,
    armor: null,
    helmet: null
};

function generateRandomItem() {
    const keys = Object.keys(ITEM_DB);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const itemTemplate = ITEM_DB[randomKey];
    
    let newItem = { 
        ...itemTemplate, 
        itemId: randomKey, 
        id: Math.random() 
    };

    // If it's a weapon, fill the magazine
    if (newItem.type === 'weapon') {
        newItem.currentAmmo = newItem.magSize;
    }
    
    return newItem;
}