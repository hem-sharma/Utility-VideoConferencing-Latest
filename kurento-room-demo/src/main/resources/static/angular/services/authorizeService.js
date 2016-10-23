kurento_room.factory('authService', ['$http', '$q', function ($http, $q) {
    var service = {};
    service.auth = auth;
    return service;

    function auth(event, token) {
        var data = {
            Event: event,
            Token: token
        };
        var deferred = $q.defer();
        $http.get('http://52.187.79.197:85/api/room/authorize', data).then(function (res) {
            deferred.resolve(res);
        })
            .then(function (res) {
                deferred.reject(res);
            });
        return deferred.promise;
    }
}]);