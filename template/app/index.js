/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var runtimePath = __dirname + '/../../lib/runtime';
var Runtime = require(runtimePath);

var configPath = __dirname + '/../../etc/';
Runtime.setConfig('log', configPath + 'log.ini');
Runtime.initLog();
Runtime.setConfig('mysql', configPath + 'mysql.ini');
Runtime.initMysql();
Runtime.setConfig('{{worker}}', configPath + '{{worker}}.ini');

var _me = require('pm').createWorker();
_me.on('suicide', function (from) {
  //before process exits, release all resources here
});
_me.ready();
