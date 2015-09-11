'use strict';
var sql = require('sql');
var sqlFormat = require('mysql').format;
var async = require('async');
var _s = require('underscore.string');
var _ = require('underscore');
var assert = require('assert');
var Data = require('./data');
var consts = require('../consts');
var utils = require('../utils');
// var lib = require('../index');

module.exports = function(lib, def, connType) {

  var DataMongodb = function(lib, model) {
    Data.call(this, lib, model);
    this.isSaved = false;
    this.conn = DataMongodb.conn;
    assert.ok(!!this.conn, 'connection should not be empty');
  }

  _.extend(DataMongodb.prototype, Data.prototype);
  _.extend(DataMongodb, Data);

  DataMongodb.conn = utils.getConnection(lib, def, connType);


  /**
   * Instance methods
   */

  /**
   * Private methods
   */

  DataMongodb.prototype.__getCollection = function() {
    return this.conn.collection(def.db.coll_name);
  }

  DataMongodb.prototype.__genId = function() {

    var db = this.model.def.db;
    var props = this.model.def.props;
    var prop, value;
    var values = [];
    for (prop in props) {
      if (props[prop].primary) {
        value = this.model.p(prop);
        if (value === undefined) {
          var err = _s.sprintf('model[%s] generate hash key need all primary key exists: %s\ndetail: %s', this.model.def.name, prop, JSON.stringify(this.model.toModelJSON()));
          assert.ok(false, err);
        }
        values.push(value);
      }
    }
    return values.join(':');
  }

  /**
   * Public methods
   */

  DataMongodb.prototype.createSync = DataMongodb.prototype.create = function(cb) {

    var self = this;
    var args = _(this.model.props).clone();
    args._id = this.__genId();
    var toBeUpdateVersion = this.model.mem.__version;
    this.__getCollection().insertOne(args, function(err, res) {
      // console.log(err, res);
      if (!!err) {
        lib.logger.error('create error:', err, args);
      } else {
        self.isSaved = true;
        self.updateVersion(toBeUpdateVersion);
      }
      cb(err);
    });
    lib.logger.debugMongodb('create:', args);
  }

  DataMongodb.prototype.load = function(cb) {
    var self = this;
    var args = this.model.getPrimaryKeysAndValues();
    this.__getCollection().findOne(args, function(err, res) {
      if (!!err) {
        lib.logger.error('load error:', err, args);
      }
      cb(err, res);
    });
    lib.logger.debugMongodb('load:', args);
  }

  DataMongodb.prototype.updateSync = DataMongodb.prototype.update = function(cb) {

    if (!this.model || this.model.isRemoved) {
      cb();
      return;
    }

    if (!this.isSaved) {
      this.create(cb);
      return;
    }

    if (!this.isModified()) {
      cb();
      return;
    }

    var self = this;
    var queryArgs = {
      _id: this.__genId()
    };
    var updateArgs = {
      $set: this.model.getPropsWithoutPrimaryKeys()
    }
    var toBeUpdateVersion = this.model.mem.__version;
    this.__getCollection().update(queryArgs, updateArgs, function(err) {
      if (!!err) {
        lib.logger.error('update error:', err, queryArgs, updateArgs);
      } else {
        if (!!self.model && !self.model.isRemoved) {
          self.updateVersion(toBeUpdateVersion);
        }
      }
      cb(err);
    });
    lib.logger.debugMongodb('update:', queryArgs, updateArgs);
  }

  DataMongodb.prototype.remove = function(cb) {

    var self = this;
    var args = {
      _id: this.__genId()
    };
    this.__getCollection().remove(args, function(err) {
      if (!!err) {
        lib.logger.error('remove error:', err, args);
      } else {
        self.isSaved = false;
      }
      cb(err);
    });
    lib.logger.debugMongodb('remove:', args);
  }

  /**
   * Static methods
   */

  /**
   * Private methods
   */

  DataMongodb.__getCollection = DataMongodb.prototype.__getCollection;

  /**
   * Public methods
   */

  /**
   * Find by primary keys, unique keys and indexes, return primary keys
   * @param  {Object}   args
   * @param  {Function} cb
   * @return {Void}
   */
  DataMongodb.find = function(args, cb) {
    var keys = utils.getPrimaryKeys(def);
    var projArgs = {};
    keys.forEach(function(elem) {
      projArgs[elem] = true;
    });
    this.__getCollection().find(args, projArgs).toArray(function(err, res) {
      if (!!err) {
        lib.logger.error('static find error:', err, args, projArgs);
      }
      cb(err, res);
    });
    lib.logger.debugMongodb('static find:', args, projArgs);
  }

  DataMongodb.remove = function(args, cb) {
    this.__getCollection().remove(args, function(err) {
      if (!!err) {
        lib.logger.error('static remove error:', err, args);
      }
      cb(err);
    });
    lib.logger.debugMongodb('static remove:', args);
  }

  DataMongodb.count = function(args, cb) {
    this.__getCollection().count(args, function(err, res) {
      if (!!err) {
        lib.logger.error('static count error:', err, args);
      }
      cb(err, res);
    });
    lib.logger.debugMongodb('static count:', args);
  }

  /**
   * !!!CAUTION: IT WOULD RETURN ALL OBJECT PRIMARY VALUES!!!
   * @param  {Function} cb [description]
   * @return {[type]}      [description]
   */
  DataMongodb.findAll = function(cb) {
    this.find({}, cb);
  }

  /**
   * !!!CAUTION: IT WOULD REMOVE ALL OBJECTS!!!
   * @param  {Function} cb [description]
   * @return {[type]}      [description]
   */
  DataMongodb.removeAll = function(cb) {
    this.remove({}, cb);
  }

  DataMongodb.countAll = function(cb) {
    this.count({}, cb);
  }


  return require('bluebird').promisifyAll(DataMongodb);
}

module.exports.__type__ = consts.DataType.MONGODB;