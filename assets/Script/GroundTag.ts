import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

/**
 * Tags every PhysicsCollider on this node as GROUND.
 * PlayerController tracks ground contact count so it knows
 * when the player is standing on a solid floor.
 */
@ccclass
export default class GroundTag extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.GROUND;
        }
    }
}
