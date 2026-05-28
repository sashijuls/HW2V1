import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

// tags all colliders on this node as BARRIER
@ccclass
export default class BarrierTag extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.BARRIER;
        }
    }
}
