import { randomInt } from 'crypto';
import { nanoid } from 'nanoid';
import { randomPlaceablesFromAllowedPlaceables } from '../client/TestUtils';
import {
  PlaceableInputInformation,
  PlaceableLocation,
  PlayerPermissionSpecification,
} from '../CoveyTypes';
import { PlaceableInfo } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownListener from '../types/CoveyTownListener';
import Placeable from '../types/Placeable';
import Player from '../types/Player';
import CoveyTownController from './CoveyTownController';
import CoveyTownsStore from './CoveyTownsStore';

const mockCoveyListenerTownDestroyed = jest.fn();
const mockCoveyListenerOtherFns = jest.fn();

function mockCoveyListener(): CoveyTownListener {
  return {
    onPlayerDisconnected(removedPlayer: Player): void {
      mockCoveyListenerOtherFns(removedPlayer);
    },
    onPlayerMoved(movedPlayer: Player): void {
      mockCoveyListenerOtherFns(movedPlayer);
    },
    onTownDestroyed() {
      mockCoveyListenerTownDestroyed();
    },
    onPlayerJoined(newPlayer: Player) {
      mockCoveyListenerOtherFns(newPlayer);
    },
    onPlaceableAdded(addedPlaceable: Placeable) {
      mockCoveyListenerOtherFns(addedPlaceable);
    },
    onPlaceableDeleted(deletedPlaceable: Placeable) {
      mockCoveyListenerOtherFns(deletedPlaceable);
    },
  };
}

function createTownForTesting(friendlyNameToUse?: string, isPublic = false) {
  const friendlyName =
    friendlyNameToUse !== undefined
      ? friendlyNameToUse
      : `${isPublic ? 'Public' : 'Private'}TestingTown=${nanoid()}`;
  return CoveyTownsStore.getInstance().createTown(friendlyName, isPublic);
}

describe('CoveyTownsStore', () => {
  beforeEach(() => {
    mockCoveyListenerTownDestroyed.mockClear();
    mockCoveyListenerOtherFns.mockClear();
  });
  it('should be a singleton', () => {
    const store1 = CoveyTownsStore.getInstance();
    const store2 = CoveyTownsStore.getInstance();
    expect(store1).toBe(store2);
  });

  describe('createTown', () => {
    it('Should allow multiple towns with the same friendlyName', () => {
      const firstTown = createTownForTesting();
      const secondTown = createTownForTesting(firstTown.friendlyName);
      expect(firstTown).not.toBe(secondTown);
      expect(firstTown.friendlyName).toBe(secondTown.friendlyName);
      expect(firstTown.coveyTownID).not.toBe(secondTown.coveyTownID);
    });
  });

  describe('getControllerForTown', () => {
    it('Should return the same controller on repeated calls', async () => {
      const firstTown = createTownForTesting();
      expect(firstTown).toBe(
        CoveyTownsStore.getInstance().getControllerForTown(firstTown.coveyTownID),
      );
      expect(firstTown).toBe(
        CoveyTownsStore.getInstance().getControllerForTown(firstTown.coveyTownID),
      );
    });
  });

  describe('updateTown', () => {
    it('Should check the password before updating any value', () => {
      const town = createTownForTesting();
      const { friendlyName } = town;
      const res = CoveyTownsStore.getInstance().updateTown(
        town.coveyTownID,
        'abcd',
        'newName',
        true,
      );
      expect(res).toBe(false);
      expect(town.friendlyName).toBe(friendlyName);
      expect(town.isPubliclyListed).toBe(false);
    });
    it('Should fail if the townID does not exist', async () => {
      const town = createTownForTesting();
      const { friendlyName } = town;

      const res = CoveyTownsStore.getInstance().updateTown(
        'abcdef',
        town.townUpdatePassword,
        'newName',
        true,
      );
      expect(res).toBe(false);
      expect(town.friendlyName).toBe(friendlyName);
      expect(town.isPubliclyListed).toBe(false);
    });
    it('Should update the town parameters', async () => {
      // First try with just a visiblity change
      const town = createTownForTesting();
      const { friendlyName } = town;
      const res = CoveyTownsStore.getInstance().updateTown(
        town.coveyTownID,
        town.townUpdatePassword,
        undefined,
        true,
      );
      expect(res).toBe(true);
      expect(town.isPubliclyListed).toBe(true);
      expect(town.friendlyName).toBe(friendlyName);

      // Now try with just a name change
      const newFriendlyName = nanoid();
      const res2 = CoveyTownsStore.getInstance().updateTown(
        town.coveyTownID,
        town.townUpdatePassword,
        newFriendlyName,
        undefined,
      );
      expect(res2).toBe(true);
      expect(town.isPubliclyListed).toBe(true);
      expect(town.friendlyName).toBe(newFriendlyName);

      // Now try to change both
      const res3 = CoveyTownsStore.getInstance().updateTown(
        town.coveyTownID,
        town.townUpdatePassword,
        friendlyName,
        false,
      );
      expect(res3).toBe(true);
      expect(town.isPubliclyListed).toBe(false);
      expect(town.friendlyName).toBe(friendlyName);
    });
  });

  describe('deleteTown', () => {
    it('Should check the password before deleting the town', () => {
      const town = createTownForTesting();
      const res = CoveyTownsStore.getInstance().deleteTown(
        town.coveyTownID,
        `${town.townUpdatePassword}*`,
      );
      expect(res).toBe(false);
    });
    it('Should fail if the townID does not exist', async () => {
      const res = CoveyTownsStore.getInstance().deleteTown('abcdef', 'efg');
      expect(res).toBe(false);
    });
    it('Should disconnect all players', async () => {
      const town = createTownForTesting();
      town.addTownListener(mockCoveyListener());
      town.addTownListener(mockCoveyListener());
      town.addTownListener(mockCoveyListener());
      town.addTownListener(mockCoveyListener());
      town.disconnectAllPlayers();

      expect(mockCoveyListenerOtherFns.mock.calls.length).toBe(0);
      expect(mockCoveyListenerTownDestroyed.mock.calls.length).toBe(4);
    });
  });

  describe('listTowns', () => {
    it('Should include public towns', async () => {
      const town = createTownForTesting(undefined, true);
      const towns = CoveyTownsStore.getInstance().getTowns();
      const entry = towns.filter(townInfo => townInfo.coveyTownID === town.coveyTownID);
      expect(entry.length).toBe(1);
      expect(entry[0].friendlyName).toBe(town.friendlyName);
      expect(entry[0].coveyTownID).toBe(town.coveyTownID);
    });
    it('Should include each CoveyTownID if there are multiple towns with the same friendlyName', async () => {
      const town = createTownForTesting(undefined, true);
      const secondTown = createTownForTesting(town.friendlyName, true);
      const towns = CoveyTownsStore.getInstance()
        .getTowns()
        .filter(townInfo => townInfo.friendlyName === town.friendlyName);
      expect(towns.length).toBe(2);
      expect(towns[0].friendlyName).toBe(town.friendlyName);
      expect(towns[1].friendlyName).toBe(town.friendlyName);

      if (towns[0].coveyTownID === town.coveyTownID) {
        expect(towns[1].coveyTownID).toBe(secondTown.coveyTownID);
      } else if (towns[1].coveyTownID === town.coveyTownID) {
        expect(towns[0].coveyTownID).toBe(town.coveyTownID);
      } else {
        fail('Expected the coveyTownIDs to match the towns that were created');
      }
    });
    it('Should not include private towns', async () => {
      const town = createTownForTesting(undefined, false);
      const towns = CoveyTownsStore.getInstance()
        .getTowns()
        .filter(
          townInfo =>
            townInfo.friendlyName === town.friendlyName ||
            townInfo.coveyTownID === town.coveyTownID,
        );
      expect(towns.length).toBe(0);
    });
    it('Should not include private towns, even if there is a public town of same name', async () => {
      const town = createTownForTesting(undefined, false);
      const town2 = createTownForTesting(town.friendlyName, true);
      const towns = CoveyTownsStore.getInstance()
        .getTowns()
        .filter(
          townInfo =>
            townInfo.friendlyName === town.friendlyName ||
            townInfo.coveyTownID === town.coveyTownID,
        );
      expect(towns.length).toBe(1);
      expect(towns[0].coveyTownID).toBe(town2.coveyTownID);
      expect(towns[0].friendlyName).toBe(town2.friendlyName);
    });
    it('Should not include deleted towns', async () => {
      const town = createTownForTesting(undefined, true);
      const towns = CoveyTownsStore.getInstance()
        .getTowns()
        .filter(
          townInfo =>
            townInfo.friendlyName === town.friendlyName ||
            townInfo.coveyTownID === town.coveyTownID,
        );
      expect(towns.length).toBe(1);
      const res = CoveyTownsStore.getInstance().deleteTown(
        town.coveyTownID,
        town.townUpdatePassword,
      );
      expect(res).toBe(true);
      const townsPostDelete = CoveyTownsStore.getInstance()
        .getTowns()
        .filter(
          townInfo =>
            townInfo.friendlyName === town.friendlyName ||
            townInfo.coveyTownID === town.coveyTownID,
        );
      expect(townsPostDelete.length).toBe(0);
    });
  });
  describe('placeables', () => {
    let town: CoveyTownController;
    let store: CoveyTownsStore;
    let placeableID: string;
    let location: PlaceableLocation;
    let player: Player;

    beforeEach(() => {
      town = createTownForTesting();
      store = CoveyTownsStore.getInstance();
      player = new Player('test player');
      player.canPlace = true;
      [placeableID] = randomPlaceablesFromAllowedPlaceables();
      const xIndex = randomInt(100);
      const yIndex = randomInt(100);
      location = { xIndex, yIndex };
    });
    describe('addPlaceable', () => {
      it('Should fail if townID does not exist, and pass back error string', async () => {
        const playerSession = await town.addPlayer(player);
        const responce = store.addPlaceable(
          nanoid(),
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(responce).not.toBe(undefined);
        expect(responce?.length).toBeGreaterThan(0);
      });
      it('Should check the password and permission before adding placeable, and pass back error string - player doesnt have permission', async () => {
        const playerSession = await town.addPlayer(player);
        player.canPlace = false;
        const responce = store.addPlaceable(
          town.coveyTownID,
          nanoid(),
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(responce).not.toBe(undefined);
        expect(responce?.length).toBeGreaterThan(0);
      });
      it('Should check the password before adding placeable, and pass back error string - player id does not exist', async () => {
        await town.addPlayer(player);
        const responce = store.addPlaceable(
          town.coveyTownID,
          nanoid(),
          nanoid(),
          placeableID,
          location,
        );
        expect(responce).not.toBe(undefined);
        expect(responce?.length).toBeGreaterThan(0);
      });
      it('Should return undefined on a succesful addition - correct password', async () => {
        const playerSession = await town.addPlayer(player);
        player.canPlace = false;
        const responce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(responce).toBe(undefined);
      });
      it('Should return undefined on a succesful addition - has permission to place', async () => {
        const playerSession = await town.addPlayer(player);
        const responce = store.addPlaceable(
          town.coveyTownID,
          nanoid(),
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(responce).toBe(undefined);
      });
      it('Should fail if there is already a placeable at the given location, and pass back error string', async () => {
        const playerSession = await town.addPlayer(player);
        const firstResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(firstResponce).toBe(undefined);
        const secondResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(secondResponce).not.toBe(undefined);
        expect(secondResponce?.length).toBeGreaterThan(0);
      });
      it('Should fail if given a plaeable Id that does not exist', async () => {
        const playerSession = await town.addPlayer(player);
        const secondResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          nanoid(),
          location,
        );
        expect(secondResponce).not.toBe(undefined);
        expect(secondResponce?.length).toBeGreaterThan(0);
      });
    });
    describe('deletePlaceable', () => {
      it('Should fail if townID does not exist', async () => {
        const playerSession = await town.addPlayer(player);
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const responce = store.deletePlaceable(
          nanoid(),
          town.townUpdatePassword,
          player.id,
          location,
        );
        expect(responce).not.toBe(undefined);
        expect(responce?.length).toBeGreaterThan(0);
      });
      it('Should check the password and permission before deleting placeable - player doesnt have permission', async () => {
        const playerSession = await town.addPlayer(player);
        player.canPlace = false;
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const responce = store.deletePlaceable(town.coveyTownID, nanoid(), player.id, location);
        expect(responce).not.toBe(undefined);
        expect(responce?.length).toBeGreaterThan(0);
      });
      it('Should check the password and permission before deleting placeable - player id doesnt exist', async () => {
        const playerSession = await town.addPlayer(player);
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const responce = store.deletePlaceable(town.coveyTownID, nanoid(), nanoid(), location);
        expect(responce).not.toBe(undefined);
        expect(responce?.length).toBeGreaterThan(0);
      });
      it('Should fail if there is not a placeable at the given location, and pass back error string', async () => {
        const playerSession = await town.addPlayer(player);
        const responce = store.deletePlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          location,
        );
        expect(responce).not.toBe(undefined);
        expect(responce?.length).toBeGreaterThan(0);
      });
      it('Should return undefined on a succesful deletion - correct password', async () => {
        const playerSession = await town.addPlayer(player);
        player.canPlace = false;
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const responce = store.deletePlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          location,
        );
        expect(responce).toBe(undefined);
      });
      it('Should return undefined on a succesful deletion - player has permission', async () => {
        const playerSession = await town.addPlayer(player);
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          nanoid(),
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const responce = store.deletePlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          location,
        );
        expect(responce).toBe(undefined);
      });
      it('Should fail after repeated calls of deletion', async () => {
        const playerSession = await town.addPlayer(player);
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const firstResponce = store.deletePlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          location,
        );
        expect(firstResponce).toBe(undefined);

        const secondResponce = store.deletePlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          location,
        );
        expect(secondResponce).not.toBe(undefined);
        expect(secondResponce?.length).toBeGreaterThan(0);
      });
      it('should not delete any nearby placeables', async () => {
        const playerSession = await town.addPlayer(player);
        player.canPlace = true;
        const addPlaceableMessage = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          location,
        );

        const offSetLocations: PlaceableLocation[] = [];

        // create and add a placeable in each direction nearby to the location being delted
        const posXLocation: PlaceableLocation = {
          xIndex: location.xIndex + 1,
          yIndex: location.yIndex,
        };
        offSetLocations.push(posXLocation);
        const addPlaceableMessagePosX = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          posXLocation,
        );

        const negXLocation: PlaceableLocation = {
          xIndex: location.xIndex - 1,
          yIndex: location.yIndex,
        };
        offSetLocations.push(negXLocation);
        const addPlaceableMessageNegX = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          negXLocation,
        );

        const posYLocation: PlaceableLocation = {
          xIndex: location.xIndex,
          yIndex: location.yIndex + 1,
        };
        offSetLocations.push(posYLocation);
        const addPlaceableMessagePosY = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          posYLocation,
        );

        const negYLocation: PlaceableLocation = {
          xIndex: location.xIndex,
          yIndex: location.yIndex - 1,
        };
        offSetLocations.push(negYLocation);
        const addPlaceableMessageNegY = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          placeableID,
          negYLocation,
        );

        const placeable: Placeable = new Placeable(placeableID, location);
        expect(addPlaceableMessage).toBe(undefined);
        expect(addPlaceableMessagePosX).toBe(undefined);
        expect(addPlaceableMessageNegX).toBe(undefined);
        expect(addPlaceableMessagePosY).toBe(undefined);
        expect(addPlaceableMessageNegY).toBe(undefined);

        // delete the placable at the center
        store.deletePlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          playerSession.sessionToken,
          location,
        );
        // for each nearby location check that it is still there
        offSetLocations.forEach(offsetLocation => {
          const placeablesInfo: PlaceableInfo = {
            coveyTownID: town.coveyTownID,
            placeableID: placeable.placeableID,
            placeableName: placeable.name,
            placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
            location: offsetLocation,
          };
          expect(store.getPlaceable(town.coveyTownID, offsetLocation)).toStrictEqual(
            placeablesInfo,
          );
        });
      });
    });
    describe('getPlaceable', () => {
      let placeableInfo: PlaceableInfo;
      let emptyInfo: PlaceableInfo;
      beforeEach(() => {
        const placeable = new Placeable(placeableID, location);
        placeableInfo = {
          coveyTownID: town.coveyTownID,
          placeableID: placeable.placeableID,
          placeableName: placeable.name,
          location: placeable.location,
          placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
        };
        emptyInfo = {
          coveyTownID: town.coveyTownID,
          placeableID: Placeable.EMPTY_PLACEABLE_ID,
          placeableName: Placeable.EMPTY_PLACEABLE_NAME,
          location,
          placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
        };
      });
      it('Should fail if townID does not exist', async () => {
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const getResponce = store.getPlaceable(nanoid(), location);
        expect(getResponce).toStrictEqual(undefined);
      });
      it('Should return the same placeable that was just added if succesful - undefined input info', async () => {
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const getResponce = store.getPlaceable(town.coveyTownID, location);
        expect(getResponce).toStrictEqual(placeableInfo);
      });
      it('should return the same placeable after a succesful addPlaceable call - given input info', async () => {
        const placeableInputInfo: PlaceableInputInformation = { bannerText: 'test' };
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
          placeableInputInfo,
        );
        expect(addResponce).toStrictEqual(undefined);

        const firstResponce = store.getPlaceable(town.coveyTownID, location);
        const expectedInputPlaceableInfo: PlaceableInfo = {
          placeableName: placeableInfo.placeableName,
          placeableID: placeableInfo.placeableID,
          coveyTownID: placeableInfo.coveyTownID,
          location: placeableInfo.location,
          placeableInformation: placeableInputInfo,
        };
        expect(firstResponce).toStrictEqual(expectedInputPlaceableInfo);
      });
      it('Should return the same placeable on repeated calls with no modifiers called', async () => {
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const firstResponce = store.getPlaceable(town.coveyTownID, location);
        expect(firstResponce).toStrictEqual(placeableInfo);
        const secondResponce = store.getPlaceable(town.coveyTownID, location);
        expect(secondResponce).toStrictEqual(placeableInfo);
        expect(firstResponce).toStrictEqual(secondResponce);
      });
      it('Should return the default placeable if no placable has been added at the location', async () => {
        const getResponce = store.getPlaceable(town.coveyTownID, location);
        expect(getResponce).toStrictEqual(emptyInfo);
      });
      it('Should return the original placeable if a failed added was called', async () => {
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const secondAddResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(secondAddResponce).not.toBe(undefined);

        const getResponce = store.getPlaceable(town.coveyTownID, location);
        expect(getResponce).toStrictEqual(placeableInfo);
      });
      it('Should return the default placeable that was just deleted if succesful', async () => {
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const secondAddResponce = store.deletePlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          location,
        );
        expect(secondAddResponce).toBe(undefined);

        const getResponce = store.getPlaceable(town.coveyTownID, location);
        expect(getResponce).toStrictEqual(emptyInfo);
      });
      it('Should return the original placeable if a failed delete was called - wrong password/player cant place', async () => {
        player.canPlace = false;
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const secondAddResponce = store.deletePlaceable(
          town.coveyTownID,
          nanoid(),
          player.id,
          location,
        );
        expect(secondAddResponce).not.toBe(undefined);

        const getResponce = store.getPlaceable(town.coveyTownID, location);
        expect(getResponce).toStrictEqual(placeableInfo);
      });
      it('Should return the original placeable if a failed delete was called - wrong password/ player id invalid', async () => {
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const secondAddResponce = store.deletePlaceable(
          town.coveyTownID,
          nanoid(),
          nanoid(),
          location,
        );
        expect(secondAddResponce).not.toBe(undefined);

        const getResponce = store.getPlaceable(town.coveyTownID, location);
        expect(getResponce).toStrictEqual(placeableInfo);
      });
      it('Should return the original placeable if a failed delete was called - wrong id', async () => {
        const addResponce = store.addPlaceable(
          town.coveyTownID,
          town.townUpdatePassword,
          player.id,
          placeableID,
          location,
        );
        expect(addResponce).toBe(undefined);

        const secondAddResponce = store.deletePlaceable(
          nanoid(),
          town.townUpdatePassword,
          player.id,
          location,
        );
        expect(secondAddResponce).not.toBe(undefined);

        const getResponce = store.getPlaceable(town.coveyTownID, location);
        expect(getResponce).toStrictEqual(placeableInfo);
      });
    });
  });
  describe('updatePlayerPermissions', () => {
    let town: CoveyTownController;
    let store: CoveyTownsStore;
    let playerOneTrue: Player;
    let playerTwoTrue: Player;
    let playerOneFalse: Player;
    let playerTwoFalse: Player;

    beforeEach(() => {
      town = createTownForTesting();
      store = CoveyTownsStore.getInstance();
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
      town.addPlayer(playerOneTrue);
      town.addPlayer(playerTwoTrue);
      town.addPlayer(playerOneFalse);
      town.addPlayer(playerTwoFalse);
    });
    it('should error if given invalid roomID', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      specifications.push({ playerID: playerOneTrue.id, canPlace: true });
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });
      specifications.push({ playerID: playerTwoFalse.id, canPlace: false });

      const updateResponse = store.updatePlayerPermissions(nanoid(), town.townUpdatePassword, {
        specifications,
      });
      // checks that the request returned an error string (a non empty string)
      expect(typeof updateResponse === 'string');
      expect(updateResponse.length).toBeGreaterThan(0);

      // checks that no values were updated
      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(true);
      expect(playerOneFalse.canPlace).toBe(false);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should error if given invalid password', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      specifications.push({ playerID: playerOneTrue.id, canPlace: true });
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });
      specifications.push({ playerID: playerTwoFalse.id, canPlace: false });

      const updateResponse = store.updatePlayerPermissions(town.coveyTownID, nanoid(), {
        specifications,
      });
      // checks that it returns and error string
      expect(typeof updateResponse === 'string');
      expect(updateResponse.length).toBeGreaterThan(0);

      // checks that no values were updated
      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(true);
      expect(playerOneFalse.canPlace).toBe(false);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should do nothing if given the empty list', async () => {
      const updateResponse = store.updatePlayerPermissions(
        town.coveyTownID,
        town.townUpdatePassword,
        {
          specifications: [],
        },
      );
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

      const updateResponse = store.updatePlayerPermissions(
        town.coveyTownID,
        town.townUpdatePassword,
        { specifications },
      );
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

      const updateResponse = store.updatePlayerPermissions(
        town.coveyTownID,
        town.townUpdatePassword,
        { specifications },
      );
      expect(updateResponse).toStrictEqual([]);

      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(false);
      expect(playerOneFalse.canPlace).toBe(true);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should not updates any values and return missing IDs, if provided with ids that do not exist in the town', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      const sneakyPlayer1: string = nanoid();
      const sneakyPlayer2: string = nanoid();
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: sneakyPlayer1, canPlace: false });
      specifications.push({ playerID: sneakyPlayer2, canPlace: true });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });

      const updateResponse = store.updatePlayerPermissions(
        town.coveyTownID,
        town.townUpdatePassword,
        { specifications },
      );
      expect(updateResponse).toContain(sneakyPlayer1);
      expect(updateResponse).toContain(sneakyPlayer2);
      expect(updateResponse.length).toBe(2);

      // checks that no values were updated
      expect(playerOneTrue.canPlace).toBe(true);
      expect(playerTwoTrue.canPlace).toBe(true);
      expect(playerOneFalse.canPlace).toBe(false);
      expect(playerTwoFalse.canPlace).toBe(false);
    });
    it('should error and not update any values if provided with duplicate IDs, returning a list of all duplicated ids', async () => {
      const specifications: PlayerPermissionSpecification[] = [];
      specifications.push({ playerID: playerTwoTrue.id, canPlace: false });
      specifications.push({ playerID: playerTwoTrue.id, canPlace: true });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });
      specifications.push({ playerID: playerOneFalse.id, canPlace: false });
      specifications.push({ playerID: playerOneFalse.id, canPlace: true });
      specifications.push({ playerID: playerTwoFalse.id, canPlace: false });

      const updateResponse = store.updatePlayerPermissions(
        town.coveyTownID,
        town.townUpdatePassword,
        { specifications },
      );
      expect(updateResponse).toContain(playerOneFalse.id);
      expect(updateResponse).toContain(playerTwoTrue.id);
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
    const store = CoveyTownsStore.getInstance();
    beforeEach(() => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      townController = store.createTown(townName, true);
      // creates two players whos default value is true
      player = new Player('test player');
      player.canPlace = true;
      townController.addPlayer(player);
    });
    it('should return undefined if town id does not exist', async () => {
      player.canPlace = true;
      const getResponce = store.getPlayersPermission(`${townController.coveyTownID}*`, player.id);
      expect(getResponce).toBe(undefined);
    });
    it('should return undefind if the players id does not exist', async () => {
      player.canPlace = true;
      const getResponce = store.getPlayersPermission(townController.coveyTownID, `${player.id}*`);
      expect(getResponce).toBe(undefined);
    });
    it('should return true if the player has permission', async () => {
      player.canPlace = true;
      const getResponce = store.getPlayersPermission(townController.coveyTownID, player.id);
      expect(getResponce).toBe(true);
    });
    it('should return false if the player does not have permission', async () => {
      player.canPlace = false;
      const getResponce = store.getPlayersPermission(townController.coveyTownID, player.id);
      expect(getResponce).toBe(false);
    });
    it('should return the same thing twice in a row if no modifiers are call inbetween - true', async () => {
      player.canPlace = true;
      const firstGetResponce = store.getPlayersPermission(townController.coveyTownID, player.id);
      expect(firstGetResponce).toBe(true);
      const secondGetResponce = store.getPlayersPermission(townController.coveyTownID, player.id);
      expect(secondGetResponce).toBe(true);
      expect(firstGetResponce).toBe(secondGetResponce);
    });
    it('should return the same thing twice in a row if no modifiers are call inbetween - false', async () => {
      player.canPlace = false;
      const firstGetResponce = store.getPlayersPermission(townController.coveyTownID, player.id);
      expect(firstGetResponce).toBe(false);
      const secondGetResponce = store.getPlayersPermission(townController.coveyTownID, player.id);
      expect(secondGetResponce).toBe(false);
      expect(firstGetResponce).toBe(secondGetResponce);
    });
  });
});
