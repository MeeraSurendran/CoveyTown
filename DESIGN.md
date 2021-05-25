# Changes to Back-End

In order to support both our Placeables and Permissions features we made many changes and additions to the back-end code.

## Towns

Added a list of placeables to the townController to allow each town to have a reference to all the placeables that have been created in it.
It represents the definitive list of all placeables that a room has.
Placeables are current assumed to be unique based on position (since they are currently both stationary and no two placeables can occupy the same location)
and so reference to specific placeables are found from their location.
This feature could be changed by assigning placeables all a unique ID to allow for potential future advancement

## Placeables class

We created a placeable class that represents a placeable object in the town.
This class currently stores information that the placeable needs to know
placeableID, name, townID, InputInformation, and location
and has defined constants of how to represent the empty Placeable (what is assumed to be in every tile there is currently nothing)

This class was designed in a way to be easily extendable both in functionality and fields.

## Players

In order to support permissions players now have an added field 'canPlace' that is used to store if a specific player canPlace or delete placeables.
We hope this design of making permissions part of the players themselves will make it easy to both track and extend. 

Track: once a programmer has a reference to the player on the backend they will already have a reference to all of those players permissions <br />
Extend: such as wanting a permission to updateTown could be added as well.

# New API Methods

## addPlaceable

**Path**: POST /placeables/:townID <br />
**Data**: placeableID, location, inputInformation, townPassword, playerSessionToken <br />
**Description**: Adds the placeable (created fromt the provided information) to the town with the given townID. Is only sucessful if either the player provides the correct password associated with that town or provides a sessionToken that references a player that has permissions to add placeables in that town.
Will return a fail status if there is already a placeable in the town at the provided location

## deletePlaceable

**Path**: DELETE /placeables/:townID <br />
**Data**: location, townPassword, playerSessionToken <br />
**Description**: Adds the placeable from the provided location with in the the town associated with the given townID. Is only sucessful if either the player provides the correct password associated with that town or provides a sessionToken that references a player that has permissions to add placeables in that town.
Will return a fail status if there is nothing to delete in the town at the provided location

## getPlaceable

**Path**: GET /placeables/:townID <br />
**Data**: location <br />
**Description**: Get the information of the placeable in the town associated with the provided id at the given location.
If there is no placeable at the provided location it will return the information assocaited with the empty placable at that location

## getPlayersPermission

**Path**: GET /towns/:townID/permissions/:playerID <br />
**Description**: Gets if the provided player (from playerID) in the provided town (from townID) has permissions to add/delete Placables.
Will return a fail status if there the there is no town or associated with the given townID or playerID respectively.

## updatePlayerPermissions

**Path**: POST /towns/:townID/permissions <br />
**Data**: list of tuples of playerIDs and booleans, townPassword <br />
**Description**: Updates if all players provides have the permission to add/delete placeables, if their id is provided with a false they will not have permission and if provided with true they will have permission.
Will return a fail status and not update any values if:

- There is no town associated with the provided id
- The password provided does not match the update password of the town
- A players ID is duplicated in the list
- The list contains a players ID that does not exist in the town

# Sockets

Two sockets emits have been created for placeables that are both sent from the server to all players:

## placeableAdded

A socket connection sent from the sever to every player when a placeable has successfully been added - including the player that made the request to add.
Contains the information of the placeable that was just added so players can add them

## placeableDeleted

A socket connection sent from the sever to every player when a placeable has successfully been deleted - including the player that made the request to add.
Contains the information of where the placeable was deleted from so players can remove the placeable they have at that location.

# CRC Cards for back-end changes

Class | State | Responsibility | Collaborators
| :---: | :---: | :---: | :---:
PlayerSession  | _player, _sessionToken, _videoToken | Represents the connection of a player to a town. Stores the secret tokens that this player uses to access resources in the town. | Player, CoveyTownController
Placeable  | _placeableID, _location, _name, EMPTY_PLACEABLE_ID, EMPTY_PLACEABLE_NAME, ALLOWED_PLACEABLES | Represents the objects that can be added by a player to a town. Stores the secret tokens that this player uses to access resources in the town. | CoveyTownController,CoveyTownListener, CoveyTownRequestHandlers
Player  | location, _id, _userName, _canPlace | Represents the user who is connected to a player object. Initialises the player with location, id and username and permission to delete/add object. | PlayerSession, CoveyTownListener, CoveyTownRequestHandlers, CoveyTownController
CoveyTownListener  | None | Defines a listener in each town. Updates when a player joins, moves or disconnects the town, when a placeable is added to the town, placeable is deleted or when the town is destroyed. | Player,Placeable CoveyTownRequestHandlers, CoveyTownController
CoveyTownController  | players, sessions, videoClient, listeners, _instance | Implements the logic of each town such as joining of a player into the town, moving from the location and leaving a town, object addition, object deletion, updating player permission to add/ delete objects. | CoveyTownListener,Player, PlayerSession, TwilioVideo, IVideoClient, CoverTownsStore, Placeable
townJoinHandler  | newPlayers, newSession, coveyTownController | Process a player's request to join a town. Returns a sessionToken that is used by the client to make subscription to the town. | CoverTownController, Player, TownJoinRequest,town, Placeable, PlayerSession
addPlaceableHandler  | None | Process a player's request to add objects to a town. Returns a sessionToken that is used by the client to add objects to the town. | CoverTownRequestHandlers,  town
deletePlaceableHandler  | None | Process a player's request to delete objects on a town. Returns a sessionToken that is used by the client to add objects to the town. | CoverTownRequestHandlers,  town
getPlaceableHandler  | None | Process a player's request to get the object details on a town. Returns a sessionToken that is used by the client. | CoverTownRequestHandlers,  town
updatePlayerPermissionsHandler  | None | Process a player's request to get permissions for the addition or deletion of objects in a town. Returns a sessionToken that is used by the client. | CoverTownRequestHandlers,  town
townSubscriptionHandler  | newPlayers, newSession, coveyTownController | Process a remote player's subscription to updates for a town. | CoverTownController,  town
IVideoClient  | None | Authorize a client to connect to a video town. | CoverTownController

# Changes to Front-End

In order to display both our Placeables and Permissions features we made many changes and additions to the front-end code.

## coveyAppState

The following fields are now being stored in the coveyAppState:
- placeables - Stores the list of placeables that have been placed in the current room.
- currentTownID - Stores the townID of the room we are currently in.
- apiClient - An object of TownServiceClient that provides the service calls used. The API calls for adding and deleting are used inside CoveyGameScene
- sessionToken 

## WorldMap

Significant changes were made to WorldMap to provide the Placeables feature:
- WorldMap:
  - Changes to useEffect so that the placeables can be updated for all players in the room.
  - A new div 'modal-container' that is used for rendering the placeable modals.
  - Changes to the width of the game map.
- CoveyGameScene: 
  - create: Updated to call the method placeableAddition, which displays the menu for creating a placeable.
  - updatePlaceables: Method that creates the sprite objects for all placeables.
  - preload: Loads the assets required for displaying placeables.

## PermissionsButton

This component was created to display the Permissions button. This component is being rendered in the MenuBar component, so that it displays alongside the Town Settings and A/V Settings buttons. Clicking on the Permissions button opens up a Chakra UI Modal with options for entering password and changing player's permissions.  

## Placeable Images

All images used for displaying placeables are stored in public/assets/placeable.

## Placable Components

We have created a React Component for each interactive placeable object (No component has been created for Tree and Flowers). They have all been implemented as Modals that get rendered on clicking the appropriate button in the game scene.
- Banner
- Chess
- FlappyBird
- TicTacToe
- Youtube

## Visual Changes

Significant changes have made to the look-and-feel of the entire application. The first thing you would notice is that the landing page has been significantly altered, but with the same functionality as before. Additionally, minor changes were made for the display inside the room as well (menubar fixed on top and the town map is centered). The following components were altered to achieve this:
 - App
 - VideoOverlay
 - MenuBar
 - PreJoinScreens
 - DeviceSelectionScreen
