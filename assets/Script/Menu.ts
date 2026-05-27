const {ccclass, property} = cc._decorator;

@ccclass
export default class Menu extends cc.Component {

    @property({type: cc.AudioClip})
    BGM: cc.AudioClip = null;

    start() {
        cc.audioEngine.playMusic(this.BGM, true);
    }

    /** Called by the "Play" / "Start" button in the Menu scene */
    startGame() {
        cc.audioEngine.stopMusic();
        cc.director.loadScene("ChooseStage");
    }

    /** Optional: Called by an "Exit" button */
    quitGame() {
        cc.game.end();
    }
}
