import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

/**
 * Tags every PhysicsCollider on this node as a ONE_WAY_PLATFORM.
 * One-way platforms are solid only from above: the player can
 * pass through from the sides or jump up through the bottom,
 * but lands normally when falling onto the top surface.
 */
@ccclass
export default class OneWayPlatform extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.ONE_WAY_PLATFORM;
        }
    }
}
