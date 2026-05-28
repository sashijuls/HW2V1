import PlayerController from "./PlayerController";

const { ccclass, property } = cc._decorator;

// smoothly follows a target player; switch targets with setFollowTarget()
@ccclass
export default class FollowCamera extends cc.Component {

    @property
    yAxisValid = false;

    private followTarget: PlayerController = null;

    setFollowTarget(player: PlayerController) {
        this.followTarget = player;
    }

    update() {
        if (!this.followTarget || this.followTarget.isPlayingDeathAnimation) {
            return;
        }

        // clamp: don't scroll left of origin
        const targetPosition = this.followTarget.node.getPosition();
        targetPosition.x = targetPosition.x > 0 ? targetPosition.x : 0;
        if (this.yAxisValid) {
            targetPosition.y = targetPosition.y > 0 ? targetPosition.y : 0;
        }

        // smooth follow
        const smoothedPosition = this.node.getPosition();
        smoothedPosition.lerp(targetPosition, 0.2, smoothedPosition);
        this.node.x = smoothedPosition.x;
        if (this.yAxisValid) {
            this.node.y = smoothedPosition.y;
        }
    }
}
