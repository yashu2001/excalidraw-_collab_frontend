// core react imports
import React, { useRef, useState } from "react";
// Excalidraw imports
import Excalidraw from "@excalidraw/excalidraw";
// Socket imports
import ActionCable from "actioncable";
import { reconcileElements } from "./reconcilation";
// Util imports
export default function App() {
  const boardRef = useRef(null);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [roomJoined, setRoomJoined] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);
  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [theme, setTheme] = useState("light");
  const [excalidrawElements, setExcalidrawElements] = useState("[]");
  const [appState, setAppState] = useState({});
  const [collaborators, setCollaborators] = useState({});
  let wsConsumer = ActionCable.createConsumer("ws://192.168.29.20:5000/cable");
  // Handlers
  const handleOnChange = (elements, state) => {
    console.log("change detected from excalidraw");
    const nonDeletedElements = elements.filter(
      (element) => element.isDeleted === false
    );
    setAppState(state);
    console.log({ excalidrawElements, pendingEl: state.pendingImageElement });
    if (excalidrawElements !== JSON.stringify(nonDeletedElements)) {
      console.log("setting timeout");
      console.log("sending websocket update");
      wsConnection.perform("speak", {
        payload: { type: "elements", elements },
        room_id: roomId,
        user: userName,
      });
      setExcalidrawElements(JSON.stringify(nonDeletedElements));
    }
  };
  const reconcileAndUpdate = (remoteElements) => {
    console.log("remote update received");
    let updatedElements = reconcileElements(
      boardRef.current.getSceneElementsIncludingDeleted(),
      remoteElements,
      boardRef.current.getAppState()
    );
    boardRef.current.updateScene({
      elements: updatedElements,
      commitToHistory: false,
    });
    boardRef.current.history.clear();
  };
  const updatePointerLocations = (state) => {
    let collabUser = {};
    if (collaborators.hasOwnProperty(state.user)) {
      collabUser = { ...collaborators[state.user] };
    }
    collabUser.pointer = state.payload.pointer;
    collabUser.button = state.payload.button;
    collabUser.selectedElementIds = state.payload.selectedElementIds;
    collabUser.username = state.user;
    let collabObj={...collaborators,[state.user]:collabUser}
    setCollaborators(collabObj);
    console.log({collabObj,collabUser})
    let collaboratorMap=new Map(Object.entries(collabObj))
    boardRef.current.updateScene({collaborators:collaboratorMap})
  };
  const joinRoomHandler = () => {
    let conn = wsConsumer.subscriptions.create(
      { channel: "RoomChannel", room_id: roomId },
      {
        received: (state) => {
          console.log({ state, userName, bool: state.user === userName });
          if (state.user !== userName) {
            if (
              state.payload.type === "elements" &&
              JSON.stringify(state.payload) !== excalidrawElements
            ) {
              reconcileAndUpdate(state.payload.elements);
            } else if (state.payload.type === "pointer") {
              console.log("updating pointer locaitons")
              updatePointerLocations(state);
            }
          }
        },
      }
    );
    setWsConnection(conn);
    setRoomJoined(true);
  };
  const handlePointerUpdate = (pointerPayload) => {
    wsConnection.perform("speak", {
      payload: {
        type: "pointer",
        pointer: pointerPayload.pointer,
        button: pointerPayload.button,
        selectedElementIds: boardRef.current.getAppState().selectedElementIds,
      },
      room_id: roomId,
      user: userName,
    });
  };
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      {roomJoined ? (
        <Excalidraw
          initialData={{}}
          ref={boardRef}
          onChange={handleOnChange}
          onPointerUpdate={handlePointerUpdate}
          onCollabButtonClick={null}
          // onCollabButtonClick={() => window.alert("You clicked on collab button")}
          viewModeEnabled={viewModeEnabled}
          zenModeEnabled={zenModeEnabled}
          gridModeEnabled={gridModeEnabled}
          theme={theme}
          // name="Custom name of drawing"
          renderTopRightUI={() => {}}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              changeViewBackgroundColor: false,
              theme: false,
              export: false,
              image: false,
              saveAsImage: false,
              saveToActiveFile: false,
              clearCanvas: false,
            },
          }}
        />
      ) : (
        <>
          <label style={{ display: "block" }}>Room ID</label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ display: "block" }}
          />
          <label style={{ display: "block" }}>User name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            style={{ display: "block" }}
          />
          <button onClick={joinRoomHandler} style={{ display: "block" }}>
            Join room
          </button>
        </>
      )}
    </div>
  );
}
