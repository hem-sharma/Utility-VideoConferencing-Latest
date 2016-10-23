var kurento_room = angular.module('kurento_room', ['ngRoute', 'FBAngular', 'lumx']);

kurento_room.config(function ($routeProvider) {

    $routeProvider
        .when('/', {
            templateUrl: 'angular/Error/error.html'
        })
        .when('/call/eventId/:eventId/accessToken/:accessToken/user/:user', {
            templateUrl: 'angular/call/call.html',
            controller: 'callController',
        })
        .when('/error', {
            templateUrl: 'angular/Error/error.html',
        })
        .otherwise({
            templateUrl: 'angular/Error/error.html'
        });
});


