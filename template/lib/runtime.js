/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var util = require('util');
var Emitter = require('events').EventEmitter;

var flog   = require('filelog');
var moment = require('moment');
var configer = require('configer');

/* {{{ private function normalize() */
var normalize = function (s) {
  return String(s).replace(/\W/g, '').toLowerCase();
};
/* }}} */

/* {{{ log formmattor */
var formmat = function (level, tag, msg) {
  return [level + ':', moment().format('YYYY-MM-DD HH:mm:ss'), process.pid,
         String(tag).toUpperCase(), JSON.stringify(msg)].join('\t');
};
/* }}} */

/*{{{ config setting */
var __config = {};
exports.setConfig = function (key, file) {
  __config[key] = configer.create(file);
}

/**
 * @用于让进程获取配置信息
 */
exports.getConfig = function (key, name, defaults) {
  if (!__config[key]) {
    return null;
  }
  return __config[key].get(name, defaults);
}
/*}}}*/

/*{{{ log setting */
var __logs = {};
var loginited = false;
exports.initLog = function () {
  if (!__config['log']) {
    console.log('log.ini not found');
    return;
  }

  if (!__config['log'].get('error')) {
    console.log('error log is required');
    return;
  }

  flog.setExceptionLogger(__config['log'].get('error'));
  process.on('uncaughtException', function (e) {
    e.name = 'uncaughtException';
    flog.logException(e);
    console.log(e.stack);
    process.exit(1);
  });
  
  var All = __config['log'];
  for (var i in All) {
    __logs[i] = flog.create(All[i]);
    __logs[i].setFormatter(formmat);
  }
  loginited = true;

  exports.getLog = function (idx) {
    return __logs[idx || 'debug'];
  }
}
/*}}}*/

/*{{{ mysql setting */
var __mysql;
exports.initMysql = function () {
  if (!__config['mysql']) {
    console.log('mysql.ini not found');
    return;
  }
  var mysql = require('easymysql');

  var options = {
    maxconnections : 20,
    maxidletime : 30000,
  };
  Object.keys(__config['mysql'].get('options')).forEach(function (opt) {
    options[opt] = __config['mysql'].get('options')[opt];
  });

  __mysql = mysql.create(options);
  __mysql.on('error', function (e) {
    if (loginited) {
      flog.logException(e);
    } else {
      console.log(e.stack);
    }
  });

  var All = __config['mysql'].find('server');
  for (var i in All) {
    __mysql.addserver(All[i]);
  }

  exports.query = function (sql, tmout, done) {
    __mysql.query(sql, tmout, function (e, r) {
      done && done(e, r);
      if (e) {
        flog.logException(e, {
          'sql' : sql
        });
      } else {
        __logs['debug'] && __logs['debug']('QUERY', sql);
      }
    });
  };
}
/*}}}*/

