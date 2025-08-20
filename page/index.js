import { getText } from '@zos/i18n'
import { BasePage } from "@zeppos/zml/base-page"
import VisLog from "@silver-zepp/vis-log"
import { createWidget, widget, event } from '@zos/ui'
import { Vibrator } from '@zos/sensor'
import { setPageBrightTime, resetPageBrightTime } from '@zos/display'
import { getDeviceInfo } from '@zos/device'
import { push } from '@zos/router'
import { getTextLayout } from '@zos/ui'
import { setStatusBarVisible } from '@zos/ui'
import { onKey, KEY_SELECT, KEY_BACK, KEY_EVENT_CLICK, KEY_EVENT_LONG_PRESS, KEY_EVENT_PRESS, KEY_EVENT_RELEASE } from '@zos/interaction'
import { onGesture, GESTURE_RIGHT } from '@zos/interaction'

const vis = new VisLog("index.js");
vis.updateSettings({ visual_log_enabled: false });
const vibrator = new Vibrator()
const vibrationType = vibrator.getType()
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = getDeviceInfo()

const DEBUG_HITBOX = false // <-- Turn to false to hide hitboxes

// Scale factor for all game elements (reduced size for watch)
let SCALE_FACTOR = 0.7

function getTextWidthAndHeight(text, fontSize) {
  return getTextLayout(text, {
    text_size: fontSize,
    text_width: 0,
    wrapped: 0
  })
}

// Game constants
const FPS = 60
const FRAME_DURATION = 1000 / FPS

// Adjusted T-Rex game constants for better feel
const GAME_SPEED = 10 * SCALE_FACTOR
const GRAVITY = 1.0 * SCALE_FACTOR
const JUMP_FORCE = -18 * SCALE_FACTOR
const GROUND_Y = SCREEN_HEIGHT - 120 * SCALE_FACTOR
const T_REX_X = 80 * SCALE_FACTOR
const CLOUD_SPAWN_RATE = 0.01
const BASE_OBSTACLE_SPAWN_RATE = 0.01
const SPEED_INCREMENT_SCORE_INTERVAL = 100
const SPEED_INCREMENT = 1.0 * SCALE_FACTOR

// Input state tracking
let isSelectPressed = false
let isScreenPressed = false

// UI and Settings
let isDarkMode = false
let textSizeModifier = 1
let isVribrationEnabled = true
const TEXT_SIZES = {
  TITLE: 28,
  INSTRUCTIONS: 20,
  SCORE: 20,
  HIGH_SCORE: 16,
  GAME_OVER: 24
}
const FONT_COLORS = {
  LIGHT: 0x535353,
  DARK: 0xffffff,
  HIGHLIGHT: 0xff6b6b
}
const BACKGROUND_COLORS = {
  LIGHT: 0xf7f7f7,
  DARK: 0x363636
}
const BUTTON_PADDING = 6; // Increased padding for a larger button

// Game state
let gameState = 'menu'
let gameSpeed = GAME_SPEED
let score = 0
let highScore = 0
let gameTimer = null
let canvas = null
let brightTimer = null
let lastObstacleX = 0
let lastSpeedIncreaseScore = 0

// Game objects
let tRex = {
  x: T_REX_X,
  y: GROUND_Y,
  width: 88 * SCALE_FACTOR,
  height: 94 * SCALE_FACTOR,
  velocityY: 0,
  isJumping: false,
  isDucking: false,
  isDead: false,
  animFrame: 0
}
let flyBird = {
  animFrame: 0
}

let obstacles = []
let clouds = []
let groundOffset = 0
let pageInstance = null

// Duck state management
let duckStartTime = 0
const DUCK_DELAY = 200 // milliseconds before ducking starts

Page(
  BasePage({
    build() {
      vis.log('Zepp Dino Run Page Initialized')
      setStatusBarVisible(false)
      const app = getApp()
      highScore = app.globalData.highScore || 0
      isDarkMode = app.globalData.isDarkMode || false
      textSizeModifier = app.globalData.textSizeModifier || 1
      SCALE_FACTOR = app.globalData.scaleFactor || 0.7
      isVribrationEnabled = app.globalData.isVribrationEnabled !== undefined ? app.globalData.isVribrationEnabled : true
      this.initializeGame()
      pageInstance = this
    },

    onDestroy() {
      vis.log('Game page destroyed')
      if (gameTimer) {
        clearInterval(gameTimer)
        gameTimer = null
      }
      const app = getApp()
      app.globalData.highScore = highScore
      app.globalData.isDarkMode = isDarkMode
      app.globalData.textSizeModifier = textSizeModifier
      app.globalData.scaleFactor = SCALE_FACTOR
      app.globalData.isVribrationEnabled = isVribrationEnabled
      resetPageBrightTime()
    },

    initializeGame() {
      canvas = createWidget(widget.CANVAS, {
        x: 0,
        y: 0,
        w: SCREEN_WIDTH,
        h: SCREEN_HEIGHT
      })
      canvas.addEventListener(event.CLICK_UP, (info) => {
        this.handleInput(info)
        this.handleScreenRelease()
      })

      canvas.addEventListener(event.CLICK_DOWN, (info) => {
        this.handleScreenPress(info)
      })

      this.startGameLoop()
      this.drawMenu()
    },

    handleInput(info) {
      const { x, y } = info
      if (gameState === 'menu') {
        const startText = getText('startBtnTxt')
        const startTextLayout = getTextLayout(startText, {
          text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
          text_width: SCREEN_WIDTH,
          wrapped: 0
        })
        const startTextWidth = startTextLayout.width
        const startButtonX1 = (SCREEN_WIDTH - startTextWidth) / 2 - BUTTON_PADDING
        const startButtonX2 = (SCREEN_WIDTH + startTextWidth) / 2 + BUTTON_PADDING
        const startButtonY1 = SCREEN_HEIGHT / 2 + 70
        const startButtonY2 = startButtonY1 + startTextLayout.height + BUTTON_PADDING

        // Settings button coordinates
        const settingsText = getText('settingBtnTxt')
        const settingsTextLayout = getTextLayout(settingsText, {
          text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
          text_width: SCREEN_WIDTH,
          wrapped: 0
        })
        const settingsTextWidth = settingsTextLayout.width
        const settingsButtonX1 = (SCREEN_WIDTH - settingsTextWidth) / 2 - BUTTON_PADDING
        const settingsButtonX2 = (SCREEN_WIDTH + settingsTextWidth) / 2 + BUTTON_PADDING
        const settingsButtonY1 = SCREEN_HEIGHT / 2 + 140
        const settingsButtonY2 = settingsButtonY1 + settingsTextLayout.height + BUTTON_PADDING

        // Check for button clicks
        if (x > startButtonX1 && x < startButtonX2 && y > startButtonY1 && y < startButtonY2) {
          this.startGame()
          isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
        } else if (x > settingsButtonX1 && x < settingsButtonX2 && y > settingsButtonY1 && y < settingsButtonY2) {
          // Placeholder for settings page logic
          this.navigateToSettings()
          isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
        }
      } else if (gameState === 'playing') {
        this.jump()
      } else if (gameState === 'gameOver') {
        // Restart button logic
        const restartText = getText('restartTxt')
        const restartTextLayout = getTextLayout(restartText, {
          text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
          text_width: SCREEN_WIDTH,
          wrapped: 0
        })
        const restartTextWidth = restartTextLayout.width
        const restartButtonX1 = (SCREEN_WIDTH - restartTextWidth) / 2 - BUTTON_PADDING
        const restartButtonX2 = (SCREEN_WIDTH + restartTextWidth) / 2 + BUTTON_PADDING
        const restartButtonY1 = SCREEN_HEIGHT / 2 + 60
        const restartButtonY2 = restartButtonY1 + restartTextLayout.height + BUTTON_PADDING

        if (x > restartButtonX1 && x < restartButtonX2 && y > restartButtonY1 && y < restartButtonY2) {
          this.restartGame()
          isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
        }
      } else if (gameState === 'paused') {
        // Resume button coordinates
        const resumeText = getText('resumeText');
        const resumeTextLayout = getTextLayout(resumeText, {
          text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
          text_width: SCREEN_WIDTH,
          wrapped: 0
        });
        const resumeTextWidth = resumeTextLayout.width;
        const resumeButtonX1 = (SCREEN_WIDTH - resumeTextWidth) / 2 - BUTTON_PADDING;
        const resumeButtonX2 = (SCREEN_WIDTH + resumeTextWidth) / 2 + BUTTON_PADDING;
        const resumeButtonY1 = SCREEN_HEIGHT / 2 + 30;
        const resumeButtonY2 = resumeButtonY1 + resumeTextLayout.height + BUTTON_PADDING;

        // Check for resume button click
        if (x > resumeButtonX1 && x < resumeButtonX2 && y > resumeButtonY1 && y < resumeButtonY2) {
          this.resumeGame();
          isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
        }
      }
    },

    handleScreenPress(info) {
      if (gameState === 'playing') {
        isScreenPressed = true
        duckStartTime = Date.now()
      }
    },

    handleScreenRelease() {
      isScreenPressed = false
      // Duck state will be handled in updateTRex()
    },

    pauseGame() {
      if (gameState === 'playing') {
        gameState = 'paused'
        vis.log('Game paused')
      }
    },

    resumeGame() {
      if (gameState === 'paused') {
        gameState = 'playing'
        vis.log('Game resumed')
      }
    },

    togglePause() {
      if (gameState === 'playing') {
        this.pauseGame()
      } else if (gameState === 'paused') {
        this.resumeGame()
      }
    },

    navigateToSettings() {
      push({
        url: 'page/setting',
      })
    },

    startGame() {
      gameState = 'playing'
      score = 0
      gameSpeed = GAME_SPEED
      lastSpeedIncreaseScore = 0

      // Reset all T-Rex properties to their initial state
      tRex.y = GROUND_Y
      tRex.height = 94 * SCALE_FACTOR
      tRex.velocityY = 0
      tRex.isJumping = false
      tRex.isDucking = false
      tRex.isDead = false
      tRex.animFrame = 0

      flyBird.animFrame = 0
      obstacles = []
      clouds = []
      groundOffset = 0
      lastObstacleX = 0

      // Reset input state variables
      isSelectPressed = false
      isScreenPressed = false

      vis.log('Game started!')
      if (brightTimer) clearInterval(brightTimer)
      brightTimer = setInterval(() => {
        setPageBrightTime({ brightTime: 30000 })
      }, 25000)
    },

    jump() {
      if (!tRex.isJumping && !tRex.isDead && !tRex.isDucking) {
        tRex.velocityY = JUMP_FORCE
        tRex.isJumping = true
        isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 100 }])
      }
    },

    restartGame() {
      this.startGame()
    },

    gameOver() {
      gameState = 'gameOver'
      tRex.isDead = true
      tRex.velocityY = 0
      if (score > highScore) {
        highScore = score
        isVribrationEnabled && vibrator.start([{ type: vibrationType.STRONG_SHORT, duration: 100 }])
      } else {
        isVribrationEnabled && vibrator.start([{ type: vibrationType.GENTLE_SHORT, duration: 50 }])
      }
      vis.log(`Game Over! Score: ${score}, High Score: ${highScore}`)
      if (brightTimer) clearInterval(brightTimer)
      resetPageBrightTime()

      // Add these lines to reset the input state
      isSelectPressed = false
      isScreenPressed = false
    },

    startGameLoop() {
      if (gameTimer) clearInterval(gameTimer)
      gameTimer = setInterval(() => {
        if (gameState === 'playing') this.updateGame()
        this.render()
      }, FRAME_DURATION)
    },

    updateGame() {
      this.updateTRex()
      this.updateObstacles()
      this.updateClouds()
      groundOffset = (groundOffset + gameSpeed) % (2404 * SCALE_FACTOR)
      score += 0.1

      // Speed increase logic
      if (Math.floor(score / SPEED_INCREMENT_SCORE_INTERVAL) > Math.floor(lastSpeedIncreaseScore / SPEED_INCREMENT_SCORE_INTERVAL)) {
        gameSpeed += SPEED_INCREMENT;
        lastSpeedIncreaseScore = score;
      }

      const lastObstacle = obstacles[obstacles.length - 1];
      const minDistance = 100 * SCALE_FACTOR + (Math.random() * 50 * SCALE_FACTOR);
      if (!lastObstacle || SCREEN_WIDTH - lastObstacle.x > minDistance) {
        if (Math.random() < BASE_OBSTACLE_SPAWN_RATE) {
          this.spawnObstacle();
        }
      }

      if (Math.random() < CLOUD_SPAWN_RATE) this.spawnCloud()
      this.checkCollisions()
    },

    updateTRex() {
      // Handle ducking logic
      if (!tRex.isJumping && !tRex.isDead && gameState === 'playing') {
        if (isSelectPressed || isScreenPressed) {
          const currentTime = Date.now()
          if (currentTime - duckStartTime >= DUCK_DELAY) {
            if (!tRex.isDucking) {
              tRex.isDucking = true
              tRex.height = 60 * SCALE_FACTOR
              tRex.y = GROUND_Y + (34 * SCALE_FACTOR)
            }
          }
        } else {
          // No input pressed - return to normal if ducking
          if (tRex.isDucking) {
            tRex.isDucking = false
            tRex.height = 94 * SCALE_FACTOR
            tRex.y = GROUND_Y
          }
        }
      }

      tRex.velocityY += GRAVITY
      tRex.y += tRex.velocityY
      if (tRex.y >= GROUND_Y) {
        tRex.y = GROUND_Y
        tRex.velocityY = 0
        tRex.isJumping = false
      }

      if (!tRex.isJumping && !tRex.isDucking && !tRex.isDead) {
        tRex.animFrame = (tRex.animFrame + 0.3) % 2
      } else if (tRex.isDucking && !tRex.isDead) {
        tRex.animFrame = (tRex.animFrame + 0.3) % 2
      }

      if (!tRex.isDead) {
        flyBird.animFrame = (flyBird.animFrame + 0.2) % 2
      }
    },

    updateObstacles() {
      for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed
        if (obstacles[i].x + obstacles[i].width < 0) obstacles.splice(i, 1)
      }
    },

    updateClouds() {
      for (let i = clouds.length - 1; i >= 0; i--) {
        clouds[i].x -= gameSpeed * 0.3
        if (clouds[i].x + clouds[i].width < 0) clouds.splice(i, 1)
      }
    },

    spawnObstacle() {
      const obstacleType = (Math.random() < 0.7 || score < 500) ? 'cactus' : 'bird';
      let obstacle;

      if (obstacleType === 'cactus') {
        const smallCactus = [
          { "img": "LargeCactus1.png", width: 48 * SCALE_FACTOR, height: 95 * SCALE_FACTOR },
          { "img": "LargeCactus2.png", width: 99 * SCALE_FACTOR, height: 95 * SCALE_FACTOR },
          { "img": "LargeCactus3.png", width: 102 * SCALE_FACTOR, height: 95 * SCALE_FACTOR }
        ];
        const largeCactus = [
          { "img": "SmallCactus1.png", width: 40 * SCALE_FACTOR, height: 71 * SCALE_FACTOR },
          { "img": "SmallCactus2.png", width: 68 * SCALE_FACTOR, height: 71 * SCALE_FACTOR },
          { "img": "SmallCactus3.png", width: 105 * SCALE_FACTOR, height: 71 * SCALE_FACTOR }
        ];

        const cactusImage = Math.random() < 0.5
          ? smallCactus[Math.floor(Math.random() * smallCactus.length)]
          : largeCactus[Math.floor(Math.random() * largeCactus.length)];
        obstacle = {
          x: SCREEN_WIDTH,
          type: 'cactus',
          width: cactusImage.width,
          height: cactusImage.height,
          y: GROUND_Y - cactusImage.height + (3 * SCALE_FACTOR),
          image: cactusImage.img
        };
      } else {
        // Bird
        // Dynamic bird heights like original Chrome Dino
        const birdHeights = [
          50 * SCALE_FACTOR,   // Low flying
          75 * SCALE_FACTOR,   // Medium flying  
          100 * SCALE_FACTOR,  // High flying
          125 * SCALE_FACTOR   // Very high flying
        ]
        const randomHeight = birdHeights[Math.floor(Math.random() * birdHeights.length)]
        obstacle = {
          x: SCREEN_WIDTH,
          type: 'bird',
          width: 93 * SCALE_FACTOR,
          height: 62 * SCALE_FACTOR,
          y: GROUND_Y - randomHeight,
          image: 'Bird.png'
        };
      }
      obstacles.push(obstacle);
      lastObstacleX = SCREEN_WIDTH;
    },

    spawnCloud() {
      const cloud = {
        x: SCREEN_WIDTH,
        y: Math.random() * (SCREEN_HEIGHT * 0.3) + (50 * SCALE_FACTOR),
        width: 84 * SCALE_FACTOR,
        height: 101 * SCALE_FACTOR,
      }
      clouds.push(cloud)
    },

    checkCollisions() {
      const trexBox = {
        x: tRex.x + (15 * SCALE_FACTOR),
        y: tRex.isDucking ? tRex.y - (60 * SCALE_FACTOR) + (3 * SCALE_FACTOR) : tRex.y - tRex.height + (3 * SCALE_FACTOR),
        width: tRex.isDucking ? (118 * SCALE_FACTOR) - (30 * SCALE_FACTOR) : tRex.width - (30 * SCALE_FACTOR),
        height: tRex.isDucking ? (60 * SCALE_FACTOR) - (10 * SCALE_FACTOR) : tRex.height - (10 * SCALE_FACTOR)
      }
      for (const obstacle of obstacles) {
        const obsBox = this.getObstacleHitbox(obstacle)
        if (this.isColliding(trexBox, obsBox)) {
          this.gameOver()
          break
        }
      }
    },

    getObstacleHitbox(obstacle) {
      if (obstacle.type === 'cactus') {
        return {
          x: obstacle.x + (10 * SCALE_FACTOR),
          y: obstacle.y,
          width: obstacle.width - (20 * SCALE_FACTOR),
          height: obstacle.height
        }
      } else {
        // Bird hitbox - slightly smaller for better gameplay
        return {
          x: obstacle.x + (5 * SCALE_FACTOR),
          y: obstacle.y + (5 * SCALE_FACTOR),
          width: obstacle.width - (10 * SCALE_FACTOR),
          height: obstacle.height - (10 * SCALE_FACTOR)
        }
      }
    },

    isColliding(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      )
    },

    render() {
      if (!canvas) return
      if (gameState === 'menu') this.drawMenu()
      else if (gameState === 'paused') {
        this.drawGame()
        this.drawPauseOverlay()
      }
      else {
        this.drawGame()
        if (gameState === 'gameOver') this.drawGameOver()
      }
    },

    drawMenu() {
      const background = isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT
      const fontColor = isDarkMode ? FONT_COLORS.DARK : FONT_COLORS.LIGHT

      canvas.clear({
        x: 0,
        y: 0,
        w: SCREEN_WIDTH,
        h: SCREEN_HEIGHT
      })

      canvas.drawRect({
        x1: 0,
        y1: 0,
        x2: SCREEN_WIDTH,
        y2: SCREEN_HEIGHT,
        color: background
      })

      const title = getText('title')
      const titleWidth = getTextWidthAndHeight(title, TEXT_SIZES.TITLE * textSizeModifier).width
      canvas.drawText({
        x: (SCREEN_WIDTH - titleWidth) / 2,
        y: SCREEN_HEIGHT / 2 - 40,
        text: title,
        text_size: TEXT_SIZES.TITLE * textSizeModifier,
        color: fontColor,
      })

      if (highScore > 0) {
        const highScoreText = `${getText('highScoreText')} ${Math.floor(highScore)}`
        const highScoreWidth = getTextWidthAndHeight(highScoreText, TEXT_SIZES.HIGH_SCORE * textSizeModifier).width
        canvas.drawText({
          x: (SCREEN_WIDTH - highScoreWidth) / 2,
          y: SCREEN_HEIGHT / 2 + 20,
          text: highScoreText,
          text_size: TEXT_SIZES.HIGH_SCORE * textSizeModifier,
          color: fontColor,
        })
      }

      // Start Game Button
      const startText = getText('startBtnTxt')
      const startTextLayout = getTextLayout(startText, {
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        text_width: SCREEN_WIDTH,
        wrapped: 0
      })
      const startTextWidth = startTextLayout.width
      const startButtonY = SCREEN_HEIGHT / 2 + 70
      const startButtonHeight = startTextLayout.height

      canvas.drawRect({
        x1: (SCREEN_WIDTH - startTextWidth) / 2 - BUTTON_PADDING,
        y1: startButtonY - (BUTTON_PADDING / 2),
        x2: (SCREEN_WIDTH + startTextWidth) / 2 + BUTTON_PADDING,
        y2: startButtonY + startButtonHeight + (BUTTON_PADDING / 2),
        radius: 10,
        color: FONT_COLORS.HIGHLIGHT,
        fill_color: FONT_COLORS.HIGHLIGHT
      })

      canvas.drawText({
        x: (SCREEN_WIDTH - startTextWidth) / 2,
        y: startButtonY,
        text: startText,
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        color: isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT,
      })

      // Settings Button Placeholder
      const settingsText = getText('settingBtnTxt')
      const settingsTextLayout = getTextLayout(settingsText, {
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        text_width: SCREEN_WIDTH,
        wrapped: 0
      })
      const settingsTextWidth = settingsTextLayout.width
      const settingsButtonY = SCREEN_HEIGHT / 2 + 140
      const settingsButtonHeight = settingsTextLayout.height

      canvas.drawRect({
        x1: (SCREEN_WIDTH - settingsTextWidth) / 2 - BUTTON_PADDING,
        y1: settingsButtonY - (BUTTON_PADDING / 2),
        x2: (SCREEN_WIDTH + settingsTextWidth) / 2 + BUTTON_PADDING,
        y2: settingsButtonY + settingsButtonHeight + (BUTTON_PADDING / 2),
        radius: 10,
        color: fontColor,
        fill_color: fontColor,
      })

      canvas.drawText({
        x: (SCREEN_WIDTH - settingsTextWidth) / 2,
        y: settingsButtonY,
        text: settingsText,
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        color: isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT,
      })

      this.drawTRex(SCREEN_WIDTH / 2 - (20 * SCALE_FACTOR), SCREEN_HEIGHT / 2 - (100 * SCALE_FACTOR), false)
    },

    drawGame() {
      const background = isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT
      canvas.clear({ x: 0, y: 0, w: SCREEN_WIDTH, h: SCREEN_HEIGHT })
      canvas.drawRect({ x1: 0, y1: 0, x2: SCREEN_WIDTH, y2: SCREEN_HEIGHT, color: background })
      this.drawClouds()
      this.drawGround()
      this.drawTRex(tRex.x, tRex.y, true)
      this.drawObstacles()
      this.drawUI()

      if (DEBUG_HITBOX) this.drawHitboxes()
    },

    drawGameOver() {
      const fontColor = isDarkMode ? FONT_COLORS.DARK : FONT_COLORS.LIGHT
      const gameOverText = getText('gameOverText')
      const gameOverWidth = getTextWidthAndHeight(gameOverText, TEXT_SIZES.GAME_OVER * textSizeModifier).width
      canvas.drawText({
        x: (SCREEN_WIDTH - gameOverWidth) / 2,
        y: SCREEN_HEIGHT / 2 - 20,
        text: gameOverText,
        text_size: TEXT_SIZES.GAME_OVER * textSizeModifier,
        color: fontColor,
      })

      const scoreText = `${getText('scoreText')} ${Math.floor(score)}`
      const scoreWidth = getTextWidthAndHeight(scoreText, TEXT_SIZES.SCORE * textSizeModifier).width
      canvas.drawText({
        x: (SCREEN_WIDTH - scoreWidth) / 2,
        y: SCREEN_HEIGHT / 2 + 10,
        text: scoreText,
        text_size: TEXT_SIZES.SCORE * textSizeModifier,
        color: fontColor,
      })

      if (score > highScore - 1) {
        const newHighScoreText = getText('newHighScoreMsg')
        const newHighScoreWidth = getTextWidthAndHeight(newHighScoreText, TEXT_SIZES.SCORE * textSizeModifier).width
        canvas.drawText({
          x: (SCREEN_WIDTH - newHighScoreWidth) / 2,
          y: SCREEN_HEIGHT / 2 - 60,
          text: newHighScoreText,
          text_size: TEXT_SIZES.SCORE * textSizeModifier,
          color: FONT_COLORS.HIGHLIGHT,
        })
      }

      const restartText = getText('restartTxt')
      const restartTextLayout = getTextLayout(restartText, {
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        text_width: SCREEN_WIDTH,
        wrapped: 0
      })
      const restartTextWidth = restartTextLayout.width
      const restartButtonY = SCREEN_HEIGHT / 2 + 60
      const restartButtonHeight = restartTextLayout.height

      canvas.drawRect({
        x1: (SCREEN_WIDTH - restartTextWidth) / 2 - BUTTON_PADDING,
        y1: restartButtonY - (BUTTON_PADDING / 2),
        x2: (SCREEN_WIDTH + restartTextWidth) / 2 + BUTTON_PADDING,
        y2: restartButtonY + restartButtonHeight + (BUTTON_PADDING / 2),
        radius: 10,
        color: FONT_COLORS.HIGHLIGHT,
        fill_color: FONT_COLORS.HIGHLIGHT
      })

      canvas.drawText({
        x: (SCREEN_WIDTH - restartTextWidth) / 2,
        y: restartButtonY,
        text: restartText,
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        color: isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT,
      })
    },

    drawPauseOverlay() {
      const background = isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT;
      const fontColor = isDarkMode ? FONT_COLORS.DARK : FONT_COLORS.LIGHT;

      // Draw a semi-transparent overlay to dim the game
      canvas.drawRect({
        x1: 0,
        y1: 0,
        x2: SCREEN_WIDTH,
        y2: SCREEN_HEIGHT,
        color: background,
        alpha: 150 // Add a slight transparency for a better visual effect
      });

      const scoreText = `${getText('scoreText')} ${Math.floor(score)}`;
      const scoreWidth = getTextWidthAndHeight(scoreText, TEXT_SIZES.SCORE * textSizeModifier).width;

      canvas.drawText({
        x: (SCREEN_WIDTH - scoreWidth) / 2,
        y: SCREEN_HEIGHT / 2 - 50,
        text: scoreText,
        text_size: TEXT_SIZES.SCORE * textSizeModifier,
        color: fontColor,
      });

      const pauseText = getText('pauseText');
      const pauseWidth = getTextWidthAndHeight(pauseText, TEXT_SIZES.GAME_OVER * textSizeModifier).width;
      canvas.drawText({
        x: (SCREEN_WIDTH - pauseWidth) / 2,
        y: SCREEN_HEIGHT / 2 - 10,
        text: pauseText,
        text_size: TEXT_SIZES.GAME_OVER * textSizeModifier,
        color: fontColor,
      });

      // Resume Button
      const resumeText = getText('resumeText');
      const resumeTextLayout = getTextLayout(resumeText, {
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        text_width: SCREEN_WIDTH,
        wrapped: 0
      });
      const resumeTextWidth = resumeTextLayout.width;
      const resumeButtonY = SCREEN_HEIGHT / 2 + 30; // Position below the pause message
      const resumeButtonHeight = resumeTextLayout.height;

      // Draw the button's background rectangle
      canvas.drawRect({
        x1: (SCREEN_WIDTH - resumeTextWidth) / 2 - BUTTON_PADDING,
        y1: resumeButtonY - (BUTTON_PADDING / 2),
        x2: (SCREEN_WIDTH + resumeTextWidth) / 2 + BUTTON_PADDING,
        y2: resumeButtonY + resumeButtonHeight + (BUTTON_PADDING / 2),
        radius: 10,
        color: FONT_COLORS.HIGHLIGHT,
        fill_color: FONT_COLORS.HIGHLIGHT
      });

      // Draw the button's text
      canvas.drawText({
        x: (SCREEN_WIDTH - resumeTextWidth) / 2,
        y: resumeButtonY,
        text: resumeText,
        text_size: TEXT_SIZES.INSTRUCTIONS * textSizeModifier,
        color: isDarkMode ? BACKGROUND_COLORS.DARK : BACKGROUND_COLORS.LIGHT,
      });
    },

    drawTRex(x, y, animate) {
      if (animate && !tRex.isJumping && !tRex.isDucking && !tRex.isDead) {
        const step = Math.floor(tRex.animFrame) % 2
        if (step === 0) {
          canvas.drawImage({
            x: x,
            y: y - tRex.height + (3 * SCALE_FACTOR),
            w: tRex.width,
            h: tRex.height,
            image: 'DinoRun1.png',
          })
        } else {
          canvas.drawImage({
            x: x,
            y: tRex.isDucking ? y - (60 * SCALE_FACTOR) + (3 * SCALE_FACTOR) : y - tRex.height + (3 * SCALE_FACTOR),
            w: tRex.width,
            h: tRex.height,
            image: 'DinoRun2.png',
          })
        }
      } else if (tRex.isDead) {
        canvas.drawImage({
          x: x,
          y: y - tRex.height + (3 * SCALE_FACTOR),
          w: tRex.width,
          h: tRex.height,
          image: 'DinoDead.png',
        })
      } else if (tRex.isJumping) {
        canvas.drawImage({
          x: x,
          y: y - tRex.height + (3 * SCALE_FACTOR),
          w: tRex.width,
          h: tRex.height,
          image: 'DinoJump.png',
        })
      } else if (tRex.isDucking) {
        const step = Math.floor(tRex.animFrame) % 2
        if (step === 0) {
          canvas.drawImage({
            x: x,
            y: y - (60 * SCALE_FACTOR) + (3 * SCALE_FACTOR),
            w: 118 * SCALE_FACTOR, // Duck sprites are wider
            h: 60 * SCALE_FACTOR,  // Duck sprites are shorter
            image: 'DinoDuck1.png',
          })
        } else {
          canvas.drawImage({
            x: x,
            y: y - (60 * SCALE_FACTOR) + (3 * SCALE_FACTOR),
            w: 118 * SCALE_FACTOR, // Duck sprites are wider
            h: 60 * SCALE_FACTOR,  // Duck sprites are shorter
            image: 'DinoDuck2.png',
          })
        }
      } else {
        canvas.drawImage({
          x: x,
          y: y - tRex.height + (3 * SCALE_FACTOR),
          w: tRex.width,
          h: tRex.height,
          image: 'DinoStart.png',
        })
      }
    },

    drawObstacles() {
      for (const obstacle of obstacles) {
        if (obstacle.type === 'cactus') {
          canvas.drawImage({
            x: obstacle.x,
            y: obstacle.y,
            w: obstacle.width,
            h: obstacle.height,
            image: obstacle.image,
          })
        } else {
          const step = Math.floor(flyBird.animFrame) % 2
          const birdY = obstacle.y + (step === 0 ? 0 : 10 * SCALE_FACTOR)
          canvas.drawImage({
            x: obstacle.x,
            y: birdY,
            w: obstacle.width,
            h: obstacle.height,
            image: `Bird${step + 1}.png`,
          })
        }
      }
    },

    drawClouds() {
      for (const cloud of clouds) {
        canvas.drawImage({
          x: cloud.x,
          y: cloud.y,
          w: cloud.width,
          h: cloud.height,
          image: 'Cloud.png',
        })
      }
    },

    drawGround() {
      for (let x = -groundOffset; x < SCREEN_WIDTH; x += 2404 * SCALE_FACTOR) {
        canvas.drawImage({
          x: x,
          y: GROUND_Y - (20 * SCALE_FACTOR),
          w: 2404 * SCALE_FACTOR,
          h: 28 * SCALE_FACTOR,
          image: 'Track.png',
        })
      }
    },

    drawUI() {
      const fontColor = isDarkMode ? FONT_COLORS.DARK : FONT_COLORS.LIGHT
      const scoreText = Math.floor(score).toString().padStart(5, '0')
      const scoreWidth = getTextWidthAndHeight(scoreText, TEXT_SIZES.SCORE * textSizeModifier).width
      canvas.drawText({
        x: (SCREEN_WIDTH - scoreWidth) / 2,
        y: 30,
        text: scoreText,
        text_size: TEXT_SIZES.SCORE * textSizeModifier,
        color: fontColor,
      })

      if (highScore > 0) {
        const highScoreText = `HI ${Math.floor(highScore).toString().padStart(5, '0')}`
        const highScoreWidth = getTextWidthAndHeight(highScoreText, TEXT_SIZES.HIGH_SCORE * textSizeModifier).width
        canvas.drawText({
          x: (SCREEN_WIDTH - highScoreWidth) / 2,
          y: 50,
          text: highScoreText,
          text_size: TEXT_SIZES.HIGH_SCORE * textSizeModifier,
          color: fontColor,
        })
      }
    },

    drawHitboxes() {
      const trexBox = {
        x: tRex.x + (15 * SCALE_FACTOR),
        y: tRex.isDucking ? tRex.y - (60 * SCALE_FACTOR) + (3 * SCALE_FACTOR) : tRex.y - tRex.height + (3 * SCALE_FACTOR),
        width: tRex.isDucking ? (118 * SCALE_FACTOR) - (30 * SCALE_FACTOR) : tRex.width - (30 * SCALE_FACTOR),
        height: tRex.isDucking ? (60 * SCALE_FACTOR) - (10 * SCALE_FACTOR) : tRex.height - (10 * SCALE_FACTOR)
      }
      canvas.drawRect({
        x1: trexBox.x,
        y1: trexBox.y,
        x2: trexBox.x + trexBox.width,
        y2: trexBox.y + trexBox.height,
        color: 0xff0000
      })

      for (const obstacle of obstacles) {
        const obs = this.getObstacleHitbox(obstacle)
        canvas.drawRect({
          x1: obs.x,
          y1: obs.y,
          x2: obs.x + obs.width,
          y2: obs.y + obs.height,
          color: 0x0000ff
        })
      }
    }
  })
)

onKey({
  callback: (key, keyEvent) => {
    if (key === KEY_SELECT && keyEvent === KEY_EVENT_CLICK) {
      if (!pageInstance) return true;
      if (gameState === 'playing') {
        pageInstance.jump();
        return true;
      }
    } else if (key === KEY_SELECT && keyEvent === KEY_EVENT_PRESS) {
      if (!pageInstance) return true;
      if (gameState === 'playing') {
        isSelectPressed = true;
        duckStartTime = Date.now();
        return true;
      }
    } else if (key === KEY_SELECT && keyEvent === KEY_EVENT_RELEASE) {
      if (!pageInstance) return true;
      if (gameState === 'playing') {
        isSelectPressed = false;
        // Duck state will be handled in updateTRex()
        return true;
      }
    } else if (key === KEY_SELECT && keyEvent === KEY_EVENT_LONG_PRESS) {
      if (!pageInstance) return true;
      if (gameState === 'playing') {
        return true;
      }
      return false;
    }
    else if (key === KEY_BACK && keyEvent === KEY_EVENT_CLICK) {
      if (pageInstance && (gameState === 'playing' || gameState === 'paused')) {
        pageInstance.togglePause();
        return true;
      }
      return false;
    }
    return false;
  },
})

onGesture({
  callback: (event) => {
    if (event === GESTURE_RIGHT) {
      if (pageInstance && (gameState === 'playing' || gameState === 'paused')) {
        pageInstance.togglePause();
        return
      }
      return
    }
    return
  }
})
