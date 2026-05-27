/**
 * Keyboard binding configuration for one local player.
 * Each key code maps to a movement action.
 * Used by PlayerController and StageController.
 */
export type PlayerKeyBindings = {
    left: number;
    right: number;
    up: number;
    switchCamera: number;
};
