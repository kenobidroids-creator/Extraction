const Input = {
    x: 0, y: 0, 
    moveX: 0, moveY: 0,
    isFiring: false,
    keys: {}
};

window.addEventListener('keydown', e => { 
    Input.keys[e.key.toLowerCase()] = true; 
    updateMove();
});
window.addEventListener('keyup', e => { 
    Input.keys[e.key.toLowerCase()] = false; 
    updateMove();
});

function updateMove() {
    Input.moveX = (Input.keys['d'] || Input.keys['arrowright'] ? 1 : 0) - (Input.keys['a'] || Input.keys['arrowleft'] ? 1 : 0);
    Input.moveY = (Input.keys['s'] || Input.keys['arrowdown'] ? 1 : 0) - (Input.keys['w'] || Input.keys['arrowup'] ? 1 : 0);
}

window.addEventListener('mousemove', e => {
    Input.x = e.clientX;
    Input.y = e.clientY;
});

window.addEventListener('mousedown', e => { if(e.button === 0) Input.isFiring = true; });
window.addEventListener('mouseup', () => { Input.isFiring = false; });
window.oncontextmenu = (e) => e.preventDefault();