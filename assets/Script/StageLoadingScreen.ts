import StageController from "./StageController";

const { ccclass, property } = cc._decorator;

// brief loading screen between stage select and the stage itself
@ccclass
export default class StageLoadingScreen extends cc.Component {

    // ─── inspector properties ─────────────────────────────────────────

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

    @property
    delay = 2;

    // ─── lifecycle ────────────────────────────────────────────────────

    start() {
        // no stage chosen — go back
        if (!StageController.stageChoice ||
                StageController.playMode.mode === 'None') {
            cc.log('no stage selected, redirecting');
            this.scheduleOnce(() => {
                cc.director.loadScene('ChooseStage');
            }, this.delay);
            return;
        }

        // multiplayer ui
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

        // load stage after delay
        this.scheduleOnce(() => {
            cc.director.loadScene(`Stage${StageController.stageChoice}`);
        }, this.delay);
    }
}
