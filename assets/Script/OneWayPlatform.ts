import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

// tags all colliders on this node as ONE_WAY_PLATFORM (solid from above only)
@ccclass
export default class OneWayPlatform extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.ONE_WAY_PLATFORM;
        }
    }
}
