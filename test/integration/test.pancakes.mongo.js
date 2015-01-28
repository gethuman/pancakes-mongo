/**
* Copyright 2014 GetHuman LLC
* Author: Jeff Whelpley
* Date: 1/13/15
*
*
*/
var name    = 'pancakes.mongo';
var taste   = require('taste');
var mongo   = taste.target(name);

describe('INTEGRATION ' + name, function () {
    describe('connect()', function () {
        it('should create a connection to the local Mongo instance', function (done) {
            var db = mongo.connectRaw('mongodb://localhost:27017/blahblah');
            db.collection('blahblahblah').find().toArray(function (err, items) {
                taste.should.not.exist(err);
                items.should.deep.equal([]);
                db.close();
                done();
            });
        });
    });
});