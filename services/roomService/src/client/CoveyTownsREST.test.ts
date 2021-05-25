import assert from 'assert';
import CORS from 'cors';
import { randomInt } from 'crypto';
import Express from 'express';
import http from 'http';
import { nanoid } from 'nanoid';
import { AddressInfo } from 'net';
import { PlaceableInputInformation, PlayerUpdateSpecifications } from '../CoveyTypes';
import addTownRoutes from '../router/towns';
import Placeable from '../types/Placeable';
import { randomPlaceablesFromAllowedPlaceables } from './TestUtils';
import TownsServiceClient, {
  PlaceableInfo,
  PlaceableLocation,
  TownListResponse,
} from './TownsServiceClient';

type TestTownData = {
  friendlyName: string;
  coveyTownID: string;
  isPubliclyListed: boolean;
  townUpdatePassword: string;
};

function expectTownListMatches(towns: TownListResponse, town: TestTownData) {
  const matching = towns.towns.find(townInfo => townInfo.coveyTownID === town.coveyTownID);
  if (town.isPubliclyListed) {
    expect(matching).toBeDefined();
    assert(matching);
    expect(matching.friendlyName).toBe(town.friendlyName);
  } else {
    expect(matching).toBeUndefined();
  }
}

describe('TownsServiceAPIREST', () => {
  let server: http.Server;
  let apiClient: TownsServiceClient;

  async function createTownForTesting(
    friendlyNameToUse?: string,
    isPublic = false,
  ): Promise<TestTownData> {
    const friendlyName =
      friendlyNameToUse !== undefined
        ? friendlyNameToUse
        : `${isPublic ? 'Public' : 'Private'}TestingTown=${nanoid()}`;
    const ret = await apiClient.createTown({
      friendlyName,
      isPubliclyListed: isPublic,
    });
    return {
      friendlyName,
      isPubliclyListed: isPublic,
      coveyTownID: ret.coveyTownID,
      townUpdatePassword: ret.coveyTownPassword,
    };
  }

  type PlayerForTesting = { playerID: string; sessionToken: string };
  async function createPlayerForTesting(
    townID: string,
    playerName: string,
    coveyTownPassword: string | undefined = undefined,
    hasPermission = true,
  ): Promise<PlayerForTesting> {
    const { coveyUserID: playerID, coveySessionToken: sessionToken } = await apiClient.joinTown({
      coveyTownID: townID,
      userName: playerName,
    });
    if (coveyTownPassword) {
      await apiClient.updatePlayerPermissions({
        coveyTownID: townID,
        coveyTownPassword,
        updates: { specifications: [{ playerID, canPlace: hasPermission }] },
      });
      const getResponse = await apiClient.getPlayersPermission({ coveyTownID: townID, playerID });
      expect(getResponse).toBe(hasPermission);
    }

    return { playerID, sessionToken };
  }

  beforeAll(async () => {
    const app = Express();
    app.use(CORS());
    server = http.createServer(app);

    addTownRoutes(server, app);
    await server.listen();
    const address = server.address() as AddressInfo;

    apiClient = new TownsServiceClient(`http://127.0.0.1:${address.port}`);
  });
  afterAll(async () => {
    await server.close();
  });
  describe('CoveyTownCreateAPI', () => {
    it('Allows for multiple towns with the same friendlyName', async () => {
      const firstTown = await createTownForTesting();
      const secondTown = await createTownForTesting(firstTown.friendlyName);
      expect(firstTown.coveyTownID).not.toBe(secondTown.coveyTownID);
    });
    it('Prohibits a blank friendlyName', async () => {
      try {
        await createTownForTesting('');
        fail('createTown should throw an error if friendly name is empty string');
      } catch (err) {
        // OK
      }
    });
  });

  describe('CoveyTownListAPI', () => {
    it('Lists public towns, but not private towns', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      const privTown1 = await createTownForTesting(undefined, false);
      const pubTown2 = await createTownForTesting(undefined, true);
      const privTown2 = await createTownForTesting(undefined, false);

      const towns = await apiClient.listTowns();
      expectTownListMatches(towns, pubTown1);
      expectTownListMatches(towns, pubTown2);
      expectTownListMatches(towns, privTown1);
      expectTownListMatches(towns, privTown2);
    });
    it('Allows for multiple towns with the same friendlyName', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      const privTown1 = await createTownForTesting(pubTown1.friendlyName, false);
      const pubTown2 = await createTownForTesting(pubTown1.friendlyName, true);
      const privTown2 = await createTownForTesting(pubTown1.friendlyName, false);

      const towns = await apiClient.listTowns();
      expectTownListMatches(towns, pubTown1);
      expectTownListMatches(towns, pubTown2);
      expectTownListMatches(towns, privTown1);
      expectTownListMatches(towns, privTown2);
    });
  });

  describe('CoveyTownDeleteAPI', () => {
    it('Throws an error if the password is invalid', async () => {
      const { coveyTownID } = await createTownForTesting(undefined, true);
      try {
        await apiClient.deleteTown({
          coveyTownID,
          coveyTownPassword: nanoid(),
        });
        fail('Expected deleteTown to throw an error');
      } catch (e) {
        // Expected error
      }
    });
    it('Throws an error if the townID is invalid', async () => {
      const { townUpdatePassword } = await createTownForTesting(undefined, true);
      try {
        await apiClient.deleteTown({
          coveyTownID: nanoid(),
          coveyTownPassword: townUpdatePassword,
        });
        fail('Expected deleteTown to throw an error');
      } catch (e) {
        // Expected error
      }
    });
    it('Deletes a town if given a valid password and town, no longer allowing it to be joined or listed', async () => {
      const { coveyTownID, townUpdatePassword } = await createTownForTesting(undefined, true);
      await apiClient.deleteTown({
        coveyTownID,
        coveyTownPassword: townUpdatePassword,
      });
      try {
        await apiClient.joinTown({
          userName: nanoid(),
          coveyTownID,
        });
        fail('Expected joinTown to throw an error');
      } catch (e) {
        // Expected
      }
      const listedTowns = await apiClient.listTowns();
      if (listedTowns.towns.find(r => r.coveyTownID === coveyTownID)) {
        fail('Expected the deleted town to no longer be listed');
      }
    });
  });
  describe('CoveyTownUpdateAPI', () => {
    it('Checks the password before updating any values', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      try {
        await apiClient.updateTown({
          coveyTownID: pubTown1.coveyTownID,
          coveyTownPassword: `${pubTown1.townUpdatePassword}*`,
          friendlyName: 'broken',
          isPubliclyListed: false,
        });
        fail('updateTown with an invalid password should throw an error');
      } catch (err) {
        // err expected
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }

      // Make sure name or vis didn't change
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
    });
    it('Updates the friendlyName and visbility as requested', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      await apiClient.updateTown({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        friendlyName: 'newName',
        isPubliclyListed: true,
      });
      pubTown1.friendlyName = 'newName';
      pubTown1.isPubliclyListed = true;
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
    });
    it('Does not update the visibility if visibility is undefined', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      await apiClient.updateTown({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        friendlyName: 'newName2',
      });
      pubTown1.friendlyName = 'newName2';
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
    });
  });

  describe('CoveyMemberAPI', () => {
    it('Throws an error if the town does not exist', async () => {
      await createTownForTesting(undefined, true);
      try {
        await apiClient.joinTown({
          userName: nanoid(),
          coveyTownID: nanoid(),
        });
        fail('Expected an error to be thrown by joinTown but none thrown');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('Admits a user to a valid public or private town', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      const privTown1 = await createTownForTesting(undefined, false);
      const res = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: pubTown1.coveyTownID,
      });
      expect(res.coveySessionToken).toBeDefined();
      expect(res.coveyUserID).toBeDefined();

      const res2 = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: privTown1.coveyTownID,
      });
      expect(res2.coveySessionToken).toBeDefined();
      expect(res2.coveyUserID).toBeDefined();
    });
  });
  describe('CoveyTownAddPlaceableAPI', () => {
    let placeableID: string;
    let playerName: string;
    beforeEach(() => {
      playerName = `test player ${nanoid()}`;
      [placeableID] = randomPlaceablesFromAllowedPlaceables();
    });

    it('Throws an error if the town does not exist', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      try {
        await apiClient.addPlaceable({
          coveyTownID: nanoid(),
          coveyTownPassword: pubTown1.townUpdatePassword,
          playersToken: sessionToken,
          placeableID,
          location: { xIndex: 0, yIndex: 0 },
        });
        fail('Expected an error to be thrown by addPlaceable when given incorrect id');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('Throws an error if the password is incorrect and player does not have permission', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        playerName,
        pubTown1.townUpdatePassword,
        false,
      );
      try {
        await apiClient.addPlaceable({
          coveyTownPassword: `${pubTown1.townUpdatePassword}*`,
          coveyTownID: pubTown1.coveyTownID,
          playersToken: sessionToken,
          placeableID,
          location: { xIndex: 0, yIndex: 0 },
        });
        fail('Expected an error to be thrown by addPlaceable when given incorrect password');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('Throws an error if the given placeable id is invalid', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      try {
        await apiClient.addPlaceable({
          coveyTownPassword: pubTown1.townUpdatePassword,
          coveyTownID: pubTown1.coveyTownID,
          playersToken: sessionToken,
          placeableID: nanoid(),
          location: { xIndex: 0, yIndex: 0 },
        });
        fail('Expected an error to be thrown by addPlaceable when given incorrect password');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('Returns expected placeableInfo when succesfully added - correct password', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        playerName,
        pubTown1.townUpdatePassword,
        false,
      );
      const placedLocation = { xIndex: 0, yIndex: 0 };
      const placeable: Placeable = new Placeable(placeableID, placedLocation);
      const addResponce: PlaceableInfo = await apiClient.addPlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: placedLocation,
      });
      const placedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: placeable.location,
      };
      expect(addResponce).toStrictEqual(placedInfo);
    });
    it('Returns expected placeableInfo when succesfully added - has permission', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        playerName,
        pubTown1.townUpdatePassword,
        true,
      );
      const placedLocation = { xIndex: 0, yIndex: 0 };
      const placeable: Placeable = new Placeable(placeableID, placedLocation);
      const addResponce: PlaceableInfo = await apiClient.addPlaceable({
        coveyTownPassword: nanoid(),
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: placedLocation,
      });
      const placedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: placeable.location,
      };
      expect(addResponce).toStrictEqual(placedInfo);
    });
    it('Throws an error when addPlacaeable is called at a location that already has a placeable', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      const placedLocation = { xIndex: 0, yIndex: 0 };
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      await apiClient.addPlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: placedLocation,
      });
      try {
        await apiClient.addPlaceable({
          coveyTownPassword: pubTown1.townUpdatePassword,
          coveyTownID: pubTown1.coveyTownID,
          playersToken: sessionToken,
          placeableID: `${placeableID}*`,
          location: placedLocation,
        });
        fail(
          'Expected an error to be thrown by addPlaceable when called where there was already a placeable',
        );
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('allows multiple placeables with the same ID at different locations', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      const firstPlacedLocation = { xIndex: 10, yIndex: 10 };
      const firstPlaceable: Placeable = new Placeable(placeableID, firstPlacedLocation);
      const secondPlacedLocation = { xIndex: 0, yIndex: 0 };
      const secondPlaceable: Placeable = new Placeable(placeableID, secondPlacedLocation);
      const firstAdd = await apiClient.addPlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: firstPlacedLocation,
      });
      const firstPlacedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: firstPlaceable.placeableID,
        placeableName: firstPlaceable.name,
        location: firstPlaceable.location,
      };
      expect(firstAdd).toStrictEqual(firstPlacedInfo);

      const secondAdd = await apiClient.addPlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: secondPlacedLocation,
      });
      const secondPlacedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: secondPlaceable.placeableID,
        placeableName: secondPlaceable.name,
        location: secondPlaceable.location,
      };
      expect(secondAdd).toStrictEqual(secondPlacedInfo);
      expect(firstAdd).not.toStrictEqual(secondPlacedInfo);
    });
  });
  describe('CoveyTownDeletePlaceableAPI', () => {
    let placeableID: string;
    let playerName: string;
    beforeEach(() => {
      [placeableID] = randomPlaceablesFromAllowedPlaceables();
      playerName = `test player-${nanoid()}`;
    });
    it('Throws an error if the town does not exist', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      try {
        await apiClient.deletePlaceable({
          coveyTownPassword: pubTown1.townUpdatePassword,
          coveyTownID: nanoid(),
          playersToken: sessionToken,
          location: { xIndex: 0, yIndex: 0 },
        });
        fail('Expected an error to be thrown by addPlaceable when given incorrect id');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('Throws an error if the password is incorrect and player does not have permission', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        playerName,
        pubTown1.townUpdatePassword,
        false,
      );
      const placedLocation: PlaceableLocation = { xIndex: 0, yIndex: 0 };
      await apiClient.addPlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: placedLocation,
      });
      try {
        await apiClient.deletePlaceable({
          coveyTownPassword: `${pubTown1.townUpdatePassword}*`,
          coveyTownID: pubTown1.coveyTownID,
          playersToken: sessionToken,
          location: placedLocation,
        });
        fail('Expected an error to be thrown by addPlaceable when given incorrect password');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('Should return the empty placeableInfo on successful delete - correct password', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        playerName,
        pubTown1.townUpdatePassword,
        false,
      );
      const placedLocation = { xIndex: 0, yIndex: 0 };
      const placeable: Placeable = new Placeable(placeableID, placedLocation);

      const addResponce: PlaceableInfo = await apiClient.addPlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: placedLocation,
      });
      const placedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: placeable.location,
      };
      expect(addResponce).toStrictEqual(placedInfo);

      const deleteResponce: PlaceableInfo = await apiClient.deletePlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        location: placedLocation,
      });
      const deletedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: Placeable.EMPTY_PLACEABLE_ID,
        placeableName: Placeable.EMPTY_PLACEABLE_NAME,
        location: placeable.location,
      };
      expect(deleteResponce).toStrictEqual(deletedInfo);
    });
    it('Should return the empty placeableInfo on successful delete - player has permission', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        playerName,
        pubTown1.townUpdatePassword,
        true,
      );
      const placedLocation = { xIndex: 0, yIndex: 0 };
      const placeable: Placeable = new Placeable(placeableID, placedLocation);

      const addResponce: PlaceableInfo = await apiClient.addPlaceable({
        coveyTownPassword: pubTown1.townUpdatePassword,
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        placeableID,
        location: placedLocation,
      });
      const placedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: placeable.location,
      };
      expect(addResponce).toStrictEqual(placedInfo);

      const deleteResponce: PlaceableInfo = await apiClient.deletePlaceable({
        coveyTownPassword: nanoid(),
        coveyTownID: pubTown1.coveyTownID,
        playersToken: sessionToken,
        location: placedLocation,
      });
      const deletedInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: Placeable.EMPTY_PLACEABLE_ID,
        placeableName: Placeable.EMPTY_PLACEABLE_NAME,
        location: placeable.location,
      };
      expect(deleteResponce).toStrictEqual(deletedInfo);
    });
    it('should throw an error if there is nothing to delete', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      try {
        await apiClient.deletePlaceable({
          coveyTownPassword: pubTown1.townUpdatePassword,
          coveyTownID: pubTown1.coveyTownID,
          playersToken: sessionToken,
          location: { xIndex: 0, yIndex: 0 },
        });
        fail('Expected an error to be thrown by addPlaceable when given incorrect password');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('should not delete any nearby placeables', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        playerName,
        pubTown1.townUpdatePassword,
        true,
      );
      const placedLocation = { xIndex: 1, yIndex: 1 };
      const placeable: Placeable = new Placeable(placeableID, placedLocation);
      await apiClient.addPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        playersToken: sessionToken,
        placeableID,
        location: placedLocation,
      });

      const offSetLocations: PlaceableLocation[] = [];

      // create and add a placeable in each direction nearby to the location being delted
      const posXLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex + 1,
        yIndex: placedLocation.yIndex,
      };
      offSetLocations.push(posXLocation);
      await apiClient.addPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        playersToken: sessionToken,
        placeableID,
        location: posXLocation,
      });

      const negXLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex - 1,
        yIndex: placedLocation.yIndex,
      };
      offSetLocations.push(negXLocation);
      apiClient.addPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        playersToken: sessionToken,
        placeableID,
        location: negXLocation,
      });

      const posYLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex,
        yIndex: placedLocation.yIndex + 1,
      };
      offSetLocations.push(posYLocation);
      apiClient.addPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        playersToken: sessionToken,
        placeableID,
        location: posYLocation,
      });

      const negYLocation: PlaceableLocation = {
        xIndex: placedLocation.xIndex,
        yIndex: placedLocation.yIndex - 1,
      };
      offSetLocations.push(negYLocation);
      apiClient.addPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        playersToken: sessionToken,
        placeableID,
        location: negYLocation,
      });

      // delete the placable at the center
      await apiClient.deletePlaceable({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        playersToken: sessionToken,
        location: placedLocation,
      });

      // checking nearby placeables
      // checking posX
      let placeableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: posXLocation,
      };
      let getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: posXLocation,
      });
      expect(getResponce).toStrictEqual(placeableInfo);
      // checking negX
      placeableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: negXLocation,
      };
      getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: negXLocation,
      });
      // checking posY
      expect(getResponce).toStrictEqual(placeableInfo);
      placeableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: posYLocation,
      };
      getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: posYLocation,
      });
      expect(getResponce).toStrictEqual(placeableInfo);
      // checking negY
      expect(getResponce).toStrictEqual(placeableInfo);
      placeableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: negYLocation,
      };
      getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: negYLocation,
      });
      expect(getResponce).toStrictEqual(placeableInfo);
    });
  });

  async function addPlaceableToTown(
    town: TestTownData,
    placedLocation: PlaceableLocation,
    sessionToken: string,
    placeableInformation?: PlaceableInputInformation,
  ): Promise<PlaceableInfo> {
    const [placeableID] = randomPlaceablesFromAllowedPlaceables();
    const placeable: Placeable = new Placeable(placeableID, placedLocation);
    await apiClient.addPlaceable({
      coveyTownPassword: town.townUpdatePassword,
      coveyTownID: town.coveyTownID,
      playersToken: sessionToken,
      placeableID,
      location: placedLocation,
      placeableInformation,
    });
    let placedInfo: PlaceableInfo;
    if (placeableInformation) {
      placedInfo = {
        coveyTownID: town.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: placeable.location,
        placeableInformation,
      };
    } else {
      placedInfo = {
        coveyTownID: town.coveyTownID,
        placeableID: placeable.placeableID,
        placeableName: placeable.name,
        location: placeable.location,
      };
    }

    return placedInfo;
  }
  describe('CoveyTownGetPlaceableAPI', () => {
    let playerName: string;
    beforeEach(() => {
      playerName = `test player-${nanoid()}`;
    });
    it('Throws an error if the town does not exist', async () => {
      try {
        await apiClient.getPlaceable({
          coveyTownID: nanoid(),
          location: { xIndex: 0, yIndex: 0 },
        });
        fail('Expected an error to be thrown by addPlaceable when given incorrect id');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('should be able to get placeable info for a public town', async () => {
      const placedLocation: PlaceableLocation = { xIndex: randomInt(100), yIndex: randomInt(100) };
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      const addedPlacableInfo = await addPlaceableToTown(pubTown1, placedLocation, sessionToken);

      const getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });
      expect(getResponce).toStrictEqual(addedPlacableInfo);
    });
    it('should be able to get placeable info for a private town', async () => {
      const placedLocation: PlaceableLocation = { xIndex: randomInt(100), yIndex: randomInt(100) };
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      const addedPlacableInfo = await addPlaceableToTown(pubTown1, placedLocation, sessionToken);

      const getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });
      expect(getResponce).toStrictEqual(addedPlacableInfo);
    });
    it('should be able to get placeable info properly when given input information', async () => {
      const inputInformation: PlaceableInputInformation = { bannerText: 'test' };
      const placedLocation: PlaceableLocation = { xIndex: randomInt(100), yIndex: randomInt(100) };
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      const addedPlacableInfo = await addPlaceableToTown(
        pubTown1,
        placedLocation,
        sessionToken,
        inputInformation,
      );

      const getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });
      expect(getResponce).toStrictEqual(addedPlacableInfo);
    });
    it('should return the default placeable if nothing has been added there', async () => {
      const placedLocation: PlaceableLocation = { xIndex: randomInt(100), yIndex: randomInt(100) };
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const emptyPlaceableInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: Placeable.EMPTY_PLACEABLE_ID,
        placeableName: Placeable.EMPTY_PLACEABLE_NAME,
        location: placedLocation,
      };

      const getResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });
      expect(getResponce).toStrictEqual(emptyPlaceableInfo);
    });
    it('should return the default placeable after a sucessful delete', async () => {
      const placedLocation: PlaceableLocation = { xIndex: randomInt(100), yIndex: randomInt(100) };
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      const addedPlacableInfo = await addPlaceableToTown(pubTown1, placedLocation, sessionToken);

      const firstGetResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });
      expect(firstGetResponce).toStrictEqual(addedPlacableInfo);

      await apiClient.deletePlaceable({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        playersToken: sessionToken,
        location: placedLocation,
      });

      const secondGetResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });

      const emptyPlaceableInfo: PlaceableInfo = {
        coveyTownID: pubTown1.coveyTownID,
        placeableID: Placeable.EMPTY_PLACEABLE_ID,
        placeableName: Placeable.EMPTY_PLACEABLE_NAME,
        location: placedLocation,
      };

      expect(secondGetResponce).toStrictEqual(emptyPlaceableInfo);
    });
    it('should return the same thing after repeated calls with no modifiers called inbetween', async () => {
      const placedLocation: PlaceableLocation = { xIndex: randomInt(100), yIndex: randomInt(100) };
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { sessionToken } = await createPlayerForTesting(pubTown1.coveyTownID, playerName);
      const addedPlacableInfo = await addPlaceableToTown(pubTown1, placedLocation, sessionToken);

      const firstGetResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });
      expect(firstGetResponce).toStrictEqual(addedPlacableInfo);

      const secondGetResponce = await apiClient.getPlaceable({
        coveyTownID: pubTown1.coveyTownID,
        location: placedLocation,
      });

      expect(secondGetResponce).toStrictEqual(addedPlacableInfo);
      expect(secondGetResponce).toStrictEqual(firstGetResponce);
    });
  });
  describe('apiClientUpdatePlayerPermissions', () => {
    /**
     * helper function used to find if players have the correct permissions
     * @param townID the town id to check for the permissions in
     * @param expectedPermissions a list of playerID and canPlace to check against
     */
    async function checkCorrectPermissions(
      townID: string,
      expectedPermissions: PlayerUpdateSpecifications,
    ): Promise<void> {
      expectedPermissions.specifications.forEach(async specification => {
        const playersPermission = await apiClient.getPlayersPermission({
          coveyTownID: townID,
          playerID: specification.playerID,
        });
        expect(playersPermission).toBe(specification.canPlace);
      });
    }
    /**
     * sets all the given players (associated with the id) permission to be true for the town
     * @param townID the id of the town to set the playerIDs true in
     * @param townPassword the password of the town inorder to be able to set them equal
     * @param playerIDs the list of player ids that should be set to true
     */
    async function setAllPermissionsTrue(
      townID: string,
      townPassword: string,
      playerIDs: string[],
    ): Promise<void> {
      const permissions: PlayerUpdateSpecifications = { specifications: [] };
      playerIDs.forEach(playerID => {
        permissions.specifications.push({ playerID, canPlace: true });
      });
      await apiClient.updatePlayerPermissions({
        coveyTownID: townID,
        coveyTownPassword: townPassword,
        updates: permissions,
      });
      await checkCorrectPermissions(townID, permissions);
    }
    let firstPlayer: string;
    let secondPlayer: string;
    beforeEach(() => {
      firstPlayer = `test player1-${nanoid()}`;
      secondPlayer = `test player2=${nanoid()}`;
    });
    it('should error if given invalid town ID', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, firstPlayer);
      await setAllPermissionsTrue(pubTown1.coveyTownID, pubTown1.townUpdatePassword, [playerID]);
      let permissions: PlayerUpdateSpecifications = {
        specifications: [{ playerID, canPlace: true }],
      };
      try {
        await apiClient.updatePlayerPermissions({
          coveyTownID: `${pubTown1.coveyTownID}*`,
          coveyTownPassword: pubTown1.townUpdatePassword,
          updates: permissions,
        });
        fail('should have error for incorrect townID');
      } catch (err) {
        permissions = {
          specifications: [{ playerID, canPlace: true }],
        };
        // check that no permissions were change
        await checkCorrectPermissions(pubTown1.coveyTownID, permissions);
      }
    });
    it('should error if given invalid password', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, firstPlayer);
      await setAllPermissionsTrue(pubTown1.coveyTownID, pubTown1.townUpdatePassword, [playerID]);
      let permissions: PlayerUpdateSpecifications = {
        specifications: [{ playerID, canPlace: true }],
      };
      try {
        await apiClient.updatePlayerPermissions({
          coveyTownID: pubTown1.coveyTownID,
          coveyTownPassword: `${pubTown1.townUpdatePassword}*`,
          updates: permissions,
        });
        fail('should have error for incorrect password');
      } catch (err) {
        permissions = {
          specifications: [{ playerID, canPlace: true }],
        };
        // check that no permissions were change
        await checkCorrectPermissions(pubTown1.coveyTownID, permissions);
      }
    });
    it('should do nothing if given the empty list', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, firstPlayer);
      await setAllPermissionsTrue(pubTown1.coveyTownID, pubTown1.townUpdatePassword, [playerID]);
      let permissions: PlayerUpdateSpecifications = {
        specifications: [],
      };
      await apiClient.updatePlayerPermissions({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        updates: permissions,
      });
      permissions = {
        specifications: [{ playerID, canPlace: true }],
      };
      // check that no permissions were change
      await checkCorrectPermissions(pubTown1.coveyTownID, permissions);
    });
    it('should update all the players ids that are in the list', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID: firstPlayerID } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        firstPlayer,
      );
      const { playerID: secondPlayerID } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        secondPlayer,
      );
      const permissions: PlayerUpdateSpecifications = {
        specifications: [
          { playerID: firstPlayerID, canPlace: true },
          { playerID: secondPlayerID, canPlace: false },
        ],
      };
      const updateResponce = await apiClient.updatePlayerPermissions({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        updates: permissions,
      });
      // check that there were no ids returned as not existing (should get caught by error but double checking)
      expect(updateResponce).toStrictEqual([]);
      // check that the players values are now as expected
      await checkCorrectPermissions(pubTown1.coveyTownID, permissions);
    });
    it('should not update any players whose id do not appear in the list', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID: firstPlayerID } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        firstPlayer,
      );
      const { playerID: secondPlayerID } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        secondPlayer,
      );
      // sets the values so it is known what it was before the update
      await setAllPermissionsTrue(pubTown1.coveyTownID, pubTown1.townUpdatePassword, [
        firstPlayerID,
        secondPlayerID,
      ]);
      // check that the players values are now as expected

      let permissions = {
        specifications: [{ playerID: firstPlayerID, canPlace: false }],
      };
      await apiClient.updatePlayerPermissions({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        updates: permissions,
      });
      permissions = {
        specifications: [
          { playerID: firstPlayerID, canPlace: false },
          { playerID: secondPlayerID, canPlace: true },
        ],
      };
      // check that the players values are now as expected
      await checkCorrectPermissions(pubTown1.coveyTownID, permissions);
    });
    it('should error if given a player id that does not exist', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID: firstPlayerID } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        firstPlayer,
      );
      const { playerID: secondPlayerID } = await createPlayerForTesting(
        pubTown1.coveyTownID,
        secondPlayer,
      );
      await setAllPermissionsTrue(pubTown1.coveyTownID, pubTown1.townUpdatePassword, [
        firstPlayerID,
        secondPlayerID,
      ]);
      // sets the values so it is known what it was before the update
      let permissions: PlayerUpdateSpecifications = {
        specifications: [
          { playerID: firstPlayerID, canPlace: false },
          { playerID: secondPlayerID, canPlace: true },
          { playerID: nanoid(), canPlace: true },
        ],
      };
      try {
        await apiClient.updatePlayerPermissions({
          coveyTownID: pubTown1.coveyTownID,
          coveyTownPassword: pubTown1.townUpdatePassword,
          updates: permissions,
        });
      } catch (err) {
        permissions = {
          specifications: [
            { playerID: firstPlayerID, canPlace: true },
            { playerID: secondPlayerID, canPlace: true },
          ],
        };
        // check that no permissions were changed
        await checkCorrectPermissions(pubTown1.coveyTownID, permissions);
      }
    });
  });
  describe('apiClientGetPlayersPermission', () => {
    async function setPlayerPermission(
      townID: string,
      townPassword: string,
      playerID: string,
      canPlace: boolean,
    ) {
      // sets the values so it is known what it was before the update
      const permissions: PlayerUpdateSpecifications = {
        specifications: [{ playerID, canPlace }],
      };
      await apiClient.updatePlayerPermissions({
        coveyTownID: townID,
        coveyTownPassword: townPassword,
        updates: permissions,
      });
    }
    let player: string;
    beforeEach(() => {
      player = `test player-${nanoid()}`;
    });
    it('should error if given town id does not exist', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, player);
      // sets the values so it is known what it was before the update
      setPlayerPermission(pubTown1.coveyTownID, pubTown1.townUpdatePassword, playerID, true);
      try {
        await apiClient.getPlayersPermission({
          coveyTownID: `${pubTown1.coveyTownID}*`,
          playerID,
        });
        fail('should have thrown an error for an incorrect townID');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('should throw an error if given a player ID that does not exist', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, player);
      await setPlayerPermission(pubTown1.coveyTownID, pubTown1.townUpdatePassword, playerID, true);
      try {
        await apiClient.getPlayersPermission({
          coveyTownID: pubTown1.coveyTownID,
          playerID: `${playerID}*`,
        });
        fail('should have thrown an error for a bad player id');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('should return true for a player whose permission that is true', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, player);
      await setPlayerPermission(pubTown1.coveyTownID, pubTown1.townUpdatePassword, playerID, true);
      const getResponce = await apiClient.getPlayersPermission({
        coveyTownID: pubTown1.coveyTownID,
        playerID,
      });
      expect(getResponce).toBe(true);
    });
    it('should return false for a player whose permission that is false', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, player);
      await setPlayerPermission(pubTown1.coveyTownID, pubTown1.townUpdatePassword, playerID, false);
      const getResponce = await apiClient.getPlayersPermission({
        coveyTownID: pubTown1.coveyTownID,
        playerID,
      });
      expect(getResponce).toBe(false);
    });
    it('should return the same value twice for a player with no modifiers called inbetween - true', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, player);
      await setPlayerPermission(pubTown1.coveyTownID, pubTown1.townUpdatePassword, playerID, true);
      const firstGetResponce = await apiClient.getPlayersPermission({
        coveyTownID: pubTown1.coveyTownID,
        playerID,
      });
      expect(firstGetResponce).toBe(true);
      const secondGetResponce = await apiClient.getPlayersPermission({
        coveyTownID: pubTown1.coveyTownID,
        playerID,
      });
      expect(secondGetResponce).toBe(true);
      expect(firstGetResponce).toBe(secondGetResponce);
    });
    it('should return the same value twice for a player with no modifiers called inbetween - false', async () => {
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const { playerID } = await createPlayerForTesting(pubTown1.coveyTownID, player);
      await setPlayerPermission(pubTown1.coveyTownID, pubTown1.townUpdatePassword, playerID, false);
      const firstGetResponce = await apiClient.getPlayersPermission({
        coveyTownID: pubTown1.coveyTownID,
        playerID,
      });
      expect(firstGetResponce).toBe(false);
      const secondGetResponce = await apiClient.getPlayersPermission({
        coveyTownID: pubTown1.coveyTownID,
        playerID,
      });
      expect(secondGetResponce).toBe(false);
      expect(firstGetResponce).toBe(secondGetResponce);
    });
  });
});
