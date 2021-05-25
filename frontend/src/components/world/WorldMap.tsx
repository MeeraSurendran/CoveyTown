import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Phaser from 'phaser';
import Player, { UserLocation } from '../../classes/Player';
import Video from '../../classes/Video/Video';
import { TicTacToe } from '../Placeables/TicTacToe';
import useCoveyAppState from '../../hooks/useCoveyAppState';
import Placeable from '../../classes/Placeable';
import TownsServiceClient from '../../classes/TownsServiceClient';
import { FlappyBird } from '../Placeables/FlappyBird';
import {Chess} from "../Placeables/Chess";
import { Banner } from '../Placeables/Banner';
import { Youtube } from '../Placeables/Youtube';


document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

class CoveyGameScene extends Phaser.Scene {


  private BUTTON_WIDTH = 309;

  private readonly X_PADDING: number= 10;

  private readonly Y_PADDING: number = 7;

  private readonly FONT_SIZE_IN_PIXLES : number= 13;

  private readonly FONT_SIZE: string= `${this.FONT_SIZE_IN_PIXLES}px`

  private readonly BUTTON_HEIGHT: number = (2 * this.Y_PADDING) + this.FONT_SIZE_IN_PIXLES;

  private readonly TEXT_HEIGHT: number = 50;

  private readonly PLAYER_WIDTH : number= 32;

  private readonly X_PLACEMENT_OFFSET: number= this.PLAYER_WIDTH + 12;

  private readonly Y_PLACEMENT_OFFSET: number = 42;

  private readonly X_OFFSET: number = (this.PLAYER_WIDTH - this.BUTTON_WIDTH) / 2;

  private player?: {
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, label: Phaser.GameObjects.Text
  };


  private placeableGroup: Phaser.Physics.Arcade.Group | undefined;


  private myPlayerID: string;

  private townId;

  private apiClient: TownsServiceClient;

  private players: Player[] = [];

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys[] = [];

  /*
   * A "captured" key doesn't send events to the browser - they are trapped by Phaser
   * When pausing the game, we uncapture all keys, and when resuming, we re-capture them.
   * This is the list of keys that are currently captured by Phaser.
   */
  private previouslyCapturedKeys: number[] = [];

  private lastLocation?: UserLocation;

  private ready = false;

  private paused = false;

  private playersToken: string;

  private video: Video;

  private emitMovement: (loc: UserLocation) => void;

   /** the tilemap for this world that is initialized within the create function */
   private tilemap!: Phaser.Tilemaps.Tilemap;


  // newly added

  private placeable?: {
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  };

  private placeables: Placeable[] = [];

  constructor(video: Video, emitMovement: (loc: UserLocation) => void, apiClient: TownsServiceClient, townId: string,  myPlayerID: string, playerSessionToken: string) {
    super('PlayGame');
    this.video = video;
    this.emitMovement = emitMovement;
    this.apiClient = apiClient;
    this.townId = townId;
    this.playersToken = playerSessionToken;
    this.myPlayerID = myPlayerID;
  }


  preload() {
    this.load.image('tiles', '/assets/tilesets/tuxmon-sample-32px-extruded.png');
    this.load.image('box', '/assets/placeable/treeObject.gif');
    this.load.image('tictactoe', '/assets/placeable/tictactoe.png');
    this.load.image('chess', '/assets/placeable/chess.png');
    this.load.image('flappy', '/assets/placeable/FlappyBird.png');
    this.load.image('banner', '/assets/placeable/banner.png');
    this.load.image('youtube', '/assets/placeable/youtube.png');
    this.load.tilemapTiledJSON('map', '/assets/tilemaps/tuxemon-town.json');
    this.load.atlas('atlas', '/assets/atlas/atlas.png', '/assets/atlas/atlas.json');
    this.load.atlas('placeables', '/assets/placeables/placeable.png', '/assets/placeables/placeable.json');
    this.load.image('tree1', '/assets/placeable/treeSprite/frame1.gif');
    this.load.image('tree2', '/assets/placeable/treeSprite/frame2.gif');
    this.load.image('tree3', '/assets/placeable/treeSprite/frame3.gif');
    this.load.image('tree4', '/assets/placeable/treeSprite/frame4.gif');
    this.load.image('tree5', '/assets/placeable/treeSprite/frame5.gif');

    this.load.image('flower1', '/assets/placeable/flowerSprite/flower1.gif');
    this.load.image('flower2', '/assets/placeable/flowerSprite/flower2.gif');
    this.load.image('flower3', '/assets/placeable/flowerSprite/flower3.gif');
    this.load.image('flower4', '/assets/placeable/flowerSprite/flower4.gif');
    this.load.image('flower5', '/assets/placeable/flowerSprite/flower5.gif');
  }


  initialise(apiClient: TownsServiceClient, townId: string) {

    this.apiClient = apiClient;
    this.townId = townId;
  }

  updatePlayersLocations(players: Player[]) {
    if (!this.ready) {
      this.players = players;
      return;
    }
    players.forEach((p) => {
      this.updatePlayerLocation(p);
    });
    // Remove disconnected players from board
    const disconnectedPlayers = this.players.filter(
      (player) => !players.find((p) => p.id === player.id),
    );
    disconnectedPlayers.forEach((disconnectedPlayer) => {
      if (disconnectedPlayer.sprite) {
        disconnectedPlayer.sprite.destroy();
        disconnectedPlayer.label?.destroy();
      }
    });
    // Remove disconnected players from list
    if (disconnectedPlayers.length) {
      this.players = this.players.filter(
        (player) => !disconnectedPlayers.find(
          (p) => p.id === player.id,
        ),
      );
    }
  }

  updatePlayerLocation(player: Player) {
    let myPlayer = this.players.find((p) => p.id === player.id);
    if (!myPlayer) {
      let { location } = player;
      if (!location) {
        location = {
          rotation: 'back',
          moving: false,
          x: 0,
          y: 0,
        };
      }
      myPlayer = new Player(player.id, player.userName, location);
      this.players.push(myPlayer);
    }


    if (this.myPlayerID !== myPlayer.id && this.physics && player.location) {
      let { sprite } = myPlayer;
      if (!sprite) {
        sprite = this.physics.add
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - JB todo
          .sprite(0, 0, 'atlas', 'misa-front')
          .setSize(30, 40)
          .setOffset(0, 24);
        const label = this.add.text(0, 0, myPlayer.userName, {
          font: '18px monospace',
          color: '#000000',
          backgroundColor: '#ffffff',
        });
        myPlayer.label = label;
        myPlayer.sprite = sprite;
      }
      if (!sprite.anims) return;
      sprite.setX(player.location.x);
      sprite.setY(player.location.y);
      myPlayer.label?.setX(player.location.x);
      myPlayer.label?.setY(player.location.y - 20);
      if (player.location.moving) {
        sprite.anims.play(`misa-${player.location.rotation}-walk`, true);
      } else {
        sprite.anims.stop();
        sprite.setTexture('atlas', `misa-${player.location.rotation}`);
      }
    }
  }


  updatePlaceables(placeables: Placeable[]) {

    if (!this.ready) {
      this.placeables = placeables;
      return;
    }
    placeables.forEach((p) => {
      this.updatePlaceable(p);
    });
    // Remove deleted placeables from board
    const deletedPlaceables = this.placeables.filter(
      (object) => !placeables.find((p) => Placeable.compareLocation(p.location, object.location)),
    );
    deletedPlaceables.forEach((deletedPlaceable) => {
      if (deletedPlaceable.sprite) {
        deletedPlaceable.sprite.destroy();
        deletedPlaceable.label?.destroy();
      }
    });
    // Remove deleted placeables from list
    if (deletedPlaceables.length) {
      this.placeables = this.placeables.filter(
        (object) => !deletedPlaceables.find(
          (p) => Placeable.compareLocation(p.location, object.location),
        ),
      );
    }
  }

  errorMessageDisplay(message: string, gameScene: CoveyGameScene, xCord : number, yCord: number) {

      const errorLines = message.split("\n")
      const maxStringLength = Math.max(...errorLines.map(o => o.length), 0);
      const W_WIDTH = this.FONT_SIZE_IN_PIXLES * 0.8
      const xErrorOffset = (gameScene.PLAYER_WIDTH - maxStringLength * W_WIDTH) / 2
      const buttonText = gameScene.add.text(xCord + xErrorOffset, yCord, `${message}\n(Click me to close)`, {
        color: '#FFFFFF',
        fontSize: gameScene.FONT_SIZE,
        backgroundColor: 'darkred',
        padding: {
          x: this.X_PADDING,
          y: this.Y_PADDING
        },
        fixedHeight: errorLines.length * gameScene.BUTTON_HEIGHT,
        fixedWidth: maxStringLength * W_WIDTH,
        align: 'center'
      });
      gameScene.pause();
      buttonText.setInteractive();
      buttonText.on('pointerdown', () => {
        buttonText.destroy();
        gameScene.resume();
      });
  }


  async placeableDeletion(myPlaceable: Placeable) {

   if(myPlaceable && myPlaceable.sprite) {

    const {xIndex, yIndex} = myPlaceable.location;
    const indexLocation: Phaser.Math.Vector2 = this.tilemap.tileToWorldXY(xIndex, yIndex);
    const xCord = indexLocation.x;
    const yCord = indexLocation.y;
    myPlaceable.sprite.on('pointerdown', () => {
      const deleteOption = this.add.text(xCord, yCord, 'Do you want to delete\n this object?',
      {
      color: '#FFFFFF',
      backgroundColor: '#004d00',
      align: 'center',
      padding: {
        x: this.X_PADDING,
        y: this.Y_PADDING
      },
      fixedWidth: 309,
      });
      const deleteOptionYes = this.add.text(xCord, yCord + 25, 'Delete',
      {
      color: '#FFFFFF',
      backgroundColor: '#004d00',
      align: 'center',
      padding: {
        x: this.X_PADDING,
        y: this.Y_PADDING
      },
      fixedWidth: 309,
      });
      deleteOptionYes.setInteractive();
      deleteOptionYes.on('pointerover', () => {
        deleteOptionYes.setBackgroundColor('#008000');
      });
      deleteOptionYes.on('pointerout', () => {
        deleteOptionYes.setBackgroundColor('#004d00');
      });
      const deleteOptionNo = this.add.text( xCord, yCord + 50, 'Cancel',
      {
       color: '#FFFFFF',
       backgroundColor: '#004d00',
       align: 'center',
       padding: {
         x: this.X_PADDING,
         y: this.Y_PADDING
       },
      fixedWidth: 309,
      });
    deleteOptionNo.setInteractive();
    deleteOptionNo.on('pointerover', () => {
      deleteOptionNo.setBackgroundColor('#008000');
    });
    deleteOptionNo.on('pointerout', () => {
      deleteOptionNo.setBackgroundColor('#004d00');
    });
    deleteOptionYes.on('pointerdown', async () => {
      deleteOption.destroy();
      deleteOptionNo.destroy();
      deleteOptionYes.destroy();
      try {
        await this.apiClient.deletePlaceable({coveyTownID: this.townId, coveyTownPassword: '5F6N8ZfXy7S1k9rf2s2uJ1_o', playersToken: this.playersToken, location: {xIndex, yIndex}});
      } catch (err) {
        this.errorMessageDisplay(err.message, this, xCord, yCord);
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
   deleteOptionNo.on('pointerdown', () => destroyOptions());
   function destroyOptions() {
    deleteOption.destroy();
    deleteOptionNo.destroy();
    deleteOptionYes.destroy();
  }
  });
}
}

  updatePlaceable(placeable: Placeable) {
    let myPlaceable: Placeable | undefined = this.placeables.find((p) => Placeable.compareLocation(p.location, placeable.location));
    if (!myPlaceable) {
      let { location } = placeable;
      if (!location) {
        location = {
          xIndex: 0,
          yIndex: 0,
        };
      }
      myPlaceable = new Placeable(placeable.placeableID, placeable.name, placeable.location, placeable.objectInformation);
      this.placeables.push(myPlaceable);
    }

    const indexLocation: Phaser.Math.Vector2 = this.tilemap.tileToWorldXY(myPlaceable.location.xIndex, myPlaceable.location.yIndex);
    const xCord = indexLocation.x
    const yCord = indexLocation.y

    this.anims.create({
      key: 'tree',
      frames: [
        { key: 'tree1' },
        { key: 'tree2' },
        { key: 'tree3' },
        { key: 'tree4' },
        { key: 'tree5', duration: 50 }
      ],
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'flower',
      frames: [
        {key: 'flower1'},
        {key: 'flower5'},
        {key: 'flower2'},
        {key: 'flower3'},
        {key: 'flower4', duration: 50}
      ],
      frameRate: 8,
      repeat: -1
    });

    function createSprite(gameScene: CoveyGameScene, curPlaceable: Placeable, displaySize: integer): Phaser.GameObjects.Sprite {
      let { sprite } = curPlaceable;
      if(!sprite) {
         sprite = gameScene.physics.add
          .sprite(xCord, yCord, curPlaceable.placeableID)
          .setScale(0.2)
          .setDisplaySize(displaySize,displaySize)
          .setImmovable(true)
          .setCollideWorldBounds(true)
          .setInteractive();
      }
      return sprite;
    }

    const isShown = true;
    const toggle = () => {
      ReactDOM.unmountComponentAtNode(document.getElementById('modal-container') as Element)
    };
    const bannerText = !myPlaceable?.objectInformation?.bannerText ? '' : myPlaceable?.objectInformation?.bannerText

    const spriteMap = new Map()
    spriteMap.set('tictactoe',<TicTacToe isShown={isShown} hide={toggle} modalContent='game' headerText='TicTacToe'/>)
    spriteMap.set('flappy', <FlappyBird isShown={isShown} hide={toggle} modalContent='game' headerText='Flappy Bird'/>)
    spriteMap.set('chess', <Chess isShown={isShown} hide={toggle} modalContent='game' headerText='Chess'/>)
    spriteMap.set('banner', <Banner isShown={isShown} hide={toggle} modalContent={bannerText} headerText='Banner'/>)
    spriteMap.set('youtube', <Youtube isShown={isShown} hide={toggle} modalContent={bannerText} headerText='TicTacToe'/>)


    if (this.physics && myPlaceable.placeableID === 'tree') {
      let { sprite } = myPlaceable;
      if (!sprite) {
        sprite = this.physics.add
          .sprite(xCord, yCord, 'tree1')
          .setOffset(0, 60 - 32)
          .setDisplaySize(65,65)
          .setImmovable(true)
          .play('tree')
          .setInteractive();
        myPlaceable.sprite = sprite;
        // this.placeableGroup?.add(myPlaceable.sprite);
        myPlaceable.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if(pointer.rightButtonDown()) {
            if(myPlaceable) {
              this.placeableDeletion(myPlaceable);
            }
          }
        })
      }

    }

    else if (this.physics && myPlaceable.placeableID === 'flower') {
      let { sprite } = myPlaceable;
      if (!sprite) {
        sprite = this.physics.add
          .sprite(xCord, yCord, 'flower1')
          .setOffset(0, 60 - 32)
          .setDisplaySize(60, 60)
          .setImmovable(true)
          .play('flower')
          .setInteractive();

        myPlaceable.sprite = sprite;
        // this.placeableGroup?.add(myPlaceable.sprite);
        myPlaceable.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if(pointer.rightButtonDown()) {
            if(myPlaceable) {
              this.placeableDeletion(myPlaceable);
            }
          }
        })
      }
    } else if (this.physics && myPlaceable.placeableID === 'tictactoe') {
      let { sprite } = myPlaceable;
      if (!sprite) {
        sprite = this.physics.add
          .sprite(xCord, yCord, myPlaceable.placeableID)
          .setOffset(0, 60 - 32)
          .setDisplaySize(40, 40)
          .setImmovable(true)
          .setInteractive();

        myPlaceable.sprite = sprite;
        myPlaceable.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if(pointer.leftButtonDown()) {
            ReactDOM.render(spriteMap.get(myPlaceable?.placeableID), document.getElementById('modal-container'))
          }
          else if(pointer.rightButtonDown()) {
            if(myPlaceable) {
              this.placeableDeletion(myPlaceable);
            }
          }
        })
      }
    }
    else if (this.physics && myPlaceable.placeableID === 'chess') {
      let { sprite } = myPlaceable;
      if (!sprite) {
        sprite = this.physics.add
          .sprite(xCord, yCord, myPlaceable.placeableID)
          .setOffset(0, 60 - 32)
          .setDisplaySize(60, 60)
          .setImmovable(true)
          .setInteractive();

        myPlaceable.sprite = sprite;
        myPlaceable.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if(pointer.leftButtonDown()) {
            ReactDOM.render(spriteMap.get(myPlaceable?.placeableID), document.getElementById('modal-container'))
          }
          else if(pointer.rightButtonDown()) {
            if(myPlaceable) {
              this.placeableDeletion(myPlaceable);
            }
          }
        })
      }
    }
    else if (this.physics && myPlaceable.placeableID === 'youtube') {
      let { sprite } = myPlaceable;
      if (!sprite) {
        sprite = this.physics.add
          .sprite(xCord, yCord, myPlaceable.placeableID)
          .setOffset(0, 60 - 32)
          .setDisplaySize(65, 65)
          .setImmovable(true)
          .setInteractive();

        myPlaceable.sprite = sprite;
        myPlaceable.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if(pointer.leftButtonDown()) {
            ReactDOM.render(spriteMap.get(myPlaceable?.placeableID), document.getElementById('modal-container'))
          }
          else if(pointer.rightButtonDown()) {
            if(myPlaceable) {
              this.placeableDeletion(myPlaceable);
            }
          }
        })
      }
    }
    else if (this.physics && myPlaceable.placeableID === 'banner') {
      let { sprite } = myPlaceable;
      if (!sprite) {
        sprite = this.physics.add
          .sprite(xCord, yCord, myPlaceable.placeableID)
          .setOffset(0, 60 - 32)
          .setDisplaySize(100, 100)
          .setImmovable(true)
          .setInteractive();

        myPlaceable.sprite = sprite;
        myPlaceable.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if(pointer.leftButtonDown()) {
            ReactDOM.render(spriteMap.get(myPlaceable?.placeableID), document.getElementById('modal-container'))
          }
          else if(pointer.rightButtonDown()) {
            if(myPlaceable) {
              this.placeableDeletion(myPlaceable);
            }
          }
        })
      }
    }
    else if (this.physics && myPlaceable.placeableID === 'flappy') {
      let { sprite } = myPlaceable;
      if (!sprite) {
        sprite = this.physics.add
          .sprite(xCord, yCord, myPlaceable.placeableID)
          .setOffset(0, 60 - 32)
          .setDisplaySize(40, 40)
          .setImmovable(true)
          .setInteractive();

        myPlaceable.sprite = sprite;
        myPlaceable.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if(pointer.leftButtonDown()) {
            ReactDOM.render(spriteMap.get(myPlaceable?.placeableID), document.getElementById('modal-container'))
          }
          else if(pointer.rightButtonDown()) {
            if(myPlaceable) {
              this.placeableDeletion(myPlaceable);
            }
          }
        })
      }
    }


    if(myPlaceable.sprite) {
      myPlaceable.sprite?.setSize(100,100);
      this.placeableGroup?.add(myPlaceable.sprite);
    }

  }


  getNewMovementDirection() {
    if (this.cursors.find(keySet => keySet.left?.isDown)) {
      return 'left';
    }
    if (this.cursors.find(keySet => keySet.right?.isDown)) {
      return 'right';
    }
    if (this.cursors.find(keySet => keySet.down?.isDown)) {
      return 'front';
    }
    if (this.cursors.find(keySet => keySet.up?.isDown)) {
      return 'back';
    }
    return undefined;
  }

  update() {
    if (this.paused) {
      return;
    }
    if (this.player && this.cursors) {
      const speed = 175;
      const prevVelocity = this.player.sprite.body.velocity.clone();
      const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;

      // Stop any previous movement from the last frame
      body.setVelocity(0);

      const primaryDirection = this.getNewMovementDirection();
      switch (primaryDirection) {
        case 'left':
          body.setVelocityX(-speed);
          this.player.sprite.anims.play('misa-left-walk', true);
          break;
        case 'right':
          body.setVelocityX(speed);
          this.player.sprite.anims.play('misa-right-walk', true);
          break;
        case 'front':
          body.setVelocityY(speed);
          this.player.sprite.anims.play('misa-front-walk', true);
          break;
        case 'back':
          body.setVelocityY(-speed);
          this.player.sprite.anims.play('misa-back-walk', true);
          break;
        default:
          // Not moving
          this.player.sprite.anims.stop();
          // If we were moving, pick and idle frame to use
          if (prevVelocity.x < 0) {
            this.player.sprite.setTexture('atlas', 'misa-left');
          } else if (prevVelocity.x > 0) {
            this.player.sprite.setTexture('atlas', 'misa-right');
          } else if (prevVelocity.y < 0) {
            this.player.sprite.setTexture('atlas', 'misa-back');
          } else if (prevVelocity.y > 0) this.player.sprite.setTexture('atlas', 'misa-front');
          break;
      }

      // Normalize and scale the velocity so that player can't move faster along a diagonal
      this.player.sprite.body.velocity.normalize()
        .scale(speed);

      const isMoving = primaryDirection !== undefined;
      this.player.label.setX(body.x);
      this.player.label.setY(body.y - 20);
      if (!this.lastLocation
        || this.lastLocation.x !== body.x
        || this.lastLocation.y !== body.y
        || (isMoving && this.lastLocation.rotation !== primaryDirection)
        || this.lastLocation.moving !== isMoving) {
        if (!this.lastLocation) {
          this.lastLocation = {
            x: body.x,
            y: body.y,
            rotation: primaryDirection || 'front',
            moving: isMoving,
          };
        }
        this.lastLocation.x = body.x;
        this.lastLocation.y = body.y;
        this.lastLocation.rotation = primaryDirection || 'front';
        this.lastLocation.moving = isMoving;
        this.emitMovement(this.lastLocation);
      }
    }
  }


// This method is where addPlaceable method is called using the apiClient.On clicking the
// yes button, apiClient calls the addPlaceable method in the TownServiceClient.ts file

  placeableAddition(sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody) {

    async function addPlaceableByID(gameScene: CoveyGameScene, placeableID: string): Promise<void> {
      let xCord = gameScene.lastLocation?.x;
      let yCord = gameScene.lastLocation?.y;
      if (!(xCord && yCord)) {
        const buttonText = gameScene.add.text(15, 15, `(Click me to close)`, {
          color: '#FFFFFF',
          fontSize: gameScene.FONT_SIZE,
          backgroundColor: 'darkred',
          padding: {
            x: gameScene.X_PADDING,
            y: gameScene.Y_PADDING
          },
          fixedHeight: 50,
          fixedWidth: 50,
          align: 'center',
        });
        gameScene.pause();
        buttonText.setInteractive();
        buttonText.setDepth(10);
        buttonText.on('pointerdown', () => {
          buttonText.destroy();
          gameScene.resume();
        });
        return
      }
      xCord += (gameScene.X_PLACEMENT_OFFSET / 2);
      yCord += (gameScene.Y_PLACEMENT_OFFSET / 2);
      const indexLocation: Phaser.Math.Vector2 = gameScene.tilemap.worldToTileXY(xCord, yCord);
      const xIndex  = indexLocation.x
      const yIndex  = indexLocation.y

        try{
          await gameScene.apiClient.addPlaceable({coveyTownID: gameScene.townId, playersToken: gameScene.playersToken, coveyTownPassword: 'bn35hyo0bF-c3aEysO5uJ936', placeableID , location: { xIndex , yIndex }});
        } catch (err) {
          gameScene.errorMessageDisplay(err.message, gameScene, xCord, yCord);
        }

    }

    async function addPlaceableWithInput(gameScene: CoveyGameScene, placeableID: string, placeableName: string, closeFunction: (coveyGameScene: CoveyGameScene) => void): Promise<void> {

      let xCord = !gameScene.lastLocation?.x ? 0 : (gameScene.lastLocation?.x);
      let yCord = !gameScene.lastLocation?.y ? 0 : (gameScene.lastLocation?.y + gameScene.TEXT_HEIGHT);
      if (!(xCord && yCord)) {
        const buttonText = gameScene.add.text(15, 15, `(Click me to close)`, {
          color: '#FFFFFF',
          fontSize: gameScene.FONT_SIZE,
          backgroundColor: 'darkred',
          padding: {
            x: gameScene.X_PADDING,
            y: gameScene.Y_PADDING
          },
          fixedHeight: 50,
          fixedWidth: 50,
          align: 'center',
        });
        gameScene.pause();
        buttonText.setInteractive();
        buttonText.setDepth(10);
        buttonText.on('pointerdown', () => {
          buttonText.destroy();
          closeFunction(gameScene);
          gameScene.resume();
        });
        return
      }
      xCord += (gameScene.X_PLACEMENT_OFFSET / 2);
      yCord += (gameScene.Y_PLACEMENT_OFFSET / 2);
      gameScene.pause();
      const form = `<input type="text" name="form-banner" class="form-banner" placeholder="Enter ${placeableName} Text" style="width: 309px; text-align: center; background-color: #008000; color: #ffffff; padding: 7px 10px 7px 10px; font-size: 13px">  `;
      const inputBannerText = gameScene.add.dom(xCord, yCord).createFromHTML(form);
      inputBannerText.setInteractive();
      inputBannerText.setDepth(5);
      inputBannerText.addListener('keyup');
      let inputText = '';
      inputBannerText.on('keyup',  (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.value) {
          inputText = event.target.value;
        }
      });
      inputBannerText.on('click',  () => {
        closeFunction(gameScene);
      });

      const submit = `<input type="button" value="Submit" style="width: 309px; text-align: center; background-color: #004d00; color: #ffffff; padding: 7px 10px 7px 10px; font-size: 13px" /> `;

      const submitBannerText = gameScene.add.dom(xCord, yCord + gameScene.BUTTON_HEIGHT).createFromHTML(submit);
      submitBannerText.setInteractive();
      submitBannerText.setDepth(5);
      const submitBannerCallback = async function submitCallback(scene: CoveyGameScene) {
        const objectInformation = {
          bannerText: inputText
        }
        closeFunction(gameScene);
        const indexLocation: Phaser.Math.Vector2 = gameScene.tilemap.worldToTileXY(xCord, yCord);
        const xIndex  = indexLocation.x
        const yIndex  = indexLocation.y

        try{
          await scene.apiClient.addPlaceable({coveyTownID: scene.townId, playersToken: gameScene.playersToken, coveyTownPassword: 'Fsrxni4kC8qKlwBbfCY',placeableID ,location: { xIndex , yIndex}, placeableInformation: objectInformation});
        } catch (err) {
            gameScene.errorMessageDisplay(err.message, gameScene, xCord, yCord);
        }
        gameScene.resume();
        inputBannerText.destroy();
        submitBannerText.destroy();
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        cancelBannerText.destroy();
      }
      submitBannerText.addListener('click');
      submitBannerText.on('click', () => submitBannerCallback(gameScene));

      const cancel = `<input type="button" value="Cancel" style="width: 309px; text-align: center; background-color: #004d00; color: #ffffff; padding: 7px 10px 7px 10px; font-size: 13px" /> `;

      const cancelBannerText = gameScene.add.dom(xCord, yCord+ gameScene.BUTTON_HEIGHT * 2).createFromHTML(cancel);
      cancelBannerText.setInteractive();
      cancelBannerText.setDepth(5);
      cancelBannerText.addListener('click');

      const cancelBannerCallback = function cancelCallback() {
        gameScene.resume();
        closeFunction(gameScene);
        inputBannerText.destroy();
        submitBannerText.destroy();
        cancelBannerText.destroy();
      };
      cancelBannerText.on('click', cancelBannerCallback);
    }


    function createListButton(gameScene: CoveyGameScene, placeableName: string, closeFunction: (coveyGameScene: CoveyGameScene) => void, numberInList: integer, placeableID?: string, placeableWithInput?: boolean): Phaser.GameObjects.Text {

      let xLocation: integer
      let yLocation: integer
      if (gameScene.lastLocation) {
        xLocation = gameScene.lastLocation.x + gameScene.X_OFFSET
        yLocation = gameScene.lastLocation.y + gameScene.TEXT_HEIGHT + gameScene.BUTTON_HEIGHT * numberInList
      } else {
        // need to figure out what to do here
        xLocation = 0;
        yLocation = 0;
      }

      const button = gameScene.add.text(xLocation, yLocation, placeableName,
      {
        fontSize: gameScene.FONT_SIZE,
        color: '#FFFFFF',
        backgroundColor: '#004d00',
        align: 'center',
        padding: {
          x: gameScene.X_PADDING,
          y: gameScene.Y_PADDING
        },
        fixedWidth: gameScene.BUTTON_WIDTH,
      });
      button.setDepth(10);
      button.setInteractive();

      const escapeKey = gameScene.input.keyboard.addKey('ESC');
      escapeKey.on('down', async () => {
        closeFunction(gameScene);
      });
      button.on('pointerover', () => {
        button.setBackgroundColor('#008000');
      });
      button.on('pointerout', () => {
        button.setBackgroundColor('#004d00');
      });

      if (placeableID && placeableWithInput) {
        button.on('pointerdown', async () => {
          closeFunction(gameScene);

          await addPlaceableWithInput(gameScene, placeableID, placeableName, closeFunction);
        });
      }
      else if (placeableID) {
        button.on('pointerdown', async () => {
          closeFunction(gameScene)
          await addPlaceableByID(gameScene, placeableID);
        });
      }
      else {
        button.on('pointerdown', async () => {
          closeFunction(gameScene);
        });
      }
      return button;
    }


    sprite.on('pointerdown', () => {
      if (!this.lastLocation) {
        return
      }
      const buttonText = this.add.text(this.lastLocation.x + this.X_OFFSET, this.lastLocation.y, "Which placeable would\nyou like to create here?", {
        color: '#FFFFFF',

        fontSize: this.FONT_SIZE,
        backgroundColor: '#003300',
        padding: {
          x: this.X_PADDING,
          y: this.Y_PADDING
        },
        fixedHeight: this.TEXT_HEIGHT,
        fixedWidth: this.BUTTON_WIDTH,
        align: 'center',
        shadow: {
          offsetX: 5,
          offsetY: 5,
          color: 'red',
          blur: 5
        }
      });
      buttonText.setDepth(10);


      const placeableButtonList: Phaser.GameObjects.Text[] = []

      function destroyText(gameScene: CoveyGameScene ) {
        buttonText.destroy();
        placeableButtonList.forEach((button) => {
          button.destroy();
        })
        gameScene.resume();
      }

      placeableButtonList.push(createListButton(this, 'Tree', destroyText, 0,'tree', false));
      placeableButtonList.push(createListButton(this, 'Flowers', destroyText, 1, 'flower', false))
      placeableButtonList.push(createListButton(this, 'Tic Tac Toe', destroyText, 2, 'tictactoe', false))
      placeableButtonList.push(createListButton(this, 'Flappy Bird', destroyText, 3, 'flappy', false))
      placeableButtonList.push(createListButton(this, 'Banner', destroyText, 4, 'banner', true))
      placeableButtonList.push(createListButton(this, 'YouTube', destroyText, 5, 'youtube', true))
      placeableButtonList.push(createListButton(this, 'Chess', destroyText, 6, 'chess'))
      placeableButtonList.push(createListButton(this, 'Cancel', destroyText, 7))

      this.pause();
    });
  }

  create() {
    const map = this.make.tilemap({ key: 'map' });
    this.tilemap = map;

    /* Parameters are the name you gave the tileset in Tiled and then the key of the
     tileset image in Phaser's cache (i.e. the name you used in preload)
     */
    const tileset = map.addTilesetImage('tuxmon-sample-32px-extruded', 'tiles');

    // Parameters: layer name (or index) from Tiled, tileset, x, y
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const belowLayer = map.createLayer('Below Player', tileset, 0, 0);
    const worldLayer = map.createLayer('World', tileset, 0, 0);
    worldLayer.setCollisionByProperty({ collides: true });
    const aboveLayer = map.createLayer('Above Player', tileset, 0, 0);
    /* By default, everything gets depth sorted on the screen in the order we created things.
     Here, we want the "Above Player" layer to sit on top of the player, so we explicitly give
     it a depth. Higher depths will sit on top of lower depth objects.
     */
    aboveLayer.setDepth(10);

    // Object layers in Tiled let you embed extra info into a map - like a spawn point or custom
    // collision shapes. In the tmx file, there's an object layer with a point named "Spawn Point"
    const spawnPoint = map.findObject('Objects',
      (obj) => obj.name === 'Spawn Point') as unknown as
      Phaser.GameObjects.Components.Transform;


    // Find all of the transporters, add them to the physics engine
    const transporters = map.createFromObjects('Objects',
      { name: 'transporter' })
    this.physics.world.enable(transporters);

    // For each of the transporters (rectangle objects), we need to tweak their location on the scene
    // for reasons that are not obvious to me, but this seems to work. We also set them to be invisible
    // but for debugging, you can comment out that line.
    transporters.forEach(transporter => {
        const sprite = transporter as Phaser.GameObjects.Sprite;
        sprite.y += 2 * sprite.height; // Phaser and Tiled seem to disagree on which corner is y
        sprite.setVisible(false); // Comment this out to see the transporter rectangles drawn on
        // the map

      }
    );

    const labels = map.filterObjects('Objects',(obj)=>obj.name==='label');
    labels.forEach(label => {
      if(label.x && label.y){
        this.add.text(label.x, label.y, label.text.text, {
          color: '#FFFFFF',
          backgroundColor: '#000000',
        })
      }
    });


    const cursorKeys = this.input.keyboard.createCursorKeys();
    this.cursors.push(cursorKeys);
    this.cursors.push(this.input.keyboard.addKeys({
      'up': Phaser.Input.Keyboard.KeyCodes.W,
      'down': Phaser.Input.Keyboard.KeyCodes.S,
      'left': Phaser.Input.Keyboard.KeyCodes.A,
      'right': Phaser.Input.Keyboard.KeyCodes.D
    }, false) as Phaser.Types.Input.Keyboard.CursorKeys);
    this.cursors.push(this.input.keyboard.addKeys({
      'up': Phaser.Input.Keyboard.KeyCodes.H,
      'down': Phaser.Input.Keyboard.KeyCodes.J,
      'left': Phaser.Input.Keyboard.KeyCodes.K,
      'right': Phaser.Input.Keyboard.KeyCodes.L
    }, false) as Phaser.Types.Input.Keyboard.CursorKeys);

    // Create a sprite with physics enabled via the physics system. The image used for the sprite
    // has a bit of whitespace, so I'm using setSize & setOffset to control the size of the
    // player's body.

    const mainSprite = this.physics.add
      .sprite(spawnPoint.x, spawnPoint.y, 'atlas', 'misa-front')
      .setSize(30, 40)
      .setOffset(0, 24)
      .setDepth(5)
      .setInteractive();

    this.placeableGroup = this.physics.add.group({
      immovable: true
    })
    this.physics.add.collider(mainSprite, this.placeableGroup);

    this.placeableAddition(mainSprite);


    const label = this.add.text(spawnPoint.x, spawnPoint.y - 20, '(You)', {
      font: '18px monospace',
      color: '#000000',
      // padding: {x: 20, y: 10},
      backgroundColor: '#ffffff',
    }).setDepth(100);
    this.player = {
      sprite: mainSprite,
      label
    };

    /* Configure physics overlap behavior for when the player steps into
    a transporter area. If you enter a transporter and press 'space', you'll
    transport to the location on the map that is referenced by the 'target' property
    of the transporter.
     */
    this.physics.add.overlap(mainSprite, transporters,
      (overlappingObject, transporter)=>{
        if(cursorKeys.space.isDown && this.player){
          // In the tiled editor, set the 'target' to be an *object* pointer
          // Here, we'll see just the ID, then find the object by ID
          const transportTargetID = transporter.getData('target') as number;
          const target = map.findObject('Objects', obj => (obj as unknown as Phaser.Types.Tilemaps.TiledObject).id === transportTargetID);
          if(target && target.x && target.y && this.lastLocation){
            // Move the player to the target, update lastLocation and send it to other players
            this.player.sprite.x = target.x;
            this.player.sprite.y = target.y;
            this.lastLocation.x = target.x;
            this.lastLocation.y = target.y;
            this.emitMovement(this.lastLocation);
          }
          else{
            throw new Error(`Unable to find target object ${target}`);
          }
        }
      })

    this.emitMovement({
      rotation: 'front',
      moving: false,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - JB todo
      x: spawnPoint.x,
      y: spawnPoint.y,
    });

    // Watch the player and worldLayer for collisions, for the duration of the scene:
    this.physics.add.collider(mainSprite, worldLayer);

    // Create the player's walking animations from the texture atlas. These are stored in the global
    // animation manager so any sprite can access them.
    const { anims } = this;
    anims.create({
      key: 'misa-left-walk',
      frames: anims.generateFrameNames('atlas', {
        prefix: 'misa-left-walk.',
        start: 0,
        end: 3,
        zeroPad: 3,
      }),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'misa-right-walk',
      frames: anims.generateFrameNames('atlas', {
        prefix: 'misa-right-walk.',
        start: 0,
        end: 3,
        zeroPad: 3,
      }),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'misa-front-walk',
      frames: anims.generateFrameNames('atlas', {
        prefix: 'misa-front-walk.',
        start: 0,
        end: 3,
        zeroPad: 3,
      }),
      frameRate: 10,
      repeat: -1,
    });
    anims.create({
      key: 'misa-back-walk',
      frames: anims.generateFrameNames('atlas', {
        prefix: 'misa-back-walk.',
        start: 0,
        end: 3,
        zeroPad: 3,
      }),
      frameRate: 10,
      repeat: -1,
    });

    const camera = this.cameras.main;
    camera.startFollow(this.player.sprite);
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);



    // Help text that has a "fixed" position on the screen
    this.add
      .text(16, 16, `Arrow keys to move, space to transport\nCurrent town: ${this.video.townFriendlyName} (${this.video.coveyTownID})`, {
        font: '18px monospace',
        color: '#000000',
        padding: {
          x: 20,
          y: 10
        },
        backgroundColor: '#ffffff',
      })
      .setScrollFactor(0)
      .setDepth(30);

    this.ready = true;
    if (this.players.length) {
      // Some players got added to the queue before we were ready, make sure that they have
      // sprites....
      this.players.forEach((p) => this.updatePlayerLocation(p));
    }

  }



  pause() {
    this.paused = true;
    this.previouslyCapturedKeys = this.input.keyboard.getCaptures();
    this.input.keyboard.clearCaptures();
  }

  resume() {
    this.paused = false;
    if(Video.instance()){
      // If the game is also in process of being torn down, the keyboard could be undefined
      this.input.keyboard.addCapture(this.previouslyCapturedKeys);
    }
    this.previouslyCapturedKeys = [];
  }
}




export default function WorldMap(): JSX.Element {
  const video = Video.instance();
  const {

    emitMovement, players,
    // newly added
    placeables, currentTownID, apiClient, sessionToken, myPlayerID
  } = useCoveyAppState();
  const [gameScene, setGameScene] = useState<CoveyGameScene>();


  useEffect(() => {
    const config = {
      type: Phaser.AUTO,
      parent: 'map-container',
      width: 1250,
      height: 600,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 }, // Top down game, so no gravity
        },
      },
      dom: {
        createContainer: true
      }
    };

    const game = new Phaser.Game(config);
    if (video) {
      const newGameScene = new CoveyGameScene(video, emitMovement, apiClient, currentTownID, myPlayerID, sessionToken);

      setGameScene(newGameScene);
      game.scene.add('coveyBoard', newGameScene, true);
      video.pauseGame = () => {
        newGameScene.pause();
      }
      video.unPauseGame = () => {
        newGameScene.resume();
      }
    }
    return () => {
      game.destroy(true);
    };
  }, [video, emitMovement, apiClient, currentTownID, sessionToken, myPlayerID]);

  const deepPlayers = JSON.stringify(players);


  useEffect(() => {

    gameScene?.initialise(apiClient, currentTownID);
    gameScene?.updatePlayersLocations(players);
    if(placeables) {
      gameScene?.updatePlaceables(placeables);
    }

  }, [players, deepPlayers, gameScene, apiClient, currentTownID, placeables]);

  useEffect(() => {
    gameScene?.updatePlaceables(placeables);
  }, [placeables, gameScene]);

  return (

    <div>
      <div id="map-container"/>
      <div id="modal-container"/>
    </div>

  );
}
