import React, { FunctionComponent, useState } from 'react';
import YouTube from 'react-youtube';
import getYoutubeID from "get-youtube-id";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";


export interface ModalProps {
  isShown: boolean;
  hide: () => void;
  modalContent: string;
  headerText: string;
}



export const Youtube: FunctionComponent<ModalProps> = ({
                                                        hide,
                                                        modalContent,
                                                      }) => {
  const [showing, setShowing] = useState<boolean>(true);
  const hiding = () => {
    setShowing(false);
    hide();
  };

  const youtubeById = getYoutubeID(modalContent) || '';
  const [ID] = useState<string>(youtubeById);

  const modal = (
    <Modal isOpen={showing} onClose={hiding} blockScrollOnMount>
      <ModalOverlay />
      <ModalContent maxW="50%" marginLeft="20%" marginTop="50px">
        <ModalCloseButton boxShadow="dark-md" rounded="1rem"
                          w={{ base: "30%", sm: "15%", md: "30%" }}
                          mb={{ base: 12, md: 0 }}
                          style={{color: 'white', background: 'black', width: '40px', height: '30px'}}/>
        <ModalBody isCentered>
          <YouTube videoId={ID} opts={{height:"520", width:'800', playerVars:{autoplay: 1}}}/>;
        </ModalBody>
      </ModalContent>
    </Modal>
  );
  return modal;

}
