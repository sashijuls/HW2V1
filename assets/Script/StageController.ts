import { CollisionTag } from "../Function/CollisionTag";
import { PlayerKeyBindings } from "../Function/InputBindings";
import PlayerController from "./PlayerController";
import PausableBody from "./PausableBody";
import FollowCamera from "./FollowCamera";

const { ccclass, property } = cc._decorator;

// ─── Local types ──────────────────────────────────────────────────────────────

/** Which play mode is currently active for this session. */
type GameMode = 'None' | 'Single' | 'LocalMultiple' | 'RemoteMultiple';

/** Three kinds of question-box reward, each handled differently. */
enum QuestionBoxReward {
    COIN,
    POWER_MUSHROOM,
    LIFE_MUSHROOM,
}

// ─── StageController ─────────────────────────────────────────────────────────

/**
 * Main controller for an in-progress stage.
 *
 * Responsibilities:
 *  - Tracks score, lives, coin count, and countdown timer.
 *  - Initialises all enemy and item physics callbacks.
 *  - Handles the pause/resume flow.
 *  - Triggers win/lose transitions.
 */
@ccclass
export default class StageController extends cc.Component {

    // ─── Shared game session data (persist across scene loads) ────────
    static readonly TIMER_START_VALUE = 300;
    static readonly SCORE_DISPLAY_LENGTH = 6;
    static readonly MUSHROOM_SPEED = 150;
    static readonly GOOMBA_SPEED = 100;
    static readonly TURTLE_WALK_SPEED = 70;
    static readonly TURTLE_SHELL_SPEED = 210;

    /** Keyboard bindings for up to four local players. */
    static readonly LOCAL_KEY_BINDINGS: PlayerKeyBindings[] = [
        { left: cc.macro.KEY.a,     right: cc.macro.KEY.d,      up: cc.macro.KEY.w, switchCamera: cc.macro.KEY.s },
        { left: cc.macro.KEY.g,     right: cc.macro.KEY.j,      up: cc.macro.KEY.y, switchCamera: cc.macro.KEY.h },
        { left: cc.macro.KEY.l,     right: cc.macro.KEY.quote,  up: cc.macro.KEY.p, switchCamera: cc.macro.KEY[';'] },
        { left: cc.macro.KEY.left,  right: cc.macro.KEY.right,  up: cc.macro.KEY.up, switchCamera: cc.macro.KEY.down },
    ];

    /** Which stage to load (set by StageSelectScreen before loading LoadStage). */
    static stageChoice: number = -1;

    /** Active play mode and optional player-count payload. */
    static playMode: { mode: GameMode; payload?: number } = { mode: 'Single' };

    // ─── Per-run counters (reset in start()) ──────────────────────────
    coinCount: number = 0;
    score: number = 0;
    /** Lives are shared across all local players. */
    livesRemaining = 5;
    stageTimer: number = StageController.TIMER_START_VALUE;

    // ─── Other runtime state ──────────────────────────────────────────
    stageWon = false;
    currentAudioId: number;

    primaryPlayer: PlayerController = null;
    /** Maps player UID → PlayerController for all active players. */
    playerRegistry: Map<string, PlayerController> = new Map();

    isPaused = false;
    pausableComponents: PausableBody[] = [];

    // ─── Inspector-assigned properties (names must match scene file) ──

    @property({ type: FollowCamera })
    camera: FollowCamera = null;

    @property
    worldNum: number = 1;

    @property({ type: cc.Label })
    worldNumLabel: cc.Label = null;

    @property({ type: cc.Label })
    lifeNumLabel: cc.Label = null;

    @property({ type: cc.Label })
    timerNumLabel: cc.Label = null;

    @property({ type: cc.Label })
    coinNumLabel: cc.Label = null;

    @property({ type: cc.Label })
    scoreLabel: cc.Label = null;

    @property({ type: cc.Node })
    resultNode: cc.Node = null;

    @property({ type: cc.Label })
    resTimerNumLabel: cc.Label = null;

    @property({ type: cc.Label })
    resScoreLabel: cc.Label = null;

    // Global audio clips
    @property({ type: cc.AudioClip })
    coinClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    powerClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    levelClearClip: cc.AudioClip = null;

    // Scene object references
    @property({ type: cc.Node })
    coins: cc.Node = null;

    @property({ type: cc.Node })
    coinQuestionBoxes: cc.Node = null;

    @property({ type: cc.Node })
    powerQuestionBoxes: cc.Node = null;

    @property({ type: cc.Node })
    healQuestionBoxes: cc.Node = null;

    @property({ type: cc.Node })
    goombas: cc.Node = null;

    @property({ type: cc.Node })
    flowers: cc.Node = null;

    @property({ type: cc.Node })
    turtles: cc.Node = null;

    @property({ type: cc.Node })
    deadFloor: cc.Node = null;

    @property({ type: cc.Node })
    flag: cc.Node = null;

    // Prefabs
    @property({ type: cc.Prefab })
    marioPrefab: cc.Prefab = null;

    @property({ type: cc.Prefab })
    coinPrefab: cc.Prefab = null;

    @property({ type: cc.Prefab })
    powerMushroomPrefab: cc.Prefab = null;

    @property({ type: cc.Prefab })
    healMushroomPrefab: cc.Prefab = null;

    // ─── Lifecycle ────────────────────────────────────────────────────

    onLoad(): void {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP,   this.onKeyUp,   this);

        // Find the Map node and insert the player prefab just above it.
        let mapIndex = 0;
        for (; mapIndex < this.node.children.length; ++mapIndex) {
            if (this.node.children[mapIndex].name === 'Map') break;
        }

        const playerNode = cc.instantiate(this.marioPrefab);
        this.node.insertChild(playerNode, mapIndex + 1);
        this.primaryPlayer = playerNode.getComponent(PlayerController);
        this.primaryPlayer.setupAsMainPlayer(this.camera);
        this.playerRegistry.set(this.primaryPlayer.uid, this.primaryPlayer);
        this.camera.setFollowTarget(this.primaryPlayer);

        // Spawn additional local players if needed.
        switch (StageController.playMode.mode) {
        case 'Single':
            break;
        case 'LocalMultiple':
            for (let i = 1; i < StageController.playMode.payload; ++i) {
                const extraNode = cc.instantiate(this.marioPrefab);
                this.node.insertChild(extraNode, mapIndex + 1);
                const extraPlayer = extraNode.getComponent(PlayerController);
                extraPlayer.setupAsLocalPlayer(
                    `player${i}`,
                    StageController.LOCAL_KEY_BINDINGS[i],
                    this.camera,
                );
                this.playerRegistry.set(extraPlayer.uid, extraPlayer);
            }
            break;
        case 'RemoteMultiple':
            alert('Not support yet :(');
            break;
        }
    }

    start() {
        // Reset all per-run counters.
        this.coinCount = 0;
        this.score = 0;
        this.livesRemaining = 5;
        this.stageTimer = StageController.TIMER_START_VALUE;

        this.worldNumLabel.string = this.worldNum.toString();
        this.resultNode.active = false;

        // ── Death zone ────────────────────────────────────────────────
        this.deadFloor.getComponent(cc.RigidBody).onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (otherCollider.node.name === 'Mario') {
                this.handlePlayerHit(
                    otherCollider.node.getComponent(PlayerController), true,
                );
            }
        };

        // ── Goal flag ─────────────────────────────────────────────────
        this.flag.getComponent(cc.RigidBody).onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (otherCollider.node.name === 'Mario') {
                const player = otherCollider.node.getComponent(PlayerController);
                player.celebrateVictory();
                // Only trigger the stage-complete sequence once all players win.
                const allPlayersWon = Array.from(this.playerRegistry.values())
                    .every(p => p.hasWon);
                if (allPlayersWon) {
                    this.handleStageComplete();
                }
            }
        };

        // ── Coins ─────────────────────────────────────────────────────
        for (const coin of this.coins.getComponentsInChildren(cc.Component)) {
            const rigidBody = coin.getComponent(cc.RigidBody);
            rigidBody.onBeginContact = (
                contact: cc.PhysicsContact,
                selfCollider: cc.PhysicsCollider,
                otherCollider: cc.PhysicsCollider,
            ) => {
                if (otherCollider.node.name === 'Mario') {
                    this.coinCount += 1;
                    this.score += 100;
                    this.playSoundEffect(this.coinClip);
                    coin.scheduleOnce(() => { coin.node.active = false; });
                }
            };
        }

        // ── Question boxes ────────────────────────────────────────────
        const questionBoxGroups: [cc.Node, QuestionBoxReward][] = [
            [this.coinQuestionBoxes,  QuestionBoxReward.COIN],
            [this.powerQuestionBoxes, QuestionBoxReward.POWER_MUSHROOM],
            [this.healQuestionBoxes,  QuestionBoxReward.LIFE_MUSHROOM],
        ];
        for (const [group, rewardType] of questionBoxGroups) {
            for (const box of group.getComponentsInChildren(cc.Component)) {
                this.initializeQuestionBox(box, rewardType);
            }
        }

        for (const goomba of this.goombas.getComponentsInChildren(cc.Component)) {
            this.initializeGoomba(goomba);
        }
        for (const flower of this.flowers.getComponentsInChildren(cc.Component)) {
            this.initializeFireFlower(flower);
        }
        for (const turtle of this.turtles.getComponentsInChildren(cc.Component)) {
            this.initializeTurtle(turtle);
        }

        this.pausableComponents = this.node.getComponentsInChildren(PausableBody);
    }

    update(dt: number) {
        if (this.stageWon || this.isPaused) return;

        this.lifeNumLabel.string  = this.livesRemaining.toString();
        this.coinNumLabel.string  = this.coinCount.toString();

        const scoreStr = this.score.toString();
        this.scoreLabel.string = '0'.repeat(
            StageController.SCORE_DISPLAY_LENGTH - scoreStr.length,
        ) + scoreStr;

        this.stageTimer -= dt;
        this.timerNumLabel.string = Math.ceil(this.stageTimer).toString();
        if (this.stageTimer <= 0) {
            this.resetTimerForMode('None');
            for (const player of Array.from(this.playerRegistry.values())) {
                this.handlePlayerHit(player, true);
            }
        }
    }

    // ─── Button click handlers (names must match the scene file) ─────

    /** Called by the Pause button in the stage UI. */
    togglePause() {
        this.isPaused = !this.isPaused;
        this.pausableComponents.forEach(body => body.togglePause());
    }

    /** Called by the Restart button in the stage UI. */
    restartCurrentStage() {
        cc.audioEngine.stopAll();
        // Ensure stageChoice and playMode are valid for the loading screen.
        StageController.stageChoice = this.worldNum;
        if (StageController.playMode.mode === 'None') {
            StageController.playMode = { mode: 'Single' };
        }
        this.scheduleOnce(() => {
            cc.director.loadScene('LoadStage');
        });
    }

    increaseVolume() {
        let volume = cc.audioEngine.getMusicVolume();
        volume = Math.min(volume + 0.1, 1);
        cc.audioEngine.setMusicVolume(volume);
        cc.audioEngine.setEffectsVolume(volume);
    }

    decreaseVolume() {
        let volume = cc.audioEngine.getMusicVolume();
        volume = Math.max(volume - 0.1, 0);
        cc.audioEngine.setMusicVolume(volume);
        cc.audioEngine.setEffectsVolume(volume);
    }

    // ─── Key forwarding ───────────────────────────────────────────────

    onKeyDown(event: cc.Event.EventKeyboard) {
        for (const player of Array.from(this.playerRegistry.values())) {
            player.onKeyDown(event);
        }
    }

    onKeyUp(event: cc.Event.EventKeyboard) {
        for (const player of Array.from(this.playerRegistry.values())) {
            player.onKeyUp(event);
        }
    }

    // ─── Audio ───────────────────────────────────────────────────────

    playSoundEffect(clip: cc.AudioClip) {
        this.currentAudioId = cc.audioEngine.playEffect(clip, false);
    }

    // ─── Timer ───────────────────────────────────────────────────────

    /**
     * Reset the stage timer.
     * Pass 'None' to reset for all modes; otherwise only resets when the
     * current mode matches.
     */
    resetTimerForMode(mode: GameMode) {
        if (mode === 'None' || StageController.playMode.mode === mode) {
            this.stageTimer = StageController.TIMER_START_VALUE;
        }
    }

    // ─── Win / lose ───────────────────────────────────────────────────

    /**
     * Respond to a player being hit.
     *  - If powered-up: power down (no life lost).
     *  - If normal and lives remain: play death + respawn.
     *  - If last life: game over.
     */
    handlePlayerHit(player: PlayerController, ignoreInvincibility: boolean) {
        if (player.isPlayingDeathAnimation || player.isInvincible) return;
        if (!ignoreInvincibility && player.isBigMario) {
            player.applyPowerDown();
        } else if (--this.livesRemaining > 0) {
            player.playDeathAndRespawn();
            this.scheduleOnce(() => {
                this.resetTimerForMode('Single');
            }, 2);
        } else {
            // Game over — save score then navigate away.
            player.playDeathAnimation(() => {
                this.saveHighScore();
                this.scheduleOnce(() => {
                    StageController.playMode = { mode: 'None' };
                    cc.director.loadScene('GameOver');
                });
            });
        }
    }

    /** Show the result overlay and transition to the stage-select screen. */
    handleStageComplete() {
        const finalScore = Math.ceil(this.score + Math.ceil(this.stageTimer) * 10);
        this.resScoreLabel.string    = finalScore.toString();
        this.resTimerNumLabel.string = this.timerNumLabel.string;
        this.resultNode.active = true;
        this.stageWon = true;
        this.scheduleOnce(() => {
            this.score = finalScore;
            this.saveHighScore();
            cc.director.loadScene('ChooseStage');
        }, 8);
        this.primaryPlayer.celebrateVictory();
        cc.audioEngine.stopAll();
        this.playSoundEffect(this.levelClearClip);
    }

    /** Persist the best score to local storage (offline, no account required). */
    saveHighScore() {
        const bestScore = Number(
            cc.sys.localStorage.getItem('MARIO_BEST_SCORE') || '0',
        );
        if (this.score > bestScore) {
            cc.sys.localStorage.setItem('MARIO_BEST_SCORE', this.score.toString());
            cc.log(`New best score: ${this.score}`);
        }
    }

    // ─── Enemy / item initialisation ──────────────────────────────────

    initializeQuestionBox(box: cc.Component, rewardType: QuestionBoxReward) {
        const rigidBody = box.getComponent(cc.RigidBody);
        if (!rigidBody) return;

        let rewardGiven = false;

        rigidBody.onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (otherCollider.node.name !== 'Mario' || rewardGiven) return;

            const player = otherCollider.node.getComponent(PlayerController);
            const boxVisual = box.node.getChildByName('QBox');

            // Only respond when the player bumps the box from below.
            if (!boxVisual.active ||
                player.isPlayingDeathAnimation ||
                contact.getWorldManifold().normal.y !== -1) return;

            this.score += 100;

            // Animate the box bump.
            const bumpAction = cc.sequence(
                cc.moveBy(0.1, 0, 5).easing(cc.easeInOut(2)),
                cc.moveBy(0.1, 0, -5).easing(cc.easeInOut(2)),
                cc.callFunc(() => { boxVisual.active = false; }),
            );
            box.node.runAction(bumpAction);

            rewardGiven = true;
            let rewardNode: cc.Node;
            let rewardAction: cc.ActionInterval;

            switch (rewardType) {
            case QuestionBoxReward.COIN:
                this.playSoundEffect(this.coinClip);
                ++this.coinCount;
                rewardNode = cc.instantiate(this.coinPrefab);
                box.node.addChild(rewardNode);
                rewardNode.setPosition(cc.v2(5, 16));
                rewardAction = cc.sequence(
                    cc.spawn(cc.moveBy(0.4, 0, 20), cc.fadeOut(0.4)),
                    cc.callFunc(() => { rewardNode.active = false; }),
                );
                break;

            case QuestionBoxReward.POWER_MUSHROOM:
            case QuestionBoxReward.LIFE_MUSHROOM:
                this.playSoundEffect(this.powerClip);
                rewardNode = cc.instantiate(
                    rewardType === QuestionBoxReward.POWER_MUSHROOM
                        ? this.powerMushroomPrefab
                        : this.healMushroomPrefab,
                );
                this.pausableComponents.push(rewardNode.getComponent(PausableBody));
                box.node.addChild(rewardNode);
                rewardNode.setPosition(cc.v2(5, 8));

                const mushroomCollider = rewardNode.getComponent(cc.PhysicsCollider);
                mushroomCollider.tag = rewardType === QuestionBoxReward.POWER_MUSHROOM
                    ? CollisionTag.POWER_MUSHROOM
                    : CollisionTag.LIFE_MUSHROOM;

                const mushroomBody = rewardNode.getComponent(cc.RigidBody);
                mushroomBody.type = cc.RigidBodyType.Kinematic;
                let mushroomEatable = false;
                let mushroomTouched = false;

                mushroomBody.onBeginContact = (
                    contact: cc.PhysicsContact,
                    selfCollider: cc.PhysicsCollider,
                    otherCollider: cc.PhysicsCollider,
                ) => {
                    if (otherCollider.tag === CollisionTag.BARRIER ||
                        otherCollider.tag === CollisionTag.ENEMY ||
                        !mushroomEatable || mushroomTouched) {
                        contact.disabled = true;
                        return;
                    }
                    if (otherCollider.node.name !== 'Mario') return;
                    mushroomTouched = true;
                    mushroomBody.linearVelocity = cc.v2(0, 0);
                    this.score += 1000;
                    if (rewardType === QuestionBoxReward.LIFE_MUSHROOM) {
                        ++this.livesRemaining;
                        this.playSoundEffect(this.coinClip);
                    }
                    rewardNode.destroy();
                };

                mushroomBody.onPreSolve = (
                    contact: cc.PhysicsContact,
                    selfCollider: cc.PhysicsCollider,
                    otherCollider: cc.PhysicsCollider,
                ) => {
                    if (otherCollider.tag === CollisionTag.BARRIER ||
                        otherCollider.tag === CollisionTag.ENEMY ||
                        !mushroomEatable) {
                        contact.disabled = true;
                        return;
                    }
                    if (Math.abs(mushroomBody.linearVelocity.x) !==
                            StageController.MUSHROOM_SPEED &&
                        Math.abs(contact.getWorldManifold().normal.x) === 1) {
                        mushroomBody.linearVelocity = cc.v2(
                            contact.getWorldManifold().normal.x < 0
                                ? StageController.MUSHROOM_SPEED
                                : -StageController.MUSHROOM_SPEED,
                            mushroomBody.linearVelocity.y,
                        );
                        contact.disabled = true;
                    }
                    contact.setFriction(0);
                };

                rewardAction = cc.sequence(
                    cc.spawn(cc.moveBy(0.1, 0, 9), cc.blink(1, 8)),
                    cc.callFunc(() => {
                        mushroomBody.linearVelocity = cc.v2(
                            -StageController.MUSHROOM_SPEED, 0,
                        );
                        mushroomBody.type = cc.RigidBodyType.Dynamic;
                        mushroomEatable = true;
                    }),
                );
                break;
            }
            rewardNode.runAction(rewardAction);
        };
    }

    initializeGoomba(goomba: cc.Component) {
        const rigidBody = goomba.getComponent(cc.RigidBody);
        rigidBody.linearVelocity = cc.v2(-StageController.GOOMBA_SPEED, 0);
        let isDead = false;

        rigidBody.onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (isDead) return;
            switch (otherCollider.tag) {
            case CollisionTag.PLAYER:
                if (contact.getWorldManifold().normal.y === 1) {
                    // Stomped from above — kill the goomba.
                    this.score += 100;
                    const anim = goomba.getComponent(cc.Animation);
                    anim.play('GoombaDead');
                    rigidBody.linearVelocity = cc.v2(0, 0);
                    isDead = true;
                    anim.once('finished', () => { goomba.node.active = false; });
                } else {
                    this.handlePlayerHit(
                        otherCollider.node.getComponent(PlayerController), false,
                    );
                }
                break;
            case CollisionTag.DEATH_ZONE:
                rigidBody.destroy();
                break;
            }
        };

        rigidBody.onPreSolve = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (isDead) return;
            if (otherCollider.tag === CollisionTag.ENEMY) {
                contact.disabled = true;
            }
            // Reverse direction when hitting a wall.
            // Use > 0.9 (not === 1) to handle near-vertical normals that arise
            // when the goomba stops at the corner junction between two adjacent
            // tile colliders — exact equality fails there due to floating point.
            const gNx = contact.getWorldManifold().normal.x;
            if (Math.abs(gNx) > 0.9) {
                // The target velocity is the direction AWAY from the wall.
                const targetVx = gNx < 0
                    ? StageController.GOOMBA_SPEED
                    : -StageController.GOOMBA_SPEED;
                // Only flip when stopped OR moving toward the wall.
                // (vx * targetVx <= 0 catches both the stopped case and the
                //  "moving into wall" case without blocking the first contact.)
                if (rigidBody.linearVelocity.x * targetVx <= 0) {
                    rigidBody.linearVelocity = cc.v2(
                        targetVx,
                        rigidBody.linearVelocity.y,
                    );
                    contact.disabled = true;
                }
            }
            contact.setFriction(0);
        };
    }

    initializeFireFlower(flower: cc.Component) {
        const rigidBody = flower.getComponent(cc.RigidBody);

        rigidBody.onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (otherCollider.tag === CollisionTag.PLAYER) {
                this.handlePlayerHit(
                    otherCollider.node.getComponent(PlayerController), false,
                );
            }
        };

        rigidBody.onPreSolve = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (otherCollider.tag === CollisionTag.ENEMY) {
                contact.disabled = true;
            }
        };

        // Bob the flower up and down continuously.
        const bobAction = cc.sequence(
            cc.moveBy(2, cc.v2(0, 12)),
            cc.moveBy(2, cc.v2(0, 0)),  // pause at top
            cc.moveBy(2, cc.v2(0, -12)),
            cc.moveBy(2, cc.v2(0, 0)),  // pause at bottom
        ).repeatForever();
        flower.node.runAction(bobAction);
    }

    initializeTurtle(turtle: cc.Component) {
        const rigidBody = turtle.getComponent(cc.RigidBody);
        rigidBody.linearVelocity = cc.v2(-StageController.TURTLE_WALK_SPEED, 0);

        let isDead       = false;
        let isSpinning   = false;
        let hasBeenKicked = false;
        let currentSpeed = StageController.TURTLE_WALK_SPEED;

        rigidBody.onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            switch (otherCollider.tag) {
            case CollisionTag.PLAYER:
                if (contact.getWorldManifold().normal.y === 1 &&
                        !isDead && !isSpinning) {
                    // Stomp from above — knock the turtle into its shell.
                    this.score += 100;
                    const anim = turtle.getComponent(cc.Animation);
                    anim.play('TurtleDead');
                    isDead = true;
                    currentSpeed = 0;
                    rigidBody.linearVelocity = cc.v2(0, rigidBody.linearVelocity.y);
                } else if (contact.getWorldManifold().normal.y !== 1 &&
                               (!isDead || isSpinning)) {
                    // Side hit while alive or spinning — hurts the player.
                    this.handlePlayerHit(
                        otherCollider.node.getComponent(PlayerController), false,
                    );
                } else {
                    // Kick the shell into a spin.
                    if (!hasBeenKicked) {
                        this.score += 100;
                        hasBeenKicked = true;
                    }
                    turtle.getComponent(cc.Animation).play('TurtleRotate');
                    isSpinning = true;
                    currentSpeed = StageController.TURTLE_SHELL_SPEED;

                    // Launch the shell in the direction away from the player.
                    const shellX = selfCollider.node.convertToWorldSpaceAR(
                        selfCollider.node.getPosition(),
                    ).x;
                    const playerX = otherCollider.node.convertToWorldSpaceAR(
                        otherCollider.node.getPosition(),
                    ).x;
                    rigidBody.linearVelocity = cc.v2(
                        shellX < playerX ? -currentSpeed : currentSpeed,
                        rigidBody.linearVelocity.y,
                    );
                }
                contact.disabled = true;
                break;

            case CollisionTag.ENEMY:
                if (isSpinning) {
                    // Spinning shell destroys other enemies.
                    otherCollider.enabled = false;
                    otherCollider.sensor  = true;
                    this.score += 100;
                }
                contact.disabled = true;
                break;

            case CollisionTag.DEATH_ZONE:
                rigidBody.destroy();
                break;
            }
        };

        rigidBody.onPreSolve = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (otherCollider.tag === CollisionTag.ENEMY) {
                contact.disabled = true;
                return;
            }
            // Reverse direction on wall contact.
            // Same fix as the goomba: use > 0.9 threshold to handle near-vertical
            // normals from tile-corner contacts in Stage 1.
            // currentSpeed === 0 means the shell was stomped but not kicked yet;
            // skip reversal in that case so the shell doesn't spontaneously move.
            const tNx = contact.getWorldManifold().normal.x;
            if (Math.abs(tNx) > 0.9 && currentSpeed > 0) {
                const targetVx = tNx < 0 ? currentSpeed : -currentSpeed;
                if (rigidBody.linearVelocity.x * targetVx <= 0) {
                    rigidBody.linearVelocity = cc.v2(
                        targetVx, rigidBody.linearVelocity.y,
                    );
                    // Flip the sprite to match direction of travel.
                    // Walking right (+) → scaleX −1 (sprite faces right).
                    // Walking left  (−) → scaleX +1 (sprite faces left).
                    if (!isSpinning) {
                        turtle.node.setScale(
                            cc.v2(targetVx > 0 ? -1 : 1, turtle.node.scaleY),
                        );
                    }
                    contact.disabled = true;
                }
            }
            contact.setFriction(0);
        };
    }
}
