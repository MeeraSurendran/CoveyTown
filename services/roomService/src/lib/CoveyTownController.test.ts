import { randomInt } from 'crypto';
import { mock, mockReset } from 'jest-mock-extended';
import { nanoid } from 'nanoid';
import { Socket } from 'socket.io';
import * as TestUtils from '../client/TestUtils';
import { randomPlaceablesFromAllowedPlaceables } from '../client/TestUtils';
import {
  PlaceableInputInformation,
  PlaceableLocation,
  PlayerPermissionSpecification,
  UserLocation,
} from '../CoveyTypes';
import {
  PlaceableInfo,
  townSubscriptionHandler,
} from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownListener from '../types/CoveyTownListener';
import Placeable from '../types/Placeable';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import CoveyTownController from './CoveyTownController';
import CoveyTownsStore from './CoveyTownsStore';
import TwilioVideo from './TwilioVideo';

jest.mock('./TwilioVideo');

const mockGetTokenForTown = jest.fn();
// eslint-disable-next-line
// @ts-ignore it's a mock
TwilioVideo.getInstance = () => ({
  getTokenForTown: mockGetTokenForTown,
});

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

describe('CoveyTownController', () => {
  beforeEach(() => {
    mockGetTokenForTown.mockClear();
  });
  it('constructor should set the friendlyName property', () => {
    // Included in handout
    const townName = `FriendlyNameTest-${nanoid()}`;
    const townController = new CoveyTownController(townName, false);
    expect(townController.friendlyName).toBe(townName);
  });
  describe('addPlayer', () => {
    // Included in handout
    it('should use the coveyTownID and player ID properties when requesting a video token', async () => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      const townController = new CoveyTownController(townName, false);
      const newPlayerSession = await townController.addPlayer(new Player(nanoid()));
      expect(mockGetTokenForTown).toBeCalledTimes(1);
      expect(mockGetTokenForTown).toBeCalledWith(
        townController.coveyTownID,
        newPlayerSession.player.id,
      );
    });
  });
  describe('addPlaceable', () => {
    let townName: string;
    let townController: CoveyTownController;
    let placedLocation: PlaceableLocation;
    let placeableID: string;
    let secondPlaceableID: string;

    beforeEach(async () => {
      townName = `FriendlyNameTest-${nanoid()}`;
      townController = new CoveyTownController(townName, false);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      placedLocation = { xIndex, yIndex };
      [placeableID, secondPlaceableID] = randomPlaceablesFromAllowedPlaceables(2);
    });
    it('should return a failure string when addPlaceable is called where there is already a placeable - different ids', async () => {
      const firstCallReturn = await townController.addPlaceable(placeableID, placedLocation);
      expect(firstCallReturn).toBe(undefined);

      const failedCallReturn = await townController.addPlaceable(secondPlaceableID, placedLocation);
      expect(failedCallReturn).not.toBe(undefined);
      expect(failedCallReturn?.length).toBeGreaterThan(0);
    });

    it('should return a failure string when addPlaceable is called where there is already a placeable - same ids', async () => {
      const firstCallReturn = await townController.addPlaceable(placeableID, placedLocation);
      expect(firstCallReturn).toBe(undefined);

      const failedCallReturn = await townController.addPlaceable(placeableID, placedLocation);
      expect(failedCallReturn).not.toBe(undefined);
      expect(failedCallReturn?.length).toBeGreaterThan(0);
    });
    it('should return a failure string when addPlaceable is called with an id that does not exist', async () => {
      const failedCallReturn = await townController.addPlaceable(nanoid(), placedLocation);
      expect(failedCallReturn).not.toBe(undefined);
      expect(failedCallReturn?.length).toBeGreaterThan(0);
    });
    it('should not change what is there when addPlaceable is called where there is already a placeable', async () => {
      const firstCallReturn = await townController.addPlaceable(placeableID, placedLocation);
      expect(firstCallReturn).toBe(undefined);

      const secondCallReturn = await townController.addPlaceable(secondPlaceableID, placedLocation);
      expect(secondCallReturn).not.toBe(undefined);
      expect(secondCallReturn?.length).toBeGreaterThan(0);

      expect(townController.getPlaceableAt(placedLocation).placeableID).toBe(placeableID);
    });
    it('should return undefined after a successful call to addPlaceable', async () => {
      const firstCallReturn = await townController.addPlaceable(placeableID, placedLocation);
      expect(firstCallReturn).toBe(undefined);
    });
    it('should be able to see the given placeable at the specified location after a successful call to addPlaceable', async () => {
      await townController.addPlaceable(placeableID, placedLocation);
      expect(townController.getPlaceableAt(placedLocation).placeableID).toBe(placeableID);
    });
  });
  describe('deletePlaceable', () => {
    let townName: string;
    let townController: CoveyTownController;
    let player: Player;
    let placedLocation: PlaceableLocation;
    let placeableID: string;

    beforeEach(async () => {
      townName = `FriendlyNameTest-${nanoid()}`;
      townController = new CoveyTownController(townName, false);
      player = new Player('test player');
      await townController.addPlayer(player);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      placedLocation = { xIndex, yIndex };
      [placeableID] = randomPlaceablesFromAllowedPlaceables();
    });
    it('should return a fail string when deletePlaceable is called where there is not a placeable at the given location', async () => {
      const failedCallReturn = await townController.deletePlaceable(placedLocation);
      expect(failedCallReturn).not.toBe(undefined);
      expect(failedCallReturn?.length).toBeGreaterThan(0);
    });
    it('should return undefined after a successful call to deletePlaceable', async () => {
      const addPlaceableMessage = await townController.addPlaceable(placeableID, placedLocation);
      expect(addPlaceableMessage).toBe(undefined);

      const failedCallReturn = townController.deletePlaceable(placedLocation);
      expect(failedCallReturn).toBe(undefined);
    });
    it('should not be able to see a placeable at the specified location after a successful call to deletePlaceable', async () => {
      const addPlaceableMessage = townController.addPlaceable(placeableID, placedLocation);
      expect(addPlaceableMessage).toBe(undefined);

      const defaultPlaceable: PlaceableInfo = {
        coveyTownID: townController.coveyTownID,
        placeableID: Placeable.EMPTY_PLACEABLE_ID,
        placeableName: Placeable.EMPTY_PLACEABLE_NAME,
        placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
        location: placedLocation,
      };
      townController.deletePlaceable(placedLocation);
      expect(townController.getPlaceableAt(placedLocation)).toStrictEqual(defaultPlaceable);
    });
    it('should not delete any nearby placeables', async () => {
      const addPlaceableMessage = townController.addPlaceable(placeableID, placedLocation);

      const offSetLocations: PlaceableLocation[] = [];

      const posXLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex + 1,
        yIndex: placedLocation.yIndex,
      };
      offSetLocations.push(posXLocation);
      const addPlaceableMessagePosX = townController.addPlaceable(placeableID, posXLocation);

      const negXLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex - 1,
        yIndex: placedLocation.yIndex,
      };
      offSetLocations.push(negXLocation);
      const addPlaceableMessageNegX = townController.addPlaceable(placeableID, negXLocation);

      const posYLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex,
        yIndex: placedLocation.yIndex + 1,
      };
      offSetLocations.push(posYLocation);
      const addPlaceableMessagePosY = townController.addPlaceable(placeableID, posYLocation);

      const negYLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex,
        yIndex: placedLocation.yIndex - 1,
      };
      offSetLocations.push(negYLocation);
      const addPlaceableMessageNegY = townController.addPlaceable(placeableID, negYLocation);

      const placeable: Placeable = new Placeable(placeableID, placedLocation);
      expect(addPlaceableMessage).toBe(undefined);
      expect(addPlaceableMessagePosX).toBe(undefined);
      expect(addPlaceableMessageNegX).toBe(undefined);
      expect(addPlaceableMessagePosY).toBe(undefined);
      expect(addPlaceableMessageNegY).toBe(undefined);

      // delete the placable at the center
      townController.deletePlaceable(placedLocation);
      // for each nearby location check that it is still there
      offSetLocations.forEach(offsetLocation => {
        const placeablesInfo: PlaceableInfo = {
          coveyTownID: townController.coveyTownID,
          placeableID: placeable.placeableID,
          placeableName: placeable.name,
          location: offsetLocation,
          placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
        };
        expect(townController.getPlaceableAt(offsetLocation)).toStrictEqual(placeablesInfo);
      });
    });
  });
  describe('getPlaceableAt', () => {
    let townName: string;
    let townController: CoveyTownController;
    let placedLocation: PlaceableLocation;
    let placeableID: string;
    let placeableInfo: PlaceableInfo;
    let emptyInfo: PlaceableInfo;

    beforeEach(async () => {
      townName = `FriendlyNameTest-${nanoid()}`;
      townController = new CoveyTownController(townName, false);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      placedLocation = { xIndex, yIndex };
      [placeableID] = randomPlaceablesFromAllowedPlaceables();
      const placeable = new Placeable(placeableID, placedLocation);
      placeableInfo = {
        coveyTownID: townController.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: placeable.location,
        placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
      };
      emptyInfo = {
        coveyTownID: townController.coveyTownID,
        placeableID: Placeable.EMPTY_PLACEABLE_ID,
        placeableName: Placeable.EMPTY_PLACEABLE_NAME,
        location: placedLocation,
        placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
      };
    });

    it('should return the default placeable info when get is called where there is no placeable', async () => {
      const firstResponce = townController.getPlaceableAt(placedLocation);
      expect(firstResponce).toStrictEqual(emptyInfo);
    });
    it('should return the specific placeable after a succesful addPlaceable call - undefined input info', async () => {
      const addResponce = townController.addPlaceable(placeableID, placedLocation);
      expect(addResponce).toStrictEqual(undefined);

      const firstResponce = townController.getPlaceableAt(placedLocation);
      expect(firstResponce).toStrictEqual(placeableInfo);
    });
    it('should return the specific placeable after a succesful addPlaceable call - given input info', async () => {
      const placeableInputInfo: PlaceableInputInformation = { bannerText: 'test' };
      const addResponce = townController.addPlaceable(
        placeableID,
        placedLocation,
        placeableInputInfo,
      );
      expect(addResponce).toStrictEqual(undefined);

      const firstResponce = townController.getPlaceableAt(placedLocation);
      const expectedInputPlaceableInfo: PlaceableInfo = {
        placeableName: placeableInfo.placeableName,
        placeableID: placeableInfo.placeableID,
        coveyTownID: placeableInfo.coveyTownID,
        location: placeableInfo.location,
        placeableInformation: placeableInputInfo,
      };
      expect(firstResponce).toStrictEqual(expectedInputPlaceableInfo);
    });
    it('should return the same info after successive calls with no modifiers call inbetween', () => {
      const addResponce = townController.addPlaceable(placeableID, placedLocation);
      expect(addResponce).toBe(undefined);

      const firstResponce = townController.getPlaceableAt(placedLocation);
      expect(firstResponce).toStrictEqual(placeableInfo);

      const secondResponce = townController.getPlaceableAt(placedLocation);
      expect(secondResponce).toStrictEqual(placeableInfo);
      expect(firstResponce).toStrictEqual(secondResponce);
    });
    it('Should return the original placeable if a failed added was called', async () => {
      const addResponce = townController.addPlaceable(placeableID, placedLocation);
      expect(addResponce).toBe(undefined);

      const secondAddResponce = townController.addPlaceable(nanoid(), placedLocation);
      expect(secondAddResponce).not.toBe(undefined);

      const getResponce = townController.getPlaceableAt(placedLocation);
      expect(getResponce).toStrictEqual(placeableInfo);
    });
    it('should return the default placeable info after a successful delete', async () => {
      const addResponce = townController.addPlaceable(placeableID, placedLocation);
      expect(addResponce).toBe(undefined);

      const secondAddResponce = townController.deletePlaceable(placedLocation);
      expect(secondAddResponce).toBe(undefined);

      const getResponce = townController.getPlaceableAt(placedLocation);
      expect(getResponce).toStrictEqual(emptyInfo);
    });
  });
  describe('updatePlayerPermissions', () => {
    let townController: CoveyTownController;
    let playerOneTrue: Player;
    let playerTwoTrue: Player;
    let playerOneFalse: Player;
    let playerTwoFalse: Player;
    beforeEach(() => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      townController = new CoveyTownController(townName, false);
      // creates two players whos default value is true
      playerOneTrue = new Player('P1T');
      playerOneTrue.canPlace = true;
      playerTwoTrue = new Player('P2T');
      playerTwoTrue.canPlace = true;
      // creates two players whos default value is false
      playerOneFalse = new Player('P1F');
      playerOneFalse.canPlace = false;
      playerTwoFalse = new Player('P2F');
      playerTwoFalse.canPlace = false;
      //  adds all players to the town
      townController.addPlayer(playerOneTrue);
      townController.addPlayer(playerTwoTrue);
      townController.addPlayer(playerOneFalse);
      townController.addPlayer(playerTwoFalse);
    });
    it('should do nothing if given the empty list', async () => {
      const updateResponse = townController.updatePlayerPermissions({ specifications: [] });
      expect(updateResponse).toStrictEqual([]);

      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(true);
      expect(playerOneFalse.canPlace).toBe(false);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should updates all the players ids that are in the list', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      specifications.push({ playerID: playerOneTrue.id, canPlace: true });
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });
      specifications.push({ playerID: playerTwoFalse.id, canPlace: false });

      const updateResponse = townController.updatePlayerPermissions({ specifications });
      expect(updateResponse).toStrictEqual([]);

      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(false);
      expect(playerOneFalse.canPlace).toBe(true);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should not update any players whose id do not appear in the list', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });

      const updateResponse = townController.updatePlayerPermissions({ specifications });
      expect(updateResponse).toStrictEqual([]);

      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(false);
      expect(playerOneFalse.canPlace).toBe(true);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should return a set (list with no duplcates) of missing ids if given player ids that do not match, and not update any values', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      const sneakyPlayer1: string = nanoid();
      const sneakyPlayer2: string = nanoid();
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: sneakyPlayer1, canPlace: false });
      specifications.push({ playerID: sneakyPlayer2, canPlace: true });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });

      const updateResponse = townController.updatePlayerPermissions({ specifications });
      expect(updateResponse).toContain(sneakyPlayer2);
      expect(updateResponse).toContain(sneakyPlayer1);
      expect(updateResponse.length).toBe(2);

      // checks that no values were updated since there was a player id that did not exist
      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(true);
      expect(playerOneFalse.canPlace).toBe(false);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should error and not update any values if provided with duplicate IDs, returning a set (list with no duplcates) of all duplicated ids', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: playerTwoTrue.id, canPlace: true });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });
      specifications.push({ playerID: playerOneFalse.id, canPlace: false });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });
      specifications.push({ playerID: playerTwoFalse.id, canPlace: false });

      const updateResponse = townController.updatePlayerPermissions({ specifications });
      expect(updateResponse).toContain(playerTwoTrue.id);
      expect(updateResponse).toContain(playerOneFalse.id);
      expect(updateResponse.length).toBe(2);

      // checks that no values were updated
      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(true);
      expect(playerOneFalse.canPlace).toBe(false);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
  });
  describe('getPlayerPermission', () => {
    let townController: CoveyTownController;
    let player: Player;
    beforeEach(() => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      townController = new CoveyTownController(townName, false);
      // creates two players whos default value is true
      player = new Player('test player');
      player.canPlace = true;
      townController.addPlayer(player);
    });
    it('should return undefind if the players id does not exist', async () => {
      player.canPlace = true;
      const getResponce = townController.getPlayersPermission(`${player.id}*`);
      expect(getResponce).toBe(undefined);
    });
    it('should return true if the player has permission', async () => {
      player.canPlace = true;
      const getResponce = townController.getPlayersPermission(player.id);
      expect(getResponce).toBe(true);
    });
    it('should return false if the player does not ahve permission', async () => {
      player.canPlace = false;
      const getResponce = townController.getPlayersPermission(player.id);
      expect(getResponce).toBe(false);
    });
    it('should return the same thing twice in a row if no modifiers are call inbetween - true', async () => {
      player.canPlace = true;
      const firstGetResponce = townController.getPlayersPermission(player.id);
      expect(firstGetResponce).toBe(true);
      const secondGetResponce = townController.getPlayersPermission(player.id);
      expect(secondGetResponce).toBe(true);
      expect(firstGetResponce).toBe(secondGetResponce);
    });
    it('should return the same thing twice in a row if no modifiers are call inbetween - false', async () => {
      player.canPlace = false;
      const firstGetResponce = townController.getPlayersPermission(player.id);
      expect(firstGetResponce).toBe(false);
      const secondGetResponce = townController.getPlayersPermission(player.id);
      expect(secondGetResponce).toBe(false);
      expect(firstGetResponce).toBe(secondGetResponce);
    });
  });
  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(mockReset);
    });
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.destroySession(session);
      mockListeners.forEach(listener =>
        expect(listener.onPlayerDisconnected).toBeCalledWith(player),
      );
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));
    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());
    });
    it('should notify added listeners that a placeable has been added when addPlaceable is called without conflict', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      const [placeableID] = randomPlaceablesFromAllowedPlaceables();

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.addPlaceable(placeableID, { xIndex, yIndex });
      mockListeners.forEach(listener => expect(listener.onPlaceableAdded).toBeCalled());
    });
    it('should not notify added listeners that a placeable has been added when addPlaceable is called with conflict', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      const [placeableID] = randomPlaceablesFromAllowedPlaceables();

      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);

      const addResponce = testingTown.addPlaceable(placeableID, { xIndex, yIndex });
      expect(addResponce).toBe(undefined);
      expect(listenerRemoved.onPlaceableAdded).not.toBeCalled();
    });
    it('should notify added listeners that a placeable has been deleted when deletePlaceable is called without conflict', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      const [placeableID] = randomPlaceablesFromAllowedPlaceables();

      testingTown.addPlaceable(placeableID, { xIndex, yIndex });
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);

      testingTown.deletePlaceable({ xIndex, yIndex });

      expect(listenerRemoved.onPlaceableAdded).not.toBeCalled();
    });
    it('should not notify added listeners that a placeable has been deleted when deletePlaceable is called with conflict', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.deletePlaceable({ xIndex, yIndex });
      mockListeners.forEach(listener => expect(listener.onPlaceableDeleted).not.toBeCalled());
    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();
    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();
    });
    it('should not notify removed listeners of new placeables when addPlaceable is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      const [placeableID] = randomPlaceablesFromAllowedPlaceables();

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.addPlaceable(placeableID, { xIndex, yIndex });
      expect(listenerRemoved.onPlaceableAdded).not.toBeCalled();
    });
    it('should not notify removed listeners of deleted placeables when deletedPlaceable is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      const [placeableID] = randomPlaceablesFromAllowedPlaceables();

      testingTown.addPlaceable(placeableID, { xIndex, yIndex });

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.deletePlaceable({ xIndex, yIndex });
      expect(listenerRemoved.onPlaceableDeleted).not.toBeCalled();
    });
  });
  describe('townSubscriptionHandler', () => {
    const mockSocket = mock<Socket>();
    let testingTown: CoveyTownController;
    let player: Player;
    let session: PlayerSession;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
      mockReset(mockSocket);
      player = new Player('test player');
      session = await testingTown.addPlayer(player);
    });
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', player);
      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
      it('should add a town listener, which should emit "placeableAdded" to the socket when a placeable is added', async () => {
        const [placeableID] = randomPlaceablesFromAllowedPlaceables();
        const location: PlaceableLocation = { xIndex: 5, yIndex: 5 };
        const addedPlaceable = new Placeable(placeableID, location);
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        const addReturn = testingTown.addPlaceable(placeableID, location);
        expect(addReturn).toBe(undefined);
        expect(mockSocket.emit).toBeCalledWith('placeableAdded', addedPlaceable);
      });
      it('should add a town listener, which should emit "deleteAdded" to the socket when a placeable is deleted', async () => {
        const [placeableID] = randomPlaceablesFromAllowedPlaceables();
        const location: PlaceableLocation = { xIndex: 5, yIndex: 5 };
        const emptyPlaceable: Placeable = Placeable.constructEmptyPlaceable(location);
        testingTown.addPlaceable(placeableID, location);
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        const deleteReturn = testingTown.deletePlaceable(location);
        expect(deleteReturn).toBe(undefined);
        expect(mockSocket.emit).toBeCalledWith('placeableDeleted', emptyPlaceable);
      });
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player('should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(
              testingTown.coveyTownID,
              session.sessionToken,
              mockSocket,
            );
            townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }
        });
      });
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'playerMovement',
        );
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith(player);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });
});
