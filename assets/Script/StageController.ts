import { CollisionTag } from "../Function/CollisionTag";
import { PlayerKeyBindings } from "../Function/InputBindings";
import PlayerController from "./PlayerController";
import PausableBody from "./PausableBody";
import FollowCamera from "./FollowCamera";

const { ccclass, property } = cc._decorator;

// current play mode for this session
type GameMode = 'None' | 'Single' | 'LocalMultiple' | 'RemoteMultiple';

// reward types spawned from question boxes
enum QuestionBoxReward {
    COIN,
    POWER_MUSHROOM,
    LIFE_MUSHROOM,
}

// manages score, lives, timer, enemies, and win/lose flow for one stage
@ccclass
export default class StageController extends cc.Component {

    // ─── shared constants ─────────────────────────────────────────────
    static readonly TIMER_START_VALUE    = 300;
    static readonly SCORE_DISPLAY_LENGTH = 6;
    static readonly MUSHROOM_SPEED       = 150;
    static readonly GOOMBA_SPEED         = 100;
    static readonly TURTLE_WALK_SPEED    = 70;
    static readonly TURTLE_SHELL_SPEED   = 210;

    static readonly LOCAL_KEY_BINDINGS: PlayerKeyBindings[] = [
        { left: cc.macro.KEY.a,     right: cc.macro.KEY.d,      up: cc.macro.KEY.w, switchCamera: cc.macro.KEY.s },
        { left: cc.macro.KEY.g,     right: cc.macro.KEY.j,      up: cc.macro.KEY.y, switchCamera: cc.macro.KEY.h },
        { left: cc.macro.KEY.l,     right: cc.macro.KEY.quote,  up: cc.macro.KEY.p, switchCamera: cc.macro.KEY[';'] },
        { left: cc.macro.KEY.left,  right: cc.macro.KEY.right,  up: cc.macro.KEY.up, switchCamera: cc.macro.KEY.down },
    ];

    // set by StageSelectScreen before loading LoadStage
    static stageChoice: number = -1;
    static playMode: { mode: GameMode; payload?: number } = { mode: 'Single' };

    // ─── per-run state ────────────────────────────────────────────────
    coinCount: number = 0;
    score: number = 0;
    livesRemaining = 5;
    stageTimer: number = StageController.TIMER_START_VALUE;

    stageWon = false;
    currentAudioId: number;

    primaryPlayer: PlayerController = null;
    playerRegistry: Map<string, PlayerController> = new Map();

    isPaused = false;
    pausableComponents: PausableBody[] = [];

    // ─── inspector properties ─────────────────────────────────────────

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

    // audio
    @property({ type: cc.AudioClip })
    coinClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    powerClip: cc.AudioClip = null;

    @property({ type: cc.AudioClip })
    levelClearClip: cc.AudioClip = null;

    // scene refs
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

    // prefabs
    @property({ type: cc.Prefab })
    marioPrefab: cc.Prefab = null;

    @property({ type: cc.Prefab })
    coinPrefab: cc.Prefab = null;

    @property({ type: cc.Prefab })
    powerMushroomPrefab: cc.Prefab = null;

    @property({ type: cc.Prefab })
    healMushroomPrefab: cc.Prefab = null;

    // ─── lifecycle ────────────────────────────────────────────────────

    onLoad(): void {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP,   this.onKeyUp,   this);

        // insert player above the Map node
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

        // extra local players
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
        this.coinCount = 0;
        this.score = 0;
        this.livesRemaining = 5;
        this.stageTimer = StageController.TIMER_START_VALUE;

        this.worldNumLabel.string = this.worldNum.toString();
        this.resultNode.active = false;

        // death zone
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

        // goal flag
        this.flag.getComponent(cc.RigidBody).onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            if (otherCollider.node.name === 'Mario') {
                const player = otherCollider.node.getComponent(PlayerController);
                player.celebrateVictory();
                // trigger complete only once all players have won
                const allPlayersWon = Array.from(this.playerRegistry.values())
                    .every(p => p.hasWon);
                if (allPlayersWon) {
                    this.handleStageComplete();
                }
            }
        };

        // coins
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

        // question boxes
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

    // ─── button handlers ──────────────────────────────────────────────

    togglePause() {
        this.isPaused = !this.isPaused;
        this.pausableComponents.forEach(body => body.togglePause());
    }

    restartCurrentStage() {
        cc.audioEngine.stopAll();
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

    // ─── key forwarding ───────────────────────────────────────────────

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

    // ─── audio ────────────────────────────────────────────────────────

    playSoundEffect(clip: cc.AudioClip) {
        this.currentAudioId = cc.audioEngine.playEffect(clip, false);
    }

    // ─── timer ────────────────────────────────────────────────────────

    // pass 'None' to reset regardless of current mode
    resetTimerForMode(mode: GameMode) {
        if (mode === 'None' || StageController.playMode.mode === mode) {
            this.stageTimer = StageController.TIMER_START_VALUE;
        }
    }

    // ─── win / lose ───────────────────────────────────────────────────

    // powered-up → power down; normal → respawn; last life → game over
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
            // game over
            player.playDeathAnimation(() => {
                this.saveHighScore();
                this.scheduleOnce(() => {
                    StageController.playMode = { mode: 'None' };
                    cc.director.loadScene('GameOver');
                });
            });
        }
    }

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

    saveHighScore() {
        const bestScore = Number(
            cc.sys.localStorage.getItem('MARIO_BEST_SCORE') || '0',
        );
        if (this.score > bestScore) {
            cc.sys.localStorage.setItem('MARIO_BEST_SCORE', this.score.toString());
            cc.log(`New best score: ${this.score}`);
        }
    }

    // ─── enemy / item setup ───────────────────────────────────────────

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

            // only fire when bumped from below
            if (!boxVisual.active ||
                player.isPlayingDeathAnimation ||
                contact.getWorldManifold().normal.y !== -1) return;

            this.score += 100;

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
                    // stomped — kill
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
            // reverse on wall contact (> 0.9 tolerates near-vertical tile-corner normals)
            const gNx = contact.getWorldManifold().normal.x;
            if (Math.abs(gNx) > 0.9) {
                const targetVx = gNx < 0
                    ? StageController.GOOMBA_SPEED
                    : -StageController.GOOMBA_SPEED;
                // flip only when stopped or moving toward the wall
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

        // bob up and down
        const bobAction = cc.sequence(
            cc.moveBy(2, cc.v2(0, 12)),
            cc.moveBy(2, cc.v2(0, 0)),
            cc.moveBy(2, cc.v2(0, -12)),
            cc.moveBy(2, cc.v2(0, 0)),
        ).repeatForever();
        flower.node.runAction(bobAction);
    }

    initializeTurtle(turtle: cc.Component) {
        const rigidBody = turtle.getComponent(cc.RigidBody);
        rigidBody.linearVelocity = cc.v2(-StageController.TURTLE_WALK_SPEED, 0);

        let isDead        = false;
        let isSpinning    = false;
        let hasBeenKicked = false;
        let currentSpeed  = StageController.TURTLE_WALK_SPEED;

        rigidBody.onBeginContact = (
            contact: cc.PhysicsContact,
            selfCollider: cc.PhysicsCollider,
            otherCollider: cc.PhysicsCollider,
        ) => {
            switch (otherCollider.tag) {
            case CollisionTag.PLAYER:
                if (contact.getWorldManifold().normal.y === 1 &&
                        !isDead && !isSpinning) {
                    // stomped — enter shell
                    this.score += 100;
                    const anim = turtle.getComponent(cc.Animation);
                    anim.play('TurtleDead');
                    isDead = true;
                    currentSpeed = 0;
                    rigidBody.linearVelocity = cc.v2(0, rigidBody.linearVelocity.y);
                } else if (contact.getWorldManifold().normal.y !== 1 &&
                               (!isDead || isSpinning)) {
                    // side hit — hurt player
                    this.handlePlayerHit(
                        otherCollider.node.getComponent(PlayerController), false,
                    );
                } else {
                    // kick shell
                    if (!hasBeenKicked) {
                        this.score += 100;
                        hasBeenKicked = true;
                    }
                    turtle.getComponent(cc.Animation).play('TurtleRotate');
                    isSpinning = true;
                    currentSpeed = StageController.TURTLE_SHELL_SPEED;

                    // launch away from player
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
                    // spinning shell kills enemies
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
            // reverse on wall contact; skip when currentSpeed === 0 (stomped shell)
            const tNx = contact.getWorldManifold().normal.x;
            if (Math.abs(tNx) > 0.9 && currentSpeed > 0) {
                const targetVx = tNx < 0 ? currentSpeed : -currentSpeed;
                if (rigidBody.linearVelocity.x * targetVx <= 0) {
                    rigidBody.linearVelocity = cc.v2(
                        targetVx, rigidBody.linearVelocity.y,
                    );
                    // flip sprite to face movement direction (right → scaleX -1)
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
