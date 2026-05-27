import { CollisionTag } from "../Function/CollisionTag";

const { ccclass } = cc._decorator;

/**
 * Tags every PhysicsCollider on this node as an ENEMY.
 * Contact callbacks in PlayerController and StageController
 * use this tag to detect enemy collisions.
 */
@ccclass
export default class EnemyTag extends cc.Component {

    start() {
        for (const collider of this.getComponents(cc.PhysicsCollider)) {
            collider.tag = CollisionTag.ENEMY;
        }
    }
}
