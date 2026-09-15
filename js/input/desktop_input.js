import { EventBus } from '../core/event_bus.js';

export function initDesktopInput() {
    const keys = { w: false, a: false, s: false, d: false };

    window.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W') keys.w = true;
        if (e.key === 'a' || e.key === 'A') keys.a = true;
        if (e.key === 's' || e.key === 'S') keys.s = true;
        if (e.key === 'd' || e.key === 'D') keys.d = true;
        
        // Magpadala ng signal sa Event Bus
        EventBus.emit('playerMove', keys);
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'W') keys.w = false;
        if (e.key === 'a' || e.key === 'A') keys.a = false;
        if (e.key === 's' || e.key === 'S') keys.s = false;
        if (e.key === 'd' || e.key === 'D') keys.d = false;
        
        EventBus.emit('playerMove', keys);
    });

    // Para sa mouse look (simplified for now)
    window.addEventListener('mousemove', (e) => {
        EventBus.emit('playerLook', { x: e.movementX, y: e.movementY });
    });
}