/**
 * Author: Jeff Whelpley
 * Date: 1/13/15
 *
 * Entry point for the pancakes-mongo plugin
 */
var mongoose        = require('mongoose');
var mongoskin       = require('mongoskin');
var MongoAdapter    = require('./pancakes.mongo.adapter');

/**
 * Connect to Mongo through a lower level API. Used by batch
 * sometimes for operations that are not done easily through
 * mongoose.
 *
 * @param dbUri
 * @returns {*}
 */
function connectRaw(dbUri) {

    /* eslint camelcase:0 */
    return mongoskin.db(dbUri, { native_parser: true });
}

/**
 * Create a new ObjectId using mongoose.
 * @param val
 */
function newObjectId(val) {
    return new mongoose.Types.ObjectId(val);
}

module.exports = {
    Adapter:        MongoAdapter,
    connect:        MongoAdapter.connect,
    disconnect:     MongoAdapter.disconnect,
    connectRaw:     connectRaw,
    newObjectId:    newObjectId,
    types: {
        ObjectId:   mongoose.Schema.Types.ObjectId,
        Mixed:      mongoose.Schema.Types.Mixed
    }
};
