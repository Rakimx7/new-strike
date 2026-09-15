// Ito ang magsisilbing "radyo" natin. 
// Magpapadala ang inputs ng signal dito, at makikinig ang player.

export const EventBus = {
    events: {},
    
    // Mag-subscribe (Makikinig) sa isang event
    on: function(eventName, fn) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push(fn);
    },
    
    // Mag-emit (Magpadala) ng event
    emit: function(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(function(fn) {
                fn(data);
            });
        }
    }
};