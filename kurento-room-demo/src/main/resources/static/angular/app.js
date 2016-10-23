var kurento_room = angular.module('kurento_room', ['ngRoute', 'FBAngular', 'lumx']);

kurento_room.config(function ($routeProvider, $routeParams) {

    $routeProvider
        .when('/', {
            templateUrl: 'angular/Error/error.html'
        })
        .when('/call/:eventId/:accessToken/:user', {
            templateUrl: 'angular/call/call.html',
            controller: 'callController',
            // resolve: {
            //     factory: checkAccess
            // }
        })
        .when('/error', {
            templateUrl: 'angular/Error/error.html'
        })
        .otherwise({
            templateUrl: 'angular/Error/error.html'
        });
});



