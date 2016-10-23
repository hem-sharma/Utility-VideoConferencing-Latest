kurento_room.factory('authService', function ($http, $q) {
    var authorize = {};
    authorize.auth = auth;
    return authorize;

    function auth(eventId, accessToken) {
        var payLoad={
          Event: eventId,
          Token: accessToken  
        };
        
        $http.get('http://52.187.79.197:85/api/room/authorize',data)
        .then(function(response){
            deferred,resolve(response);
        })
        .then(function(response){
           deferred.reject(response); 
        });  
        
        return deferred.promise;
    }
});