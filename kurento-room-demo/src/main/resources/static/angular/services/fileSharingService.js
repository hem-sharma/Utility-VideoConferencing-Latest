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
        _connection = value;
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
            _connection = null;
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
        //listeners
        window.addEventListener('online', function () {
            location.reload();
        }, false);
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
        return connection;
        //window.connection = connection;
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
        if (kurento)
            kurento.sendMessage(roomName, userName, message);
        return;
    };

    this.joinRoom = function (roomId) {
        var btnSelectFile = $('[type="file"]')[0];
        btnSelectFile.onclick = function (file) {
            if (file && (file instanceof File || file instanceof Blob) && file.size) {
                that.onFileSelected(file);
                return;
            }

            var fileSelector = new FileSelector();
            fileSelector.selectSingleFile(function (file) {
                // previewFile(file);
                that.onFileSelected(file);
            });
        };

        var lastSelectedFile;

        var room_id = '';

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

            connection.filesContainer = logsDiv;
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
                console.info(message)

                if (!lastSelectedFile) return;
                var file = lastSelectedFile;
                setTimeout(function () {
                    console.info('Sharing file<br><b>' + file.name + '</b><br>Size: <b>' + bytesToSize(file.size) + '<b><br>With <b>' + connection.getAllParticipants().length + '</b> users')
                    connection.send({
                        doYouWannaReceiveThisFile: true,
                        fileName: file.size + file.name
                    });
                }, 500);
            };

            connection.onclose = function (e) {
                if (connection.connectedWith[e.userid]) return;
                console.info('Data connection has been closed between you and <b>' + e.userid + '</b>. Re-Connecting..')
                connection.join(roomId);
            };

            connection.onerror = function (e) {
                if (connection.connectedWith[e.userid]) return;
                console.info('Data connection failed. between you and <b>' + e.userid + '</b>. Retrying..');
            };

            setFileProgressBarHandlers(connection);

            connection.onUserStatusChanged = function (user) {};

            connection.onleave = function (user) {
                user.status = 'offline';
                connection.onUserStatusChanged(user);
            };

            var message = 'Connecting room:<br><b>' + connection.channel + '</b>';
            console.info(message);

            connection.openOrJoin(connection.channel, function (isRoomExists, roomid) {
                var message = 'Successfully connected to room: <b>' + roomid + '</b><hr>Other users can join you on iPhone/Android using "' + roomid + '" or desktop (Windows/MacOSX/Ubuntu) users can join using this (secure/private) URL: <a href="./file-sharing.html#' + roomid + '" target="_blank">file-sharing.html#' + roomid + '</a>';

                // if (isRoomEists) { }
                console.info(message);

                if (document.getElementById('room-id')) {
                    if (innerWidth > 500) {
                        $('#room-id')[0].parentNode.innerHTML = 'Joined room: ' + roomid;
                    } else {
                        $('#room-id')[0].parentNode.innerHTML = 'Joined room:<br>' + roomid;
                    }
                }

                var socket = connection.getSocket();
                socket.on('disconnect', function () {
                    appendLog('Seems disconnected.', 'red');
                });
                socket.on('connect', function () {
                    location.reload();
                });
                socket.on('error', function () {
                    location.reload();
                });

                window.addEventListener('offline', function () {
                    appendLog('Seems disconnected.', 'red');
                }, false);
            });
            that._connection = connection;
            window.connection = connection;
            return connection;
        }
        //done in service
        function setFileProgressBarHandlers(connection) {
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
                    // previewFile(file);

                    connection.fileReceived[file.size + file.name] = file;

                    var message = 'Successfully received file';
                    message += '<br><b>' + file.name + '</b>.';
                    message += '<br>Size: <b>' + bytesToSize(file.size) + '</b>.';
                    message += '<br><a href="' + file.url + '" target="_blank" download="' + file.name + '">Download</a>';
                    var div = console.info(message);
                    return;
                }

                var message = 'Successfully shared file';
                message += '<br><b>' + file.name + '</b>.';
                message += '<br>With: <b>' + file.remoteUserId + '</b>.';
                message += '<br>Size: <b>' + bytesToSize(file.size) + '</b>.';
                console.info(message);
            };

            function updateLabel(progress, label) {
                if (progress.position === -1) {
                    return;
                }

                var position = +progress.position.toFixed(2).split('.')[1] || 100;
                label.innerHTML = position + '%';
            }
        }

        //done in  service
        function bytesToSize(bytes) {
            var k = 1000;
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) {
                return '0 Bytes';
            }
            var i = parseInt(Math.floor(Math.log(bytes) / Math.log(k)), 10);
            return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
        }

        //done in service
        function onFileSelected(file) {
            var innerHTML = 'You selected:<br><b>' + file.name + '</b><br>Size: <b>' + bytesToSize(file.size) + '</b>';
            console.info(innerHTML);

            lastSelectedFile = file;

            if (connection) {
                connection.send({
                    doYouWannaReceiveThisFile: true,
                    fileName: file.size + file.name
                });
            }
        }

        var numberOfUsers = $('#number-of-users')[0];

        function incrementOrDecrementUsers() {
            numberOfUsers.innerHTML = connection ? connection.getAllParticipants().length : 0;
        }

        var logsDiv = $('#logs')[0];

        function appendLog(html, color) {
            console.info(html);

            return div;
        }

        window.onerror = console.error = function () {
            var error = JSON.stringify(arguments);
            if (error.indexOf('Blocked a frame with origin') !== -1) {
                return;
            }
            appendLog('Error:<br>' + error, 'red')
        };

        function previewFile(file) {
            btnSelectFile.style.left = '5px';
            btnSelectFile.style.right = 'auto';
            btnSelectFile.style.zIndex = 10;
            btnSelectFile.style.top = '5px';
            btnSelectFile.style.outline = 'none';

            document.querySelector('.overlay').style.display = 'none';
            // iframe.style.display = 'block';

            // iframe.onload = function () {
            //     Array.prototype.slice.call(iframe.contentWindow.document.body.querySelectorAll('*')).forEach(function (element) {
            //         element.style.maxWidth = '100%';
            //     });

            //     if (!file.type || fileNameMatches || file.type.match(/image|video|audio|pdf/g) || iframe.src.indexOf('data:image/png') !== -1 || iframe.src.toLowerCase().search(/.png|.jpeg|.jpg|.gif/g) !== -1) {
            //         iframe.contentWindow.document.body.style.textAlign = 'center';
            //         iframe.contentWindow.document.body.style.background = 'black';
            //         iframe.contentWindow.document.body.style.color = 'white';
            //         return;
            //     }
            //     iframe.contentWindow.document.body.style.textAlign = 'left';
            //     iframe.contentWindow.document.body.style.background = 'white';
            //     iframe.contentWindow.document.body.style.color = 'black';
            // };

            var fileNameMatches = (file.name || '').toLowerCase().match(/.webm|.wav|.pdf|.txt|.js|.css|.cs|.png|.jpg|.jpeg|.gif/g);
            if (fileNameMatches) {
                // iframe.src = URL.createObjectURL(file);
            } else {
                // iframe.src = 'https://rtcxp.com/fs/unknown-file.png';
            }
        }

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
    }
});