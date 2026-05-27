/**
 * Numeric tags assigned to physics colliders.
 * Set these tags on cc.PhysicsCollider components so that
 * contact callbacks can identify what type of surface or
 * object was touched without needing a node-name string check.
 */
export enum CollisionTag {
    NONE,
    PLAYER,
    GROUND,
    ONE_WAY_PLATFORM,   // Passable from sides and below; solid from above only
    BARRIER,
    DEATH_ZONE,         // Kills the player instantly on contact
    POWER_MUSHROOM,     // Grants the big-Mario powered-up state
    LIFE_MUSHROOM,      // Grants an extra life
    ENEMY,
}
