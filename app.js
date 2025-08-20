import { BaseApp } from "@zeppos/zml/base-app";
import VisLog from "@silver-zepp/vis-log"
import { LocalStorage } from '@zos/storage'

const vis = new VisLog("app.js");
vis.updateSettings({ visual_log_enabled: false, });
const localStorage = new LocalStorage();

App(
  BaseApp({
    globalData: {
      highScore: 0,
      isDarkMode: false,
      textSizeModifier: 0,
      scaleFactor: 0.7, // Default scale factor for game elements
    },
    onCreate(options) {
      vis.log('app on create invoke')
      try {
        const savedScore = localStorage.getItem('dino_high_score');
        if (savedScore > 0) {
          this.globalData.highScore = savedScore;
        }
        this.globalData.isDarkMode = localStorage.getItem('dino_is_dark_mode')
        this.globalData.textSizeModifier = parseFloat(localStorage.getItem('dino_text_size_modifier')) || 1;
        this.globalData.scaleFactor = parseFloat(localStorage.getItem('dino_scale_factor')) || 0.7;
      } catch (e) {
        vis.log('No saved high score found');
      }
    },

    onDestroy(options) {
      vis.log('app on destroy invoke')
      try {
        localStorage.setItem('dino_high_score', this.globalData.highScore);
        localStorage.setItem('dino_is_dark_mode', this.globalData.isDarkMode ? true : false);
        localStorage.setItem('dino_text_size_modifier', this.globalData.textSizeModifier.toString());
        localStorage.setItem('dino_scale_factor', this.globalData.scaleFactor.toString());
      } catch (e) {
        vis.log('Failed to save high score');
      }
    }
  })
)