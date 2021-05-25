import React from 'react';
import Scroll from 'react-scroll';
import { Divider, VStack, Center, Flex, Box, Spacer, Button, Heading, Text , Image} from '@chakra-ui/react';
import DeviceSelectionScreen from './DeviceSelectionScreen/DeviceSelectionScreen';
import IntroContainer from '../IntroContainer/IntroContainer';
import { TownJoinResponse } from '../../../../../classes/TownsServiceClient';
import TownSelection from '../../../../Login/TownSelection';
import LocationCityIcon from '@material-ui/icons/LocationCity';





export default function PreJoinScreens(props: { doLogin: (initData: TownJoinResponse) => Promise<boolean>; setMediaError?(error: Error): void }) {
  const ScrollLink = Scroll.Link
  // @ts-ignore
  return (
    <IntroContainer>
      <div style={{
        position: "fixed",
        backgroundColor: "white",
        width: "100%",
        opacity: "100%",
        zIndex: 10,
      }}>
        <Flex boxShadow="dark-lg" p="4" width="100%">
          <Image src="logo.png" boxSize="40px" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                ></Image>
          <Button colorScheme="teal" mr="5" variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <b>Covey Town</b>
          </Button>
          <Spacer />
          <Box>
            <ScrollLink
              to="username"
              spy={true}
              smooth={true}
              duration={500}
              className='some-class'
              activeClass='some-active-class'
            >
              <Button colorScheme="teal" mr="4" variant="ghost">
                Enter Username
              </Button>
            </ScrollLink>
            <ScrollLink
              to="create"
              spy={true}
              smooth={true}
              duration={500}
              className='some-class'
              activeClass='some-active-class'
            >
              <Button colorScheme="teal" mr="4" variant="outline">
               Create Town
              </Button>
            </ScrollLink>
            <ScrollLink
              to="join"
              spy={true}
              smooth={true}
              duration={500}
              className='some-class'
              activeClass='some-active-class'
            >
              <Button colorScheme="teal" mr="4" variant="outline">
                Join Town
              </Button>
            </ScrollLink>
          </Box>

        </Flex>
      </div>


      <div>


        <VStack spacing="100px" style={{
          backgroundImage: `url("/assets/town.gif")`
        }}>
          <Center height="30px">
            <Divider orientation="vertical" />
          </Center>
          <Center p="2">
            <Heading as="h2" size="xl" fontSize="56px" color="teal">Welcome to Covey Town!</Heading>
          </Center>
          <Box width="50%">
            <Text fontSize={"20px"} align="center" fontWeight="bold">
              Covey Town is a social platform that integrates a 2D game-like metaphor with video chat.
              To get started, setup your camera and microphone, choose a username, and then create a new town
              to hang out in, or join an existing one.
            </Text>
          </Box>
          <Center height="100px">
            <Divider orientation="vertical" />
          </Center>
        </VStack>


        <Center height="10px">
          <Divider orientation="vertical" />
        </Center>
        <DeviceSelectionScreen setMediaError={props.setMediaError} />
      </div>
      <TownSelection doLogin={props.doLogin} />
    </IntroContainer>
  );
}
