import RTCClient from './rtc-client'
import SketchPad, {colors, widths} from './sketchpad'
import {getDevices, serializeFormData, validator, resolutions, Toast} from './common'

import './assets/style.css'
import * as M from 'materialize-css'

// handle current tab or window inactive scenario
// If current tab or window inactive `visibilitychange` would occurs and we would change `activate` state so that it will switch to another async render way 
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    SketchPad.activate = false
  } else {
    SketchPad.activate = true
  }
  SketchPad.autoRender(SketchPad.activate)
})

$(() => {
  SketchPad.mount('#local_canvas')
  
  getDevices(function (devices) {
    devices.audios.forEach(function (audio) {
      $('<option/>', {
        value: audio.value,
        text: audio.name,
      }).appendTo('#microphoneId')
    })
    devices.videos.forEach(function (video) {
      $('<option/>', {
        value: video.value,
        text: video.name,
      }).appendTo('#cameraId')
    })
    resolutions.forEach(function (resolution) {
      $('<option/>', {
        value: resolution.value,
        text: resolution.name
      }).appendTo('#cameraResolution')
    })
    M.AutoInit()

    if (localStorage.getItem('custom_videosource') != 'true') {
      M.Modal.init($('#warn')[0], {
        dismissible: false,
      }).open()
    }
  })

  const fields = ['appID', 'channel']
  
  const modal = M.Modal.init($('#warn')[0])

  $('#sure').on('click', () => {
    modal.close()
  })

  $('#never_show').on('click', () => {
    modal.close()
    localStorage.setItem('custom_videosource', true)
  })

  let lineWidthCount = 1
  $('#lineWidth').on('click', function (e) {
    e.preventDefault()
    $('#lineWidthProgress').removeClass(widths[lineWidthCount])
    let widthIdx = ++lineWidthCount % 3
    SketchPad.width = widthIdx
    $('#lineWidthProgress').addClass(widths[widthIdx])
  })

  let colorCount = 0
  $('#color').on('click', function (e) {
    e.preventDefault()
    $('#colorProgress').removeClass(colors[colorCount])
    let colorIdx = ++colorCount % 3
    SketchPad.color = colorIdx
    $('#colorProgress').addClass(colors[colorIdx])
  })

  $('#clear').on('click', function (e) {
    e.preventDefault()
    SketchPad.clear()
  })

  let rtc = new RTCClient()

  $('.autoplay-fallback').on('click', function (e) {
    e.preventDefault()
    const id = e.target.getAttribute('id').split('video_autoplay_')[1]
    console.log('autoplay fallback')
    if (id === 'local') {
      rtc._localStream.resume().then(() => {
        Toast.notice('local resume')
        $(e.target).addClass('hide')
      }).catch((err) => {
        Toast.error('resume failed, please open console see more details')
        console.error(err)
      })
      return
    }
    const remoteStream = rtc._remoteStreams.find((item) => `${item.getId()}` == id)
    if (remoteStream) {
      remoteStream.resume().then(() => {
        Toast.notice('remote resume')
        $(e.target).addClass('hide')
      }).catch((err) => {
        Toast.error('resume failed, please open console see more details')
        console.error(err)
      })
    }
  })

  $('#show_profile').on('change', function (e) {
    e.preventDefault()
    if (!rtc._joined) {
      $(this).removeAttr('checked')
      return false
    }
    rtc.setNetworkQualityAndStreamStats(this.checked)
  })

  $('#join').on('click', function (e) {
    e.preventDefault()
    console.log('join')
    const params = serializeFormData()
    if (validator(params, fields)) {
      rtc.join(params).then(() => {
        rtc.publish()
      })
    }
  })

  const selectVals = [ 'camera', 'canvas', './assets/sample.mp4','avatar']
  const domIds = [ 'local_stream', 'local_canvas', 'local_video','avatar_video' ]

  $('#stream').on('change', function (e) {
    e.preventDefault()
    if (!rtc._joined) {
      Toast.error('Please Join First!')
      return
    }
    const idx = selectVals.indexOf($(this).val())
    rtc._currentStreamIdx = idx
    const currentDomId = domIds[idx]

    for (let dom of domIds) {
      if (dom == currentDomId) {
        $('#'+currentDomId).hasClass('hide') && $('#'+currentDomId).removeClass('hide')
        continue
      }
      if (!$('#'+dom).hasClass('hide')) {
        $('#'+dom).addClass('hide')
      }
    }
  })

  $('#switch_track').on('click', function (e) {
    e.preventDefault()
    if (!rtc._joined) {
      Toast.error('Please Join First!')
      return
    }
    const currentDomId = domIds[rtc._currentStreamIdx]
    if (currentDomId == 'local_video') {
      $('#sample_video')[0].play().then(() => {
        console.log('play video success')
      })
    }
    const params = serializeFormData()
    if (validator(params, fields)) {
      rtc.replaceTrack(params, () => {
        Toast.notice('switch success')
      })
    }
  })

  $('#leave').on('click', function (e) {
    e.preventDefault()
    console.log('leave')
    const params = serializeFormData()
    if (validator(params, fields)) {
      rtc.leave()
    }
  })
  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  //  // 


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

    webrtc = new WebRTC()
    webrtc.preview = document.getElementById('previewVideo')
    webrtc.remoteVideo = document.getElementById('avatarVideo')
    webrtc.dest = destFld.value
    webrtc.start()
  })


  function endCall() {
    startBtn.disabled = false
    endBtn.disabled = true

    if (webrtc) {
      webrtc.stop()
      webrtc = null
    }
  }
})