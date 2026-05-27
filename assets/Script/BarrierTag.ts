import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

/**
 * Tags every PhysicsCollider on this node as a BARRIER.
 * Barriers block enemy movement but do not interact with the player.
 */
@ccclass
export default class BarrierTag extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.BARRIER;
        }
    }
}
