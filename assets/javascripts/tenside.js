/**
 * This file is part of tenside/contao-ui.
 *
 * (c) Christian Schiffler <c.schiffler@cyberspectrum.de>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * This project is provided in good faith and hope to be usable by anyone.
 *
 * @package    tenside/contao-ui
 * @author     Christian Schiffler <c.schiffler@cyberspectrum.de>
 * @copyright  2015 Christian Schiffler <c.schiffler@cyberspectrum.de>
 * @license    https://github.com/tenside/contao-ui/blob/master/LICENSE MIT
 * @link       https://github.com/tenside/contao-ui
 * @filesource
 */

var TENSIDE;
var TENSIDEApi = TENSIDEApi || '';

(function () {
    "use strict";
    TENSIDE = angular.module(
        'tenside',
        [
            'ui.router', 'ui.bootstrap', 'pascalprecht.translate',
            'tenside-api', 'tenside-install', 'tenside-tasklist', 'tenside-console'
        ]
    );
    TENSIDE
        .run(
            [
                '$tensideApi',
                function ($tensideApi) {
                    $tensideApi.setBaseUrl(TENSIDEApi);
                }
            ]
        )
        // Provide a fancy "loading" circle element.
        .factory('loadingHandler',
            [
                '$q',
                '$rootScope',
                function ($q, $rootScope) {
                    var counter = 0;
                    return {
                        'request': function (config) {
                            $rootScope.loading = (++counter > 0);
                            return config;
                        },
                        'requestError': function (rejection) {
                            $rootScope.loading = (--counter > 0);
                            return $q.reject(rejection);
                        },
                        'response': function (response) {
                            $rootScope.loading = (--counter > 0);
                            return response;
                        },
                        'responseError': function (response) {
                            $rootScope.loading = (--counter > 0);
                            return $q.reject(response);
                        }
                    };
                }
            ]
        )
        .config(
            [
                '$stateProvider', '$urlRouterProvider', '$httpProvider', '$translateProvider',
                function ($stateProvider, $urlRouterProvider, $httpProvider, $translateProvider) {

                    $httpProvider.interceptors.push('loadingHandler');
                    $translateProvider
                        .useSanitizeValueStrategy('escape')
                        .registerAvailableLanguageKeys(['en', 'de'], {
                            'en*': 'en',
                            'de*': 'de'
                        })
                        .useStaticFilesLoader({
                            prefix: 'l10n/',
                            suffix: '.json'
                        })
                        .usePostCompiling(true)
                        .fallbackLanguage('en')
                        .determinePreferredLanguage();
                    if ('' === $translateProvider.use()) {
                        $translateProvider.preferredLanguage('en')
                    }

                    $urlRouterProvider.otherwise('/');
                    $stateProvider
                        .state(
                            'index',
                            {
                                url: '/',
                                templateUrl: 'pages/index.html',
                                controller: 'TensideIndexController'
                            }
                        )
                        .state(
                            'about',
                            {
                                url: '/about',
                                templateUrl: 'pages/about.html',
                                controller: 'tensideAboutController'
                            }
                        )
                        .state(
                            'support',
                            {
                                url: '/support',
                                templateUrl: 'pages/support.html',
                                controller: 'tensideSupportController'
                            }
                        )
                    ;
                }
            ]
        )
        .run(
            [
                '$rootScope', '$translate', 'TensideTasks',
                function ($rootScope, $translate, TensideTasks) {
                    $rootScope.$on('$stateChangeSuccess', function (event, toState/*, toParams, fromState, fromParams*/) {
                        $rootScope.appContentClass = toState.name;

                        // Do not start polling in install screen.
                        if (toState.name !== 'install') {
                            TensideTasks.startPolling();
                        }

                        $translate('title.' + toState.name).then(function (translation) {
                            $rootScope.title = translation;
                        }, function () {
                            $translate('title.base').then(function (translation) {
                                $rootScope.title = translation;
                            })
                        });
                    });
                }
            ]
        )
        .controller('TensideIndexController',
            ['$http', '$state',
                function ($http, $state) {
                    // Determine the initial state of the application.
                    $http.get(TENSIDEApi + '/api/v1/install/get_state.json').success(function (data) {
                        if (data.installation) {
                            var state;
                            switch (data.installation) {
                                case 'FRESH':
                                case 'PARTIAL':
                                    state = 'install';
                                    break;
                                default:
                                    state = 'packages';
                            }
                            $state.go(state);
                        }
                    });
                }
            ]
        )
        .controller(
            'tensideAboutController',
            [
                '$scope',
                function ($scope) {
                    $scope.config = {};
                }
            ]
        )
        .controller(
            'tensideSupportController',
            [
                '$scope',
                function ($scope) {
                    $scope.config = {};
                }
            ]
        );
})();
