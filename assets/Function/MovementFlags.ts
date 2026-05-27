/**
 * Bitflag-based movement state for the player.
 * Multiple directions can be active at once (e.g. UP + LEFT = jump-left).
 */
export enum MovementState {
    IDLE      = 0x0,
    LEFT      = 0x1,   // 001
    RIGHT     = 0x2,   // 010
    UP        = 0x4,   // 100
    UP_LEFT   = 0x5,   // 101
    UP_RIGHT  = 0x6,   // 110
}

/** Any object that holds a MovementState can use the helper functions below. */
export interface MovementRef {
    movementState: MovementState;
}

export function beginMoveLeft(ref: MovementRef) {
    ref.movementState |= MovementState.LEFT;
    endMoveRight(ref); // left and right are mutually exclusive
}

export function endMoveLeft(ref: MovementRef) {
    ref.movementState &= ~(MovementState.LEFT);
}

export function beginMoveRight(ref: MovementRef) {
    ref.movementState |= MovementState.RIGHT;
    endMoveLeft(ref); // left and right are mutually exclusive
}

export function endMoveRight(ref: MovementRef) {
    ref.movementState &= ~(MovementState.RIGHT);
}

export function beginJump(ref: MovementRef) {
    ref.movementState |= MovementState.UP;
}

export function endJump(ref: MovementRef) {
    ref.movementState &= ~(MovementState.UP);
}

export function stopAllMovement(ref: MovementRef) {
    ref.movementState = MovementState.IDLE;
}
