/**
 * Author: Jeff Whelpley
 * Date: 2/17/14
 *
 * CRUD operations for mongo when used within pancakes
 */
var Q           = require('q');
var _           = require('lodash');
var mongoose    = require('mongoose');

var admin = {
    _id: new mongoose.Types.ObjectId('000000000000000000000000'),
    name: 'systemAdmin',
    type: 'user',
    role: 'admin'
};

var realtimeAdmin = {
    _id: new mongoose.Types.ObjectId('000000000000000000000000'),
    name: 'moderators',
    type: 'user',
    role: 'admin'
};

/**
 * Constructor for the persist adapter
 * @param resource
 * @constructor
 */
function MongoAdapter(resource) {
    this.admin = admin;
    this.realtimeAdmin = realtimeAdmin;
    this.resource = resource;
    this.Model = this.getModel(resource);
}

//************************************
//********* STATIC STUFF *************
//************************************

/**
 * Caching models
 * @type {{}}
 */
MongoAdapter.modelCache = {};

/**
 * Connect to Mongo via mongoose
 *
 * @param dbUri
 * @param debugFlag
 */
MongoAdapter.connect = function connect(dbUri, debugFlag) {
    var deferred = Q.defer();
    var opts = {};

    if (dbUri.indexOf(',') > 0) {
        opts.mongos = true;
    }

    mongoose.set('debug', debugFlag);

    // make sure we disconnect any other existing connections
    mongoose.disconnect(function () {
        mongoose.connect(dbUri, opts, function (err)  {
            err ? deferred.reject(err) : deferred.resolve();
        });
    });

    return deferred.promise;
};

/**
 * Disconnect from the database
 */
MongoAdapter.disconnect = function disconnect() {
    mongoose.disconnect();
};

/**
 * Initialize the connection to mongo. NOTE: it is NOT
 * a mistake that this is a static method instead of an
 * instance method. We do this so that mw.service.init
 * middleware will initialize the mongo connection once.
 *
 * @param config
 * @returns {*}
 */
MongoAdapter.init = function init(config) {
    var deferred = Q.defer();

    MongoAdapter.connect(config.mongo.url, config.mongo.debug)
        .then(function () {
            deferred.resolve(config);
        })
        .catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
};

/**
 * Static function used to clear out the model cache
 */
MongoAdapter.clearCache = function clearCache() {
    MongoAdapter.modelCache = {};
};

//************************************
//********* CLASS METHODS ************
//************************************


/**
 * Create a mongoose model object from a set of fields, fieldsets and indexes
 *
 * @param resource
 * @returns {Model}
 */
MongoAdapter.prototype.getModel = function getModel(resource) {
    var name = resource.name;

    // if not already in the model cache, get it
    if (!MongoAdapter.modelCache[name]) {
        var schema = new mongoose.Schema(resource.fields, { collection: name });

        // loop through indexes and add them to the schema
        _.each(resource.indexes, function (idx) {
            schema.index(idx.fields, idx.options);
        });

        MongoAdapter.modelCache[name] = mongoose.model(name, schema);
    }

    return MongoAdapter.modelCache[name];
};

/**
 * Get the count of how many documents match a given set of conditions
 * @param req
 * @returns {Promise}
 */
MongoAdapter.prototype.baseCount = MongoAdapter.prototype.count = function count(req) {
    var deferred = Q.defer();
    var where = req.where || {};

    this.Model.count(where, function (err, modelCount) {
        err ? deferred.reject(err) : deferred.resolve(modelCount);
    });

    return deferred.promise;
};

/**
 * Create a new model and return back the data
 * @param req
 * @returns {Promise}
 */
MongoAdapter.prototype.baseCreate = MongoAdapter.prototype.create = function create(req) {
    var err = this.setCreatedBy(req) || this.setModifiedBy(req);
    var deferred = Q.defer();

    if (err) { deferred.reject(err); return deferred.promise; }

    var model = new this.Model(req.data);
    model.save(function (modelErr) {
        modelErr ? deferred.reject(modelErr) : deferred.resolve(model.toObject());
    });

    return deferred.promise;
};

/**
 * Convenience method for finding by ID. We will accept legacy IDs, so need to
 * do a quick check on that.
 * @param req
 * @returns {Promise}
 */
MongoAdapter.prototype.baseFindById = MongoAdapter.prototype.findById = function findById(req) {
    var id = req._id + '';
    return this.find({
        where:      id.length < 20 ? { legacyId: parseInt(id, 10) } : { _id: req._id },
        findOne:    true
    });
};

/**
 * Query the resource
 * @param req
 * @returns {Promise}
 */
MongoAdapter.prototype.baseFind = MongoAdapter.prototype.find = function find(req) {
    var deferred = Q.defer();
    var select = req.select || null;
    var where = req.where || {};

    if (select && _.isArray(select)) {
        select = select.join(' ');
    }

    var options = {
        skip: req.skip || 0,
        lean: true
    };

    if (req.limit) {
        options.limit = req.limit;
    }

    // if no status set, default to only active statuses
    if (!req.findOne && !req.allStatuses && this.resource.fields && this.resource.fields.status && !where.status) {
        where.status = { $in: ['created', 'approved'] };
    }
    var query = req.findOne ?
        this.Model.findOne(where, select, options) :
        this.Model.find(where, select, options);

    if (req.sort) {
        query = query.sort(req.sort);
    }
    var promise = query.exec();

    // if the client wants the count, we will need to do an extra query and then add it to the results
    if (req.includeCount) {
        promise = Q.spread([promise, this.count({ where: where })],
            function (data, count) {
                if (data && _.isArray(data)) {
                    for (var i = 0; i < data.length; i++) {
                        data[i].idx = i + options.skip;
                        data[i].count = count;
                    }
                }
                return data;
            });
    }

    promise.then(function (data) {
        deferred.resolve(data || null);
    })
    .then(null, function (err) {
        deferred.reject(err);
    });

    return deferred.promise;
};

/**
 * Update is by default for one document, but can be done with multiple
 * if the multi option is passed in
 * @param req
 * @returns {Promise}
 */
MongoAdapter.prototype.baseUpdate = MongoAdapter.prototype.update = function update(req) {
    var deferred = Q.defer();
    // by default we audit, but if flag set in request, don't change modify fields

    if (!req.noaudit) {
        var err = this.setModifiedBy(req);
        if (err) { deferred.reject(err); return deferred.promise; }
    }
    // if _id exists, set the where
    if (req._id) {
        req.where = { _id: req._id };
    }

    var data = req.data || {};
    var where = req.where || {};
    var options = {
        multi:  req.multi || false,
        upsert: req.upsert || false,
        select: req.select || (req.multi ? '_id' : ''),
        lean:   true,
        'new':  true
    };

    var stmt = req.multi ?
        this.Model.update(where, data, options) :
        this.Model.findOneAndUpdate(where, data, options);

    stmt.exec()
        .then(function (updatedData) {
            deferred.resolve(updatedData);
        })
        .then(null, deferred.reject);


    return deferred.promise;
};

/**
 * This will just mark a document or documents as deleted. To remove permanently,
 * use the removePermanently() function
 * @param req
 * @returns {Promise}
 */
MongoAdapter.prototype.baseRemove = MongoAdapter.prototype.remove = function remove(req) {
    var deferred = Q.defer();
    var err = this.setModifiedBy(req);

    if (err) { deferred.reject(err); return deferred.promise; }

    // try to use the _id if no other where conditions
    req.data = { status: 'deleted' };
    var id = req._id || (req.data && req.data._id);
    if (!req.where && id) {
        req.where = { _id: id };
    }

    // if no where conditions, error
    if (!req.where) {
        deferred.reject('No conditions passed into remove');
        return deferred.promise;
    }

    var options = {
        multi: req.multi || false,
        select: req.select || '',
        lean: true,
        'new': true
    };

    var stmt = req.multi ?
        this.Model.update(req.where, req.data, options) :
        this.Model.findOneAndUpdate(req.where, req.data, options);

    stmt.exec()
        .then(function (data) {
            deferred.resolve(data);
        })
        .then(null, deferred.reject);

    return deferred.promise;
};

/**
 * WARNING: use this with caution!
 *
 * This will permanently delete one or more documents from the database.
 *
 * @param req
 * @returns {*}
 */
MongoAdapter.prototype.baseRemovePermanently = MongoAdapter.prototype.removePermanently = function removePermanently(req) {
    var deferred = Q.defer();

    // try to use the _id if no other where conditions
    var id = req._id || (req.data && req.data._id);
    if (!req.where && id) {
        req.where = { _id: id };
    }

    var stmt = req.multi ?
        this.Model.remove(req.where) :
        this.Model.findOneAndRemove(req.where, { lean: true });

    stmt.exec()
        .then(function (data) {
            deferred.resolve(data);
        })
        .then(null, function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
};

/**
 * Insert a set of documents into the database
 * @param req
 * @returns {*}
 */
MongoAdapter.prototype.baseBulkInsert = MongoAdapter.prototype.bulkInsert = function bulkInsert(req) {
    var deferred = Q.defer();

    this.Model.create(req.data, function (err) {
        err ? deferred.reject(err) : deferred.resolve();
    });

    return deferred.promise;
};

/**
 * Take data returned from elasticsearch and hydrate it.
 * Note: this method is only used internally, so we can have
 * a second param other than the normal req
 *
 * @param req
 * @param data
 */
MongoAdapter.prototype.hydrate = function hydrate(req, data) {
    if (!data || !data.results) { return []; }

    var skip = req.skip || 0;
    var documents = data.results;
    var count = data.count || 0;
    var docIds = documents.map(function (document) {
        return document._id + '';
    });

    // if no IDs, nothing to hydrate so return right away
    if (docIds.length === 0) { return new Q([]); }

    var findReq = { where: { _id: { '$in': docIds } } };
    if (req.select) {
        findReq.select = req.select;
    }

    return this.baseFind(findReq)
        .then(function (hydratedDocs) {
            var docLookup = {};

            // create a lookup mechanism so we can put the docs in order
            for (var i = 0; i < hydratedDocs.length; i++) {
                docLookup[hydratedDocs[i]._id] = hydratedDocs[i];
            }

            return docIds
                .filter(function (docId) {
                    return docLookup[docId];
                })
                .map(function (docId, idx) {
                    var doc = docLookup[docId];
                    doc.count = count;
                    doc.idx = idx + skip;
                    return doc;
                });
        });
};

/**
 * The Starts with function is meant to only work
 * with one chacter so other characters are ignored
 * @param req
 */
MongoAdapter.prototype.checkStartsWithParam = function checkStartsWithParam(req) {
    req.where = req.where || {};

    // we delete regardless because this param is not used at the lower level
    var startsWith = req.startsWith || req.query;
    delete req.startsWith;
    delete req.query;

    // if startsWith, translate to where clause
    if (!startsWith || req.name) { return; }

    if (startsWith) {

        // if value starts with a letter and is not Other then search by letter
        if (/^[A-Za-z]/.test(startsWith) && startsWith !== 'Other') {
            var upperCase = startsWith.substring(0, 1).toUpperCase();
            var lowerCase = startsWith.substring(0, 1).toLowerCase();
            req.where.name = { '$regex': new RegExp('^(' + upperCase + '|' + lowerCase + ')') };
        }
        // else find everything outside of letters
        else {
            req.where.name = { '$regex': /^[^A-Za-z]/ };
        }
    }
};


/**
 * Set the created by fields
 * @param req
 */
MongoAdapter.prototype.setCreatedBy = function setCreatedBy(req) {
    var caller = req.caller;
    var data = req.data || {};
    var resource = this.resource || req.resource;

    // first check to make sure the resource has workflow fields
    if (resource && resource.fields && (!resource.fields.status || !resource.fields.createDate)) {
        return;
    }

    // if no caller then throw error
    if (!caller) {
        throw new Error('No caller found for setCreatedBy');
    }

    data.status = data.status || 'created';

    if (caller.role === 'admin' && data.createUsername) {
        data.createUserType = data.createUserType || 'visitor';
    }
    else if (caller.onBehalfOf) {
        data.createUserId = caller.onBehalfOf._id;
        data.createUsername = caller.onBehalfOf.name || '';
        data.createUserType = caller.onBehalfOf.type;
    }
    else {
        data.createUserId = caller._id;
        data.createUsername = caller.name || '';
        data.createUserType = caller.type;
    }

    req.data = data;
};

/**
 * Set modified by fields
 * @param req
 * @returns {*}
 */
MongoAdapter.prototype.setModifiedBy = function setModifiedBy(req) {
    var caller = req.caller;
    var data = req.data || {};
    var resource = this.resource || req.resource;

    // first check to make sure the resource has workflow fields
    if (resource && resource.fields && (!resource.fields.status || !resource.fields.modifyDate)) {
        return;
    }

    // if no caller then throw error
    if (!caller) {
        throw new Error('No caller found for setModifiedBy');
    }

    if (caller.name === this.admin.name) {
        data.sysadminDate = new Date();
    }
    else {
        data.modifyDate = data.modifyDate || new Date();

        if (caller.onBehalfOf) {
            data.modifyUserId = data.modifyUserId || caller.onBehalfOf.id;
            data.modifyUsername = data.modifyUsername || caller.onBehalfOf.name || '';
            data.modifyUserType = data.createUserType || caller.onBehalfOf.type;
        }
        else {
            data.modifyUserId = data.modifyUserId || caller._id;
            data.modifyUsername = data.modifyUsername || caller.name || '';
            data.modifyUserType = data.createUserType || caller.type;
        }
    }

    req.data = data;
};

// return the class
module.exports = MongoAdapter;
