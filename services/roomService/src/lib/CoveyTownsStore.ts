import {
  CoveyTownList,
  PlaceableInfo,
  PlaceableInputInformation,
  PlaceableLocation,
  PlayerUpdateSpecifications,
} from '../CoveyTypes';
import Player from '../types/Player';
import { isDefined } from '../Utils';
import CoveyTownController from './CoveyTownController';

function passwordMatches(provided: string, expected: string): boolean {
  if (provided === expected) {
    return true;
  }
  if (process.env.MASTER_TOWN_PASSWORD && process.env.MASTER_TOWN_PASWORD === provided) {
    return true;
  }
  return false;
}

/**
 * checks that the provided password is correct or that the given player has permission to place
 * @param providedPassword the password to compare
 * @param town the town to check all this information with
 * @param requestingPlayer the player requesting to add a placeable (in the case of undefined just checks if the password is correct)
 * @returns if the password is correct or the player is defined and has permission
 */
function correctPasswordOrPermission(
  providedPassword: string,
  town: CoveyTownController,
  requestingPlayer: Player | undefined,
): boolean {
  const validPassword: boolean = passwordMatches(providedPassword, town.townUpdatePassword);
  const hasPermission: boolean = requestingPlayer?.canPlace || false;
  return validPassword || hasPermission;
}

export default class CoveyTownsStore {
  private static _instance: CoveyTownsStore;

  private _towns: CoveyTownController[] = [];

  static getInstance(): CoveyTownsStore {
    if (CoveyTownsStore._instance === undefined) {
      CoveyTownsStore._instance = new CoveyTownsStore();
    }
    return CoveyTownsStore._instance;
  }

  getControllerForTown(coveyTownID: string): CoveyTownController | undefined {
    return this._towns.find(town => town.coveyTownID === coveyTownID);
  }

  getTowns(): CoveyTownList {
    return this._towns
      .filter(townController => townController.isPubliclyListed)
      .map(townController => ({
        coveyTownID: townController.coveyTownID,
        friendlyName: townController.friendlyName,
        currentOccupancy: townController.occupancy,
        maximumOccupancy: townController.capacity,
      }));
  }

  createTown(friendlyName: string, isPubliclyListed: boolean): CoveyTownController {
    const newTown = new CoveyTownController(friendlyName, isPubliclyListed);
    this._towns.push(newTown);
    return newTown;
  }

  updateTown(
    coveyTownID: string,
    coveyTownPassword: string,
    friendlyName?: string,
    makePublic?: boolean,
  ): boolean {
    const existingTown = this.getControllerForTown(coveyTownID);
    if (existingTown && passwordMatches(coveyTownPassword, existingTown.townUpdatePassword)) {
      if (friendlyName !== undefined) {
        if (friendlyName.length === 0) {
          return false;
        }
        existingTown.friendlyName = friendlyName;
      }
      if (makePublic !== undefined) {
        existingTown.isPubliclyListed = makePublic;
      }
      return true;
    }
    return false;
  }

  deleteTown(coveyTownID: string, coveyTownPassword: string): boolean {
    const existingTown = this.getControllerForTown(coveyTownID);
    if (existingTown && passwordMatches(coveyTownPassword, existingTown.townUpdatePassword)) {
      this._towns = this._towns.filter(town => town !== existingTown);
      existingTown.disconnectAllPlayers();
      return true;
    }
    return false;
  }

  addPlaceable(
    coveyTownID: string,
    coveyTownPassword: string,
    playerSessionToken: string,
    placeableID: string,
    placeableLocation: PlaceableLocation,
    placeableInformation?: PlaceableInputInformation,
  ): string | undefined {
    const existingTown = this.getControllerForTown(coveyTownID);

    // checks that the room exists
    if (existingTown) {
      // checks that the player has permission to add or they have provided a valid password
      const requestionPlayerSession = existingTown.getSessionByToken(playerSessionToken);
      const requestingPlayer = requestionPlayerSession?.player;
      if (correctPasswordOrPermission(coveyTownPassword, existingTown, requestingPlayer)) {
        if (
          !(
            isDefined(placeableLocation) &&
            isDefined(placeableLocation.xIndex) &&
            isDefined(placeableLocation.yIndex)
          )
        ) {
          return 'Invalid Location:\nThe location to add the placeable must be defined.';
        }
        const addResponce = existingTown.addPlaceable(
          placeableID,
          placeableLocation,
          placeableInformation,
        );
        return addResponce;
      }
      return 'Do not have permission:\nAsk someone in the room to give you permission.';
    }
    return 'Invalid room information:\nDouble check that the room exists.';
  }

  deletePlaceable(
    coveyTownID: string,
    coveyTownPassword: string,
    playerSessionToken: string,
    placeableLocation: PlaceableLocation,
  ): string | undefined {
    const existingTown = this.getControllerForTown(coveyTownID);
    // checks the the town id provided exists with a stored town
    if (existingTown) {
      // checks that the player has permission to delete or they have provided a valid passsword
      const requestionPlayerSession = existingTown.getSessionByToken(playerSessionToken);
      const requestingPlayer = requestionPlayerSession?.player;
      if (correctPasswordOrPermission(coveyTownPassword, existingTown, requestingPlayer)) {
        // currently provides a dummy player that can then later be swapped out for permissions funciton
        const deleteResponce = existingTown.deletePlaceable(placeableLocation);
        return deleteResponce;
      }
      return 'Do not have permission:\nAsk someone in the room to give you permission.';
    }
    return 'Invalid room information:\n Double check that the room exists.';
  }

  getPlaceable(
    coveyTownID: string,
    placeableLocation: PlaceableLocation,
  ): PlaceableInfo | undefined {
    const existingTown = this.getControllerForTown(coveyTownID);
    if (existingTown) {
      const deleteResponce = existingTown.getPlaceableAt(placeableLocation);
      return deleteResponce;
    }
    return undefined;
  }

  updatePlayerPermissions(
    coveyTownID: string,
    coveyTownPassword: string,
    updates: PlayerUpdateSpecifications,
  ): string | string[] {
    const existingTown = this.getControllerForTown(coveyTownID);
    if (existingTown) {
      if (passwordMatches(coveyTownPassword, existingTown.townUpdatePassword)) {
        const updateResponce = existingTown.updatePlayerPermissions(updates);
        return updateResponce;
      }
      return 'Incorrect password:\nPlease enter the correct password.';
    }
    return 'Invalid room information:\nDouble check that the room exists.';
  }

  getPlayersPermission(townID: string, playerID: string): boolean | undefined {
    const existingTown = this.getControllerForTown(townID);
    if (existingTown) {
      const getResponce = existingTown.getPlayersPermission(playerID);
      return getResponce;
    }
    return undefined;
  }
}