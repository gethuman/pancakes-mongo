/**
 * Author: Jeff Whelpley
 * Date: 1/13/15
 *
 *
 */
var name    = 'pancakes.mongo';
var taste   = require('taste');
var mongo   = taste.target(name);

describe('UNIT ' + name, function () {
    describe('newObjectId()', function () {
        it('should create a new object Id', function () {
            var id = mongo.newObjectId();
            taste.should.exist(id);
        });
    });
});