navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

var net = null;
var stream = null;
var video = null;
var bgvideo = null;
var OTSession = undefined;
var publisher = undefined;
var apiKey="";
var sessionId="";
var token="";
var videoConstraints = {};
var bgImageData = undefined;
var isMicMuted = false;
var isCamMuted = false;

var focusTimer = undefined;
var tempcanvas = undefined;
var canvas = undefined;

var MODE_BLUR = 1;
var MODE_BGIMAGE = 2;
var MODE_BGVIDEO = 3;
var MODE_COLORPOP = 4;
var MODE_PIXELATE = 5;
var currentMode = MODE_BLUR;

var FRAME_WIDTH = 640;
var FRAME_HEIGHT =  480;

var props = {
	  architecture: 'MobileNetV1',
    outputStride: 16,
    internalResolution: 'medium',
    multiplier: 0.75,
    quantBytes: 2,
    flipHorizontal: false,
    algorithm: 'person',
    backgroundBlurAmount: 5,
    maskBlurAmount: 0,
    edgeBlurAmount: 20,
    segmentationThreshold: 0.7,
    maxDetections: 1,
    scoreThreshold: 0.3,
    nmsRadius: 20,
    pixelFactor: 0.05,	
}

function handleError(error) {
        if (error) {
          alert(error.message);
        }
}

function changeFilter(){
  document.getElementById("pixelamtdiv").style.display="none";
  document.getElementById("bluramtdiv").style.display="none";
  document.getElementById("videoselect").style.display="none";
  document.getElementById("imageselect").style.display="none";
  
  newMode = document.getElementById("mode").value;
  if(newMode == "MODE_BLUR"){
    currentMode = MODE_BLUR;
    bgvideo.pause();
    document.getElementById("bluramtdiv").style.display="inline-block";
  }
  else if(newMode == "MODE_COLORPOP"){
    currentMode = MODE_COLORPOP;
    bgvideo.pause();
  }
  else if(newMode == "MODE_PIXELATE"){
    document.getElementById("pixelamtdiv").style.display="inline-block";
    currentMode = MODE_PIXELATE;
    bgvideo.pause();
  }
  else if(newMode == "MODE_BGVIDEO"){
    alert("experimental - cpu killer");
    currentMode = MODE_BGVIDEO;
    bgvideo.play();
    document.getElementById("videoselect").style.display="inline-block";
  }
  else if(newMode == "MODE_BGIMAGE"){
    currentMode = MODE_BGIMAGE;
    bgvideo.pause();
    document.getElementById("imageselect").style.display="inline-block";
  }
}

function changeBlurAmount(){
  props.backgroundBlurAmount = document.getElementById("bluramount").value;
}
function changePixelAmount(){
  props.pixelFactor = document.getElementById("pixelamount").value;
}
function changeVideo(){
   bgvideo.src = "assets/"+document.getElementById("videoname").value+".mp4";
   bgvideo.muted = true;
   bgvideo.loop = true;
   bgvideo.play();
}

function changeImage(){
  const img = new Image();
  img.crossOrigin = '';
  // Load the image on canvas
  img.addEventListener('load', () => {
    // Set canvas width, height same as image
    const tempctx = tempcanvas.getContext('2d');
    tempcanvas.width = FRAME_WIDTH;
    tempcanvas.height = FRAME_HEIGHT;
    tempctx.drawImage(img,0,0,tempcanvas.width,tempcanvas.height);
    bgImageData = tempctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;
  });

  img.src = "assets/"+document.getElementById("imagename").value+".jpg";
}

function muteUnmuteMic(){
    if(isMicMuted){
      isMicMuted = false;
      publisher.publishAudio(true);
      $("#micon").css("display", "inline-block");
      $("#micoff").css("display", "none");
    }
    else {
      isMicMuted = true;
      publisher.publishAudio(false);
      $("#micon").css("display", "none");
      $("#micoff").css("display", "inline-block");
    }
    return isMicMuted;
  }
  function muteUnmuteCam(){
    if(isCamMuted){
      isCamMuted = false;
      publisher.publishVideo(true);
      $("#camon").css("display", "inline-block");
      $("#camoff").css("display", "none");
    }
    else {
      isCamMuted = true;
      publisher.publishVideo(false);
      $("#camon").css("display", "none");
      $("#camoff").css("display", "inline-block");
    }
    return isCamMuted;
  }

function start(){
    $.get("/opentokFilters/token", function(data){
      try{
        token = data.token;
        sessionId = data.sessionid;
        apiKey = data.apikey;
        initializeSession();
      }
      catch(e){
        console.log(data);
        alert("Error" + e)
      }
    });
}

function initializeSession() {
      OTSession = OT.initSession(apiKey, sessionId);
      OTSession.on('streamCreated', function(event) {
          subscriber = OTSession.subscribe(event.stream, 'layoutContainer', {
              insertMode: 'append',
              width: '100%',
              height: '100%'
          }, handleError);
          layout();
      });
      
      OTSession.on('streamDestroyed', function(event) {
        layout();
      });
      startPublishing();
}

function startPublishing(){

      if (!canvas.captureStream) {
          alert('This browser does not support VideoElement.captureStream(). You must use Google Chrome.');
          return;
      }
    OTSession.connect(token, function(error) {
      if (error) {
              handleError(error);
          } else {
               publisher = OT.initPublisher('layoutContainer', {
                insertMode: 'append',
                width: '100%',
                height: '100%',
                videoSource: canvas.captureStream().getVideoTracks()[0],
                audioSource: true
              }, (err) => {
                if (err) {
                  alert(err.message);
                }
                else{
                  layout();
                  OTSession.publish(publisher,function(error) {
                    if (error) {
                      console.log(error);
                    } else {
                      console.log('Publishing a stream.');
                    }
                  });            
                }
              });
          }
      });

}

function onFocusChange(){
	if(document.hidden){
		console.log("Starting timer");
      		focusTimer = setInterval(function(){bodySegmentationFrame()},50);
	}
	else{
		console.log("Stopping timer");
		clearInterval(focusTimer);
	}
}

async function bindPage() {
  canvas = document.createElement("canvas");
  tempcanvas = document.createElement("canvas");
  bgvideocanvas = document.createElement("canvas");
  bgvideocanvas.height = FRAME_HEIGHT;
  bgvideocanvas.width = FRAME_WIDTH;
  document.addEventListener("visibilitychange", onFocusChange);
  // Load the BodyPix model weights with architecture 0.75
  net = await bodyPix.load({
    architecture: props.architecture,
    outputStride: props.outputStride,
    multiplier: props.multiplier,
    quantBytes: props.quantBytes
  });
  await loadVideo(null);
  document.getElementById('main').style.display = 'inline-block';
  
  /*load the bg image and video */
  const img = new Image();
  img.crossOrigin = '';
  // Load the image on canvas
  img.addEventListener('load', () => {
    // Set canvas width, height same as image
    const tempctx = tempcanvas.getContext('2d');
    tempcanvas.width = FRAME_WIDTH;
    tempcanvas.height = FRAME_HEIGHT;
    tempctx.drawImage(img,0,0,tempcanvas.width,tempcanvas.height);
    bgImageData = tempctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;

    bgvideo = document.createElement("video");
    bgvideo.src = "assets/bevel.mp4";
    bgvideo.muted = true;
    bgvideo.loop = true;
    bgvideo.onloadedmetadata = function() {
      	console.log("Metadata for video loaded");
  	segmentBodyInRealTime();     
	start();
    };
  });

  img.src = 'assets/wall.jpg';
}

function doBgImage(map,mask){
  const tempctx = tempcanvas.getContext('2d');
  const { data:imgData } = tempctx.getImageData(0, 0, tempcanvas.width, tempcanvas.height);
  
  // Creating new image data
 
  const newImg = tempctx.createImageData(tempcanvas.width, tempcanvas.height);
  const newImgData = newImg.data;
  
  for(let i=0; i<map.length; i++) {
    const [r, g, b, a] = [imgData[i*4], imgData[i*4+1], imgData[i*4+2], imgData[i*4+3]];
    [
      newImgData[i*4],
      newImgData[i*4+1],
      newImgData[i*4+2],
      newImgData[i*4+3]
    ] = !map[i] ? [bgImageData[i*4], bgImageData[i*4+1], bgImageData[i*4+2], bgImageData[i*4+3]] : [r, g, b, a];
  }
  // Draw the new image back to canvas
  var ctx = canvas.getContext('2d');
  ctx.putImageData(newImg, 0, 0);

}

function doBgVideo(map,bgData){
  const tempctx = tempcanvas.getContext('2d');
  const { data:imgData } = tempctx.getImageData(0, 0, tempcanvas.width, tempcanvas.height);

  // Creating new image data
 
  const newImg = tempctx.createImageData(tempcanvas.width, tempcanvas.height);
  const newImgData = newImg.data;
  for(let i=0; i<map.length; i++) {
    const [r, g, b, a] = [(imgData[i*4]), (imgData[i*4+1]), (imgData[i*4+2]), imgData[i*4+3]];
    [
      newImgData[i*4],
      newImgData[i*4+1],
      newImgData[i*4+2],
      newImgData[i*4+3]
    ] = !map[i] ? [bgData[i*4],bgData[i*4+1],bgData[i*4+2],bgData[i*4+3]] : [r, g, b, a];
  }
  // Draw the new image back to canvas
  var ctx = canvas.getContext('2d');
  ctx.putImageData(newImg, 0, 0);
}

function doColorPop(map){
  const tempctx = tempcanvas.getContext('2d');
  const { data:imgData } = tempctx.getImageData(0, 0, tempcanvas.width, tempcanvas.height);
  
  // Creating new image data
 
  const newImg = tempctx.createImageData(tempcanvas.width, tempcanvas.height);
  const newImgData = newImg.data;
  var brightness = 20;
  for(let i=0; i<map.length; i++) {
    var row = Math.floor(i/640);
    var column = i%640;
    
    const [r, g, b, a] = [imgData[i*4], imgData[i*4+1], imgData[i*4+2], imgData[i*4+3]];

    const gray = ((0.3 * r) + (0.59 * g) + (0.11 * b));
    [
      newImgData[i*4],
      newImgData[i*4+1],
      newImgData[i*4+2],
      newImgData[i*4+3]
    ] = !map[i] ? [gray, gray, gray, 255] : [r, g, b, a];
  }
  // Draw the new image back to canvas
   var ctx = canvas.getContext('2d');
   ctx.putImageData(newImg, 0, 0);
}

function pixelateBg(map){
  const tempctx = tempcanvas.getContext('2d');
  const { data:imgData } = tempctx.getImageData(0, 0, tempcanvas.width, tempcanvas.height);
  tempctx.mozImageSmoothingEnabled = false;
    tempctx.webkitImageSmoothingEnabled = false;
    tempctx.imageSmoothingEnabled = false;
  tempctx.drawImage(tempcanvas, 0, 0, tempcanvas.width*props.pixelFactor, tempcanvas.height*props.pixelFactor);
  tempctx.drawImage(tempcanvas, 0, 0, tempcanvas.width*props.pixelFactor, tempcanvas.height*props.pixelFactor, 0, 0, tempcanvas.width, tempcanvas.height);
  // Creating new image data
  const { data:pixelImgData } = tempctx.getImageData(0, 0, tempcanvas.width, tempcanvas.height);
 
  const newImg = tempctx.createImageData(tempcanvas.width, tempcanvas.height);
  const newImgData = newImg.data;
  var brightness = 20;
  for(let i=0; i<map.length; i++) {
    var row = Math.floor(i/640);
    var column = i%640;
    
    const [r, g, b, a] = [imgData[i*4], imgData[i*4+1], imgData[i*4+2], imgData[i*4+3]];
    const [pr, pg, pb, pa] = [pixelImgData[i*4], pixelImgData[i*4+1], pixelImgData[i*4+2], pixelImgData[i*4+3]];
    
    [
      newImgData[i*4],
      newImgData[i*4+1],
      newImgData[i*4+2],
      newImgData[i*4+3]
    ] = !map[i] ? [pr,pg,pb,pa] : [r, g, b, a];
  }
  // Draw the new image back to canvas
   var ctx = canvas.getContext('2d');
   ctx.putImageData(newImg, 0, 0);
}
function segmentBodyInRealTime() {
	bodySegmentationFrame();
	requestAnimationFrame(segmentBodyInRealTime);
}
  // since images are being fed from a webcam
  async function bodySegmentationFrame() {

    if(currentMode == MODE_BLUR){
        const multiPersonSegmentation = await estimateSegmentation(video);
        bodyPix.drawBokehEffect(
                canvas, video, multiPersonSegmentation,
                props.backgroundBlurAmount,
                props.edgeBlurAmount, props.flipHorizontal);
    }
    else {
        /*draw video frame on temp canvas */
        const tempctx = tempcanvas.getContext('2d');
        tempctx.clearRect(0,0,tempcanvas.width,tempcanvas.height);
        tempctx.drawImage(video,0,0,tempcanvas.width,tempcanvas.height);
        if(currentMode == MODE_COLORPOP){
            const multiPersonSegmentation = await estimateSegmentation(tempcanvas);
            doColorPop(multiPersonSegmentation.data);
        }
        else if(currentMode == MODE_PIXELATE){
            const multiPersonSegmentation = await estimateSegmentation(tempcanvas);
            pixelateBg(multiPersonSegmentation.data);
        }
        else if(currentMode == MODE_BGIMAGE){
            var img = document.getElementById("bg");
            const multiPersonSegmentation = await estimateSegmentation(tempcanvas);
            /*const foregroundColor = {r: 0, g: 0, b: 0, a: 0};
            const backgroundColor = {r: 0, g: 0, b: 0, a: 255};
            const backgroundDarkeningMask = bodyPix.toMask(multiPersonSegmentation, foregroundColor, backgroundColor,true);*/
            doBgImage(multiPersonSegmentation.data,undefined/*,backgroundDarkeningMask*/);
        }
        else if(currentMode == MODE_BGVIDEO){
            const bgvideoctx = bgvideocanvas.getContext('2d');
            bgvideoctx.clearRect(0,0,bgvideocanvas.width,bgvideocanvas.height);
            bgvideoctx.drawImage(bgvideo,0,0,bgvideocanvas.width,bgvideocanvas.height);
            const { data:bgData } = bgvideoctx.getImageData(0, 0, bgvideocanvas.width, bgvideocanvas.height);
            const multiPersonSegmentation = await estimateSegmentation(tempcanvas);
            doBgVideo(multiPersonSegmentation.data,bgData);
        }
    }
    //requestAnimationFrame(bodySegmentationFrame);
  }


async function estimateSegmentation(image) {
  	let multiPersonSegmentation = null;
  
    return await net.segmentPerson(image, {
        internalResolution: props.internalResolution,
        segmentationThreshold: props.segmentationThreshold,
        maxDetections: props.maxDetections,
        scoreThreshold: props.scoreThreshold,
        nmsRadius: props.nmsRadius,
    });
}

async function getVideoInputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    console.log('enumerateDevices() not supported.');
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(device => device.kind === 'videoinput');
  return videoDevices;
}

async function getDeviceIdForLabel(cameraLabel) {
  const videoInputs = await getVideoInputs();

  for (let i = 0; i < videoInputs.length; i++) {
    const videoInput = videoInputs[i];
    if (videoInput.label === cameraLabel) {
      return videoInput.deviceId;
    }
  }

  return null;
}

async function getConstraints(cameraLabel) {
  let deviceId;
  let facingMode;

  if (cameraLabel) {
    deviceId = await getDeviceIdForLabel(cameraLabel);
    // on mobile, use the facing mode based on the camera.
    facingMode = isMobile() ? getFacingMode(cameraLabel) : null;
  };
  return {deviceId, facingMode,width: {exact: FRAME_WIDTH}, height: {exact: FRAME_HEIGHT}};
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobile() {
  return isAndroid() || isiOS();
}

function stopExistingVideoCapture() {
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => {
      track.stop();
    })
    video.srcObject = null;
  }
}

async function setupCamera(cameraLabel) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const videoElement = document.createElement('video');

  stopExistingVideoCapture();

  const videoConstraints = await getConstraints(cameraLabel);

  const stream = await navigator.mediaDevices.getUserMedia(
      {'audio': false, 'video': videoConstraints});
  videoElement.srcObject = stream;

  return new Promise((resolve) => {
    videoElement.onloadedmetadata = () => {
      videoElement.width = FRAME_WIDTH;
      videoElement.height = FRAME_HEIGHT;
      tempcanvas.width = FRAME_WIDTH;
      canvas.width = FRAME_WIDTH;
      tempcanvas.height = FRAME_HEIGHT;
      canvas.height = FRAME_HEIGHT;
      console.log(canvas.width+":"+canvas.height);
      resolve(videoElement);
    };
  });
}

async function loadVideo(cameraLabel) {
  try {
    video = await setupCamera(cameraLabel);
  } catch (e) {
    alert("Error in Load Video");
  }

  video.play();
}

