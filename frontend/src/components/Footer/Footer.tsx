import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Divider,
  HStack,
  Image, Link,
  Stack, VStack, Wrap,
} from '@chakra-ui/react'
import * as React from 'react'
import {FaGithub} from "react-icons/fa";
import {Text} from "@chakra-ui/layout";

const Footer: React.FunctionComponent = () => (
  <Box as="footer" role="contentinfo" mx="auto" maxW="100%" py="3" px={{ base: '4', md: '8' }} backgroundColor="#F5F5F5">
    <Stack>
      <Stack direction="row" spacing="4" align="center" justify="space-between">
        <HStack>
          <Image src="logo.png" boxSize="70px"/>
          <h1 style={{fontSize: '50px', color: 'teal'}}>
            <b>Covey Town</b>
          </h1>
        </HStack>
        <VStack>
          <Text fontSize="25px">Meet the Creators</Text>
          <ButtonGroup variant="ghost" color="gray.600">
            <Wrap>
              <Link href="https://www.linkedin.com/in/rahulguin2/" isExternal>
                <Avatar name="Rahul Guin" src="https://scontent-bos3-1.xx.fbcdn.net/v/t1.6435-9/96573108_3245033852201705_3097766989263798272_n.jpg?_nc_cat=104&ccb=1-3&_nc_sid=174925&_nc_ohc=7StTTniEGZAAX8y7glT&_nc_ht=scontent-bos3-1.xx&oh=0d1cebe8f02dbcf99c1c97f95603ae77&oe=609D36A6"/>
              </Link>
              <Link href="https://www.linkedin.com/in/ritvik-vinodkumar/" isExternal>
                <Avatar name="Ritvik Vinodkumar" src="https://scontent-bos3-1.xx.fbcdn.net/v/t1.6435-9/79501954_10221085809636885_5719587705902333952_n.jpg?_nc_cat=106&ccb=1-3&_nc_sid=09cbfe&_nc_ohc=hWI-XfNMOlUAX9vKUiP&_nc_ht=scontent-bos3-1.xx&oh=9de690672fa02a69b0a4c0b8d0208534&oe=609F71B5"/>
              </Link>
              <Link href="https://www.linkedin.com/in/meera-surendran-53bb8819a/" isExternal>
                <Avatar name="Meera Surendran" src="https://media-exp1.licdn.com/dms/image/C4D35AQGXzaf11NKpBg/profile-framedphoto-shrink_800_800/0/1612749399080?e=1618624800&v=beta&t=PzQnHsxCOYvPASMTDHIYC-BBlKWvguv-OnYB-GwLNi0"/>
              </Link>
              <Link href="https://github.com/JJEW22" isExternal>
                <Avatar name="John Wilkins" src="https://media-exp1.licdn.com/dms/image/C4E03AQGpA5LKrg-J-w/profile-displayphoto-shrink_800_800/0/1614640156735?e=1623888000&v=beta&t=XJ3kv_DC453nyALx5HEmnSu1lMRDC9M1ZHZpY255Jso"/>
              </Link>
              <Link href="https://github.com/jon-bell" isExternal>
                <Avatar name="Jonathan Bell" src="https://avatars.githubusercontent.com/u/2130186?v=4"/>
              </Link>
            </Wrap>
          </ButtonGroup>
          <Button width="200px" colorScheme="teal" as="a" href="https://github.com/rahulguin/CoveyTown">
            <FaGithub fontSize="20px" color="white"/>
          </Button>
        </VStack>



      </Stack>
      <Divider orientation="horizontal" style={{marginBottom: '10px'}}/>
      <Text fontSize="sm" alignSelf={{ base: 'center', sm: 'start' }} style={{marginBottom: '40px', marginLeft: '40px'}} >
        &copy; {new Date().getFullYear()} CoveyTown, Inc. All rights reserved.
      </Text>
    </Stack>
  </Box>
);

export default Footer;

