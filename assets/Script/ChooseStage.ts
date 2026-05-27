import StageMgr from "./StageMgr";

const {ccclass, property} = cc._decorator;

/**
 * ChooseStage — Simple offline level select.
 * Removed: user account gating, rank list, online features.
 * Players can freely choose Stage 1 or Stage 2.
 */
@ccclass
export default class ChooseStage extends cc.Component {

    /** Scene name for the loading screen */
    static readonly sceneName = "LoadStage";

    @property(cc.AudioClip)
    BGM: cc.AudioClip | null = null;

    /** The "How To Play" overlay node — assign in inspector */
    @property(cc.Node)
    howToPlay: cc.Node | null = null;

    start(): void {
        cc.audioEngine.playMusic(this.BGM, true);
        // make sure how-to-play panel starts hidden
        if (this.howToPlay) this.howToPlay.active = false;
    }

    /**
     * Load a stage in single-player mode.
     * Bind this to your Stage 1 / Stage 2 buttons.
     * Set the "customEventData" field of the button to "1" or "2".
     */
    loadStage(_: cc.Event, stageCount: string) {
        StageMgr.playMode = { mode: 'Single' };
        StageMgr.stageChoice = Number(stageCount);
        cc.audioEngine.stopMusic();
        cc.director.loadScene(ChooseStage.sceneName);
    }

    /**
     * Load a stage in local multiplayer mode.
     * Bind this to your multiplayer buttons.
     */
    loadLocalMultiplayerStage(_: cc.Event, stageCount: string) {
        let nPlayers = prompt('How many players (1–4)?');
        try {
            let n = Number(nPlayers);
            if (n >= 1 && n <= 4) {
                StageMgr.playMode = { mode: 'LocalMultiple', payload: n };
                StageMgr.stageChoice = Number(stageCount);
                cc.audioEngine.stopMusic();
                cc.director.loadScene(ChooseStage.sceneName);
            } else {
                alert(`Invalid number: ${nPlayers}. Enter 1–4.`);
            }
        } catch {
            alert(`Invalid input: ${nPlayers}. Enter a number 1–4.`);
        }
    }

    /** Toggle the How To Play panel (keyboard controls) */
    openHowToPlay() {
        if (this.howToPlay) {
            this.howToPlay.active = !this.howToPlay.active;
        }
    }

    /** Return to main menu */
    backToMenu() {
        cc.audioEngine.stopMusic();
        cc.director.loadScene('Menu');
    }
}
