import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

// tags all colliders on this node as ENEMY
@ccclass
export default class EnemyTag extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.ENEMY;
        }
    }
}
