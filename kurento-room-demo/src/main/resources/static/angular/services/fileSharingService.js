kurento_room.service('FileServe', function () {

    var kurento;
    var roomName;
    var userName;
    var fileSocketServer = 'https://rtcmulticonnection.herokuapp.com:443/';
    var socketMessageEvent = 'file-sharing-demo';
    var _connection;
    var that = this;
    // 60k -- assuming receiving client is chrome
    var chunk_size = 60 * 1000;

    this.getKurento = function () {
        return kurento;
    };

    this.getRoomName = function () {
        return roomName;
    };

    this.setKurento = function (value) {
        kurento = value;
    };

    this.getUserName = function () {
        return userName;
    };

    this.setUserName = function (value) {
        userName = value;
    };

    this.setRoomName = function (value) {
        roomName = value;
    };

    //fs
    this.getFileSharingSocketUrl = function () {
        return fileSocketServer;
    }

    this.getSocketMessageEvent = function () {
        return socketMessageEvent;
    }

    this.setConnection = function (value) {
        connection = value;
    };

    this.getConnection = function () {
        return _connection;
    };

    this.onFileSelected = function (file) {
        if (_connection) {
            _connection.send({
                doYouWannaReceiveThisFile: true,
                fileName: file.size + file.name
            });
        };
    };

    this.bytesToSize = function (bytes) {
        var k = 1000;
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) {
            return '0 Bytes';
        }
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(k)), 10);
        return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
    };

    this.getChunkSize = function () {
        return chunk_size;
    };

    this.setupWebRTCConnection = function () {
        var connection;

        if (_connection) {
            return;
        }
        connection = new RTCMultiConnection();
        this._connection = connection;
        connection.fileReceived = {};
        connection.socketURL = fileSocketServer;
        connection.socketMessageEvent = socketMessageEvent;
        connection.chunkSize = chunk_size;

        connection.sdpConstraints.mandatory = {
            OfferToReceiveAudio: false,
            OfferToReceiveVideo: false
        };

        connection.enableFileSharing = true;

        if (userName && userName.length) {
            connection.userid = userName;
        }

        connection.channel = connection.sessionid = roomName;

        connection.session = {
            data: true,
            // oneway: true --- to make it one-to-many
        };

        connection.filesContainer = $('#logs')[0];
        connection.connectedWith = {};
        connection.onmessage = function (event) {
            if (event.data.doYouWannaReceiveThisFile) {
                if (!connection.fileReceived[event.data.fileName]) {
                    connection.send({
                        yesIWannaReceive: true,
                        fileName: event.data.fileName
                    });
                }
            }

            if (event.data.yesIWannaReceive && !!lastSelectedFile) {
                connection.shareFile(lastSelectedFile, event.userid);
            }
        };

        connection.onopen = function (e) {
            try {
                chrome.power.requestKeepAwake('display');
            } catch (e) {}

            if (connection.connectedWith[e.userid]) return;
            connection.connectedWith[e.userid] = true;

            var message = '<b>' + e.userid + '</b><br>is connected.';
            this.sendMessage(message, '');

            if (!lastSelectedFile) return;

            // already shared the file

            var file = lastSelectedFile;
            setTimeout(function () {
                this.sendMessage('Sharing file<br><b>' + file.name + '</b><br>Size: <b>' + bytesToSize(file.size) + '<b><br>With <b>' + connection.getAllParticipants().length + '</b> users', '');
                connection.send({
                    doYouWannaReceiveThisFile: true,
                    fileName: file.size + file.name
                });
            }, 500);
        };

        connection.onclose = function (e) {
            incrementOrDecrementUsers();

            if (connection.connectedWith[e.userid]) return;

            this.sendMessage('Data connection has been closed between you and <b>' + e.userid + '</b>. Re-Connecting..', '')
            connection.join(roomId);
        };

        connection.onerror = function (e) {
            if (connection.connectedWith[e.userid]) return;
            this.sendMessage('Data connection failed. between you and <b>' + e.userid + '</b>. Retrying..', '')
        };

        this.setFileProgressBarHandlers(connection);

        connection.onUserStatusChanged = function (user) {
            //incrementOrDecrementUsers();
        };

        connection.onleave = function (user) {
            user.status = 'offline';
            connection.onUserStatusChanged(user);
            //incrementOrDecrementUsers();
        };

        var message = 'Connecting room:<br><b>' + connection.channel + '</b>';
        this.sendMessage(message, '');

        connection.openOrJoin(connection.channel, function (isRoomExists, roomid) {
            var message = 'Successfully connected to room: <b>' + roomid + '</b><hr>Other users can join you on iPhone/Android using "' + roomid + '" or desktop (Windows/MacOSX/Ubuntu) users can join using this (secure/private) URL: <a href="./file-sharing.html#' + roomid + '" target="_blank">file-sharing.html#' + roomid + '</a>';

            // if (isRoomEists) { }
            that.sendMessage(message, '');

            if (document.getElementById('room-id')) {
                if (innerWidth > 500) {
                    $('#room-id')[0].parentNode.innerHTML = 'Joined room: ' + roomid;
                } else {
                    $('#room-id')[0].parentNode.innerHTML = 'Joined room:<br>' + roomid;
                }
            }

            var socket = connection.getSocket();
            socket.on('disconnect', function () {
                that.sendMessage('Seems disconnected.', '');
            });
            socket.on('connect', function () {
                location.reload();
            });
            socket.on('error', function () {
                location.reload();
            });

            window.addEventListener('offline', function () {
                that.sendMessage('Seems disconnected.', 'red')
            }, false);
        });

        window.connection = connection;
    };

    this.setFileProgressBarHandlers = function (connection) {
        var progressHelper = {};

        // www.RTCMultiConnection.org/docs/onFileStart/
        connection.onFileStart = function (file) {
            if (connection.fileReceived[file.size + file.name]) return;

            var div = document.createElement('div');
            div.style.borderBottom = '1px solid black';
            div.style.padding = '2px 4px';
            div.id = file.uuid;

            var message = '';
            if (file.userid == connection.userid) {
                message += 'Sharing with:' + file.remoteUserId;
            } else {
                message += 'Receiving from:' + file.userid;
            }

            message += '<br><b>' + file.name + '</b>.';
            message += '<br>Size: <b>' + bytesToSize(file.size) + '</b>';
            message += '<br><label>0%</label> <progress></progress>';

            if (file.userid !== connection.userid) {
                message += '<br><button id="resend">Receive Again?</button>';
            }

            div.innerHTML = message;

            connection.filesContainer.insertBefore(div, connection.filesContainer.firstChild);

            if (file.userid !== connection.userid && div.querySelector('#resend')) {
                div.querySelector('#resend').onclick = function (e) {
                    e.preventDefault();
                    this.onclick = function () {};

                    if (connection.fileReceived[file.size + file.name]) {
                        delete connection.fileReceived[file.size + file.name];
                    }
                    connection.send({
                        yesIWannaReceive: true,
                        fileName: file.name
                    }, file.userid);

                    div.parentNode.removeChild(div);
                };
            }

            if (!file.remoteUserId) {
                progressHelper[file.uuid] = {
                    div: div,
                    progress: div.querySelector('progress'),
                    label: div.querySelector('label')
                };
                progressHelper[file.uuid].progress.max = file.maxChunks;
                return;
            }

            if (!progressHelper[file.uuid]) {
                progressHelper[file.uuid] = {};
            }

            progressHelper[file.uuid][file.remoteUserId] = {
                div: div,
                progress: div.querySelector('progress'),
                label: div.querySelector('label')
            };
            progressHelper[file.uuid][file.remoteUserId].progress.max = file.maxChunks;
        };

        // www.RTCMultiConnection.org/docs/onFileProgress/
        connection.onFileProgress = function (chunk) {
            if (connection.fileReceived[chunk.size + chunk.name]) return;

            var helper = progressHelper[chunk.uuid];
            if (!helper) {
                return;
            }
            if (chunk.remoteUserId) {
                helper = progressHelper[chunk.uuid][chunk.remoteUserId];
                if (!helper) {
                    return;
                }
            }

            helper.progress.value = chunk.currentPosition || chunk.maxChunks || helper.progress.max;
            updateLabel(helper.progress, helper.label);
        };

        // www.RTCMultiConnection.org/docs/onFileEnd/
        connection.onFileEnd = function (file) {
            if (connection.fileReceived[file.size + file.name]) return;

            var div = document.getElementById(file.uuid);
            if (div) {
                div.parentNode.removeChild(div);
            }

            if (file.remoteUserId === connection.userid) {
                //previewFile(file);

                connection.fileReceived[file.size + file.name] = file;

                var message = 'Successfully received file';
                message += '<br><b>' + file.name + '</b>.';
                message += '<br>Size: <b>' + bytesToSize(file.size) + '</b>.';
                message += '<br><a href="' + file.url + '" target="_blank" download="' + file.name + '">Download</a>';
                var div = that.sendMessage(message, '')
                return;
            }

            var message = 'Successfully shared file';
            message += '<br><b>' + file.name + '</b>.';
            message += '<br>With: <b>' + file.remoteUserId + '</b>.';
            message += '<br>Size: <b>' + bytesToSize(file.size) + '</b>.';
            that.sendMessage(message, '')
        };

        function updateLabel(progress, label) {
            if (progress.position === -1) {
                return;
            }

            var position = +progress.position.toFixed(2).split('.')[1] || 100;
            label.innerHTML = position + '%';
        }
    };

    this.sendMessage = function (message, html) {
        //TODO:needs to be done 
        return;
    };
});