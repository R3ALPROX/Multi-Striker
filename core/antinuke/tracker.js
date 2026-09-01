class ActionTracker {
    constructor() {
        this.events = new Map();
    }

    add(key, windowMs) {
        const now = Date.now();
        const list = (this.events.get(key) || []).filter(time => now - time <= windowMs);
        list.push(now);
        this.events.set(key, list);
        return list.length;
    }

    clear(key) {
        this.events.delete(key);
    }
}

module.exports = new ActionTracker();
