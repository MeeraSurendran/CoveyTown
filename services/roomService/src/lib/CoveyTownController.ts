import { customAlphabet, nanoid } from 'nanoid';
import {
  PlaceableInfo,
  PlaceableInputInformation,
  PlaceableLocation,
  PlayerUpdateSpecifications,
  UserLocation,
} from '../CoveyTypes';
import CoveyTownListener from '../types/CoveyTownListener';
import Placeable from '../types/Placeable';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import IVideoClient from './IVideoClient';
import TwilioVideo from './TwilioVideo';

const friendlyNanoID = customAlphabet('1234567890ABCDEF', 8);

/**
 * The CoveyTownController implements the logic for each town: managing the various events that
 * can occur (e.g. joining a town, moving, leaving a town)
 */
export default class CoveyTownController {
  get capacity(): number {
    return this._capacity;
  }

  set isPubliclyListed(value: boolean) {
    this._isPubliclyListed = value;
  }

  get isPubliclyListed(): boolean {
    return this._isPubliclyListed;
  }

  get townUpdatePassword(): string {
    return this._townUpdatePassword;
  }

  get players(): Player[] {
    return this._players;
  }

  get placeables(): Placeable[] {
    return this._placeables;
  }

  get occupancy(): number {
    return this._listeners.length;
  }

  get friendlyName(): string {
    return this._friendlyName;
  }

  set friendlyName(value: string) {
    this._friendlyName = value;
  }

  get coveyTownID(): string {
    return this._coveyTownID;
  }

  /** The list of players currently in the town * */
  private _players: Player[] = [];

  /** The list of valid sessions for this town * */
  private _sessions: PlayerSession[] = [];

  /** The videoClient that this CoveyTown will use to provision video resources * */
  private _videoClient: IVideoClient = TwilioVideo.getInstance();

  /** The list of CoveyTownListeners that are subscribed to events in this town * */
  private _listeners: CoveyTownListener[] = [];

  private readonly _coveyTownID: string;

  private _friendlyName: string;

  private readonly _townUpdatePassword: string;

  private _isPubliclyListed: boolean;

  private _capacity: number;

  private _placeables: Placeable[] = [];

  constructor(friendlyName: string, isPubliclyListed: boolean) {
    this._coveyTownID = process.env.DEMO_TOWN_ID === friendlyName ? friendlyName : friendlyNanoID();
    this._capacity = 50;
    this._townUpdatePassword = nanoid(24);
    this._isPubliclyListed = isPubliclyListed;
    this._friendlyName = friendlyName;
  }

  /**
   * compares two locations by doing deep equality of their xInded and yIndexValues
   * @param location1 the first location
   * @param location2 the second location
   * @returns returns if the two locations are equal
   */
  static compareLocation(location1: PlaceableLocation, location2: PlaceableLocation): unknown {
    return location1.xIndex === location2.xIndex && location1.yIndex === location2.yIndex;
  }

  /**
   * finds the placeable at the given location if there is one
   * @param location the location to look for the placeable at
   * @returns the placeable at the location or undefined if there is not a placeable there
   */
  findPlaceableByLocation(location: PlaceableLocation): Placeable | undefined {
    return this._placeables.find((placeable: Placeable) =>
      CoveyTownController.compareLocation(placeable.location, location),
    );
  }

  /**
   * Adds a player to this Covey Town, provisioning the necessary credentials for the
   * player, and returning them
   *
   * @param newPlayer The new player to add to the town
   */
  async addPlayer(newPlayer: Player): Promise<PlayerSession> {
    const theSession = new PlayerSession(newPlayer);

    this._sessions.push(theSession);
    this._players.push(newPlayer);

    // Create a video token for this user to join this town
    theSession.videoToken = await this._videoClient.getTokenForTown(
      this._coveyTownID,
      newPlayer.id,
    );

    // Notify other players that this player has joined
    this._listeners.forEach(listener => listener.onPlayerJoined(newPlayer));

    return theSession;
  }

  /**
   * Destroys all data related to a player in this town.
   *
   * @param session PlayerSession to destroy
   */
  destroySession(session: PlayerSession): void {
    this._players = this._players.filter(p => p.id !== session.player.id);
    this._sessions = this._sessions.filter(s => s.sessionToken !== session.sessionToken);
    this._listeners.forEach(listener => listener.onPlayerDisconnected(session.player));
  }

  /**
   * Updates the location of a player within the town
   * @param player Player to update location for
   * @param location New location for this player
   */
  updatePlayerLocation(player: Player, location: UserLocation): void {
    player.updateLocation(location);
    this._listeners.forEach(listener => listener.onPlayerMoved(player));
  }

  /**
   * Subscribe to events from this town. Callers should make sure to
   * unsubscribe when they no longer want those events by calling removeTownListener
   *
   * @param listener New listener
   */
  addTownListener(listener: CoveyTownListener): void {
    this._listeners.push(listener);
  }

  /**
   * Unsubscribe from events in this town.
   *
   * @param listener The listener to unsubscribe, must be a listener that was registered
   * with addTownListener, or otherwise will be a no-op
   */
  removeTownListener(listener: CoveyTownListener): void {
    this._listeners = this._listeners.filter(v => v !== listener);
  }

  /**
   * Fetch a player's session based on the provided session token. Returns undefined if the
   * session token is not valid.
   *
   * @param token
   */
  getSessionByToken(token: string): PlayerSession | undefined {
    return this._sessions.find(p => p.sessionToken === token);
  }

  disconnectAllPlayers(): void {
    this._listeners.forEach(listener => listener.onTownDestroyed());
  }

  /**
   * Adds a placeable to this CoveyTown, checking that the player can add placeables and this placeable can be added at this specified location.
   *
   * @param _player the player that made the request to add the placeable
   * @param placeableID the id assocaited of the placeable that is wanting to be added
   * @param location the location the player is wanting to add the placeable
   */
  addPlaceable(
    placeableID: string,
    location: PlaceableLocation,
    placeableInformation?: PlaceableInputInformation,
  ): string | undefined {
    // check that the placeable id given is one that exists
    if (!Placeable.isAllowedPlaceable(placeableID)) {
      // this means that the given ID is not allow
      return 'cannot add:\ngiven id for placeable that does not exist';
    }
    // check that placeable can get added
    const conflictingPlacement: Placeable | undefined = this.findPlaceableByLocation(location);
    if (conflictingPlacement !== undefined) {
      // this means there was a conflict with placement
      return 'cannot add:\nplaceable already exists at specified location';
    }

    // add placeable at that location
    const addedPlaceable = new Placeable(placeableID, location, placeableInformation);
    this._placeables = this._placeables.concat([addedPlaceable]);

    // then for all listeners to this room notify them that an placeable was added
    this._listeners.forEach(listener => {
      listener.onPlaceableAdded(addedPlaceable);
    });
    return undefined;
  }

  /**
   * deltes a placeable form this CoveyTown, checking that the player can delete placeables and this placeable can be added.
   * returns a string that describes why the placeable couldn't be deleted or undefined if it was deleted
   * @param _player the player the made the request to delete the placeable
   * @param location the location the player is wanting to delete the placeable from
   */
  deletePlaceable(location: PlaceableLocation): string | undefined {
    // check that placeable can be deleted from here

    const conflictingPlacement: Placeable | undefined = this.findPlaceableByLocation(location);
    if (conflictingPlacement === undefined) {
      // this means there was nothing to be deleted from here
      return 'cannot delete:\nno placeable to delete at specifed location';
    }

    // removes the placeable from the list of placebles
    this._placeables = this._placeables.filter(
      (placeable: Placeable) => !CoveyTownController.compareLocation(placeable.location, location),
    );

    const placeableNow = Placeable.constructEmptyPlaceable(location);
    // for all listeners notifies them that the object was deleted, with what is now at the location
    this._listeners.forEach(listener => listener.onPlaceableDeleted(placeableNow));

    return undefined;
  }

  getPlaceableAt(location: PlaceableLocation): PlaceableInfo {
    const placeableAtLocation: Placeable | undefined = this.findPlaceableByLocation(location);
    if (placeableAtLocation === undefined) {
      return {
        coveyTownID: this._coveyTownID,
        placeableID: Placeable.EMPTY_PLACEABLE_ID,
        placeableName: Placeable.EMPTY_PLACEABLE_NAME,
        location,
        placeableInformation: Placeable.EMPTY_PLACEABLE_INFO,
      };
    }

    return {
      coveyTownID: this._coveyTownID,
      placeableID: placeableAtLocation.placeableID,
      placeableName: placeableAtLocation.name,
      location: placeableAtLocation.location,
      placeableInformation: placeableAtLocation.placeableInformation,
    };
  }

  private createSetOfMissingOrDuplicated(playersToUpdate: PlayerUpdateSpecifications): string[] {
    const troubleSomeIDs = new Set<string>();
    // set of IDs that have already been see
    const seenIDs = new Set<string>(undefined);
    // checks if there are any player ids missing if so adds them to the list of missing player ids
    playersToUpdate.specifications.forEach(updateSpecification => {
      const { playerID } = updateSpecification;
      // checks if the player id has already been seen
      if (seenIDs.has(playerID)) {
        // if it hasn't adds it to the troublesome ids
        troubleSomeIDs.add(playerID);
      } else {
        // if it hasnt add it to the set of seen IDs
        seenIDs.add(playerID);

        // then check if it appears in the list
        const playerToUpdate = this._players.find(player => player.id === playerID);
        if (!playerToUpdate) {
          troubleSomeIDs.add(playerID);
        }
      }
    });

    return Array.from(troubleSomeIDs);
  }

  updatePlayerPermissions(playersToUpdate: PlayerUpdateSpecifications): string[] {
    // f
    const troubleSomeIDs = this.createSetOfMissingOrDuplicated(playersToUpdate);
    // if there were missing/or duplicated ids return the ids
    if (troubleSomeIDs.length > 0) {
      return troubleSomeIDs;
    }

    // since none of the ids were missing update them
    playersToUpdate.specifications.forEach(updateSpecification => {
      const playerToUpdate = this._players.find(
        player => player.id === updateSpecification.playerID,
      );
      if (playerToUpdate) {
        playerToUpdate.canPlace = updateSpecification.canPlace;
      }
    });
    return [];
  }

  getPlayersPermission(playerID: string): boolean | undefined {
    const requestedPlayer = this.players.find(player => player.id === playerID);
    if (requestedPlayer) {
      return requestedPlayer.canPlace;
    }
    return undefined;
  }
}