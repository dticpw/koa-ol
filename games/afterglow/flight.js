'use strict';
// Shared steering for mouse, keyboard, touch, and the demonstration pilot.
// Coordinates and speed are in CSS pixels, independent of display density.
globalThis.Flight = Object.freeze({
  deadZone: 24,
  fullThrottleDistance: 220,
  maxSpeed: 245,
  turnRate: 8,
  acceleration: 600,
  braking: 1100,
  angleDelta(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  },
  step(ship, intent, dt) {
    const cap = (value, min, max) => Math.max(min, Math.min(max, value));
    dt = cap(dt, 0, 0.05);
    const dx = intent.x - ship.x, dy = intent.y - ship.y;
    const distance = Math.hypot(dx, dy);
    if (ship.dash > 0) {
      // Dash is committed to the heading at activation, even while stationary.
      ship.a = ship.dashAngle;
      ship.x += Math.cos(ship.a) * 950 * dt;
      ship.y += Math.sin(ship.a) * 950 * dt;
      ship.speed = 0;
      return;
    }
    if (intent.active && distance > 3) {
      const delta = this.angleDelta(ship.a, Math.atan2(dy, dx));
      ship.a += cap(delta, -this.turnRate * dt, this.turnRate * dt);
    }
    const error = distance > 3 ? this.angleDelta(ship.a, Math.atan2(dy, dx)) : 0;
    const throttle = intent.active
      ? (intent.throttle ?? cap((distance - this.deadZone) / (this.fullThrottleDistance - this.deadZone), 0, 1))
      : 0;
    // Brake through tight turns rather than orbiting the pointer.
    const desired = this.maxSpeed * cap(throttle, 0, 1) * Math.max(0, Math.cos(error)) ** 2;
    const rate = desired < ship.speed ? this.braking : this.acceleration;
    ship.speed += cap(desired - ship.speed, -rate * dt, rate * dt);
    let travel = ship.speed * dt;
    if (intent.arrive !== false) {
      travel = Math.min(travel, Math.max(0, distance - this.deadZone));
      if (distance <= this.deadZone) ship.speed = 0;
    }
    ship.x += Math.cos(ship.a) * travel;
    ship.y += Math.sin(ship.a) * travel;
  }
});
