// collision tags for physics colliders; used in contact callbacks to identify surface types
export enum CollisionTag {
    NONE,
    PLAYER,
    GROUND,
    ONE_WAY_PLATFORM,   // solid from above only
    BARRIER,
    DEATH_ZONE,         // instant kill
    POWER_MUSHROOM,     // big mario
    LIFE_MUSHROOM,      // extra life
    ENEMY,
}
