import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

// tags all colliders on this node as GROUND
@ccclass
export default class GroundTag extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.GROUND;
        }
    }
}
