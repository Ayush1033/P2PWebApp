const socket = io("http://localhost:5000");

let peerConnection;
let dataChannel;
let roomId;

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

function joinRoom() {
  roomId = document.getElementById("roomInput").value;
  socket.emit("join-room", roomId);
}

socket.on("peer-joined", async () => {
  createPeerConnection(true);
});

socket.on("offer", async (offer) => {
  createPeerConnection(false);
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on("ice-candidate", async (candidate) => {
  await peerConnection.addIceCandidate(candidate);
});

function createPeerConnection(isCaller) {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { roomId, candidate: event.candidate });
    }
  };

  if (isCaller) {
    dataChannel = peerConnection.createDataChannel("chat");
    setupDataChannel();

    peerConnection.createOffer().then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    });
  } else {
    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel();
    };
  }
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    console.log("Data channel open");
  };

  dataChannel.onmessage = (event) => {
    addMessage("Peer: " + event.data);
  };
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value;
  dataChannel.send(message);
  addMessage("You: " + message);
  input.value = "";
}

function addMessage(msg) {
  const chat = document.getElementById("chat");
  chat.innerHTML += `<div>${msg}</div>`;
}