$(() => {
  function WebRTC() {
    this.dest = ''
    this.remoteVideo = null
    this.preview = null
    this.peerConnection = null
    this.httpRequest = null

    this.constraints = {
      voiceActivityDetection: false,
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    }


    this.start = function () {
      this.peerConnection = new RTCPeerConnection({ bundlePolicy: 'max-bundle' })
      this.peerConnection.onicecandidate = this.onIceCandidate.bind(this)
      this.peerConnection.oniceconnectionstatechange = this.onIceConnectionStateChanged.bind(this)
      this.peerConnection.ontrack = this.onRemoteTrackAdded.bind(this)

      // Get the tx devices (microphone/camera) to use
      console.info('WebRTC starting getUserMedia.')
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(this.onGotMedia.bind(this))
        .catch((error) => { console.error('WebRTC getUserMedia error:', error.toString()) })
    }


    this.stop = function () {
      if (this.peerConnection) {
        this.peerConnection.close()
        console.info('WebRTC stopped.')
        this.peerConnection = null
      }
    }


    this.onIceConnectionStateChanged = function (evt) {
      console.info('WebRTC ICE connection state:', this.peerConnection.iceConnectionState)
    }


    this.onGotMedia = function (stream) {
      console.info(`WebRTC onGotMedia: attaching ${stream.id} to ${this.preview.id}`)
      this.preview.srcObject = stream
      this.peerConnection.addStream(stream)

      console.debug('WebRTC creating offer:', JSON.stringify(this.constraints))
      this.peerConnection.createOffer(this.constraints)
        .then(sessionDescription => this.peerConnection.setLocalDescription(sessionDescription))
        .catch(error => console.error('WebRTC failed to create offer:', error.toString()))
    }


    this.onIceCandidate = function (evt) {
      if (evt.candidate) {
        console.debug('WebRTC onIceCandidate:', JSON.stringify(evt.candidate))
        return
      }

      console.info('WebRTC ICE candidates completed')
      console.debug('WebRTC offer sdp:\n' + this.peerConnection.localDescription.sdp)

      this.httpRequest = new XMLHttpRequest()
      this.httpRequest.open('POST', 'https://trulience.uk/sdp?destination=' + this.dest)
      this.httpRequest.setRequestHeader('Content-Type', 'application/sdp')
      this.httpRequest.onreadystatechange = this.opalResponse.bind(this)
      this.httpRequest.send(this.peerConnection.localDescription.sdp)
    }


    this.opalResponse = function () {
      if (this.httpRequest.readyState !== this.httpRequest.DONE)
        return

      if (this.httpRequest.status !== 200) {
        console.warn(`WebRTC answer failed: status=${this.httpRequest.status}`)
        this.stop()
        return
      }


      var sdp = this.httpRequest.responseText.replace('42001f','42e01f')
      console.info('WebRTC answer SDP received:', sdp.length, 'bytes')
      console.debug('WebRTC answer SDP:\n' + sdp)
      this.peerConnection.setRemoteDescription({ type: 'answer', sdp: sdp })
        .then(() => { console.warn('WebRTC answer SDP accepted, media starting') })
        .catch((error) => { console.error('Offer SDP unacceptable:', error.toString()) })
    }


    this.onRemoteTrackAdded = function (evt) {
      if (typeof evt.streams === 'undefined' || evt.streams.length === 0) {
        console.warn('WebRTC onRemoteTrackAdded: no streams')
        return
      }

      let stream = evt.streams[0]
      this.remoteVideo.srcObject = stream
      console.info('WebRTC attached', stream.id, 'to', this.remoteVideo.id)
    }
  }


  var destFld = null
  var startBtn = null
  var endBtn = null
  var webrtc = null

  window.onload = function () {
    destFld = document.getElementById('dest')
    destFld.value = ''
    startBtn = document.getElementById('startBtn')
    endBtn = document.getElementById('endBtn')
  }


  window.onunload = function () {
    if (webrtc)
      webrtc.stop()
  }


  function destChanged() {
    startBtn.disabled = destFld.value.search(':') < 0
  }



  $('#startBtn').on('click', function (e) {

    startBtn.disabled = true
    endBtn.disabled = false
    console.log('avatarVideo tag:', document.getElementById('avatarVideo'))
   

    webrtc = new WebRTC()
    webrtc.preview = document.getElementById('previewVideo')
    webrtc.remoteVideo = document.getElementById('avatarVideo')
    webrtc.dest = destFld.value
    webrtc.start()
  })


  $('#endBtn').on('click', function (e) {
    startBtn.disabled = false
    endBtn.disabled = true

    if (webrtc) {
      webrtc.stop()
      webrtc = null
    }
  })
})