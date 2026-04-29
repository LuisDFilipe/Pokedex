<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import Phaser from "phaser";

const gameContainer = ref(null);
var gameInstance = null;
const map = ref(null);
var ground_1_tileset;
var ground_1_layer;

const TILE_SIZE = 32;
var player;
var cursors;
var wasd;
var isMoving = false;
var isBattling = false;

var pokemonId = null;
var jsonData = ref(null);
var currentLevel = 1;
var levelsLoaded = { level_1: false };

var grass_trigger_zone_1 = ref(null);

const config = {
  type: Phaser.AUTO,
  width: 512,
  height: 512,
  //scale: {
  //    mode: Phaser.Scale.FIT, // FIT scales the game to fit the screen while preserving aspect ratio
  //    autoCenter: Phaser.Scale.CENTER_BOTH, // Center the canvas
  //},
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: {
    preload() {
      // Use absolute paths or @/assets if configured in Vite
      this.load.image("ground_1", "assets/map/ground_1.png");
      this.load.image("grass_1", "assets/map/grass_1.png");
      this.load.tilemapTiledJSON("map", "assets/map/map1.json"); // Your map JSON
      //this.load.image('player', 'assets/player/player1.png'); // Player sprite
      this.load.spritesheet("player", "assets/player/player1.png", {
        frameWidth: 32,
        frameHeight: 32,
      });

      fetch("data/data.json")
        .then((response) => response.json())
        .then((data) => {
          jsonData.value = data;
        })
        .catch((error) => console.error("Error loading JSON:", error));
    },
    create() {
      map.value = this.make.tilemap({ key: "map" });
      ground_1_tileset = map.value.addTilesetImage("ground_1", "ground_1");

      ground_1_layer = map.value.createLayer("Ground1", ground_1_tileset, 0, 0);

      ground_1_layer.setCollisionByProperty({ collides: true });

      this.anims.create({
        key: "walk",
        frames: this.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });

      // Place player at a tile position
      player = this.physics.add.sprite(
        7 * TILE_SIZE + TILE_SIZE / 2,
        6 * TILE_SIZE + TILE_SIZE / 2,
        "player",
      );
      player.play("walk");
      player.setOrigin(0.5);
      player.setDepth(10);
      player.setCollideWorldBounds(true);

      this.physics.add.collider(player, ground_1_layer);

      loadLevels();

      cursors = this.input.keyboard.createCursorKeys();

      // WASD keys
      wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      });
    },
    update() {
      if (isMoving || isBattling) return;

      //check key presses
      if (
        Phaser.Input.Keyboard.JustDown(cursors.left) ||
        Phaser.Input.Keyboard.JustDown(wasd.left)
      )
        var moveX = -1;
      else if (
        Phaser.Input.Keyboard.JustDown(cursors.right) ||
        Phaser.Input.Keyboard.JustDown(wasd.right)
      )
        var moveX = 1;
      else if (
        Phaser.Input.Keyboard.JustDown(cursors.up) ||
        Phaser.Input.Keyboard.JustDown(wasd.up)
      )
        var moveY = -1;
      else if (
        Phaser.Input.Keyboard.JustDown(cursors.down) ||
        Phaser.Input.Keyboard.JustDown(wasd.down)
      )
        var moveY = 1;
      else return;

      //movePlayer
      if (moveX != null || moveY != null)
        movePlayer(this, moveX != null ? moveX : 0, moveY != null ? moveY : 0);
    },
  },
};

onMounted(() => {
  // Attach Phaser to the specific div ref
  gameInstance = new Phaser.Game({
    ...config,
    parent: gameContainer.value,
  });
});

onUnmounted(() => {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }
});

function movePlayer(scene, moveX, moveY) {
  if (isMoving || isBattling) return;

  var targetX = player.x + moveX * TILE_SIZE;
  var targetY = player.y + moveY * TILE_SIZE;

  var tileX = Math.floor(targetX / TILE_SIZE);
  var tileY = Math.floor(targetY / TILE_SIZE);

  var layer = map.value.getLayer("Ground1").tilemapLayer;
  var tile = layer.hasTileAt(tileX, tileY)
    ? layer.getTileAt(tileX, tileY)
    : null;

  // Block movement if collides
  if (tile && tile.properties.collides) return;

  isMoving = true;

  //move player
  scene.tweens.add({
    targets: player,
    x: targetX,
    y: targetY,
    duration: 100, //movement duration
    onComplete: () => {
      isMoving = false;
    },
  });

  //touched object
  checkTouchObject(targetX, targetY);
}

function checkTouchObject(targetX, targetY) {
  if (levelsLoaded.level_1 && grass_trigger_zone_1 != null) {
    grass_trigger_zone_1.value.forEach((zone) => {
      if (Phaser.Geom.Rectangle.Contains(zone.rect, targetX, targetY))
        touchGrassEvent("1");
    });
  }

  if (levelsLoaded.level_2 && grass_trigger_zone_2 != null) {
    grass_trigger_zone_2.forEach((zone) => {
      if (Phaser.Geom.Rectangle.Contains(zone.rect, targetX, targetY))
        touchGrassEvent("2");
    });
  }
}

function touchGrassEvent(level = "1") {
  //showToast("Grass Level:" + level, 1000, "top");

  let grassLevelData = jsonData.value.grass.filter(
    (entry) => entry.level == level,
  )[0];

  let encounterOdds = grassLevelData.encounterOdds;
  let foundPokemon = Math.floor(Math.random() * encounterOdds) == 0;

  let shinyOdds = 10;
  let isShiny = Math.floor(Math.random() * shinyOdds) == 0;

  if (foundPokemon) {
    let pokemonIds = grassLevelData.pokemonIds;
    pokemonId = pokemonIds[Math.floor(Math.random() * pokemonIds.length)];

    //showPokemonPopup(pokemonId, isShiny);
    //showToast("Show Pokemon", 1000, "top");
  }
}

function showToast(
  message = "This is a toast!",
  duration = 1000,
  position = "bottom",
) {
  const toast = document.createElement("div");
  toast.textContent = message;

  const initialOffset = "30px";
  const visibleOffset = "50px";

  Object.assign(toast.style, {
    position: "fixed",
    [position]: initialOffset, // Sets 'top' or 'bottom'
    left: "50%",
    transform: "translateX(-50%)",
    background: "#3334",
    color: "#fff7",
    padding: "12px 24px",
    borderRadius: "6px",
    fontSize: "14px",
    zIndex: 9999,
    opacity: "0",
    transition: `opacity 0.4s ease, ${position} 0.4s ease`,
  });

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style[position] = visibleOffset;
  });

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style[position] = initialOffset;
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 400);
  }, duration);
}

function loadLevels() {
  if (!levelsLoaded.level_1) {
    var grass_object_layer_1 = map.value.getObjectLayer("Grass1");

    grass_trigger_zone_1.value = grass_object_layer_1.objects.map((obj) => {
      var sprite = gameInstance.scene.scenes[0].add.sprite(
        obj.x,
        obj.y - obj.height,
        "grass_1",
      );
      sprite.setOrigin(0, 0);
      levelsLoaded.level_1 = true;
      return {
        name: obj.name,
        rect: new Phaser.Geom.Rectangle(
          obj.x,
          obj.y - obj.height,
          obj.width,
          obj.height,
        ),
        triggered: false,
      };
    });
  }

  if (currentLevel > 2 && !levelsLoaded.level_2) {
    grass_object_layer_2 = map.value.getObjectLayer("Grass2");

    grass_trigger_zone_2 = grass_object_layer_2.objects.map((obj) => {
      var sprite = gameInstance.scene.scenes[0].add.sprite(
        obj.x,
        obj.y - obj.height,
        "grass_1",
      );
      sprite.setOrigin(0, 0);
      levelsLoaded.level_2 = true;
      return {
        name: obj.name,
        rect: new Phaser.Geom.Rectangle(
          obj.x,
          obj.y - obj.height,
          obj.width,
          obj.height,
        ),
        triggered: false,
      };
    });
  }
}
</script>

<template>
  <div class="game-view">
    <div ref="gameContainer" class="canvas-wrapper"></div>

    <div class="instructions">
      <p>Use Arrows or WASD to move.</p>
    </div>
  </div>
</template>

<style scoped>
.game-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.canvas-wrapper {
  border: 4px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.instructions {
  margin-top: 15px;
  color: #888;
}
</style>
