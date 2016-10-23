kurento_room.factory('authService', function ($http, $q) {
    var authorize = {};
    authorize.auth = auth;
    return authorize;
    function auth(eventId, accessToken, user) {
        var payLoad = {
            Event: eventId,
            Token: accessToken,
            User: user
        };
        var req = 'http://52.187.79.197:85/api/room/checkroomaccess?eventId=' + payLoad.Event + '&accessToken=' + payLoad.Token + '&user=' + payLoad.User;
        $http.get(req)
            .then(function (response) {
                console.log('response 1');
                console.log(response);
                deferred.resolve(response);
            })
            .then(function (response) {
                console.log('response 2');
                console.log(response);
                deferred.reject(response);
            });
            console.log('deferred.promise');
            console.log(deferred.promise);
        return deferred.promise;
    }
});