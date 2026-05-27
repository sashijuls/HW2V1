import StageController from "./StageController";

const { ccclass, property } = cc._decorator;

/**
 * Shown briefly while the selected stage loads.
 * Reads the stage choice and play mode set by StageSelectScreen,
 * then transitions automatically after a short delay.
 */
@ccclass
export default class StageLoadingScreen extends cc.Component {

    // ─── Inspector-assigned (names must match the scene file) ────────

    @property(cc.Node)
    multiPlayerInfo: cc.Node = null;

    @property(cc.Label)
    stageCount: cc.Label = null;

    @property(cc.Label)
    waitingCount: cc.Label = null;

    @property(cc.Label)
    readyCount: cc.Label = null;

    @property(cc.Button)
    readyButton: cc.Button = null;

    /** Seconds to display the loading screen before switching scenes. */
    @property
    delay = 2;

    // ─── Lifecycle ────────────────────────────────────────────────────

    start() {
        // Guard: redirect to stage select if no valid stage has been chosen.
        if (!StageController.stageChoice ||
                StageController.playMode.mode === 'None') {
            cc.log('No stage selected — redirecting to ChooseStage.');
            this.scheduleOnce(() => {
                cc.director.loadScene('ChooseStage');
            }, this.delay);
            return;
        }

        // Show multiplayer waiting UI if needed.
        switch (StageController.playMode.mode) {
        case 'RemoteMultiple':
            alert('Not implemented');
            break;
        case 'LocalMultiple':
            this.multiPlayerInfo.active = true;
            this.readyButton.node.active = false;
            this.waitingCount.string = this.readyCount.string =
                StageController.playMode.payload.toString();
            break;
        case 'Single':
            break;
        }

        this.stageCount.string = StageController.stageChoice.toString();

        // Transition to the selected stage after the delay.
        this.scheduleOnce(() => {
            cc.director.loadScene(`Stage${StageController.stageChoice}`);
        }, this.delay);
    }
}
