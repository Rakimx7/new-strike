import { EventBus } from '../core/event_bus.js';
import { CONFIG } from '../core/config.js';

export function initMobileInput() {
    const leftJoystick = document.getElementById('joystick-left');
    const rightJoystick = document.getElementById('joystick-right');
    const btnFire = document.getElementById('btn-fire');

    let leftTouchId = null;
    let rightTouchId = null;

    // Simplified Touch Logic para sa Joysticks
    leftJoystick.addEventListener('touchstart', (e) => {
        leftTouchId = e.changedTouches[0].identifier;
    });

    leftJoystick.addEventListener('touchmove', (e) => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === leftTouchId) {
                // Compute direction based on joystick center
                const rect = leftJoystick.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const deltaX = touch.clientX - centerX;
                const deltaY = touch.clientY - centerY;
                
                // Normalize
                const moveX = deltaX / (rect.width / 2);
                const moveY = deltaY / (rect.height / 2);

                // Emit movement (WASD equivalent)
                EventBus.emit('playerMove', { 
                    x: Math.max(-1, Math.min(1, moveX)), 
                    y: Math.max(-1, Math.min(1, moveY)) 
                });
            }
        }
    });

    leftJoystick.addEventListener('touchend', (e) => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === leftTouchId) {
                leftTouchId = null;
                EventBus.emit('playerMove', { x: 0, y: 0 }); // Stop
            }
        }
    });

    // Right Joystick for looking around
    rightJoystick.addEventListener('touchmove', (e) => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === rightTouchId) {
                 const rect = rightJoystick.getBoundingClientRect();
                 const deltaX = touch.clientX - (rect.left + rect.width / 2);
                 const deltaY = touch.clientY - (rect.top + rect.height / 2);
                 EventBus.emit('playerLook', { x: deltaX * CONFIG.touchSensitivity, y: deltaY * CONFIG.touchSensitivity });
            }
        }
    });

    // Action Buttons
    btnFire.addEventListener('touchstart', () => EventBus.emit('playerShoot', true));
    btnFire.addEventListener('touchend', () => EventBus.emit('playerShoot', false));
}