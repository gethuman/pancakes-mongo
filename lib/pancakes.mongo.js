/**
 * Author: Jeff Whelpley
 * Date: 1/13/15
 *
 * Entry point for the pancakes-mongo plugin
 */
var mongoose        = require('mongoose');
var MongoAdapter    = require('./pancakes.mongo.adapter');

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
    newObjectId:    newObjectId,
    types: {
        ObjectId:   mongoose.Schema.Types.ObjectId,
        Mixed:      mongoose.Schema.Types.Mixed
    }
};
