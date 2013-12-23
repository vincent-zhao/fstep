/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');
var mkdirp = require('mkdirp');
var configer = require('configer');

var indent = '    ';

/*{{{ function normalize() */
function normalize() {
  var parts = ['/'];
  var array = Array.prototype.slice.call(arguments);
  array.forEach(function (one) {
    parts.push(one);
  });
  return path.normalize(parts.join('/'));
}
/*}}}*/

/*{{{ function cp() */
function cp(src, dest, obj) {
  if (fs.statSync(src).isDirectory()) {
    mkdirp.sync(dest);
    fs.readdirSync(src).forEach(function (file) {
      cp(normalize(src, file), normalize(dest, file), obj);
    });
    return;
  }
  var content = fs.readFileSync(src).toString();
  Object.keys(obj).forEach(function (one) {
    content = content.replace(new RegExp('{{' + one + '}}', 'g'), obj[one]);
  });
  fs.writeFileSync(dest, content);
}
/*}}}*/

var configFile = process.argv[2] || __dirname + '/config-example.ini';
var config = configer.create(configFile);

//values for replace
var values = {};

/*{{{ init project folder */
var projectName = config.get('options')['project.name'];
var projectDir  = config.get('options')['project.dir'] || __dirname;
var projectPath = normalize(projectDir, projectName);
if (fs.existsSync(projectPath)) {
  console.log(util.format('%s already exists, delete before create', projectPath));
  process.exit();
}
mkdirp.sync(projectPath);
values['project.name'] = projectName;
/*}}}*/

/*{{{ read configs from config file */
//worker processes
var workers = config.find('worker');
//mysql settings
var mysqlOptions = config.get('mysql:options');
var mysqlServers = config.find('mysql:server');
/*}}}*/

/*{{{ read templates and generate files into project folder according to the configs read before */
var templates = __dirname + '/template';
fs.readdirSync(templates).forEach(function (file) {
  var src  = normalize(templates, file);
  var dest = normalize(projectPath, file);

  /*{{{ generate app folder */
  if (file === 'app') {
    //mkdir /app
    mkdirp.sync(dest);
    for (var i in workers) {
      var wpath = normalize(dest, i);
      //mkdir /app/worker
      mkdirp.sync(wpath);

      var templateIndex = normalize(src, 'index.js');
      var content = fs.readFileSync(templateIndex).toString().replace(/\{\{worker\}\}/g, i);
      //write file /app/worker/index.js
      fs.writeFileSync(normalize(wpath, 'index.js'), content);
    }
    return;
  }
  /*}}}*/

  /*{{{ generate build folder */
  if (file === 'build') {
    //cp /build to destination folder
    cp(src, dest, values);
    
    //worker config in master.ini
    var worker_config_in_master = [];
    //worker config in default.properties
    var worker_config_in_properties = [];
    //worker config in make.js 
    var worker_config_in_make = [];
    for (var i in workers) {
      worker_config_in_master.push([
        '[worker:' + i + ']', 
        'script = "##dir.root##/app/' + i + '/index.js"',
        'children = ##' + i + '.children##',
        ''
      ].join('\n'));

      worker_config_in_properties.push(i + '.children = ##' + i + '.children##');
      worker_config_in_make.push(indent + '\'' + i + '.children\' : ' + workers[i]['children.num'] + ',');

      var workerconfig = normalize(dest, 'tpl', i + '.ini');
      fs.writeFileSync(workerconfig, [';', i, ' config here'].join(''));
    }
    
    //mysql config in mysql.ini
    var mysql_config_in_mysql = [];
    //mysql config in default.properties
    var mysql_config_in_properties = [];
    //mysql config in make.js
    var mysql_config_in_make = [];
    var mysqls = config.find('mysql:server');
    for (var idx in mysqlServers) {
      mysql_config_in_mysql.push([
        '[server:' + idx + ']',
        'host = "##mysql.server' + idx + '.host##"',
        'port = ##mysql.server' + idx + '.port##',
        'user = "##mysql.server' + idx + '.user##"',
        'password = "##mysql.server' + idx + '.password##"',
        'database = "##mysql.server' + idx + '.database##"',
        ''
      ].join('\n'));
      mysql_config_in_properties.push([
        'mysql.server' + idx + '.host = ##mysql.server' + idx + '.host##',
        'mysql.server' + idx + '.port = ##mysql.server' + idx + '.port##',
        'mysql.server' + idx + '.user = ##mysql.server' + idx + '.user##',
        'mysql.server' + idx + '.password = ##mysql.server' + idx + '.password##',
        'mysql.server' + idx + '.database = ##mysql.server' + idx + '.database##',
        ''
      ].join('\n'));
      mysql_config_in_make.push([
        indent + '\'mysql.server' + idx + '.host\' : \'' + (mysqlServers[idx].host || 'localhost') + '\',',
        indent + '\'mysql.server' + idx + '.port\' : ' + (mysqlServers[idx].port || 3306) + ',',
        indent + '\'mysql.server' + idx + '.user\' : \'' + (mysqlServers[idx].user || 'root') + '\',',
        indent + '\'mysql.server' + idx + '.password\' : \'' + (mysqlServers[idx].password || 'root') + '\',',
        indent + '\'mysql.server' + idx + '.database\' : \'' + (mysqlServers[idx].database || 'mydb') + '\',',
        ''
      ].join('\n'));
    }

    //write config into mysql.ini
    if (mysql_config_in_mysql.length) {
      var opts = ['[options]'];
      for (var j in mysqlOptions) {
        opts.push(j + ' = ' + mysqlOptions[j]);
      }
      var mysql_configs = [
        ';mysql config',
        '',
        opts.join('\n'),
        '',
        mysql_config_in_mysql.join('\n')
      ];
      mysql_configs.push();
      mysql_configs.push();
      fs.writeFileSync(normalize(dest, 'tpl', 'mysql.ini'), mysql_configs.join('\n'));
    }
    
    //write config into master.ini
    var master_content = fs.readFileSync(normalize(dest, 'tpl', 'master.ini')).toString();
    master_content = master_content.replace(/\{\{workers\}\}/g, worker_config_in_master.join('\n'));
    fs.writeFileSync(normalize(dest, 'tpl', 'master.ini'), master_content);

    //write config into default.properties
    var properties_content = fs.readFileSync(normalize(dest, 'tpl', 'default.properties')).toString();
    properties_content = properties_content.replace(/\{\{workers\}\}/g, 
      worker_config_in_properties.join('\n'));
    properties_content = properties_content.replace(/\{\{mysqls\}\}/g, 
      mysql_config_in_properties.join('\n'));
    fs.writeFileSync(normalize(dest, 'tpl', 'default.properties'), properties_content);

    //write config into make.js
    var make_content = fs.readFileSync(normalize(dest, 'make.js')).toString();
    make_content = make_content.replace(/\{\{workers\}\}/g, worker_config_in_make.join('\n'));
    make_content = make_content.replace(/\{\{mysqls\}\}/g, mysql_config_in_make.join('\n'));
    fs.writeFileSync(normalize(dest, 'make.js'), make_content);
    return;
  }
  /*}}}*/

  //copy other folders
  cp(src, dest, values);
});
/*}}}*/

console.log(projectName + ' init succeed!');
process.exit();

