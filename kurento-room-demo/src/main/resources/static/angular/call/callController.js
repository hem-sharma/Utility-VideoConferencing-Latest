kurento_room.controller('callController', function ($scope, $http, $window, ServiceParticipant, ServiceRoom, Fullscreen, LxNotificationService, $routeParams, $q, $rootScope, $location) {

    var options;
    $scope.roomName = '';
    $http.get('/getAllRooms').
        success(function (data, status, headers, config) {
            // console.log(JSON.stringify(data));
            $scope.listRooms = data;
        }).
        error(function (data, status, headers, config) {
        });

    $http.get('/getClientConfig').
        success(function (data, status, headers, config) {
            // console.log(JSON.stringify(data));
            $scope.clientConfig = data;
        }).
        error(function (data, status, headers, config) {
        });
    $http.get('/getUpdateSpeakerInterval').
        success(function (data, status, headers, config) {
            $scope.updateSpeakerInterval = data
        }).
        error(function (data, status, headers, config) {
        });

    $http.get('/getThresholdSpeaker').
        success(function (data, status, headers, config) {
            $scope.thresholdSpeaker = data
        }).
        error(function (data, status, headers, config) {
        });
    $scope.roomName = $routeParams.eventId;
    var room = {
        roomName: $routeParams.eventId,
        token: $routeParams.accessToken,
        userName: $routeParams.user
    };

    var deferred = $q.defer();
    //TODO:change Api url
    // var req = 'https://www.kazastream.com/api/common/checkroomaccess?';
    var req = 'https://localhost:44300/api/common/checkroomaccess?';
    req += 'eventId=' + room.roomName;
    req += '&accessToken=' + room.token;
    req += '&user=' + room.userName;
    $http.get(req)
        .then(function (response) {
            deferred.resolve(response);
            var result = response;
            // console.log(result);
            if (result.data.status === 200 && result.data.isValid) {
                room.roomName = result.data.event;
                $scope.roomName = result.data.event;
                room.userName = result.data.user;
                register(room);
            } else {
                //$location.path($rootScope.contextpath + '/');
                $scope.roomName = $routeParams.eventId;
                $window.location.href = '#/error';
                return false;
            }
        })
        .then(function (response) {
            deferred.reject(response);
        });
    var register = function (room) {

        if (!room)
            ServiceParticipant.showError($window, LxNotificationService, {
                error: {
                    message: "Username and room fields are both required"
                }
            });

        $scope.userName = room.userName;
        $scope.roomName = room.roomName;

        var wsUri = 'wss://' + location.host + '/room';


        var displayPublished = $scope.clientConfig.loopbackRemote || false;

        var mirrorLocal = $scope.clientConfig.loopbackAndLocal || false;

        var kurento = KurentoRoom(wsUri, function (error, kurento) {

            if (error)
                return console.log(error);


            kurento.setRpcParams({ token: room.token });

            room = kurento.Room({
                room: $scope.roomName,
                user: $scope.userName,
                updateSpeakerInterval: $scope.updateSpeakerInterval,
                thresholdSpeaker: $scope.thresholdSpeaker
            });

            var localStream = kurento.Stream(room, {
                audio: true,
                video: true,
                data: false
            });

            localStream.addEventListener("access-accepted", function () {
                room.addEventListener("room-connected", function (roomEvent) {
                    var streams = roomEvent.streams;
                    if (displayPublished) {
                        localStream.subscribeToMyRemote();
                    }
                    localStream.publish();
                    ServiceRoom.setLocalStream(localStream.getWebRtcPeer());
                    for (var i = 0; i < streams.length; i++) {
                        ServiceParticipant.addParticipant(streams[i]);
                    }
                });

                room.addEventListener("stream-published", function (streamEvent) {
                    ServiceParticipant.addLocalParticipant(localStream);
                    if (mirrorLocal && localStream.displayMyRemote()) {
                        var localVideo = kurento.Stream(room, {
                            video: true,
                            id: "localStream"
                        });
                        localVideo.mirrorLocalStream(localStream.getWrStream());
                        ServiceParticipant.addLocalMirror(localVideo);
                    }
                });

                room.addEventListener("stream-added", function (streamEvent) {
                    ServiceParticipant.addParticipant(streamEvent.stream);
                });

                room.addEventListener("stream-removed", function (streamEvent) {
                    ServiceParticipant.removeParticipantByStream(streamEvent.stream);
                });

                room.addEventListener("newMessage", function (msg) {
                    ServiceParticipant.showMessage(msg.room, msg.user, msg.message);
                });

                room.addEventListener("error-room", function (error) {
                    ServiceParticipant.showError($window, LxNotificationService, error);
                });

                room.addEventListener("error-media", function (msg) {
                    ServiceParticipant.alertMediaError($window, LxNotificationService, msg.error, function (answer) {
                        console.warn("Leave room because of error: " + answer);
                        if (answer) {
                            kurento.close(true);
                        }
                    });
                });

                room.addEventListener("room-closed", function (msg) {
                    if (msg.room !== $scope.roomName) {
                        console.error("Closed room name doesn't match this room's name",
                            msg.room, $scope.roomName);
                    } else {
                        kurento.close(true);
                        ServiceParticipant.forceClose($window, LxNotificationService, 'Room '
                            + msg.room + ' has been forcibly closed from server');
                    }
                });

                room.addEventListener("lost-connection", function (msg) {
                    kurento.close(true);
                    ServiceParticipant.forceClose($window, LxNotificationService,
                        'Lost connection with room "' + msg.room +
                        '". Please try reloading the webpage...');
                });

                room.addEventListener("stream-stopped-speaking", function (participantId) {
                    ServiceParticipant.streamStoppedSpeaking(participantId);
                });

                room.addEventListener("stream-speaking", function (participantId) {
                    ServiceParticipant.streamSpeaking(participantId);
                });

                room.addEventListener("update-main-speaker", function (participantId) {
                    ServiceParticipant.updateMainSpeaker(participantId);
                });

                room.connect();
            });

            localStream.addEventListener("access-denied", function () {
                ServiceParticipant.showError($window, LxNotificationService, {
                    error: {
                        message: "Access not granted to camera and microphone"
                    }
                });
            });
            localStream.init();
        });


        ServiceRoom.setKurento(kurento);
        ServiceRoom.setRoomName($scope.roomName);
        ServiceRoom.setUserName($scope.userName);
    };



    $scope.roomName = ServiceRoom.getRoomName();
    $scope.userName = ServiceRoom.getUserName();
    $scope.participants = ServiceParticipant.getParticipants();
    $scope.kurento = ServiceRoom.getKurento();

    $scope.leaveRoom = function () {

        ServiceRoom.getKurento().close();

        ServiceParticipant.removeParticipants();


        $window.location.href = '#/thanks';
    };

    window.onbeforeunload = function () {

        if (ServiceParticipant.isConnected()) {
            ServiceRoom.getKurento().close();
        }
    };
    // For Screen Sharing start
    $scope.shareScreen = function () {
        
        captureUserMedia(function() {
                        conferenceUI.createRoom({
                            roomName: ('test') + ' shared his screen with you'
                        });
                    });
                    
        // First script start
        function intallFirefoxScreenCapturingExtension() {
            InstallTrigger.install({
                'Foo': {
                    // URL: 'https://addons.mozilla.org/en-US/firefox/addon/enable-screen-capturing/',
                    URL: 'https://addons.mozilla.org/firefox/downloads/file/355418/enable_screen_capturing_in_firefox-1.0.006-fx.xpi?src=cb-dl-hotness',
                    toString: function () {
                        return this.URL;
                    }
                }
            });
        }

        var isWebRTCExperimentsDomain = document.domain.indexOf('webrtc-experiment.com') != -1;

        var config = {
            openSocket: function (config) {
                var channel = config.channel || 'screen-capturing-' + location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
                var socket = new Firebase('https://webrtc.firebaseIO.com/' + channel);
                socket.channel = channel;
                socket.on("child_added", function (data) {
                    config.onmessage && config.onmessage(data.val());
                });
                socket.send = function (data) {
                    this.push(data);
                };
                config.onopen && setTimeout(config.onopen, 1);
                socket.onDisconnect().remove();
                return socket;
            },
            onRemoteStream: function (media) {
                var video = media.video;
                video.setAttribute('controls', true);
                videosContainer.insertBefore(video, videosContainer.firstChild);
                video.play();
                rotateVideo(video);
            },
            onRoomFound: function (room) {
                if (location.hash.replace('#', '').length) {
                    // private rooms should auto be joined.
                    conferenceUI.joinRoom({
                        roomToken: room.roomToken,
                        joinUser: room.broadcaster
                    });
                    return;
                }

                var alreadyExist = document.getElementById(room.broadcaster);
                if (alreadyExist) return;

                if (typeof roomsList === 'undefined') roomsList = document.body;

                var tr = document.createElement('tr');
                tr.setAttribute('id', room.broadcaster);
                tr.innerHTML = '<td>' + room.roomName + '</td>' +
                    '<td><button class="join" id="' + room.roomToken + '">Open Screen</button></td>';
                roomsList.insertBefore(tr, roomsList.firstChild);

                var button = tr.querySelector('.join');
                button.onclick = function () {
                    var button = this;
                    button.disabled = true;
                    conferenceUI.joinRoom({
                        roomToken: button.id,
                        joinUser: button.parentNode.parentNode.id
                    });
                };
            },
            onNewParticipant: function (numberOfParticipants) {
                document.title = numberOfParticipants + ' users are viewing your screen!';
                var element = document.getElementById('number-of-participants');
                if (element) {
                    element.innerHTML = numberOfParticipants + ' users are viewing your screen!';
                }
            },
            oniceconnectionstatechange: function (state) {
                if (state == 'failed') {
                    alert('Failed to bypass Firewall rules. It seems that target user did not receive your screen. Please ask him reload the page and try again.');
                }

                if (state == 'connected') {
                    alert('A user successfully received your screen.');
                }
            }
        };

        function captureUserMedia(callback, extensionAvailable) {
            console.log('captureUserMedia chromeMediaSource', DetectRTC.screen.chromeMediaSource);

            var screen_constraints = {
                mandatory: {
                    chromeMediaSource: DetectRTC.screen.chromeMediaSource,
                    maxWidth: screen.width > 1920 ? screen.width : 1920,
                    maxHeight: screen.height > 1080 ? screen.height : 1080
                    // minAspectRatio: 1.77
                },
                optional: [{ // non-official Google-only optional constraints
                    googTemporalLayeredScreencast: true
                }, {
                        googLeakyBucket: true
                    }]
            };

            // try to check if extension is installed.
            if (isChrome && isWebRTCExperimentsDomain && typeof extensionAvailable == 'undefined' && DetectRTC.screen.chromeMediaSource != 'desktop') {
                DetectRTC.screen.isChromeExtensionAvailable(function (available) {
                    captureUserMedia(callback, available);
                });
                return;
            }

            if (isChrome && isWebRTCExperimentsDomain && DetectRTC.screen.chromeMediaSource == 'desktop' && !DetectRTC.screen.sourceId) {
                DetectRTC.screen.getSourceId(function (error) {
                    if (error && error == 'PermissionDeniedError') {
                        alert('PermissionDeniedError: User denied to share content of his screen.');
                    }

                    captureUserMedia(callback);
                });
                return;
            }

            // for non-www.webrtc-experiment.com domains
            if (isChrome && !isWebRTCExperimentsDomain && !DetectRTC.screen.sourceId) {
                window.addEventListener('message', function (event) {
                    if (event.data && event.data.chromeMediaSourceId) {
                        var sourceId = event.data.chromeMediaSourceId;

                        DetectRTC.screen.sourceId = sourceId;
                        DetectRTC.screen.chromeMediaSource = 'desktop';

                        if (sourceId == 'PermissionDeniedError') {
                            return alert('User denied to share content of his screen.');
                        }

                        captureUserMedia(callback, true);
                    }

                    if (event.data && event.data.chromeExtensionStatus) {
                        warn('Screen capturing extension status is:', event.data.chromeExtensionStatus);
                        DetectRTC.screen.chromeMediaSource = 'screen';
                        captureUserMedia(callback, true);
                    }
                });
                screenFrame.postMessage();
                return;
            }

            if (isChrome && DetectRTC.screen.chromeMediaSource == 'desktop') {
                screen_constraints.mandatory.chromeMediaSourceId = DetectRTC.screen.sourceId;
            }

            var constraints = {
                audio: false,
                video: screen_constraints
            };

            if (!!navigator.mozGetUserMedia) {
                console.warn(Firefox_Screen_Capturing_Warning);
                constraints.video = {
                    mozMediaSource: 'window',
                    mediaSource: 'window',
                    maxWidth: 1920,
                    maxHeight: 1080,
                    minAspectRatio: 1.77
                };
            }

            console.log(JSON.stringify(constraints, null, '\t'));

            var video = document.createElement('video');
            video.setAttribute('autoplay', true);
            video.setAttribute('controls', true);
            videosContainer.insertBefore(video, videosContainer.firstChild);

            getUserMedia({
                video: video,
                constraints: constraints,
                onsuccess: function (stream) {
                    config.attachStream = stream;
                    callback && callback();

                    video.setAttribute('muted', true);
                    rotateVideo(video);
                },
                onerror: function () {
                    if (isChrome && location.protocol === 'http:') {
                        alert('Please test this WebRTC experiment on HTTPS.');
                    } else if (isChrome) {
                        alert('Screen capturing is either denied or not supported. Please install chrome extension for screen capturing or run chrome with command-line flag: --enable-usermedia-screen-capturing');
                    }
                    else if (!!navigator.mozGetUserMedia) {
                        alert(Firefox_Screen_Capturing_Warning);
                    }
                }
            });
        }

        /* on page load: get public rooms */
        var conferenceUI = conference(config);

        /* UI specific */
        var videosContainer = document.getElementById("videos-container") || document.body;
        var roomsList = document.getElementById('rooms-list');

        document.getElementById('share-screen').onclick = function () {
            var roomName = document.getElementById('room-name') || {};
            roomName.disabled = true;
            captureUserMedia(function () {
                conferenceUI.createRoom({
                    roomName: (roomName.value || 'Anonymous') + ' shared his screen with you'
                });
            });
            this.disabled = true;
        };

        function rotateVideo(video) {
            video.style[navigator.mozGetUserMedia ? 'transform' : '-webkit-transform'] = 'rotate(0deg)';
            setTimeout(function () {
                video.style[navigator.mozGetUserMedia ? 'transform' : '-webkit-transform'] = 'rotate(360deg)';
            }, 1000);
        }

        (function () {
            var uniqueToken = document.getElementById('unique-token');
            if (uniqueToken)
                if (location.hash.length > 2) uniqueToken.parentNode.parentNode.parentNode.innerHTML = '<h2 style="text-align:center;"><a href="' + location.href + '" target="_blank">Share this link</a></h2>';
                else uniqueToken.innerHTML = uniqueToken.parentNode.parentNode.href = '#' + (Math.random() * new Date().getTime()).toString(36).toUpperCase().replace(/\./g, '-');
        })();

        var Firefox_Screen_Capturing_Warning = 'Make sure that you are using Firefox Nightly and you enabled: media.getusermedia.screensharing.enabled flag from about:config page. You also need to add your domain in "media.getusermedia.screensharing.allowed_domains" flag.';
        // First script end

        // Second script start

        var screenFrame, loadedScreenFrame;

        function loadScreenFrame(skip) {
            if (loadedScreenFrame) return;
            if (!skip) return loadScreenFrame(true);

            loadedScreenFrame = true;

            var iframe = document.createElement('iframe');
            iframe.onload = function () {
                iframe.isLoaded = true;
                console.log('Screen Capturing frame is loaded.');

                document.getElementById('share-screen').disabled = false;
                document.getElementById('room-name').disabled = false;
            };
            iframe.src = 'https://www.webrtc-experiment.com/getSourceId/';
            // iframe.src = 'https://www.kazastream.com/images/getSourceId.html';
            iframe.style.display = 'none';
            (document.body || document.documentElement).appendChild(iframe);

            screenFrame = {
                postMessage: function () {
                    if (!iframe.isLoaded) {
                        setTimeout(screenFrame.postMessage, 100);
                        return;
                    }
                    console.log('Asking iframe for sourceId.');
                    iframe.contentWindow.postMessage({
                        captureSourceId: true
                    }, '*');
                }
            };
        };

        if (!isWebRTCExperimentsDomain) {
            loadScreenFrame();
        }
        else {
            document.getElementById('share-screen').disabled = false;
            document.getElementById('room-name').disabled = false;
        }

        // Second script end

        // Third script start

        // todo: need to check exact chrome browser because opera also uses chromium framework
        var isChrome = !!navigator.webkitGetUserMedia;

        
        var DetectRTC = {};

        (function () {

            var screenCallback;

            DetectRTC.screen = {
                chromeMediaSource: 'screen',
                getSourceId: function (callback) {
                    if (!callback) throw '"callback" parameter is mandatory.';
                    screenCallback = callback;
                    window.postMessage('get-sourceId', '*');
                },
                isChromeExtensionAvailable: function (callback) {
                    if (!callback) return;

                    if (DetectRTC.screen.chromeMediaSource == 'desktop') return callback(true);

                    // ask extension if it is available
                    window.postMessage('are-you-there', '*');

                    setTimeout(function () {
                        if (DetectRTC.screen.chromeMediaSource == 'screen') {
                            callback(false);
                        }
                        else callback(true);
                    }, 2000);
                },
                onMessageCallback: function (data) {
                    if (!(typeof data == 'string' || !!data.sourceId)) return;

                    console.log('chrome message', data);

                    // "cancel" button is clicked
                    if (data == 'PermissionDeniedError') {
                        DetectRTC.screen.chromeMediaSource = 'PermissionDeniedError';
                        if (screenCallback) return screenCallback('PermissionDeniedError');
                        else throw new Error('PermissionDeniedError');
                    }

                    // extension notified his presence
                    if (data == 'rtcmulticonnection-extension-loaded') {
                        if (document.getElementById('install-button')) {
                            document.getElementById('install-button').parentNode.innerHTML = '<strong>Great!</strong> <a href="https://chrome.google.com/webstore/detail/screen-capturing/ajhifddimkapgcifgcodmmfdlknahffk" target="_blank">Google chrome extension</a> is installed.';
                        }
                        DetectRTC.screen.chromeMediaSource = 'desktop';
                    }

                    // extension shared temp sourceId
                    if (data.sourceId) {
                        DetectRTC.screen.sourceId = data.sourceId;
                        if (screenCallback) screenCallback(DetectRTC.screen.sourceId);
                    }
                },
                getChromeExtensionStatus: function (callback) {
                    if (!!navigator.mozGetUserMedia) return callback('not-chrome');

                    var extensionid = 'ajhifddimkapgcifgcodmmfdlknahffk';

                    var image = document.createElement('img');
                    image.src = 'chrome-extension://' + extensionid + '/icon.png';
                    image.onload = function () {
                        DetectRTC.screen.chromeMediaSource = 'screen';
                        window.postMessage('are-you-there', '*');
                        setTimeout(function () {
                            if (!DetectRTC.screen.notInstalled) {
                                callback('installed-enabled');
                            }
                        }, 2000);
                    };
                    image.onerror = function () {
                        DetectRTC.screen.notInstalled = true;
                        callback('not-installed');
                    };
                }
            };

            // check if desktop-capture extension installed.
            if (window.postMessage && isChrome) {
                DetectRTC.screen.isChromeExtensionAvailable();
            }
        })();

        DetectRTC.screen.getChromeExtensionStatus(function (status) {
            if (status == 'installed-enabled') {
                if (document.getElementById('install-button')) {
                    document.getElementById('install-button').parentNode.innerHTML = '<strong>Great!</strong> <a href="https://chrome.google.com/webstore/detail/screen-capturing/ajhifddimkapgcifgcodmmfdlknahffk" target="_blank">Google chrome extension</a> is installed.';
                }
                DetectRTC.screen.chromeMediaSource = 'desktop';
            }
        });

        window.addEventListener('message', function (event) {
            if (event.origin != window.location.origin) {
                return;
            }

            DetectRTC.screen.onMessageCallback(event.data);
        });

        console.log('current chromeMediaSource', DetectRTC.screen.chromeMediaSource);


        // Third script end

    };
    // end

    $scope.goFullscreen = function () {

        if (Fullscreen.isEnabled())
            Fullscreen.cancel();
        else
            Fullscreen.all();

    };

    $scope.disableMainSpeaker = function (value) {

        var element = document.getElementById("buttonMainSpeaker");
        if (element.classList.contains("md-person")) {
            element.classList.remove("md-person");
            element.classList.add("md-recent-actors");
            ServiceParticipant.enableMainSpeaker();
        } else {
            element.classList.remove("md-recent-actors");
            element.classList.add("md-person");
            ServiceParticipant.disableMainSpeaker();
        }
    }

    $scope.onOffVolume = function () {
        var localStream = ServiceRoom.getLocalStream();
        var element = document.getElementById("buttonVolume");
        if (element.classList.contains("md-volume-off")) {
            element.classList.remove("md-volume-off");
            element.classList.add("md-volume-up");
            localStream.audioEnabled = true;
        } else {
            element.classList.remove("md-volume-up");
            element.classList.add("md-volume-off");
            localStream.audioEnabled = false;

        }
    };

    $scope.onOffVideocam = function () {
        var localStream = ServiceRoom.getLocalStream();
        var element = document.getElementById("buttonVideocam");
        if (element.classList.contains("md-videocam-off")) {
            element.classList.remove("md-videocam-off");
            element.classList.add("md-videocam");
            localStream.videoEnabled = true;
        } else {
            element.classList.remove("md-videocam");
            element.classList.add("md-videocam-off");
            localStream.videoEnabled = false;
        }
    };

    $scope.disconnectStream = function () {
        var localStream = ServiceRoom.getLocalStream();
        var participant = ServiceParticipant.getMainParticipant();
        if (!localStream || !participant) {
            LxNotificationService.alert('Error!', "Not connected yet", 'Ok', function (answer) {
            });
            return false;
        }
        ServiceParticipant.disconnectParticipant(participant);
        ServiceRoom.getKurento().disconnectParticipant(participant.getStream());
    }


    $scope.message;

    $scope.sendMessage = function () {
        console.log("Sending message", $scope.message);
        var kurento = ServiceRoom.getKurento();
        kurento.sendMessage($scope.roomName, $scope.userName, $scope.message);
        $scope.message = "";
    };


    $scope.toggleChat = function () {
        var selectedEffect = "slide";

        var options = { direction: "right" };
        if ($("#effect").is(':visible')) {
            $("#content").animate({ width: '100%' }, 500);
        } else {
            $("#content").animate({ width: '80%' }, 500);
        }

        $("#effect").toggle(selectedEffect, options, 500);
    };

    $scope.showHat = function () {
        var targetHat = false;
        var offImgStyle = "md-mood";
        var offColorStyle = "btn--deep-purple";
        var onImgStyle = "md-face-unlock";
        var onColorStyle = "btn--purple";
        var element = document.getElementById("hatButton");
        if (element.classList.contains(offImgStyle)) {
            element.classList.remove(offImgStyle);
            element.classList.remove(offColorStyle);
            element.classList.add(onImgStyle);
            element.classList.add(onColorStyle);
            targetHat = true;
        } else if (element.classList.contains(onImgStyle)) {
            element.classList.remove(onImgStyle);
            element.classList.remove(onColorStyle);
            element.classList.add(offImgStyle);
            element.classList.add(offColorStyle);
            targetHat = false;
        }

        var hatTo = targetHat ? "on" : "off";
        // console.log("Toggle hat to " + hatTo);
        ServiceRoom.getKurento().sendCustomRequest({ hat: targetHat }, function (error, response) {
            if (error) {
                console.error("Unable to toggle hat " + hatTo, error);
                LxNotificationService.alert('Error!', "Unable to toggle hat " + hatTo,
                    'Ok', function (answer) { });
                return false;
            } else {
                console.debug("Response on hat toggle", response);
            }
        });
    };
});


