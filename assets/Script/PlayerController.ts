import { CollisionTag } from "../Function/CollisionTag";
import {
    MovementState, MovementRef,
    stopAllMovement, endMoveLeft, endMoveRight, endJump,
    beginMoveLeft, beginMoveRight, beginJump,
} from "../Function/MovementFlags";
import { PlayerKeyBindings } from "../Function/InputBindings";
import FollowCamera from "./FollowCamera";
import StageController from "./StageController";

const { ccclass, property } = cc._decorator;

/**
 * Controls a single player character.
 *
 * Each instance represents one player in either single-player or
 * local-multiplayer mode.  The first player is set up via
 * setupAsMainPlayer(); additional local players use setupAsLocalPlayer().
 */
@ccclass
export default class PlayerController extends cc.Component implements MovementRef {

    // ─── Movement constants ───────────────────────────────────────────
    private static readonly MOVE_SPEED     = 200;
    private static readonly RUN_ACCELERATION = 600;
    private static readonly JUMP_FORCE     = 850;

    // ─── Runtime state ────────────────────────────────────────────────
    /** Unique identifier used by StageController to track all active players. */
    uid: string = 'invalidUID';

    /** True while the death animation is playing (player input is ignored). */
    isPlayingDeathAnimation = false;

    /** Current directional input state (bitflags). */
    movementState: MovementState = MovementState.IDLE;

    /** True when the player has collected a power mushroom (big-Mario mode). */
    isBigMario: boolean = false;

    /** True during the post-respawn grace period — player cannot be hurt. */
    isInvincible: boolean = false;

    /**
     * Number of ground-type colliders currently in contact with the player.
     * Jump is only allowed when this value is greater than zero.
     */
    groundContactCount: number = 0;

    /** True while the player is inside a one-way-platform trigger zone. */
    isStandingOnPassThrough: boolean = false;

    /** True after the player reaches the goal flag. */
    hasWon = false;

    /** Name of the animation that is currently playing. */
    private currentAnimationName: string = null;

    /** Audio ID of the currently playing sound effect (used to avoid overlaps). */
    private currentSoundEffectId: number = null;

    /** World position where this player spawns (or re-spawns after death). */
    private spawnPosition: cc.Vec2 = null;

    /** Cached reference to the cc.Animation component on this node. */
    private animationComponent: cc.Animation = null;

    /** Camera that follows this player. */
    private cameraController: FollowCamera = null;

    /** Keyboard mapping for this player. */
    keyBindings: PlayerKeyBindings = {
        left: -1, right: -1, up: -1, switchCamera: -1,
    };

    // ─── Inspector properties (names must match the scene file) ──────
    @property({ type: cc.Label })
    usernameLabel: cc.Label = null;

    @property({ type: cc.AudioClip })
    BGM: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    jumpClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    kickClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    loseOneLifeClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    powerUpClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    powerDownClip: cc.AudioClip = null;

    // ─── Lifecycle ────────────────────────────────────────────────────
    onLoad() {
        cc.director.getPhysicsManager().enabled = true;
        this.animationComponent = this.getComponent(cc.Animation);
    }

    start() {
        this.getComponent(cc.PhysicsCollider).tag = CollisionTag.PLAYER;
        cc.audioEngine.playMusic(this.BGM, true);
        if (!this.spawnPosition) {
            this.spawnPosition = this.node.getPosition();
        }
    }

    onDestroy() {
        // Physics contact callbacks are assigned directly on RigidBody instances
        // (not via cc.systemEvent), so no listener cleanup is required here.
    }

    update(dt: number) {
        // isPlayingDeathAnimation is re-evaluated from the animation state each frame.
        this.isPlayingDeathAnimation =
            this.animationComponent.getAnimationState('MarioDead').isPlaying;

        if (this.hasWon || this.isPlayingDeathAnimation) {
            return; // freeze player input during victory/death animations
        }

        this.updateMovement(dt);
        this.updateAnimation();
    }

    // ─── Initialisation ───────────────────────────────────────────────

    /** Set this player up as the main (player 1) character. */
    setupAsMainPlayer(camera: FollowCamera) {
        this.keyBindings = { ...StageController.LOCAL_KEY_BINDINGS[0] };
        this.cameraController = camera;
        this.uid = 'player1';
        this.usernameLabel.string = 'PLAYER';
    }

    /** Set this player up as an additional local player. */
    setupAsLocalPlayer(
        username: string,
        keyBindings: PlayerKeyBindings,
        camera: FollowCamera,
    ) {
        this.keyBindings = { ...keyBindings };
        this.cameraController = camera;
        this.uid = username;
        this.usernameLabel.string = username.toUpperCase();
    }

    // ─── Movement & animation ─────────────────────────────────────────

    /** Read the current movementState and apply physics forces. */
    updateMovement(dt: number) {
        const rigidBody = this.getComponent(cc.RigidBody);
        let horizontalVelocity: number;

        switch (this.movementState) {
        case MovementState.UP_LEFT:
            this.attemptJump(rigidBody);
            // fall through to apply left movement
        case MovementState.LEFT:
            if (rigidBody.linearVelocity.x > 0) {
                // Turning: preserve current speed while decelerating
                horizontalVelocity = rigidBody.linearVelocity.x;
            } else {
                horizontalVelocity = rigidBody.linearVelocity.x - PlayerController.RUN_ACCELERATION * dt;
                horizontalVelocity = Math.max(horizontalVelocity, -PlayerController.MOVE_SPEED);
            }
            rigidBody.linearVelocity = cc.v2(horizontalVelocity, rigidBody.linearVelocity.y);
            this.faceLeft();
            break;

        case MovementState.UP_RIGHT:
            this.attemptJump(rigidBody);
            // fall through to apply right movement
        case MovementState.RIGHT:
            if (rigidBody.linearVelocity.x < 0) {
                horizontalVelocity = rigidBody.linearVelocity.x;
            } else {
                horizontalVelocity = rigidBody.linearVelocity.x + PlayerController.RUN_ACCELERATION * dt;
                horizontalVelocity = Math.min(horizontalVelocity, PlayerController.MOVE_SPEED);
            }
            rigidBody.linearVelocity = cc.v2(horizontalVelocity, rigidBody.linearVelocity.y);
            this.faceRight();
            break;

        case MovementState.UP:
            this.attemptJump(rigidBody, 0);
            break;

        case MovementState.IDLE:
            rigidBody.linearVelocity = new cc.Vec2(0, rigidBody.linearVelocity.y);
            break;
        }
    }

    /** Choose the correct animation frame based on velocity and movementState. */
    updateAnimation() {
        const rigidBody = this.getComponent(cc.RigidBody);
        const vx = rigidBody.linearVelocity.x;
        const vy = rigidBody.linearVelocity.y;

        switch (this.movementState) {
        case MovementState.LEFT:
            if (!vy) {
                if (vx > 100)       { this.playAnimation('MarioStop');   this.faceRight(); }
                else if (vx > 0)    { this.playAnimation('MarioGoBack'); this.faceRight(); }
                else                { this.playAnimation('MarioRun'); }
            }
            break;
        case MovementState.RIGHT:
            if (!vy) {
                if (vx < -100)      { this.playAnimation('MarioStop');   this.faceLeft(); }
                else if (vx < 0)    { this.playAnimation('MarioGoBack'); this.faceLeft(); }
                else                { this.playAnimation('MarioRun'); }
            }
            break;
        case MovementState.UP:
        case MovementState.UP_LEFT:
        case MovementState.UP_RIGHT:
            this.playAnimation('MarioJump', this.jumpClip);
            break;
        case MovementState.IDLE:
            if (vx !== 0)               { this.playAnimation('MarioStop'); }
            else if (this.groundContactCount) { this.playAnimation('MarioIdle'); }
            break;
        }
    }

    // ─── Animation helpers ────────────────────────────────────────────

    /** Play a named animation, optionally with a one-shot sound effect. */
    playAnimation(animationName: string, soundClip?: cc.AudioClip) {
        const playIfNotAlready = (name: string) => {
            this.currentAnimationName = name;
            const bigName = this.isBigMario ? 'Big' + name : name;
            this.animationComponent.play(bigName);
        };

        const alreadyPlaying =
            this.animationComponent.getAnimationState(animationName).isPlaying;

        if (animationName !== this.currentAnimationName && !alreadyPlaying) {
            playIfNotAlready(animationName);
            if (soundClip) {
                this.playSoundEffect(soundClip);
            }
        } else if (animationName === 'MarioJump' && this.groundContactCount) {
            playIfNotAlready(animationName);
            this.playSoundEffect(this.jumpClip);
        }
    }

    /** Play a sound effect without overlapping an already-playing one. */
    playSoundEffect(clip: cc.AudioClip) {
        if (cc.audioEngine.getState(this.currentSoundEffectId) !==
                cc.audioEngine.AudioState.PLAYING) {
            this.currentSoundEffectId = cc.audioEngine.playEffect(clip, false);
        }
    }

    // ─── Movement helpers ─────────────────────────────────────────────

    /** Jump only if the player is currently touching the ground. */
    attemptJump(rigidBody: cc.RigidBody, overrideX?: number) {
        if (this.groundContactCount) {
            rigidBody.linearVelocity = cc.v2(
                overrideX !== undefined ? overrideX : rigidBody.linearVelocity.x,
                PlayerController.JUMP_FORCE,
            );
        }
    }

    /** Flip the sprite so it faces left. */
    faceLeft() {
        this.usernameLabel.node.scaleX = -Math.abs(this.usernameLabel.node.scaleX);
        this.node.scaleX = -Math.abs(this.node.scaleX);
    }

    /** Flip the sprite so it faces right. */
    faceRight() {
        this.usernameLabel.node.scaleX = Math.abs(this.usernameLabel.node.scaleX);
        this.node.scaleX = Math.abs(this.node.scaleX);
    }

    // ─── Power-up / hurt states ───────────────────────────────────────

    /** Play a rapid blink animation (used for power-up and invincibility). */
    playBlinkEffect() {
        const blinkAction = cc.spawn(cc.blink(1, 8), cc.flipX(true));
        this.node.runAction(blinkAction);
    }

    /** Grow Mario to the big-Mario state if not already big. */
    applyPowerUp() {
        if (!this.isBigMario) {
            this.isBigMario = true;
            const collider = this.getComponent(cc.PhysicsBoxCollider);
            collider.size.height += 4;
            collider.offset.y -= 3.5;
            this.playBlinkEffect();
            this.animationComponent.play('BigMarioIdle');
            this.playSoundEffect(this.powerUpClip);
        }
    }

    /** Shrink Mario back to small-Mario if currently big. */
    applyPowerDown() {
        if (this.isBigMario) {
            this.isBigMario = false;
            const collider = this.getComponent(cc.PhysicsBoxCollider);
            collider.size.height -= 4;
            collider.offset.y += 3.5;
            this.activateInvincibility();
            this.playSoundEffect(this.powerDownClip);
        }
    }

    /**
     * Play the death animation followed by an optional callback.
     * Disables the physics collider and stops music while playing.
     */
    playDeathAnimation(onAnimationFinished?: () => void) {
        this.getComponent(cc.RigidBody).linearVelocity = cc.v2(0, 1000);
        this.playAnimation('MarioDead');
        this.getComponent(cc.PhysicsCollider).enabled = false;
        cc.audioEngine.stopMusic();
        cc.audioEngine.stopAllEffects();
        this.playSoundEffect(this.loseOneLifeClip);
        if (onAnimationFinished) {
            this.animationComponent.once('finished', onAnimationFinished);
        }
    }

    /**
     * Handle losing one life: power-down if big, otherwise play the death
     * animation and then respawn at the spawn position.
     */
    playDeathAndRespawn() {
        if (this.isBigMario) {
            this.applyPowerDown();
        }
        this.playDeathAnimation(() => {
            this.scheduleOnce(() => {
                this.getComponent(cc.PhysicsCollider).enabled = true;
                this.faceLeft();
                this.node.setPosition(this.spawnPosition);
                cc.audioEngine.playMusic(this.BGM, true);
                this.activateInvincibility(); // grace period on respawn
            });
        });
    }

    /**
     * Grant a brief invincibility window (e.g. after respawn or power-down).
     * The player blinks visually and cannot take damage for 2 seconds.
     */
    activateInvincibility() {
        this.playBlinkEffect();
        this.isInvincible = true;
        this.scheduleOnce(() => {
            this.isInvincible = false;
        }, 2);
    }

    /** Lock movement and stop velocity when the player reaches the goal. */
    celebrateVictory() {
        this.hasWon = true;
        this.movementState = MovementState.IDLE;
        const rigidBody = this.getComponent(cc.RigidBody);
        rigidBody.linearVelocity = cc.v2(0, 0);
    }

    // ─── Input handlers ───────────────────────────────────────────────

    onKeyDown(event: cc.Event.EventKeyboard) {
        switch (event.keyCode) {
        case this.keyBindings.left:         beginMoveLeft(this);  break;
        case this.keyBindings.right:        beginMoveRight(this); break;
        case this.keyBindings.up:           beginJump(this);      break;
        case this.keyBindings.switchCamera:
            this.cameraController.setFollowTarget(this);
            break;
        }
    }

    onKeyUp(event: cc.Event.EventKeyboard) {
        switch (event.keyCode) {
        case this.keyBindings.left:  endMoveLeft(this);  break;
        case this.keyBindings.right: endMoveRight(this); break;
        case this.keyBindings.up:    endJump(this);      break;
        }
    }

    // ─── Physics contact callbacks ────────────────────────────────────

    onBeginContact(
        contact: cc.PhysicsContact,
        self: cc.PhysicsCollider,
        other: cc.PhysicsCollider,
    ): void {
        switch (other.tag) {
        case CollisionTag.GROUND:
            if (contact.getWorldManifold().normal.y !== -1) return;
            ++this.groundContactCount;
            break;

        case CollisionTag.ONE_WAY_PLATFORM:
            // Disable contact from the sides and from below; only land from above.
            if (Math.abs(contact.getWorldManifold().normal.x) !== 0 ||
                contact.getWorldManifold().normal.y === 1) {
                contact.disabled = true;
                this.isStandingOnPassThrough = true;
                return;
            }
            break;

        case CollisionTag.DEATH_ZONE:
            // Death zone contact is handled by StageController.
            break;

        case CollisionTag.POWER_MUSHROOM:
            contact.disabled = true;
            this.applyPowerUp();
            break;

        case CollisionTag.LIFE_MUSHROOM:
            contact.disabled = true;
            // Life increment is handled by StageController's mushroom contact callback.
            break;

        case CollisionTag.PLAYER:
            contact.disabled = true; // players do not collide with each other
            break;

        case CollisionTag.ENEMY:
            if (contact.getWorldManifold().normal.y === -1) {
                // Stomping an enemy: bounce the player upward.
                const rigidBody = this.getComponent(cc.RigidBody);
                rigidBody.linearVelocity = cc.v2(
                    rigidBody.linearVelocity.x,
                    PlayerController.JUMP_FORCE,
                );
                this.playSoundEffect(this.kickClip);
            }
            break;
        }
    }

    onPreSolve(
        contact: cc.PhysicsContact,
        self: cc.PhysicsCollider,
        other: cc.PhysicsCollider,
    ): void {
        switch (other.tag) {
        case CollisionTag.ONE_WAY_PLATFORM:
            // Only allow the top surface to be solid.
            if (Math.abs(contact.getWorldManifold().normal.x) !== 0 ||
                contact.getWorldManifold().normal.y === 1) {
                contact.disabled = true;
                this.isStandingOnPassThrough = true;
                return;
            }
            if (contact.getWorldManifold().normal.y === -1 &&
                    !this.isStandingOnPassThrough) {
                ++this.groundContactCount;
                this.isStandingOnPassThrough = true;
            }
            break;

        case CollisionTag.POWER_MUSHROOM:
        case CollisionTag.LIFE_MUSHROOM:
        case CollisionTag.PLAYER:
        case CollisionTag.ENEMY:
            contact.disabled = true;
            break;
        }
    }

    onEndContact(
        contact: cc.PhysicsContact,
        self: cc.PhysicsCollider,
        other: cc.PhysicsCollider,
    ): void {
        switch (other.tag) {
        case CollisionTag.GROUND:
            this.groundContactCount = Math.max(this.groundContactCount - 1, 0);
            break;
        case CollisionTag.ONE_WAY_PLATFORM:
            this.isStandingOnPassThrough = false;
            this.groundContactCount = Math.max(this.groundContactCount - 1, 0);
            break;
        }
    }
}
