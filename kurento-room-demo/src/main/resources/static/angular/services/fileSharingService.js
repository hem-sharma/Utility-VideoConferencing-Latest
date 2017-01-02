kurento_room.service('FileServe', function () {
    var kurento;
    var roomName;
    var userName;
    // var fileSocketServer = 'https://rtcmulticonnection.herokuapp.com:443/';
    var fileSocketServer = 'https://room.kazastream.com:9000/';
    var socketMessageEvent = 'file-sharing-demo';
    var _connection;
    var that = this;
    this._lastSelectedFile;

    // 60k -- assuming receiving client is chrome
    var chunk_size = 60 * 1000;
    this._lxService;

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
        _connection = value;
    };

    this.getConnection = function () {
        return _connection;
    };

    this.getlastSelectedFile = function () {
        return that._lastSelectedFile;
    };

    this.setLxNotificationService = function (value) {
        that._lxService = value;
    }

    this.getLxnotificationService = function () {
        return that._lxService;
    }

    this.setlastSelectedFile = function (value) {
        that._lastSelectedFile = value;
    };

    this.onFileSelected = function (file) {
        that.setlastSelectedFile(file);
        var lxS = that.getLxnotificationService();
        if (!that.isValidSize(that.bytesToSize(file.size), 20)) {
            lxS.alert('Alert!', 'file size shouldn\'t exceed 20MB.', 'Ok', function (answer) {
                return false;
            });
        } 
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

    this.isValidSize = function (actualSizeString, desiredLimitInMb) {
        if (actualSizeString.includes("Bytes") || actualSizeString.includes("KB") || actualSizeString.includes("MB")) {
            if (actualSizeString.includes("MB")) {
                var res;
                parseInt(actualSizeString.split(' ')[0]) > desiredLimitInMb ? res = false : res = true;
                return res;
            }
            return true;
        }
        return false;

    };

    this.getChunkSize = function () {
        return chunk_size;
    };

    this.updateLabel = function (progress, label) {
        if (progress.position === -1) {
            return;
        }

        var position = +progress.position.toFixed(2).split('.')[1] || 100;
        label.innerHTML = position + '%';
    };

    this.setFileProgressBarHandlers = function (connection) {
        var progressHelper = {};

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
            message += '<br>Size: <b>' + that.bytesToSize(file.size) + '</b>';
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
            that.updateLabel(helper.progress, helper.label);
        };

        connection.onFileEnd = function (file) {
            if (connection.fileReceived[file.size + file.name]) return;

            var div = document.getElementById(file.uuid);
            if (div) {
                div.parentNode.removeChild(div);
            }

            if (file.remoteUserId === connection.userid) {
                connection.fileReceived[file.size + file.name] = file;
                var message = 'Successfully received file';
                message += '<br><b>' + file.name + '</b>.';
                message += '<br>Size: <b>' + that.bytesToSize(file.size) + '</b>.';
                message += '<br><a href="' + file.url + '" target="_blank" download="' + file.name + '">Download</a>';
                var div = that.sendMessage(message)
                return;
            }

            var message = 'Successfully shared file';
            message += '<br><b>' + file.name + '</b>.';
            message += '<br>With: <b>' + file.remoteUserId + '</b>.';
            message += '<br>Size: <b>' + that.bytesToSize(file.size) + '</b>.';
            that.sendMessage(message)
        };
    };

    this.sendMessage = function (message) {
        if (kurento)
            kurento.sendMessage(roomName, userName, message);
        return;
    };

    this.joinRoom = function (roomId) {
        var globalConnection;
        var btnSelectFile = $('[type="file"]')[0];
        btnSelectFile.onclick = function (file) {
            if (file && (file instanceof File || file instanceof Blob) && file.size) {
                that.onFileSelected(file);
                return;
            }

            var fileSelector = new FileSelector();
            fileSelector.selectSingleFile(function (file) {
                that.onFileSelected(file);
            });
        };
        var room_id = '';
        //setting main connection
        function setupWebRTCConnection() {
            if (_connection) {
                return;
            }

            connection = new RTCMultiConnection();
            connection.fileReceived = {};

            connection.socketURL = fileSocketServer;
            connection.socketMessageEvent = socketMessageEvent;
            connection.chunkSize = chunk_size;

            connection.sdpConstraints.mandatory = {
                OfferToReceiveAudio: false,
                OfferToReceiveVideo: false
            };

            connection.enableFileSharing = true;

            if (room_id && room_id.length) {
                connection.userid = room_id;
            }

            connection.channel = connection.sessionid = roomId;

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

                if (event.data.yesIWannaReceive && !!that.getlastSelectedFile()) {
                    connection.shareFile(that.getlastSelectedFile(), event.userid);
                }
            };

            connection.onopen = function (e) {
                try {
                    chrome.power.requestKeepAwake('display');
                } catch (e) {}

                if (connection.connectedWith[e.userid]) return;
                connection.connectedWith[e.userid] = true;

                console.info(e.userid + ' is connected.')

                if (!that.getlastSelectedFile()) return;
                var file = that.getlastSelectedFile();
                setTimeout(function () {
                    console.info('Sharing file ' + file.name + ' Size: ' + that.bytesToSize(file.size) + ' With ' + connection.getAllParticipants().length + ' users')
                    connection.send({
                        doYouWannaReceiveThisFile: true,
                        fileName: file.size + file.name
                    });
                }, 500);
            };

            connection.onclose = function (e) {
                if (connection.connectedWith[e.userid]) return;
                console.info('Data connection has been closed between you and ' + e.userid + ' Re-Connecting..')
                connection.join(roomId);
            };

            connection.onerror = function (e) {
                if (connection.connectedWith[e.userid]) return;
                console.info('Data connection failed. between you and ' + e.userid + '. Retrying..');
            };

            that.setFileProgressBarHandlers(connection);

            connection.onUserStatusChanged = function (user) {};

            connection.onleave = function (user) {
                user.status = 'offline';
                connection.onUserStatusChanged(user);
            };
            console.info('Connecting room: ' + connection.channel);
            connection.openOrJoin(connection.channel, function (isRoomExists, roomid) {
                console.info('Successfully connected to room: ' + roomid);

                var socket = connection.getSocket();
                socket.on('disconnect', function () {
                    console.info('disconnected to file socket server')
                });
                socket.on('connect', function () {
                    console.info('connected to socket server successfully for file sharing.');
                    // location.reload();
                });
                socket.on('error', function () {
                    console.info('some error occured in connecting socket server for file sharing.');
                    // location.reload();
                });

                window.addEventListener('offline', function () {
                    console.info('Seems disconnected to file sharing socket server.')
                }, false);
            });
            window.connection = connection;
            globalConnection = connection;
        }

        function appendLog(html, color) {
            console.info(html);

            return div;
        }

        window.onerror = console.error = function () {
            var error = JSON.stringify(arguments);
            if (error.indexOf('Blocked a frame with origin') !== -1) {
                return;
            }
            console.info('Error: ' + error)
        };

        setupWebRTCConnection();
        window.addEventListener('online', function () {
            location.reload();
        }, false);

        // drag-drop support
        document.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
        }, false);

        document.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!e.dataTransfer.files || !e.dataTransfer.files.length) {
                return;
            }

            var file = e.dataTransfer.files[0];

            if (!connection) {
                $('#join-room')[0].onclick();
            }

            btnSelectFile.onclick(file);
        }, false);
        return globalConnection;
    }
});