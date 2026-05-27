const { ccclass } = cc._decorator;

/**
 * Attach this to any physics object that must freeze in place when the game
 * is paused and resume exactly where it left off when unpaused.
 *
 * StageController collects all PausableBody components in the scene and calls
 * togglePause() on each whenever the player pauses or resumes the game.
 */
@ccclass
export default class PausableBody extends cc.Component {

    /** Velocity saved at the moment of pause so it can be restored on resume. */
    private savedVelocity: cc.Vec2 = null;

    /**
     * When non-null this node is frozen: its position is locked every frame.
     * When null the node moves freely.
     */
    private frozenPosition: cc.Vec2 = null;

    private rigidBody: cc.RigidBody = null;
    private animationComponent: cc.Animation = null;

    start() {
        this.rigidBody = this.getComponent(cc.RigidBody);
        this.animationComponent = this.getComponent(cc.Animation);
    }

    update() {
        // While paused, force the node back to the frozen position every frame
        // so physics cannot drift it.
        if (this.frozenPosition) {
            this.node.setPosition(this.frozenPosition);
        }
    }

    /** Freeze this body if currently running, or unfreeze it if currently paused. */
    togglePause() {
        if (!this.frozenPosition) {
            // ── Pause ──
            if (this.node) {
                this.frozenPosition = this.node.getPosition();
                this.node.pauseAllActions();
            }
            if (this.animationComponent) {
                this.animationComponent.pause();
            }
            if (this.rigidBody) {
                this.savedVelocity = this.rigidBody.linearVelocity;
                this.rigidBody.linearVelocity = cc.v2(0, 0);
                this.rigidBody.active = false;
            }
        } else {
            // ── Resume ──
            if (this.node) {
                this.frozenPosition = null;
                this.node.resumeAllActions();
            }
            if (this.animationComponent) {
                this.animationComponent.resume();
            }
            if (this.rigidBody) {
                this.rigidBody.linearVelocity = this.savedVelocity;
                this.savedVelocity = null;
                // Delay re-enabling the body by one frame so Box2D
                // does not apply stale contact forces on the resume frame.
                this.scheduleOnce(() => {
                    this.rigidBody.active = true;
                });
            }
        }
    }

    /** Returns true while this body is paused. */
    isPaused(): boolean {
        return this.frozenPosition !== null;
    }
}
