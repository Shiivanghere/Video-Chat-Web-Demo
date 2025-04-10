const socket = io("https://talkatoo.onrender.com");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const disconnectBtn = document.getElementById("disconnectBtn");

let peerConnection;
let makingOffer = false;
let ignoreOffer = false;
let polite = false;
let localStream;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
  localStream = stream;
  localVideo.srcObject = stream;

  socket.on("peer-found", () => {
    polite = true; // the second user to join is polite
    createPeerConnection();
    localStream.getTracks().forEach((track) =>
      peerConnection.addTrack(track, localStream)
    );
  });

  socket.on("signal", async (data) => {
    if (!peerConnection) {
      createPeerConnection();
      localStream.getTracks().forEach((track) =>
        peerConnection.addTrack(track, localStream)
      );
    }

    if (data.description) {
      const offerCollision =
        data.description.type === "offer" &&
        (makingOffer || peerConnection.signalingState !== "stable");

      ignoreOffer = !polite && offerCollision;

      if (ignoreOffer) return;

      await peerConnection.setRemoteDescription(data.description);
      if (data.description.type === "offer") {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("signal", { description: peerConnection.localDescription });
      }
    } else if (data.candidate) {
      try {
        await peerConnection.addIceCandidate(data.candidate);
      } catch (err) {
        if (!ignoreOffer) console.error("ICE candidate error:", err);
      }
    }
  });

  socket.on("peer-disconnected", () => {
    cleanupAndReload("Peer disconnected.");
  });

  disconnectBtn.onclick = () => {
    cleanupAndReload("You disconnected.");
  };
});

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit("signal", { description: peerConnection.localDescription });
    } catch (err) {
      console.error("Negotiation error:", err);
    } finally {
      makingOffer = false;
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
}

function cleanupAndReload(msg) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  socket.disconnect();

  alert(msg);
  location.reload();
}