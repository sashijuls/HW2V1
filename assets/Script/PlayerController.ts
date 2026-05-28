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

// controls a single player character in single or local-multiplayer mode
@ccclass
export default class PlayerController extends cc.Component implements MovementRef {

    // ─── movement constants ───────────────────────────────────────────
    private static readonly MOVE_SPEED       = 200;
    private static readonly RUN_ACCELERATION = 600;
    private static readonly JUMP_FORCE       = 850;

    // ─── runtime state ────────────────────────────────────────────────
    // uid for playerRegistry
    uid: string = 'invalidUID';

    isPlayingDeathAnimation = false;

    // movement bitflags
    movementState: MovementState = MovementState.IDLE;

    // big mario state
    isBigMario: boolean = false;

    // invincible (grace period after respawn or power-down)
    isInvincible: boolean = false;

    // count of active ground contacts; jump allowed when > 0
    groundContactCount: number = 0;

    // on a pass-through platform
    isStandingOnPassThrough: boolean = false;

    // reached the flag
    hasWon = false;

    private currentAnimationName: string = null;
    private currentSoundEffectId: number = null;
    private spawnPosition: cc.Vec2 = null;
    private animationComponent: cc.Animation = null;
    private cameraController: FollowCamera = null;

    keyBindings: PlayerKeyBindings = {
        left: -1, right: -1, up: -1, switchCamera: -1,
    };

    // ─── inspector properties ─────────────────────────────────────────
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

    // ─── lifecycle ────────────────────────────────────────────────────
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
        // no listener cleanup needed (callbacks are on RigidBody directly)
    }

    update(dt: number) {
        // re-check from anim state each frame
        this.isPlayingDeathAnimation =
            this.animationComponent.getAnimationState('MarioDead').isPlaying;

        if (this.hasWon || this.isPlayingDeathAnimation) return;

        this.updateMovement(dt);
        this.updateAnimation();
    }

    // ─── initialisation ───────────────────────────────────────────────

    setupAsMainPlayer(camera: FollowCamera) {
        this.keyBindings = { ...StageController.LOCAL_KEY_BINDINGS[0] };
        this.cameraController = camera;
        this.uid = 'player1';
        this.usernameLabel.string = 'PLAYER';
    }

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

    // ─── movement & animation ─────────────────────────────────────────

    updateMovement(dt: number) {
        const rigidBody = this.getComponent(cc.RigidBody);
        let horizontalVelocity: number;

        switch (this.movementState) {
        case MovementState.UP_LEFT:
            this.attemptJump(rigidBody);
            // fall through
        case MovementState.LEFT:
            if (rigidBody.linearVelocity.x > 0) {
                // decelerating (turning)
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
            // fall through
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
            if (vx !== 0)                     { this.playAnimation('MarioStop'); }
            else if (this.groundContactCount) { this.playAnimation('MarioIdle'); }
            break;
        }
    }

    // ─── animation helpers ────────────────────────────────────────────

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

    playSoundEffect(clip: cc.AudioClip) {
        if (cc.audioEngine.getState(this.currentSoundEffectId) !==
                cc.audioEngine.AudioState.PLAYING) {
            this.currentSoundEffectId = cc.audioEngine.playEffect(clip, false);
        }
    }

    // ─── movement helpers ─────────────────────────────────────────────

    attemptJump(rigidBody: cc.RigidBody, overrideX?: number) {
        if (this.groundContactCount) {
            rigidBody.linearVelocity = cc.v2(
                overrideX !== undefined ? overrideX : rigidBody.linearVelocity.x,
                PlayerController.JUMP_FORCE,
            );
        }
    }

    faceLeft() {
        this.usernameLabel.node.scaleX = -Math.abs(this.usernameLabel.node.scaleX);
        this.node.scaleX = -Math.abs(this.node.scaleX);
    }

    faceRight() {
        this.usernameLabel.node.scaleX = Math.abs(this.usernameLabel.node.scaleX);
        this.node.scaleX = Math.abs(this.node.scaleX);
    }

    // ─── power-up / hurt states ───────────────────────────────────────

    playBlinkEffect() {
        const blinkAction = cc.spawn(cc.blink(1, 8), cc.flipX(true));
        this.node.runAction(blinkAction);
    }

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
                this.activateInvincibility(); // grace period
            });
        });
    }

    activateInvincibility() {
        this.playBlinkEffect();
        this.isInvincible = true;
        this.scheduleOnce(() => {
            this.isInvincible = false;
        }, 2);
    }

    celebrateVictory() {
        this.hasWon = true;
        this.movementState = MovementState.IDLE;
        const rigidBody = this.getComponent(cc.RigidBody);
        rigidBody.linearVelocity = cc.v2(0, 0);
    }

    // ─── input handlers ───────────────────────────────────────────────

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

    // ─── physics contact callbacks ────────────────────────────────────

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
            // solid from above only
            if (Math.abs(contact.getWorldManifold().normal.x) !== 0 ||
                contact.getWorldManifold().normal.y === 1) {
                contact.disabled = true;
                this.isStandingOnPassThrough = true;
                return;
            }
            break;

        case CollisionTag.DEATH_ZONE:
            break;

        case CollisionTag.POWER_MUSHROOM:
            contact.disabled = true;
            this.applyPowerUp();
            break;

        case CollisionTag.LIFE_MUSHROOM:
            contact.disabled = true;
            break;

        case CollisionTag.PLAYER:
            contact.disabled = true;
            break;

        case CollisionTag.ENEMY:
            if (contact.getWorldManifold().normal.y === -1) {
                // stomp bounce
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
            // solid from above only
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
