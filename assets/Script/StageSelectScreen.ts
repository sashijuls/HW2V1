import StageController from "./StageController";

const { ccclass, property } = cc._decorator;

/**
 * Controls the stage-select screen.
 * Buttons on this screen call startSinglePlayerStage() or
 * startMultiplayerStage() with the stage number as customEventData.
 */
@ccclass
export default class StageSelectScreen extends cc.Component {

    /** Scene name of the loading screen (keeps the magic string in one place). */
    static readonly LOADING_SCENE = 'LoadStage';

    // ─── Inspector-assigned (names must match the scene file) ────────

    @property(cc.AudioClip)
    BGM: cc.AudioClip | null = null;

    @property(cc.Node)
    howToPlay: cc.Node | null = null;

    // ─── Lifecycle ────────────────────────────────────────────────────

    start(): void {
        cc.audioEngine.playMusic(this.BGM, true);
        if (this.howToPlay) {
            this.howToPlay.active = false;
        }
    }

    // ─── Button click handlers (names must match the scene file) ─────

    /**
     * Start the stage in single-player mode.
     * Bind to Stage 1 / Stage 2 buttons; set customEventData to "1" or "2".
     */
    startSinglePlayerStage(_event: cc.Event, stageNumber: string) {
        StageController.playMode   = { mode: 'Single' };
        StageController.stageChoice = Number(stageNumber);
        cc.audioEngine.stopMusic();
        cc.director.loadScene(StageSelectScreen.LOADING_SCENE);
    }

    /**
     * Start the stage in local multiplayer mode.
     * Bind to multiplayer buttons; set customEventData to the stage number.
     * The player will be prompted to enter the number of players (1–4).
     *
     * NOTE: This method is not yet wired to a scene button.
     */
    startMultiplayerStage(_event: cc.Event, stageNumber: string) {
        const input = prompt('How many players (1–4)?');
        try {
            const playerCount = Number(input);
            if (playerCount >= 1 && playerCount <= 4) {
                StageController.playMode    = { mode: 'LocalMultiple', payload: playerCount };
                StageController.stageChoice = Number(stageNumber);
                cc.audioEngine.stopMusic();
                cc.director.loadScene(StageSelectScreen.LOADING_SCENE);
            } else {
                alert(`Invalid number: ${input}. Please enter 1–4.`);
            }
        } catch {
            alert(`Invalid input: ${input}. Please enter a number 1–4.`);
        }
    }

    /** This handler is called by the scene button — keep this exact name. */
    loadStage(_event: cc.Event, stageNumber: string) {
        this.startSinglePlayerStage(_event, stageNumber);
    }

    /** Toggle the How-To-Play overlay panel. */
    openHowToPlay() {
        if (this.howToPlay) {
            this.howToPlay.active = !this.howToPlay.active;
        }
    }

    /** Return to the main menu. */
    backToMenu() {
        cc.audioEngine.stopMusic();
        cc.director.loadScene('Menu');
    }
}
