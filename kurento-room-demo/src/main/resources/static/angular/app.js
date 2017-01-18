var kurento_room = angular.module('kurento_room', ['ngRoute', 'FBAngular', 'lumx', 'ngAnimate',
    'ngAria',
    'ngMessages',
    'ngMaterial'
]);

kurento_room.config(function ($routeProvider) {

    $routeProvider
        .when('/', {
            templateUrl: 'angular/home/index.html'
        })
        .when('/call/eventId/:eventId/accessToken/:accessToken/user/:user', {
            templateUrl: 'angular/call/call.html',
            controller: 'callController',
        })
        .when('/error', {
            templateUrl: 'angular/Error/error.html',
        })
        .when('/thanks', {
            templateUrl: 'angular/thanks/thanks.html'
        })
        .when('/join/hub/:hub', {
            templateUrl: 'angular/login/login.html',
            controller: 'loginController'
        })
        .otherwise({
            templateUrl: 'angular/home/index.html'
        });
});

kurento_room.filter('split', function () {
    return function (input, splitChar, splitIndex) {
        if (typeof (input) != 'undefined')
            return input.split(splitChar)[splitIndex];
        return '';
    }
});
kurento_room.directive('customOnChange', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var onChangeHandler = scope.$eval(attrs.customOnChange);
            element.bind('change', onChangeHandler);
        }
    };
});

kurento_room.filter('trustUrl', function ($sce) {
    return function (url) {
        return $sce.trustAsResourceUrl(url);
    };
});