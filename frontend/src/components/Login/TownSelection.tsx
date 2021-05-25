import React, { useCallback, useEffect, useState } from 'react';
import { Element } from 'react-scroll'
import assert from "assert";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Table,
  TableCaption,
  Tbody,
  Td,
  Th,
  Image,
  Thead,
  Tr,
  useToast, Divider, Center
} from '@chakra-ui/react';
import useVideoContext from '../VideoCall/VideoFrontend/hooks/useVideoContext/useVideoContext';
import Video from '../../classes/Video/Video';
import { CoveyTownInfo, TownJoinResponse, } from '../../classes/TownsServiceClient';
import useCoveyAppState from '../../hooks/useCoveyAppState';
import Footer from "../Footer/Footer";


interface TownSelectionProps {
  doLogin: (initData: TownJoinResponse) => Promise<boolean>
}

export default function TownSelection({ doLogin }: TownSelectionProps): JSX.Element {
  const [userName, setUserName] = useState<string>(Video.instance()?.userName || '');
  const [newTownName, setNewTownName] = useState<string>('');
  const [newTownIsPublic, setNewTownIsPublic] = useState<boolean>(true);
  const [townIDToJoin, setTownIDToJoin] = useState<string>('');
  const [currentPublicTowns, setCurrentPublicTowns] = useState<CoveyTownInfo[]>();
  const { connect } = useVideoContext();
  const { apiClient } = useCoveyAppState();
  const toast = useToast();


  const updateTownListings = useCallback(() => {
    apiClient.listTowns()
      .then((towns) => {
        setCurrentPublicTowns(towns.towns
          .sort((a, b) => b.currentOccupancy - a.currentOccupancy)
        );
      })
  }, [setCurrentPublicTowns, apiClient]);
  useEffect(() => {
    updateTownListings();
    const timer = setInterval(updateTownListings, 2000);
    return () => {
      clearInterval(timer)
    };
  }, [updateTownListings]);

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleJoin = useCallback(async (coveyRoomID: string) => {
    try {
      if (!userName || userName.length === 0) {
        toast({
          title: 'Unable to join town',
          description: 'Please select a username',
          status: 'error',
        });
        return;
      }
      if (!coveyRoomID || coveyRoomID.length === 0) {
        toast({
          title: 'Unable to join town',
          description: 'Please enter a town ID',
          status: 'error',
        });
        return;
      }
      const initData = await Video.setup(userName, coveyRoomID);

      const loggedIn = await doLogin(initData);
      if (loggedIn) {
        assert(initData.providerVideoToken);
        await connect(initData.providerVideoToken);
      }
    } catch (err) {
      toast({
        title: 'Unable to connect to Towns Service',
        description: err.toString(),
        status: 'error'
      })
    }
  }, [doLogin, userName, connect, toast]);

  const handleCreate = async () => {
    if (!userName || userName.length === 0) {
      toast({
        title: 'Unable to create town',
        description: 'Please select a username before creating a town',
        status: 'error',
      });
      return;
    }
    if (!newTownName || newTownName.length === 0) {
      toast({
        title: 'Unable to create town',
        description: 'Please enter a town name',
        status: 'error',
      });
      return;
    }
    try {

      const newTownInfo = await apiClient.createTown({
        friendlyName: newTownName,
        isPubliclyListed: newTownIsPublic
      });
      let privateMessage = <></>;
      if (!newTownIsPublic) {
        privateMessage =
          <p>This town will NOT be publicly listed. To re-enter it, you will need to use this
            ID: {newTownInfo.coveyTownID}</p>;
      }

      toast({
        title: `Town ${newTownName} is ready to go!`,
        description: <>
          {privateMessage}Please record these values in case you need to change the
          room:<br/>Town ID: {newTownInfo.coveyTownID}
          <br/>Town Editing
          Password: {newTownInfo.coveyTownPassword}
        </>,
        status: 'success',
        isClosable: true,
        duration: null,
      })
      await handleJoin(newTownInfo.coveyTownID);
    } catch (err) {
      toast({
        title: 'Unable to connect to Towns Service',
        description: err.toString(),
        status: 'error'
      })
    }
  };

  return (
    <>
      <Center height="20px">
        <Divider orientation="vertical" />
      </Center>
      <Element id="username" name="username">
        <Flex
          backgroundImage="url('/assets/backgrounds/abstract.png')"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
          align="center"
          justify={{ base: "center", md: "space-around"}}
          direction={{ base: "column-reverse", md: "row" }}
          minH="70vh"
          px={8}
          mb={16}
        >
          <Stack
            spacing={4}
            w={{ base: "80%", md: "40%" }}
            align={["center", "center", "flex-start", "flex-start"]}
          >
            <Heading
              as="h1"
              size="xl"
              fontWeight="bold"
              color="primary.800"
              textAlign={["center", "center", "left", "left"]}
            >
              Select a cool Username!
            </Heading>
            <Heading
              as="h2"
              size="md"
              color="primary.800"
              opacity="0.8"
              fontWeight="normal"
              lineHeight={1.5}
              textAlign={["center", "center", "left", "left"]}
            >
              <FormControl width="200%">
                <FormLabel htmlFor="name" />
                <Input autoFocus name="name" placeholder="Your name"
                       value={userName}
                       background="white"
                       onChange={event => setUserName(event.target.value)}
                />
              </FormControl>
            </Heading>
          </Stack>
          <Box w={{ base: "20%", sm: "10%", md: "20%" }} mb={{ base: 12, md: 0 }}>
            <Image src="https://cdn.pixabay.com/photo/2016/04/15/18/05/computer-1331579_1280.png" size="50%" rounded="1rem" shadow="2xl" />
          </Box>
        </Flex>
      </Element>

      <Element id="create" name="create">
        <Flex
          backgroundImage="url('/assets/backgrounds/sky.jpg')"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
          align="center"
          justify={{ base: "center", md: "space-around"}}
          direction={{ base: "column-reverse", md: "row" }}
          minH="70vh"
          px={8}
          mb={16}
        >
          <Box boxShadow="dark-md" rounded="1rem" w={{ base: "30%", sm: "15%", md: "30%" }} mb={{ base: 12, md: 0 }}>
            <Image src="assets/building.gif" size="80%" rounded="1rem" shadow="2xl" />
          </Box>
          <Stack
            spacing={4}
            w={{ base: "80%", md: "40%" }}
            align={["center", "center", "flex-start", "flex-start"]}
          >
            <Heading
              as="h1"
              size="xl"
              fontWeight="bold"
              color="primary.800"
              textAlign={["center", "center", "left", "left"]}
            >
              Create a new Town!
            </Heading>
            <Heading
              as="h2"
              size="md"
              color="primary.800"
              fontWeight="normal"
              lineHeight={1.5}
              textAlign={["center", "center", "left", "left"]}
            >
              <FormControl width="200%">
                <FormLabel htmlFor="townName" />
                <Input name="townName" placeholder="New Town Name"
                       value={newTownName}
                       background="white"
                       onChange={event => setNewTownName(event.target.value)}
                />
              </FormControl>
              <FormControl>
                &nbsp;
                &nbsp;
                <FormLabel htmlFor="isPublic">Publicly Listed?</FormLabel>
                <Checkbox id="isPublic" name="isPublic" isChecked={newTownIsPublic}
                          onChange={(e) => {
                            setNewTownIsPublic(e.target.checked)
                          }}/>
              </FormControl>
              <Button data-testid="newTownButton" colorScheme="green" variant="solid" onClick={handleCreate}>Create</Button>
            </Heading>
          </Stack>
        </Flex>
      </Element>

      <Element id="join" name="join">
        <Flex
          backgroundImage="url('/assets/backgrounds/abstract.png')"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
          align="center"
          justify={{ base: "center", md: "center"}}
          direction={{ base: "column-reverse", md: "row" }}
          minH="70vh"
          px={8}
          mb={16}
        >
          <Stack
            spacing={8}
            w={{ base: "100%", md: "100%" }}
            align={["center", "center", "center", "center"]}
          >
            <Heading
              as="h1"
              size="xl"
              fontWeight="bold"
              color="primary.800"
              textAlign={["center", "center", "center", "center"]}
            >
              Or join an Existing Town!
            </Heading>
            <Box borderWidth="1px" borderRadius="lg">
              <Flex p="4">
                <FormControl>
                  <FormLabel htmlFor="townIDToJoin" />
                  <Input name="townIDToJoin" placeholder="ID of town to join, or select from the list"
                         value={townIDToJoin}
                         background="white"
                         onChange={event => setTownIDToJoin(event.target.value)}/>
                </FormControl>
                &nbsp;
                &nbsp;
                <Button data-testid='joinTownByIDButton' colorScheme="blue"
                        onClick={() => handleJoin(townIDToJoin)}>Connect</Button>

              </Flex>
              <Heading
                as="h3"
                size="l"
                fontWeight="bold"
                color="primary.800"
                textAlign={["center", "center", "center", "center"]}
              >
                Select a public town to join
              </Heading>
              &nbsp;
              &nbsp;
              <Box w={{ base: "100%", sm: "80%", md: "100%" }} mb={{ base: 120, md: 0 }} maxH="500px" overflowY="scroll">
                <Table rounded="1rem" shadow="2xl">
                  <TableCaption placement="bottom">Publicly Listed Towns</TableCaption>
                  <Thead><Tr><Th>Room Name</Th><Th>Room ID</Th><Th>Activity</Th></Tr></Thead>
                  <Tbody>
                    {currentPublicTowns?.map((town) => (
                      <Tr key={town.coveyTownID}><Td role='cell'>{town.friendlyName}</Td>
                        <Td role='cell'>{town.coveyTownID}</Td>
                        <Td role='cell'>{town.currentOccupancy}/{town.maximumOccupancy} </Td>
                        <Td><Button onClick={() => handleJoin(town.coveyTownID)}
                                    colorScheme="green"
                                    disabled={town.currentOccupancy >= town.maximumOccupancy}>Connect</Button></Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          </Stack>
        </Flex>
      </Element>
      <Footer/>
    </>
  );
}
