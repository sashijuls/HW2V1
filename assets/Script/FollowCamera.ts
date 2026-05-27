import PlayerController from "./PlayerController";

const { ccclass, property } = cc._decorator;

/**
 * Smoothly follows a target PlayerController node.
 * X-axis tracking is always active; Y-axis tracking is optional
 * and controlled by the yAxisValid inspector property.
 *
 * Call setFollowTarget() to switch which player the camera tracks.
 */
@ccclass
export default class FollowCamera extends cc.Component {

    /** Set to true in the inspector to also track vertical movement. */
    @property
    yAxisValid = false;

    /** The player node this camera is currently following. */
    private followTarget: PlayerController = null;

    /** Switch which player the camera follows. */
    setFollowTarget(player: PlayerController) {
        this.followTarget = player;
    }

    update() {
        if (!this.followTarget || this.followTarget.isPlayingDeathAnimation) {
            return;
        }

        // Clamp position so the camera never scrolls left of the spawn point.
        const targetPosition = this.followTarget.node.getPosition();
        targetPosition.x = targetPosition.x > 0 ? targetPosition.x : 0;
        if (this.yAxisValid) {
            targetPosition.y = targetPosition.y > 0 ? targetPosition.y : 0;
        }

        // Lerp the camera toward the target for a smooth follow effect.
        const smoothedPosition = this.node.getPosition();
        smoothedPosition.lerp(targetPosition, 0.2, smoothedPosition);
        this.node.x = smoothedPosition.x;
        if (this.yAxisValid) {
            this.node.y = smoothedPosition.y;
        }
    }
}
