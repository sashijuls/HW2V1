const { ccclass, property } = cc._decorator;

/**
 * Controls the main menu screen.
 * Buttons call startGame() or exitGame() directly.
 */
@ccclass
export default class Menu extends cc.Component {

    @property({ type: cc.AudioClip })
    BGM: cc.AudioClip = null;

    start() {
        cc.audioEngine.playMusic(this.BGM, true);
    }

    /** Called by the Play / Start button. */
    startGame() {
        cc.audioEngine.stopMusic();
        cc.director.loadScene('ChooseStage');
    }

    /** Called by the Exit / Quit button. */
    exitGame() {
        cc.game.end();
    }

    // ─── Legacy aliases kept so existing scene buttons still work ────
    /** @deprecated Use exitGame() — kept for scene button compatibility. */
    quitGame() { this.exitGame(); }
}
