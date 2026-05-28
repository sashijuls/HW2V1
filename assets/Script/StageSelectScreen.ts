import StageController from "./StageController";

const { ccclass, property } = cc._decorator;

// stage select screen; buttons call startSinglePlayerStage() or startMultiplayerStage()
@ccclass
export default class StageSelectScreen extends cc.Component {

    static readonly LOADING_SCENE = 'LoadStage';

    // ─── inspector properties ─────────────────────────────────────────

    @property(cc.AudioClip)
    BGM: cc.AudioClip | null = null;

    @property(cc.Node)
    howToPlay: cc.Node | null = null;

    // ─── lifecycle ────────────────────────────────────────────────────

    start(): void {
        cc.audioEngine.playMusic(this.BGM, true);
        if (this.howToPlay) {
            this.howToPlay.active = false;
        }
    }

    // ─── button handlers ──────────────────────────────────────────────

    // set customEventData to "1" or "2" for stage number
    startSinglePlayerStage(_event: cc.Event, stageNumber: string) {
        StageController.playMode    = { mode: 'Single' };
        StageController.stageChoice = Number(stageNumber);
        cc.audioEngine.stopMusic();
        cc.director.loadScene(StageSelectScreen.LOADING_SCENE);
    }

    // set customEventData to stage number; prompts player count (1-4)
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

    // scene button calls this name directly
    loadStage(_event: cc.Event, stageNumber: string) {
        this.startSinglePlayerStage(_event, stageNumber);
    }

    openHowToPlay() {
        if (this.howToPlay) {
            this.howToPlay.active = !this.howToPlay.active;
        }
    }

    backToMenu() {
        cc.audioEngine.stopMusic();
        cc.director.loadScene('Menu');
    }
}
