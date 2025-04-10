const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const disconnectBtn = document.getElementById('disconnectBtn');

let peerConnection;
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localVideo.srcObject = stream;

  socket.on('peer-found', async () => {
    peerConnection = createPeerConnection();
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', {
      type: 'offer',
      sdp: offer.sdp,
    });
  });

  socket.on('signal', async (data) => {
    if (!peerConnection) {
      peerConnection = createPeerConnection();
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    }

    if (data.type === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', {
        type: 'answer',
        sdp: answer.sdp,
      });
    } else if (data.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
    } else if (data.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    }
  });

  socket.on('peer-disconnected', () => {
    cleanupAndReload("Peer disconnected.");
  });

  disconnectBtn.onclick = () => {
    cleanupAndReload("You disconnected.");
  };

  function createPeerConnection() {
    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', {
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        });
      }
    };

    pc.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    return pc;
  }

  function cleanupAndReload(msg) {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    stream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    socket.disconnect();

    alert(msg);
    location.reload();
  }
});
