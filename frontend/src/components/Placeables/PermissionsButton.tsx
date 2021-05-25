import { Button, Checkbox, FormControl, FormLabel, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Table, Tbody, Td, Th, Thead, Tr, useDisclosure, useToast } from "@chakra-ui/react";
import { MenuItem, Typography } from "@material-ui/core";
import React, { useCallback, useEffect, useState } from "react";
import Player from "../../classes/Player";
import { PlayerPermissionSpecification, PlayerUpdateSpecifications } from "../../classes/TownsServiceClient";
import useCoveyAppState from "../../hooks/useCoveyAppState";
import useMaybeVideo from "../../hooks/useMaybeVideo";
import '../../App.css';

export default function PermissionsButton(): JSX.Element {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const video = useMaybeVideo()
  const { players, apiClient, currentTownID } = useCoveyAppState();
  const [roomUpdatePassword, setRoomUpdatePassword] = useState<string>('');
  const [currentPlayers, setCurrentPlayers] = useState<Player[]>([]);
  const [currentPlayersCanPlace, setPlayersCanPlace] = useState<Map<string, boolean>>(new Map<string, boolean>());
  const toast = useToast();



  const openPermissions = useCallback(async ()=>{
    async function updatePlayersCanPlace(playersOnOpen: Player[]): Promise<void> {
      playersOnOpen.forEach(async (player) => {
        const thisPlayerCanPlace = await apiClient.getPlayersPermission({ coveyTownID: currentTownID, playerID: player.id });
        currentPlayersCanPlace.set(player.id, thisPlayerCanPlace);
      });
    }
    await updatePlayersCanPlace(currentPlayers)
    video?.pauseGame();
    onOpen();
  }, [apiClient, currentPlayers, currentTownID, onOpen, video, currentPlayersCanPlace]);

  const closePermissions = useCallback(()=>{
    onClose();
    video?.unPauseGame();
  }, [onClose, video]);

  const processUpdates = async (action: string) =>{
    if(action === 'submit'){
      const updates: PlayerUpdateSpecifications = { specifications: []}
      currentPlayersCanPlace?.forEach((value: boolean, key: string) => {
        const playersPermission: PlayerPermissionSpecification =  { playerID: key, canPlace: value };
        updates.specifications.push(playersPermission);
      })

      try{
        await apiClient.updatePlayerPermissions({coveyTownID: currentTownID, coveyTownPassword: roomUpdatePassword,
          updates });
        toast({
          title: 'Player\'s permissions sucessfully updated',
          status: 'success'
        })
        closePermissions();
      } catch(err) {
        toast({
          title: 'Unable to update players permissions',
          description: err.toString(),
          status: 'error'
        });
      }
    }
  };

  useEffect(() => {
    setCurrentPlayers(players)
  }, [players]);

  useEffect(() => {
    async function updatePlayersCanPlace(playersOnOpen: Player[]): Promise<void> {
      const updatePlayerPermissions = new Map<string, boolean>();
      playersOnOpen.forEach(async (player) => {
        const thisPlayerCanPlace = await apiClient.getPlayersPermission({ coveyTownID: currentTownID, playerID: player.id });
        updatePlayerPermissions.set(player.id, thisPlayerCanPlace);
      });
      setPlayersCanPlace(updatePlayerPermissions);
    }
    updatePlayersCanPlace(currentPlayers);
  }, [apiClient, currentPlayers, currentTownID]);

return (
<>
  <MenuItem data-testid='openPermissionsMenuButton' onClick={openPermissions}>
    <Typography variant="body1">Player Permissions</Typography>
  </MenuItem>

  <Modal isOpen={isOpen} onClose={closePermissions}>
  <ModalOverlay/>
  <ModalContent>
    <ModalHeader>Player Permissions</ModalHeader>
    <ModalCloseButton/>
    <form onSubmit={(ev)=>{ev.preventDefault(); processUpdates('submit')}}>
      <ModalBody pb={6}>
      <FormControl isRequired>
          <FormLabel htmlFor="updatePassword">Town Update Password</FormLabel>
          <Input data-testid="updatePassword" id="updatePassword" placeholder="Password" name="password" type="password" value={roomUpdatePassword} onChange={(e)=>setRoomUpdatePassword(e.target.value)} />
      </FormControl>

      <Table>
        <Thead><Tr><Th>Player Name</Th><Th>player ID</Th><Th>can place</Th></Tr></Thead>
        <Tbody>
            {currentPlayers?.map((player) => (
            <Tr key={player.id}><Td role='cell'>{player.userName}</Td><Td
                        role='cell'>{player.id}</Td>
                        <Td role='cell'>
                        <Checkbox defaultChecked={currentPlayersCanPlace.get(player.id)} onChange={(e) => setPlayersCanPlace(currentPlayersCanPlace.set(player.id, e.target.checked))} spacing="1rem" />
                        </Td>
            </Tr>
        ))}
        </Tbody>
      </Table>
      </ModalBody>

      <ModalFooter>
        <Button data-testid='updatebutton' colorScheme="blue" mr={3} value="submit" name='action2' onClick={()=>processUpdates('submit')}>
          Submit
        </Button>
        <Button onClick={closePermissions}>Cancel</Button>
      </ModalFooter>
    </form>
  </ModalContent>
  </Modal>
</>
)

}
