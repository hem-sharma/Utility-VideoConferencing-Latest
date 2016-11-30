kurento_room.controller('callController', function ($scope, $http, $window, ServiceParticipant, ServiceRoom, Fullscreen, LxNotificationService, $routeParams, $q, $rootScope, $location, $compile) {

    var options;
    $scope.roomName = '';
    $http.get('/getAllRooms').
    success(function (data, status, headers, config) {
        // console.log(JSON.stringify(data));
        $scope.listRooms = data;
    }).
    error(function (data, status, headers, config) {});

    $http.get('/getClientConfig').
    success(function (data, status, headers, config) {
        // console.log(JSON.stringify(data));
        $scope.clientConfig = data;
    }).
    error(function (data, status, headers, config) {});
    $http.get('/getUpdateSpeakerInterval').
    success(function (data, status, headers, config) {
        $scope.updateSpeakerInterval = data
    }).
    error(function (data, status, headers, config) {});

    $http.get('/getThresholdSpeaker').
    success(function (data, status, headers, config) {
        $scope.thresholdSpeaker = data
    }).
    error(function (data, status, headers, config) {});
    $scope.roomName = $routeParams.eventId;
    var room = {
        roomName: $routeParams.eventId,
        token: $routeParams.accessToken,
        userName: $routeParams.user
    };

    $rootScope.roomName = room.roomName;
    $rootScope.userName = room.userName;

    var deferred = $q.defer();
    var req = 'https://www.kazastream.com/api/common/checkroomaccess?';
    req += 'eventId=' + room.roomName;
    req += '&accessToken=' + room.token;
    req += '&user=' + room.userName;
    $http.get(req)
        .then(function (response) {
            deferred.resolve(response);
            var result = response;
            if (result.data.status === 200 && result.data.isValid) {
                var event = result.data.event,
                    user = result.data.user;
                room.roomName = event;
                room.userName = user;
                $scope.roomName = event;
                $rootScope.roomName = event;
                $rootScope.userName = user;
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


            kurento.setRpcParams({
                token: room.token
            });

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
                        ServiceParticipant.forceClose($window, LxNotificationService, 'Room ' +
                            msg.room + ' has been forcibly closed from server');
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
        //stop recording
        stopRecording($rootScope.webRtcPeer, $rootScope.pipeline);

        $window.location.href = '#/thanks';
        $window.location.reload();
    };

    window.onbeforeunload = function () {

        if (ServiceParticipant.isConnected()) {
            ServiceRoom.getKurento().close();
            //stop recording
            stopRecording($rootScope.webRtcPeer, $rootScope.pipeline);
        }
    };


    $scope.shareScreen = function () {
        var def = $q.defer();
        var req = 'https://www.kazastream.com/api/common/getScreenShareUrl';
        $http.get(req)
            .then(function (response) {
                def.resolve(response);
                var result = response;
                if (result.data.status === 200) {
                    var url = result.data.url + '#' + (Math.random() * 100).toString().replace('.', '');
                    var vUrl = url + '?mode=v',
                        pUrl = url + '?mode=p';
                    var msg = '<a ng-href="javascript:void(0)" ng-click="showSharingPopup(' + vUrl + ')">View</a>';

                    //test
                    var w = 'http://www.google.co.in';
                    var test = '<a ng-click="showSharingPopup(' + w + ')">View</a>';
                    angular.element(document.querySelector('#room-name')).prepend($compile(test)($scope))
                        //test
                        // var compiledMessage = $compile(msg)($scope);

                    // sendSharedScreenMessage('Shared Screen : ' + compiledMessage);
                    window.open(pUrl, '_blank');

                } else {
                    alert('Some error occured! try again later.')
                    return false;
                }
            })
            .then(function (response) {
                def.reject(response);
            });
    };
    $scope.showAlert = false;
    $scope.showSharingPopup = function (url) {
        $scope.showAlert = !$scope.showAlert;
        var html = '<iframe src=' + url + ' style="height:100%;width:100%"></iframe>';
        $('#popUp').html(html)
    };

    function sendSharedScreenMessage(message) {
        var dskKurento = ServiceRoom.getKurento();
        dskKurento.sendMessage($scope.roomName, $scope.userName, message);
        $scope.message = "";
    }

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
            LxNotificationService.alert('Error!', "Not connected yet", 'Ok', function (answer) {});
            return false;
        }
        ServiceParticipant.disconnectParticipant(participant);
        ServiceRoom.getKurento().disconnectParticipant(participant.getStream());
        //stop recording for current participant
        stopRecording($rootScope.webRtcPeer, $rootScope.pipeline);
    }


    $scope.message;

    $scope.sendMessage = function () {
        console.log("Sending message", $scope.message);
        var kurento = ServiceRoom.getKurento();
        // kurento.sendMessage($scope.roomName, $scope.userName, $scope.message);
        kurento.sendMessage($scope.roomName, $scope.userName, $scope.message);
        $scope.message = "";
    };


    $scope.toggleChat = function () {
        var selectedEffect = "slide";

        var options = {
            direction: "right"
        };
        if ($("#effect").is(':visible')) {
            $("#content").animate({
                width: '100%'
            }, 500);
        } else {
            $("#content").animate({
                width: '80%'
            }, 500);
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
        ServiceRoom.getKurento().sendCustomRequest({
            hat: targetHat
        }, function (error, response) {
            if (error) {
                console.error("Unable to toggle hat " + hatTo, error);
                LxNotificationService.alert('Error!', "Unable to toggle hat " + hatTo,
                    'Ok',
                    function (answer) {});
                return false;
            } else {
                console.debug("Response on hat toggle", response);
            }
        });
    };
});