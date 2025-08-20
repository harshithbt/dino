import { gettext } from 'i18n'
import { BaseSideService } from "@zeppos/zml/base-side";
import { VisLogAppSide } from "@silver-zepp/vis-log/appside";

const vis = new VisLogAppSide();
vis.updateSettings({ visual_log_enabled: false, });

AppSideService(
  BaseSideService({
    onInit() {
      vis.log(gettext('example'))
    },

    onRun() {
    },

    onDestroy() {
    }
  })
)
