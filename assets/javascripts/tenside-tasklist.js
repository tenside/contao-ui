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

(function () {
    "use strict";
    angular.module(
        'tenside-tasklist',
        [
            'ui.router', 'tenside-api'
        ]
    ).factory(
        'TensideTasks',
        [
            '$q', '$timeout', '$tensideApi', '$rootScope',
            function ($q, $timeout, $tensideApi, $rootScope) {
                //// CONFIGURATION
                var
                    listRefreshTime = 5000,
                    taskRefreshTime = 1000;
                //// END CONFIGURATION

                var
                // Keep the broadcasting handy.
                    broadcast = $rootScope.$broadcast,
                    listService = this,
                    taskRefreshTimer = {};

                var TaskObject = function (taskId, typeName) {
                    var
                        task = this,
                        $data = {
                            id: taskId,
                            type: typeName,
                            status: null,
                            output: '',
                            lastBuffer: -1
                        };

                    task.getId = function () {
                        return $data.id;
                    };
                    task.getStatus = function () {
                        return $data.status;
                    };
                    task.isRunning = function () {
                        return $data.status === 'RUNNING';
                    };
                    task.isPending = function () {
                        return $data.status === 'PENDING';
                    };
                    task.hasErrored = function () {
                        return $data.status === 'ERROR';
                    };
                    task.isFinished = function () {
                        return $data.status === 'FINISHED';
                    };
                    task.getOutput = function () {
                        return $data.output;
                    };
                    task.isOutputComplete = function () {
                        return task.isFinished() && ($data.lastBuffer === 0);
                    };

                    task.refresh = function () {
                        return $tensideApi.tasks.get(task.getId(), task.getOutput().length)
                            .success(function (data) {
                                var id = task.getId();
                                if (!data.status) {
                                    delete taskRefreshTimer[id];
                                    delete $tasks[id]
                                }

                                $data.output += data.output;
                                $data.status = data.status;
                                $data.lastBuffer = data.output.length;

                                // Setup delayed refreshing if not complete yet.
                                if (task.isOutputComplete()) {
                                    $rootScope.$broadcast('tenside.task.done', task);
                                    delete taskRefreshTimer[id];
                                    delete $tasks[id];
                                } else {
                                    $rootScope.$broadcast('tenside.task.updated', task);
                                    var timer = $timeout(function () {
                                        task.refresh();
                                    }, taskRefreshTime);
                                    taskRefreshTimer[id] = timer;
                                    timer.catch(function () {
                                        delete taskRefreshTimer[id];
                                        delete $tasks[id];
                                    });
                                }
                            })
                            .error(function (result, status) {
                                if (status === 404) {
                                    $rootScope.$broadcast('tenside.task.not-found', task);
                                }
                                // Assume the task is dead - refresh the list then.
                                listRefresh();
                            });
                    };

                    task.refresh();
                };

                var $tasks = {};

                // This handles periodically refreshing of the task list on the server.
                var
                    listRefreshTimer,
                    listRefresh = function () {
                        $tensideApi.tasks.list()
                            .success(function (data) {
                                var info, task, id;

                                listRefreshTimer = undefined;
                                // Add new tasks to the list.
                                for (id in data) {
                                    if (data.hasOwnProperty(id)) {
                                        info = data[id];
                                        task = listService.getTask(info.id);
                                        if (task === null) {
                                            $tasks[info.id] = new TaskObject(info.id, info.type);
                                        }
                                    }
                                }

                                // Now expunge all tasks not listed anymore.
                                var found, id2;
                                for (id in $tasks) {
                                    if (!$tasks.hasOwnProperty(id)) {
                                        continue;
                                    }
                                    found = false;
                                    task = $tasks[id];

                                    for (id2 in data) {
                                        if (data.hasOwnProperty(id2) && (id === id2)) {
                                            found = true;
                                            break;
                                        }
                                    }

                                    if (!found) {
                                        broadcast('tenside.tasklist.removed', {list: listService, task: task});
                                        delete $tasks[id];
                                    }
                                }

                                $rootScope.$broadcast('tenside.tasklist.updated', {list: listService});
                                if (!Object.keys($tasks).length) {
                                    // Nothing in the list anymore, therefore start over and try to fetch a new task.
                                    listRefreshTimer = $timeout(listRefresh, listRefreshTime);
                                }
                            })
                            .error(function (result, status) {
                                // FIXME: handle error here.
                            });
                    };

                // Cleanup all timers etc on scope destruction.
                $rootScope.$on('$destroy', function () {
                    var id;
                    // Cleanup code
                    $timeout.cancel(listRefreshTimer);
                    for (id in taskRefreshTimer) {
                        if (taskRefreshTimer.hasOwnProperty(id)) {
                            $timeout.cancel(taskRefreshTimer[id]);
                            delete taskRefreshTimer[id];
                        }
                    }
                    for (id in $tasks) {
                        if ($tasks.hasOwnProperty(id)) {
                            delete $tasks[id];
                        }
                    }
                });

                listService.getTasks = function () {
                    return $tasks;
                };

                listService.getTask = function (taskId) {
                    if ($tasks[taskId]) {
                        return $tasks[taskId];
                    }

                    return null;
                };

                listService.getCurrentTaskId = function () {
                    for (var id in $tasks) {
                        if ($tasks.hasOwnProperty(id)) {
                            return id;
                        }
                    }

                    return null;
                };

                listService.getCurrentTask = function () {
                    return listService.getTask(listService.getCurrentTaskId());
                };

                listService.startPolling = function () {
                    if (!listRefreshTimer) {
                        listRefresh();
                    }
                };

                listService.stopPolling = function () {
                    $timeout.cancel(listRefreshTimer);
                };

                return listService;
            }
        ]
    )
    ;
})();
