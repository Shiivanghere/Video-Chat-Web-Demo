const socket = io("https://talkatoo.onrender.com");
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const disconnectBtn = document.getElementById('disconnectBtn');

let peerConnection;
let isInitiator = false;
let localStream;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    socket.on('peer-found', () => {
      isInitiator = true;
      createPeerConnection();
      addLocalTracks();
      createAndSendOffer();
    });

    socket.on('signal', async (data) => {
      if (!peerConnection) {
        createPeerConnection();
        addLocalTracks();
      }

      if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', peerConnection.localDescription);
      } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('peer-disconnected', () => {
      cleanupAndReload("Peer disconnected.");
    });

    disconnectBtn.onclick = () => {
      cleanupAndReload("You disconnected.");
    };
  })
  .catch(err => {
    alert("Camera/Mic access is required.");
    console.error(err);
  });

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('signal', { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };
}

function addLocalTracks() {
  if (!localStream || !peerConnection) return;
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

function createAndSendOffer() {
  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => socket.emit('signal', peerConnection.localDescription))
    .catch(err => console.error('Offer creation error:', err));
}

function cleanupAndReload(msg) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  socket.disconnect();

  alert(msg);
  location.reload();
}