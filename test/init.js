'use strict';
var mysql = require('mysql');
var redis = require('redis');
var model = require('../lib');
var debug_mode = model.debug_mode = false;
// var debug_mode = model.debug_mode = true;

module.exports = function(dbConfig) {

  var pool = mysql.createPool(dbConfig || {
    connectionLimit: 10,
    host: 'localhost',
    user: 'yqb',
    password: 'yqb',
    database: 'model_test',
    multipleStatements: true,
    debug: ['ComQueryPacket'],
  });

  model.setDBClient(pool);

  var redisClient = redis.createClient();
  model.setCacheClient(redisClient);

  model.initialize(require('./cg_model'));
}