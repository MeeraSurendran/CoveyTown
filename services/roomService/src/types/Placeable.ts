import { PlaceableInputInformation, PlaceableLocation } from '../CoveyTypes';
import { isDefined } from '../Utils';


export default class Placeable {
  private readonly _placeableID: string;

  private _location: PlaceableLocation;

  private readonly _name: string;

  private _placeableInformation?: PlaceableInputInformation;

  static readonly EMPTY_PLACEABLE_ID: string = 'empty';

  static readonly EMPTY_PLACEABLE_NAME: string = 'empty space';

  static readonly EMPTY_PLACEABLE_INFO: PlaceableInputInformation | undefined = undefined;

  static initializeSet(): Set<string> {
    return new Set<string>()
      .add('speaker')
      .add('tree')
      .add('tictactoe')
      .add('flappy')
      .add('banner')
      .add('youtube')
      .add('chess')
      .add('flower');
  }

  static readonly ALLOWED_PLACEABLES: Set<string> = Placeable.initializeSet();

  constructor(
    placeableID: string,
    location: PlaceableLocation,
    placeableInformation?: PlaceableInputInformation,
    _name = 'dummy name',
  ) {
    this._placeableID = placeableID;
    this._location = location;
    this._name = _name;
    if (isDefined(placeableInformation)) {
      this._placeableInformation = placeableInformation;
    } else {
      this._placeableInformation = Placeable.EMPTY_PLACEABLE_INFO;
    }
  }

  get location(): PlaceableLocation {
    return this._location;
  }

  set location(newLocation: PlaceableLocation) {
    this._location = newLocation;
  }

  get placeableID(): string {
    return this._placeableID;
  }

  get placeableInformation(): PlaceableInputInformation | undefined {
    return this._placeableInformation;
  }

  get EMPTY_PLACEABLE_ID(): string {
    return this.EMPTY_PLACEABLE_ID;
  }

  get EMPTY_PLACEABLE_NAME(): string {
    return this.EMPTY_PLACEABLE_NAME;
  }

  get name(): string {
    return this._name;
  }

  static isAllowedPlaceable(placeableID: string): boolean {
    return this.ALLOWED_PLACEABLES.has(placeableID);
  }

  static constructEmptyPlaceable(location: PlaceableLocation): Placeable {
    return new Placeable(
      this.EMPTY_PLACEABLE_ID,
      location,
      this.EMPTY_PLACEABLE_INFO,
      this.EMPTY_PLACEABLE_NAME,
    );
  }
}
