const { ccclass, property } = cc._decorator;

// main menu screen
@ccclass
export default class Menu extends cc.Component {

    @property({ type: cc.AudioClip })
    BGM: cc.AudioClip = null;

    start() {
        cc.audioEngine.playMusic(this.BGM, true);
    }

    startGame() {
        cc.audioEngine.stopMusic();
        cc.director.loadScene('ChooseStage');
    }

    exitGame() {
        cc.game.end();
    }

    // kept for scene button compatibility
    quitGame() { this.exitGame(); }
}
