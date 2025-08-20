import { getText } from '@zos/i18n';
import { BasePage } from "@zeppos/zml/base-page";
import VisLog from "@silver-zepp/vis-log";
import { createWidget, widget, event } from '@zos/ui';
import { getDeviceInfo } from '@zos/device';
import { getTextLayout } from '@zos/ui';
import { setStatusBarVisible } from '@zos/ui';
import { back } from '@zos/router';
import { Vibrator } from '@zos/sensor'

const vis = new VisLog("settings.js");
vis.updateSettings({ visual_log_enabled: false });

const vibrator = new Vibrator()
const vibrationType = vibrator.getType()

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = getDeviceInfo();

function getTextWidthAndHeight(text, fontSize) {
    return getTextLayout(text, {
        text_size: fontSize,
        text_width: 0,
        wrapped: 0
    });
}

// UI and Settings
let isDarkMode = false;
let textSizeModifier = 1; // Default to 'Normal'
let SCALE_FACTOR = 0.7; // Default scale factor for game elements
let isVribrationEnabled = true; // Default vibration setting
const TEXT_SIZES = {
    TITLE: 28,
    OPTION: 20,
    BUTTON: 20,
};
const FONT_COLORS = {
    LIGHT: 0x535353,
    DARK: 0xffffff,
    HIGHLIGHT: 0xff6b6b,
};
const BACKGROUND_COLORS = {
    LIGHT: 0xf7f7f7,
    DARK: 0x363636,
};
const FONT_MODIFIERS = {
    SMALL: 0.8,
    NORMAL: 1,
    LARGE: 1.2
};
const SCALE_FACTORS = {
    SMALL: 0.5,
    NORMAL: 0.7,
    LARGE: 0.9
};


let canvas = null;
let app = null;

Page(
    BasePage({
        build() {
            vis.log('Settings Page Initialized');
            setStatusBarVisible(false);
            app = getApp();
            isDarkMode = app.globalData.isDarkMode || false;
            textSizeModifier = app.globalData.textSizeModifier || FONT_MODIFIERS.NORMAL;
            SCALE_FACTOR = app.globalData.scaleFactor || SCALE_FACTORS.NORMAL;
            isVribrationEnabled = app.globalData.isVribrationEnabled !== undefined ? app.globalData.isVribrationEnabled : true;

            canvas = createWidget(widget.CANVAS, {
                x: 0,
                y: 0,
                w: SCREEN_WIDTH,
                h: SCREEN_HEIGHT,
            });

            canvas.addEventListener(event.CLICK_UP, (info) => {
                this.handleInput(info);
            });

            this.render();
        },

        onDestroy() {
            vis.log('Settings page destroyed');
            // Save settings back to global data when leaving the page
            app.globalData.isDarkMode = isDarkMode;
            app.globalData.textSizeModifier = textSizeModifier;
            app.globalData.scaleFactor = SCALE_FACTOR;
            app.globalData.isVribrationEnabled = isVribrationEnabled;
        },

        handleInput(info) {
            const { x, y } = info;

            // Check for Vibration button click
            const vibrationY = SCREEN_HEIGHT / 2 - 80; // Positioned above Dark Mode
            const vibrationHeight = getTextWidthAndHeight(getText('vibration'), TEXT_SIZES.OPTION).height;
            if (x > SCREEN_WIDTH / 2 - 100 && x < SCREEN_WIDTH / 2 + 100 && y > vibrationY && y < vibrationY + vibrationHeight) {
                isVribrationEnabled = !isVribrationEnabled;
                isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
                this.render();
            }

            // Check for Dark Mode button click
            const darkModeY = SCREEN_HEIGHT / 2 - 20;
            const darkModeHeight = getTextWidthAndHeight(getText('darkMode'), TEXT_SIZES.OPTION).height;
            if (x > SCREEN_WIDTH / 2 - 100 && x < SCREEN_WIDTH / 2 + 100 && y > darkModeY && y < darkModeY + darkModeHeight) {
                isDarkMode = !isDarkMode;
                isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
                this.render();
            }

            // Check for Font Size button click
            const fontSizeY = SCREEN_HEIGHT / 2 + 40;
            const fontSizeHeight = getTextWidthAndHeight(getText('fontSize'), TEXT_SIZES.OPTION).height;
            if (x > SCREEN_WIDTH / 2 - 100 && x < SCREEN_WIDTH / 2 + 100 && y > fontSizeY && y < fontSizeY + fontSizeHeight) {
                if (textSizeModifier === FONT_MODIFIERS.NORMAL) {
                    textSizeModifier = FONT_MODIFIERS.LARGE;
                } else if (textSizeModifier === FONT_MODIFIERS.LARGE) {
                    textSizeModifier = FONT_MODIFIERS.SMALL;
                } else {
                    textSizeModifier = FONT_MODIFIERS.NORMAL;
                }
                isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
                this.render();
            }

            // Check for Scale Factor button click
            const scaleFactorY = SCREEN_HEIGHT / 2 + 100;
            const scaleFactorHeight = getTextWidthAndHeight(getText('scaleFactor'), TEXT_SIZES.OPTION).height;
            if (x > SCREEN_WIDTH / 2 - 100 && x < SCREEN_WIDTH / 2 + 100 && y > scaleFactorY && y < scaleFactorY + scaleFactorHeight) {
                if (SCALE_FACTOR === SCALE_FACTORS.NORMAL) {
                    SCALE_FACTOR = SCALE_FACTORS.LARGE;
                } else if (SCALE_FACTOR === SCALE_FACTORS.LARGE) {
                    SCALE_FACTOR = SCALE_FACTORS.SMALL;
                } else {
                    SCALE_FACTOR = SCALE_FACTORS.NORMAL;
                }
                isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
                this.render();
            }


            // Check for Back button click (or a button to navigate back)
            const backY = SCREEN_HEIGHT - 60;
            const backHeight = getTextWidthAndHeight(getText('back'), TEXT_SIZES.BUTTON).height;
            if (x > SCREEN_WIDTH / 2 - 50 && x < SCREEN_WIDTH / 2 + 50 && y > backY && y < backY + backHeight) {
                isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
                back();
            }
        },

        render() {
            const background = isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT;
            const fontColor = isDarkMode ? FONT_COLORS.DARK : FONT_COLORS.LIGHT;
            const highlightColor = FONT_COLORS.HIGHLIGHT;

            canvas.clear({ x: 0, y: 0, w: SCREEN_WIDTH, h: SCREEN_HEIGHT });
            canvas.drawRect({ x1: 0, y1: 0, x2: SCREEN_WIDTH, y2: SCREEN_HEIGHT, color: background });

            // Draw Title
            const titleText = getText('settingsTitle');
            const titleMetrics = getTextWidthAndHeight(titleText, TEXT_SIZES.TITLE * textSizeModifier);
            canvas.drawText({
                x: (SCREEN_WIDTH - titleMetrics.width) / 2,
                y: 40,
                text: titleText,
                text_size: TEXT_SIZES.TITLE * textSizeModifier,
                color: fontColor,
            });
            vis.log('Rendering Settings Page');

            // Draw Vibration Toggle
            const vibrationText = `${getText('vibration')}: ${isVribrationEnabled ? 'On' : 'Off'}`;
            const vibrationMetrics = getTextWidthAndHeight(vibrationText, TEXT_SIZES.OPTION * textSizeModifier);
            canvas.drawText({
                x: (SCREEN_WIDTH - vibrationMetrics.width) / 2,
                y: SCREEN_HEIGHT / 2 - 80, // Position above Dark Mode
                text: vibrationText,
                text_size: TEXT_SIZES.OPTION * textSizeModifier,
                color: !isVribrationEnabled ? fontColor : highlightColor,
            });

            // Draw Dark Mode Toggle
            const darkModeText = `${getText('darkMode')}: ${isDarkMode ? 'On' : 'Off'}`;
            const darkModeMetrics = getTextWidthAndHeight(darkModeText, TEXT_SIZES.OPTION * textSizeModifier);
            canvas.drawText({
                x: (SCREEN_WIDTH - darkModeMetrics.width) / 2,
                y: SCREEN_HEIGHT / 2 - 20,
                text: darkModeText,
                text_size: TEXT_SIZES.OPTION * textSizeModifier,
                color: isDarkMode ? highlightColor : fontColor,
            });

            // Draw Font Size Toggle
            let fontSizeString = 'Normal';
            if (textSizeModifier === FONT_MODIFIERS.SMALL) {
                fontSizeString = 'Small';
            } else if (textSizeModifier === FONT_MODIFIERS.LARGE) {
                fontSizeString = 'Large';
            }
            const fontSizeText = `${getText('fontSize')}: ${fontSizeString}`;
            const fontSizeMetrics = getTextWidthAndHeight(fontSizeText, TEXT_SIZES.OPTION * textSizeModifier);
            canvas.drawText({
                x: (SCREEN_WIDTH - fontSizeMetrics.width) / 2,
                y: SCREEN_HEIGHT / 2 + 40,
                text: fontSizeText,
                text_size: TEXT_SIZES.OPTION * textSizeModifier,
                color: textSizeModifier !== FONT_MODIFIERS.NORMAL ? highlightColor : fontColor,
            });

            // Draw Scale Factor Toggle
            let scaleFactorString = 'Normal';
            if (SCALE_FACTOR === SCALE_FACTORS.SMALL) {
                scaleFactorString = 'Small';
            } else if (SCALE_FACTOR === SCALE_FACTORS.LARGE) {
                scaleFactorString = 'Large';
            }
            const scaleFactorText = `${getText('scaleFactor')}: ${scaleFactorString}`;
            const scaleFactorMetrics = getTextWidthAndHeight(scaleFactorText, TEXT_SIZES.OPTION * textSizeModifier);
            canvas.drawText({
                x: (SCREEN_WIDTH - scaleFactorMetrics.width) / 2,
                y: SCREEN_HEIGHT / 2 + 100, // Position the new option below Font Size
                text: scaleFactorText,
                text_size: TEXT_SIZES.OPTION * textSizeModifier,
                color: SCALE_FACTOR !== SCALE_FACTORS.NORMAL ? highlightColor : fontColor,
            });


            // Draw Back Button
            const backText = getText('back');
            const backMetrics = getTextWidthAndHeight(backText, TEXT_SIZES.BUTTON * textSizeModifier);
            canvas.drawText({
                x: (SCREEN_WIDTH - backMetrics.width) / 2,
                y: SCREEN_HEIGHT - 60,
                text: backText,
                text_size: TEXT_SIZES.BUTTON * textSizeModifier,
                color: fontColor,
            });
        },
    })
);
