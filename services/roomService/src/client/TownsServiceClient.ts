import assert from 'assert';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { PlaceableInputInformation, PlayerUpdateSpecifications, UserLocation } from '../CoveyTypes';

export type ServerPlayer = { _id: string; _userName: string; location: UserLocation };

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
  currentPlayers: ServerPlayer[];
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
  towns: CoveyTownInfo[];
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
 * Envelope that wraps any response from the server
 */
export interface ResponseEnvelope<T> {
  isOK: boolean;
  message?: string;
  response?: T;
}

export type CoveyTownInfo = {
  friendlyName: string;
  coveyTownID: string;
  currentOccupancy: number;
  maximumOccupancy: number;
};

/**
 * payload sent by the client to add a placeable to a town
 */
export interface PlaceableAddRequest {
  coveyTownID: string;
  coveyTownPassword: string;
  playersToken: string;
  placeableID: string;
  location: PlaceableLocation;
  placeableInformation?: PlaceableInputInformation;
}

/**
 * Response from the server for a PlaceableAddRequest
 */
export interface PlaceableAddResponse {
  placeableID: string;
  location: PlaceableLocation;
}

/**
 * represents a location on the map based on indecies of tiles
 */
export interface PlaceableLocation {
  xIndex: number;
  yIndex: number;
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

/**
 * Payload sent by the client to retrive a placeable from a specific location in a town
 */
export interface PlaceableGetRequest {
  coveyTownID: string;
  location: PlaceableLocation;
  placeableInformation?: PlaceableInputInformation;
}

export interface PlaceableInfo {
  coveyTownID: string;
  placeableID: string;
  placeableName: string;
  location: PlaceableLocation;
  placeableInformation?: {
    bannerText?: string;
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

export default class TownsServiceClient {
  private _axios: AxiosInstance;

  /**
   * Construct a new Towns Service API client. Specify a serviceURL for testing, or otherwise
   * defaults to the URL at the environmental variable REACT_APP_ROOMS_SERVICE_URL
   * @param serviceURL
   */
  constructor(serviceURL?: string) {
    const baseURL = serviceURL || process.env.REACT_APP_TOWNS_SERVICE_URL;
    assert(baseURL);
    this._axios = axios.create({ baseURL });
  }

  static unwrapOrThrowError<T>(
    response: AxiosResponse<ResponseEnvelope<T>>,
    ignoreResponse = false,
  ): T {
    if (response.data.isOK) {
      if (ignoreResponse) {
        return {} as T;
      }
      assert(response.data.response !== undefined);
      return response.data.response;
    }
    throw new Error(`Error processing request: ${response.data.message}`);
  }

  async createTown(requestData: TownCreateRequest): Promise<TownCreateResponse> {
    const responseWrapper = await this._axios.post<ResponseEnvelope<TownCreateResponse>>(
      '/towns',
      requestData,
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async updateTown(requestData: TownUpdateRequest): Promise<void> {
    const responseWrapper = await this._axios.patch<ResponseEnvelope<void>>(
      `/towns/${requestData.coveyTownID}`,
      requestData,
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper, true);
  }

  async deleteTown(requestData: TownDeleteRequest): Promise<void> {
    const responseWrapper = await this._axios.delete<ResponseEnvelope<void>>(
      `/towns/${requestData.coveyTownID}/${requestData.coveyTownPassword}`,
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper, true);
  }

  async listTowns(): Promise<TownListResponse> {
    const responseWrapper = await this._axios.get<ResponseEnvelope<TownListResponse>>('/towns');
    return TownsServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async joinTown(requestData: TownJoinRequest): Promise<TownJoinResponse> {
    const responseWrapper = await this._axios.post('/sessions', requestData);
    return TownsServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async addPlaceable(requestData: PlaceableAddRequest): Promise<PlaceableInfo> {
    const responseWrapper = await this._axios.post<ResponseEnvelope<PlaceableInfo>>(
      `/placeables/${requestData.coveyTownID}`,
      requestData,
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper, false);
  }

  async deletePlaceable(requestData: PlaceableDeleteRequest): Promise<PlaceableInfo> {
    const responseWrapper = await this._axios.delete<ResponseEnvelope<PlaceableInfo>>(
      `/placeables/${requestData.coveyTownID}`,
      { data: requestData },
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper, false);
  }

  async getPlaceable(requestData: PlaceableGetRequest): Promise<PlaceableInfo> {
    const responseWrapper = await this._axios.get<ResponseEnvelope<PlaceableInfo>>(
      `/placeables/${requestData.coveyTownID}`,
      { data: requestData },
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async updatePlayerPermissions(requestData: PlayerUpdatePermissionsRequest): Promise<string[]> {
    const responseWrapper = await this._axios.post<ResponseEnvelope<string[]>>(
      `/towns/${requestData.coveyTownID}/permissions`,
      requestData,
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async getPlayersPermission(requestData: PlayerGetPermissionRequest): Promise<boolean> {
    const responseWrapper = await this._axios.get<ResponseEnvelope<boolean>>(
      `/towns/${requestData.coveyTownID}/permissions/${requestData.playerID}`,
    );
    return TownsServiceClient.unwrapOrThrowError(responseWrapper);
  }
}