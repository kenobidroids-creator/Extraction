class Scavenger {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 120;
        this.hp = 50;
        this.state = "PATROL"; // PATROL, CHASE, ATTACK
        this.target = { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 };
        this.lastShot = 0;
        this.loot = generateRandomItem();
    }

    update(dt, player) {
        let dist = Math.hypot(player.x - this.x, player.y - this.y);

        // 1. Detection Logic
        if (dist < 400) this.state = "CHASE";
        if (dist < 200) this.state = "ATTACK";
        if (dist > 600) this.state = "PATROL";

        // 2. State Machine
        if (this.state === "CHASE") {
            let angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        } 
        else if (this.state === "ATTACK") {
            // Stop and fire every 1 second
            if (Date.now() - this.lastShot > 1000) {
                this.shoot(player);
                this.lastShot = Date.now();
            }
        }
        else if (this.state === "PATROL") {
            // Move toward random waypoint
            let angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.x += Math.cos(angle) * (this.speed * 0.5) * dt;
            if (Math.hypot(this.target.x - this.x, this.target.y - this.y) < 10) {
                this.target = { x: this.x + (Math.random() - 0.5) * 400, y: this.y + (Math.random() - 0.5) * 400 };
            }
        }
    }

    shoot(player) {
        let angle = Math.atan2(player.y - this.y, player.x - this.x);
        bullets.push({ 
            x: this.x, y: this.y, angle: angle, speed: 400, owner: "ENEMY" 
        });
    }

    draw(ctx) {
        ctx.fillStyle = "red";
        ctx.fillRect(this.x - 15, this.y - 15, 30, 30);
        // Small HP bar
        ctx.fillStyle = "black"; ctx.fillRect(this.x - 15, this.y - 25, 30, 5);
        ctx.fillStyle = "red"; ctx.fillRect(this.x - 15, this.y - 25, (this.hp / 50) * 30, 5);
    }
}