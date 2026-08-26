import type { Vec2 } from "./types.ts";

const KEY_BINDINGS: Record<string, Vec2> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const STICK_RADIUS = 44;

// A fixed screen-space tap target for the sword, distinct from the
// thumb-anchored joystick --- shared with render/attackButton.ts so the drawn
// circle and the hit-test always agree.
export const ATTACK_BUTTON_RADIUS = 34;
export const ATTACK_BUTTON_MARGIN = 28;

export function attackButtonCenter(viewportWidth: number, viewportHeight: number): Vec2 {
  return {
    x: viewportWidth - ATTACK_BUTTON_MARGIN - ATTACK_BUTTON_RADIUS,
    y: viewportHeight - ATTACK_BUTTON_MARGIN - ATTACK_BUTTON_RADIUS,
  };
}

function isInAttackButton(x: number, y: number): boolean {
  const center = attackButtonCenter(window.innerWidth, window.innerHeight);
  return Math.hypot(x - center.x, y - center.y) <= ATTACK_BUTTON_RADIUS;
}

export interface Joystick {
  active: boolean;
  anchor: Vec2;
  current: Vec2;
}

// Keyboard (arrows/WASD) and a thumb-anchored virtual stick feed the same
// movement vector, so the game loop doesn't need to know which one is in use.
export class InputController {
  private pressed = new Set<string>();
  private pointerId: number | null = null;
  // Edge-triggered "was something just pressed" signal for menu-style input
  // (restart), distinct from getMovement()'s held-state vector --- a tap
  // without a drag never clears the joystick's own dead zone, so restart
  // needs its own primitive rather than reusing movement.
  private activationPending = false;
  // Edge-triggered "attack was just requested" --- Space on keyboard, or a
  // tap on the fixed on-screen sword button on touch, kept separate from
  // activationPending so a swing during play never gets eaten by restart's
  // consumeActivation() (which only polls while the run is already over).
  private attackPending = false;
  readonly joystick: Joystick = { active: false, anchor: { x: 0, y: 0 }, current: { x: 0, y: 0 } };

  constructor(private target: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }

  getMovement(): Vec2 {
    const keys = this.keyboardVector();
    if (keys.x !== 0 || keys.y !== 0) return keys;
    return this.joystickVector();
  }

  // Returns true at most once per press, then clears --- callers poll this
  // once per frame rather than receiving a callback.
  consumeActivation(): boolean {
    if (!this.activationPending) return false;
    this.activationPending = false;
    return true;
  }

  // Drains a pending press without acting on it --- used during a restart
  // arm-delay so a key still held from the moment of the fatal collision
  // can't be mistaken for a fresh press once listening begins.
  clearActivation(): void {
    this.activationPending = false;
  }

  // Same edge-triggered contract as consumeActivation(), for the sword.
  consumeAttack(): boolean {
    if (!this.attackPending) return false;
    this.attackPending = false;
    return true;
  }

  private keyboardVector(): Vec2 {
    let x = 0;
    let y = 0;
    for (const code of this.pressed) {
      const dir = KEY_BINDINGS[code];
      if (dir) {
        x += dir.x;
        y += dir.y;
      }
    }
    return normalize({ x, y });
  }

  private joystickVector(): Vec2 {
    if (!this.joystick.active) return { x: 0, y: 0 };
    const dx = this.joystick.current.x - this.joystick.anchor.x;
    const dy = this.joystick.current.y - this.joystick.anchor.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return { x: 0, y: 0 };
    const clamped = Math.min(dist, STICK_RADIUS);
    const scale = clamped / dist / STICK_RADIUS;
    return { x: dx * scale, y: dy * scale };
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code);
    // Repeat keydowns (OS auto-repeat while held) must not count as fresh
    // presses --- that's exactly the case RESTART_ARM_DELAY guards against.
    if (!event.repeat) this.activationPending = true;
    if (event.code === "Space" && !event.repeat) this.attackPending = true;
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.activationPending = true;
    // A tap on the sword button attacks --- it must not also anchor the
    // joystick, or the same touch would both swing and start dragging a
    // stick centred on the button.
    if (isInAttackButton(event.clientX, event.clientY)) {
      this.attackPending = true;
      return;
    }
    if (this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.joystick.active = true;
    this.joystick.anchor = { x: event.clientX, y: event.clientY };
    this.joystick.current = { x: event.clientX, y: event.clientY };
    // Capture is a nice-to-have (keeps the drag tracked if the finger leaves
    // the canvas) --- the stick must still work if the browser refuses it.
    try {
      this.target.setPointerCapture(event.pointerId);
    } catch {
      // ignore --- some pointer ids (synthetic events, some browsers) can't be captured
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.joystick.current = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.joystick.active = false;
  };
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return v;
  return { x: v.x / len, y: v.y / len };
}
