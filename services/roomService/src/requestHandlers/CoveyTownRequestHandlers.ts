import assert from 'assert';
import { Socket } from 'socket.io';
import { PlaceableGetRequest } from '../client/TownsServiceClient';
import {
  CoveyTownList,
  PlaceableLocation,
  PlayerUpdateSpecifications,
  UserLocation,
} from '../CoveyTypes';
import CoveyTownsStore from '../lib/CoveyTownsStore';
import CoveyTownListener from '../types/CoveyTownListener';
import Placeable from '../types/Placeable';
import Player from '../types/Player';

/**
 * The format of a request to join a Town in Covey.Town, as dispatched by the server middleware
 */
export interface TownJoinRequest {
  /** userName of the player that would like to join * */
  userName: string;
  /** ID of the town that the player would like to join * */
  coveyTownID: string;
}

/**
 * The format of a response to join a Town in Covey.Town, as returned by the handler to the server
 * middleware
 */
export interface TownJoinResponse {
  /** Unique ID that represents this player * */
  coveyUserID: string;
  /** Secret token that this player should use to authenticate
   * in future requests to this service * */
  coveySessionToken: string;
  /** Secret token that this player should use to authenticate
   * in future requests to the video service * */
  providerVideoToken: string;
  /** List of players currently in this town * */
  currentPlayers: Player[];
  /** List of placeables currently in this town */
  currentPlaceables: Placeable[];
  /** Friendly name of this town * */
  friendlyName: string;
  /** Is this a private town? * */
  isPubliclyListed: boolean;
}

/**
 * Payload sent by client to create a Town in Covey.Town
 */
export interface TownCreateRequest {
  friendlyName: string;
  isPubliclyListed: boolean;
}

/**
 * Response from the server for a Town create request
 */
export interface TownCreateResponse {
  coveyTownID: string;
  coveyTownPassword: string;
}

/**
 * Response from the server for a Town list request
 */
export interface TownListResponse {
  towns: CoveyTownList;
}

/**
 * Payload sent by the client to delete a Town
 */
export interface TownDeleteRequest {
  coveyTownID: string;
  coveyTownPassword: string;
}

/**
 * Payload sent by the client to update a Town.
 * N.B., JavaScript is terrible, so:
 * if(!isPubliclyListed) -> evaluates to true if the value is false OR undefined, use ===
 */
export interface TownUpdateRequest {
  coveyTownID: string;
  coveyTownPassword: string;
  friendlyName?: string;
  isPubliclyListed?: boolean;
}

/**
 * payload sent by the client to add a placeable to a town
 */
export interface PlaceableAddRequest {
  coveyTownID: string;
  coveyTownPassword: string;
  playerToken: string;
  placeableID: string;
  location: PlaceableLocation,
  placeableInformation?: {
    bannerText?: string
  };
}

export interface PlaceableAddResponse {
  placeableID: string;
  location: PlaceableLocation;
  objectInformation: {
    bannerText: string
  };
}

/**
 * Payload sent by the client to delete a placeable from a town
 */
export interface PlaceableDeleteRequest {
  coveyTownID: string;
  coveyTownPassword: string;
  playersToken: string;
  location: PlaceableLocation;
}

/**
 * Payload sent by the client to retrive placeables from a town
 */
export interface PlaceableListRequest {
  coveyTownID: string;
}

export interface PlaceableInfo {
  coveyTownID: string;
  placeableID: string;
  placeableName: string;
  location: PlaceableLocation;
  placeableInformation?: {
    bannerText?: string
  };
}

/**
 * Payload sent by the client to update players permission to add/delete placeables
 */
export interface PlayerUpdatePermissionsRequest {
  coveyTownID: string;
  coveyTownPassword: string;
  updates: PlayerUpdateSpecifications;
}
/**
 * Payload sent by the client to get if the given player (by ID) has permission to add/delete placeables
 */
export interface PlayerGetPermissionRequest {
  coveyTownID: string;
  playerID: string;
}

/**
 * Responce from the server for a list of placeables
 */
export interface PlaceableListResponce {
  placeables: PlaceableInfo[];
}

/**
 * Envelope that wraps any response from the server
 */
export interface ResponseEnvelope<T> {
  isOK: boolean;
  message?: string;
  response?: T;
}

/**
 * A handler to process a player's request to join a town. The flow is:
 *  1. Client makes a TownJoinRequest, this handler is executed
 *  2. Client uses the sessionToken returned by this handler to make a subscription to the town,
 *  @see townSubscriptionHandler for the code that handles that request.
 *
 * @param requestData an object representing the player's request
 */
export async function townJoinHandler(
  requestData: TownJoinRequest,
): Promise<ResponseEnvelope<TownJoinResponse>> {
  const townsStore = CoveyTownsStore.getInstance();

  const coveyTownController = townsStore.getControllerForTown(requestData.coveyTownID);
  if (!coveyTownController) {
    return {
      isOK: false,
      message: 'Error: No such town',
    };
  }
  const newPlayer = new Player(requestData.userName);
  const newSession = await coveyTownController.addPlayer(newPlayer);
  assert(newSession.videoToken);
  return {
    isOK: true,
    response: {
      coveyUserID: newPlayer.id,
      coveySessionToken: newSession.sessionToken,
      providerVideoToken: newSession.videoToken,
      currentPlayers: coveyTownController.players,
      currentPlaceables: coveyTownController.placeables,
      friendlyName: coveyTownController.friendlyName,
      isPubliclyListed: coveyTownController.isPubliclyListed,
    },
  };
}

export async function townListHandler(): Promise<ResponseEnvelope<TownListResponse>> {
  const townsStore = CoveyTownsStore.getInstance();
  return {
    isOK: true,
    response: { towns: townsStore.getTowns() },
  };
}

export async function townCreateHandler(
  requestData: TownCreateRequest,
): Promise<ResponseEnvelope<TownCreateResponse>> {
  const townsStore = CoveyTownsStore.getInstance();
  if (requestData.friendlyName.length === 0) {
    return {
      isOK: false,
      message: 'FriendlyName must be specified',
    };
  }
  const newTown = townsStore.createTown(requestData.friendlyName, requestData.isPubliclyListed);
  return {
    isOK: true,
    response: {
      coveyTownID: newTown.coveyTownID,
      coveyTownPassword: newTown.townUpdatePassword,
    },
  };
}

export async function townDeleteHandler(
  requestData: TownDeleteRequest,
): Promise<ResponseEnvelope<Record<string, null>>> {
  const townsStore = CoveyTownsStore.getInstance();
  const success = townsStore.deleteTown(requestData.coveyTownID, requestData.coveyTownPassword);
  return {
    isOK: success,
    response: {},
    message: !success
      ? 'Invalid password. Please double check your town update password.'
      : undefined,
  };
}

export async function townUpdateHandler(
  requestData: TownUpdateRequest,
): Promise<ResponseEnvelope<Record<string, null>>> {
  const townsStore = CoveyTownsStore.getInstance();
  const success = townsStore.updateTown(
    requestData.coveyTownID,
    requestData.coveyTownPassword,
    requestData.friendlyName,
    requestData.isPubliclyListed,
  );
  return {
    isOK: success,
    response: {},
    message: !success
      ? 'Invalid password or update values specified. Please double check your town update password.'
      : undefined,
  };
}

export async function addPlaceableHandler(
  requestData: PlaceableAddRequest,
): Promise<ResponseEnvelope<PlaceableInfo>> {
  const townsStore = CoveyTownsStore.getInstance();
  const success = townsStore.addPlaceable(
    requestData.coveyTownID,
    requestData.coveyTownPassword,
    requestData.playerToken,
    requestData.placeableID,
    requestData.location,
    requestData.placeableInformation,
  );
  const placeableAt = townsStore.getPlaceable(requestData.coveyTownID, requestData.location);
  return {
    // if the string is undefined then addPlaceable was sucessful
    isOK: success === undefined,
    // returns the placeable that is at the location (regardless of failure)
    response: placeableAt,
    // the message returned is the message to be recieved about an error (given undefined if the add was successful)
    message: success,
  };
}

export async function deletePlaceableHandler(
  requestData: PlaceableDeleteRequest,
): Promise<ResponseEnvelope<PlaceableInfo>> {

  const townsStore = CoveyTownsStore.getInstance();
  const success = townsStore.deletePlaceable(
    requestData.coveyTownID,
    requestData.coveyTownPassword,
    requestData.playersToken,
    requestData.location,
  );
  const placeableAt = townsStore.getPlaceable(requestData.coveyTownID, requestData.location);
  return {
    // if the string is undefined then deletePlaceable was sucessful
    isOK: !success,
    // returns the placeable that should be located there
    response: placeableAt,
    // the message returned is the message to be recieved
    message: success,
  };
}

export async function getPlaceableHandler(
  requestData: PlaceableGetRequest,
): Promise<ResponseEnvelope<PlaceableInfo>> {
  const townsStore = CoveyTownsStore.getInstance();
  const placeable = townsStore.getPlaceable(requestData.coveyTownID, requestData.location);
  return {
    // if the string is undefined then getPlaceable was unsuccessful
    isOK: placeable !== undefined,
    // returns the placeable that should be located there
    response: placeable,
    // the message returned is the message to be recieved
    message: !placeable ? undefined : 'Invalid town id given',
  };
}

function updatePlayerPermissionsMessage(updateResponce: string | string[]): string | undefined {
  if (typeof updateResponce === 'string') {
    return updateResponce;
  }
  if (updateResponce.length > 0) {
    return 'given player ids that do not exist';
  }
  return undefined;
}
function updatePlayerResponceParser(updateResponce: string | string[]): string[] {
  if (typeof updateResponce === 'string') {
    return [];
  }
  return updateResponce;
}

export async function updatePlayerPermissionsHandler(
  requestData: PlayerUpdatePermissionsRequest,
): Promise<ResponseEnvelope<string[]>> {
  const townsStore = CoveyTownsStore.getInstance();
  const updateResponce = townsStore.updatePlayerPermissions(
    requestData.coveyTownID,
    requestData.coveyTownPassword,
    requestData.updates,
  );
  const message = updatePlayerPermissionsMessage(updateResponce);
  const responceToReturn = updatePlayerResponceParser(updateResponce);
  return {
    // if the message string is undefined then getPlaceable was unsuccessful
    isOK: message === undefined,
    // returns the list of badIDs or the empty list if it is a string
    response: responceToReturn,
    // the message returned is the message to be recieved
    message,
  };
}

export async function getPlayersPermissionHandler(
  requestData: PlayerGetPermissionRequest,
): Promise<ResponseEnvelope<boolean>> {
  const townsStore = CoveyTownsStore.getInstance();
  const getResponce = townsStore.getPlayersPermission(
    requestData.coveyTownID,
    requestData.playerID,
  );
  return {
    // if the responce was undefined then getPlaceable was unsuccessful
    isOK: getResponce !== undefined,
    // return the value placeable if defined
    response: getResponce,
    // error message returned if undefined
    message: getResponce === undefined ? 'Invalid town id or invalid player id given' : undefined,
  };
}

/**
 * An adapter between CoveyTownController's event interface (CoveyTownListener)
 * and the low-level network communication protocol
 *
 * @param socket the Socket object that we will use to communicate with the player
 */
function townSocketAdapter(socket: Socket): CoveyTownListener {
  return {
    onPlayerMoved(movedPlayer: Player) {
      socket.emit('playerMoved', movedPlayer);
    },
    onPlayerDisconnected(removedPlayer: Player) {
      socket.emit('playerDisconnect', removedPlayer);
    },
    onPlayerJoined(newPlayer: Player) {
      socket.emit('newPlayer', newPlayer);
    },
    onTownDestroyed() {
      socket.emit('townClosing');
      socket.disconnect(true);
    },
    onPlaceableAdded(placeable: Placeable) {
      socket.emit('placeableAdded', placeable);
    },
    onPlaceableDeleted(placeable: Placeable) {
      socket.emit('placeableDeleted', placeable);
    },
  };
}

/**
 * A handler to process a remote player's subscription to updates for a town
 *
 * @param socket the Socket object that we will use to communicate with the player
 */
export function townSubscriptionHandler(socket: Socket): void {
  // Parse the client's session token from the connection
  // For each player, the session token should be the same string returned by joinTownHandler
  const { token, coveyTownID } = socket.handshake.auth as { token: string; coveyTownID: string };

  const townController = CoveyTownsStore.getInstance().getControllerForTown(coveyTownID);

  // Retrieve our metadata about this player from the TownController
  const s = townController?.getSessionByToken(token);
  if (!s || !townController) {
    // No valid session exists for this token, hence this client's connection should be terminated
    socket.disconnect(true);
    return;
  }

  // Create an adapter that will translate events from the CoveyTownController into
  // events that the socket protocol knows about
  const listener = townSocketAdapter(socket);
  townController.addTownListener(listener);

  // Register an event listener for the client socket: if the client disconnects,
  // clean up our listener adapter, and then let the CoveyTownController know that the
  // player's session is disconnected
  socket.on('disconnect', () => {
    townController.removeTownListener(listener);
    townController.destroySession(s);
  });

  // Register an event listener for the client socket: if the client updates their
  // location, inform the CoveyTownController
  socket.on('playerMovement', (movementData: UserLocation) => {
    townController.updatePlayerLocation(s.player, movementData);
  });
}