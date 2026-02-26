const Input = {
    x: 0, y: 0, 
    moveX: 0, moveY: 0,
    isFiring: false,
    keys: {},
    touchID: null, // Track the finger used for movement

    init() {
        const canvas = document.getElementById('gameCanvas');

        // --- TOUCH EVENTS (iOS) ---
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let t of e.changedTouches) {
                // If touch is on left 40% of screen and we aren't already moving
                if (t.clientX < window.innerWidth * 0.4 && this.touchID === null) {
                    this.touchID = t.identifier;
                    this.handleJoystick(t);
                } else {
                    // Right side touch = Aim and Fire
                    this.isFiring = true;
                    this.x = t.clientX;
                    this.y = t.clientY;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let t of e.changedTouches) {
                if (t.identifier === this.touchID) {
                    this.handleJoystick(t);
                } else {
                    // Update aim while moving second finger
                    this.x = t.clientX;
                    this.y = t.clientY;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            for (let t of e.changedTouches) {
                if (t.identifier === this.touchID) {
                    this.touchID = null;
                    this.moveX = 0;
                    this.moveY = 0;
                } else {
                    this.isFiring = false;
                }
            }
        });
    },

    handleJoystick(t) {
        // Virtual Joystick Center (Bottom Left)
        const centerX = 100;
        const centerY = window.innerHeight - 100;
        
        const dx = t.clientX - centerX;
        const dy = t.clientY - centerY;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 5) { // Small deadzone
            this.moveX = dx / dist;
            this.moveY = dy / dist;
        }
    }
};

// --- KEEP YOUR EXISTING KEYBOARD/MOUSE LOGIC BELOW ---

window.addEventListener('keydown', e => { 
    Input.keys[e.key.toLowerCase()] = true; 
    if (Input.touchID === null) updateMove(); 
});
window.addEventListener('keyup', e => { 
    Input.keys[e.key.toLowerCase()] = false; 
    if (Input.touchID === null) updateMove(); 
});

function updateMove() {
    Input.moveX = (Input.keys['d'] || Input.keys['arrowright'] ? 1 : 0) - (Input.keys['a'] || Input.keys['arrowleft'] ? 1 : 0);
    Input.moveY = (Input.keys['s'] || Input.keys['arrowdown'] ? 1 : 0) - (Input.keys['w'] || Input.keys['arrowup'] ? 1 : 0);
}

window.addEventListener('mousemove', e => {
    // Only update aim via mouse if not currently using a second finger on touch
    if (!Input.isFiring || Input.touchID === null) {
        Input.x = e.clientX;
        Input.y = e.clientY;
    }
});

window.addEventListener('mousedown', e => { if(e.button === 0) Input.isFiring = true; });
window.addEventListener('mouseup', () => { Input.isFiring = false; });
window.oncontextmenu = (e) => e.preventDefault();

// Initialize the touch listeners
Input.init();