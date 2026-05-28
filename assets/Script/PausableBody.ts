const { ccclass } = cc._decorator;

// freezes this physics object on pause; StageController calls togglePause() on each
@ccclass
export default class PausableBody extends cc.Component {

    private savedVelocity: cc.Vec2 = null;
    private frozenPosition: cc.Vec2 = null;
    private rigidBody: cc.RigidBody = null;
    private animationComponent: cc.Animation = null;

    start() {
        this.rigidBody = this.getComponent(cc.RigidBody);
        this.animationComponent = this.getComponent(cc.Animation);
    }

    update() {
        // keep frozen while paused
        if (this.frozenPosition) {
            this.node.setPosition(this.frozenPosition);
        }
    }

    togglePause() {
        if (!this.frozenPosition) {
            // pause
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
            // resume
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
                // delay one frame to avoid stale contact forces
                this.scheduleOnce(() => {
                    this.rigidBody.active = true;
                });
            }
        }
    }

    isPaused(): boolean {
        return this.frozenPosition !== null;
    }
}
