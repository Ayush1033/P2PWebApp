const socket = io("http://localhost:5000");

let peerConnection;
let dataChannel;
let roomId;
let username;

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

let typingTimeout;

// ---------------- STATUS ----------------
function updateStatus(state){
  const status = document.getElementById("status");

  if(state === "connected"){
    status.innerText = "Connected";
    status.className = "badge bg-success";
  }

  if(state === "connecting"){
    status.innerText = "Connecting...";
    status.className = "badge bg-warning";
  }

  if(state === "disconnected"){
    status.innerText = "Disconnected";
    status.className = "badge bg-danger";
  }
}

// ---------------- JOIN ROOM ----------------
function joinRoom() {

  username = document.getElementById("usernameInput").value || "User";
  roomId = document.getElementById("roomInput").value;

  if(!roomId){
    alert("Enter Room ID");
    return;
  }

  updateStatus("connecting");

  socket.emit("join-room", roomId);
}

// ---------------- SOCKET EVENTS ----------------
socket.on("peer-joined", () => {
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
  if(candidate){
    await peerConnection.addIceCandidate(candidate);
  }
});

socket.on("peer-left", () => {
  updateStatus("disconnected");

  document.getElementById("typingIndicator").innerText = "";

  if(dataChannel){
    dataChannel.close();
  }
});

socket.on("room-full", () => {
  alert("Room is full (only 2 users allowed)");
  updateStatus("disconnected");
});

// ---------------- WEBRTC ----------------
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

// ---------------- DATA CHANNEL ----------------
function setupDataChannel() {

  dataChannel.onopen = () => {
    console.log("Data channel open");
    updateStatus("connected");
  };

  dataChannel.onclose = () => {
    console.log("Peer disconnected");
    updateStatus("disconnected");
  };

  dataChannel.onmessage = (event) => {

    const data = JSON.parse(event.data);

    if(data.type === "message"){
      addMessage(data.username, data.text, "peer");
    }

    if(data.type === "typing"){
      showTyping(data.username);
    }

    if(data.type === "file"){
      receiveFile(data);
    }

  };
}

// ---------------- SEND MESSAGE ----------------
function sendMessage(){

  if(!dataChannel || dataChannel.readyState !== "open"){
    alert("Not connected yet!");
    return;
  }

  const input = document.getElementById("messageInput");

  const message = input.value.trim();

  if(!message) return;

  const payload = {
    type: "message",
    username: username,
    text: message
  };

  dataChannel.send(JSON.stringify(payload));

  addMessage(username, message, "me");

  input.value = "";
}

// ---------------- ADD MESSAGE ----------------
function addMessage(user, message, type="peer") {

  const chat = document.getElementById("chat");

  const msg = document.createElement("div");

  msg.classList.add("message");

  if(type === "me"){
    msg.classList.add("my-message");
  } else {
    msg.classList.add("peer-message");
  }

  const time = new Date().toLocaleTimeString();

  msg.innerHTML =
    "<b>" + user + "</b>: " + message +
    "<div class='timestamp'>" + time + "</div>";

  chat.appendChild(msg);

  chat.scrollTop = chat.scrollHeight;
}

// ---------------- TYPING ----------------
function sendTyping(){

  if(dataChannel && dataChannel.readyState === "open"){

    dataChannel.send(JSON.stringify({
      type: "typing",
      username: username
    }));

  }
}

function showTyping(user){

  const indicator = document.getElementById("typingIndicator");

  indicator.innerText = user + " is typing...";

  clearTimeout(typingTimeout);

  typingTimeout = setTimeout(()=>{
    indicator.innerText = "";
  }, 1500);
}

// ---------------- FILE SHARE ----------------
document.getElementById("fileInput").addEventListener("change", function(){

  const file = this.files[0];

  if(!file || !dataChannel || dataChannel.readyState !== "open") return;

  const reader = new FileReader();

  reader.onload = () => {

    dataChannel.send(JSON.stringify({
      type: "file",
      name: file.name,
      data: reader.result
    }));

  };

  reader.readAsDataURL(file);
});

function receiveFile(data){

  const link = document.createElement("a");

  link.href = data.data;
  link.download = data.name;
  link.innerText = "📎 Download " + data.name;

  const chat = document.getElementById("chat");

  chat.appendChild(link);
}

// ---------------- DARK MODE ----------------
function toggleDarkMode(){
  document.getElementById("body").classList.toggle("dark-mode");
}