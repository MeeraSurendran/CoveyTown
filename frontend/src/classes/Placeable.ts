export default class Placeable {

  private readonly _placeableID: string;

  private _location: PlaceableLocation;

  private readonly _name: string;

  private _placeableInformation?: {
    bannerText?: string
  };
  

  public sprite?: Phaser.GameObjects.Sprite;

  public label?: Phaser.GameObjects.Text;

  constructor (placeableID: string, placeableName: string, location: PlaceableLocation, placeableInformation?: { bannerText?: string }) {
    this._placeableID = placeableID
    this._location = location
    this._name = placeableName
    this._placeableInformation = placeableInformation
  }

  static fromServerPlaceable(serverPlaceable: ServerPlaceable): Placeable {
    return new Placeable(serverPlaceable._placeableID, serverPlaceable._placeableName, serverPlaceable._location, serverPlaceable._placeableInformation)
  }

  get location(): PlaceableLocation {
    return this._location
  }

  set location(newLocation: PlaceableLocation){
    this._location = newLocation
  }

  get placeableID(): string {
    return this._placeableID
  }

  get name(): string {
    return this._name
  }

  get objectInformation(): { bannerText?: string } | undefined {
    return this._placeableInformation;
  }

  /**

   * compares two locations by doing deep equality of their xInded and yIndex Values

   * @param location1 the first location

   * @param location2 the second location

   * @returns returns if the two locations are equal

   */

  static compareLocation(location1: PlaceableLocation, location2: PlaceableLocation): boolean {

    return location1.xIndex === location2.xIndex && location1.yIndex === location2.yIndex;

  }

}



export type PlaceableLocation = { xIndex: number, yIndex: number }

export type ServerPlaceable = { _townId: string, _placeableID: string, _placeableName: string, _location: PlaceableLocation, _placeableInformation?: { bannerText?: string } }

