/**
* Copyright 2014 GetHuman LLC
* Author: Jeff Whelpley
* Date: 2/25/14
*
* Integration tests for mongo persist adapter
*/
var name    = 'pancakes.mongo.adapter';
var taste   = require('taste');
var Adapter = taste.target(name);

describe('INTEGRATION ' + name, function () {
    var resource = { name: 'test', fields: { name: String, val: Number, status: String }};
    var adapter = new Adapter(resource);
    var dbUrl = 'mongodb://localhost:27017/test';
    var doc;

    before(function (done) {
        var promise = Adapter.connect(dbUrl, false);
        taste.eventuallyFulfilled(promise, done);
    });

    after(function () {
        Adapter.disconnect();
    });

    describe('saveIndexInfo()', function (done) {
        it('should save some new index info', function () {
            var json = {
                name: 'blah',
                where: { type: 1 }
            };
            json.where[(new Date()).getTime() + ''] = 1;
            var str = JSON.stringify(json);

            Adapter.cache.idxInfo[str] = {
                str: str,
                json: json,
                name: 'blah',
                count: 5
            };

            Adapter.saveIndexInfo()
                .then(function (ret) {
                    ret.length.should.equal(1);
                    ret[0].count = 5;

                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });
    });

    describe('setIndexInfo()', function () {
        it('should save data to the cache', function () {
            var name = 'blah';
            var where = {
                type: 'foo',
                moo: 'loo'
            };
            var sort = {
                choo: -1,
                ayo: 1
            };

            Adapter.cache.idxInfo = {};
            Adapter.setIndexInfo(name, where, sort);

            var json = {
                name: name,
                where: { type: 1, moo: 1 },
                sort: { choo: -1, ayo: 1 }
            };
            var jsonSorted = {
                name: name,
                where: { moo: 1, type: 1 },
                sort: { ayo: 1, choo: -1 }
            };
            var key = JSON.stringify(json);
            var keySorted = JSON.stringify(jsonSorted);
            var expected = {};
            expected[key] = {
                name: name,
                json : json,
                str: key,
                jsonSorted: jsonSorted,
                strSorted: keySorted,
                count: 1
            };

            Adapter.cache.idxInfo.should.deep.equal(expected)
        });
    });

    //describe('create()', function () {
    //    it('should create a new doc in a test collection', function (done) {
    //        var req = {
    //            data: { name: 'jeff', val: (new Date()).getTime(), status: 'created' }
    //        };
    //
    //        adapter.create(req)
    //            .then(function (data) {
    //                taste.should.exist(data);
    //                data.__v.should.equal(0);
    //
    //                doc = data;
    //                done();
    //            })
    //            .catch(function (err) {
    //                done(err);
    //            });
    //    });
    //});
    //
    //describe('bulkInsert()', function () {
    //    it('should insert multiple docs into a collection', function (done) {
    //        var docs = [
    //            { name: 'bulk1', val: (new Date()).getTime() },
    //            { name: 'bulk2', val: (new Date()).getTime() }
    //        ];
    //        var promise = adapter.bulkInsert({ data: docs });
    //        taste.eventuallyFulfilled(promise, done);
    //    });
    //});
    //
    //describe('count()', function () {
    //    it('should get a count of test documents', function (done) {
    //        var req = {
    //            where: { val: doc.val }
    //        };
    //        var expected = 1;
    //
    //        var promise = adapter.count(req);
    //        taste.eventuallyEqual(promise, expected, done);
    //    });
    //});
    //
    //describe('find()', function () {
    //    it('should find the test document', function (done) {
    //        var req = {
    //            where: { val: doc.val },
    //            findOne: true
    //        };
    //        var expected = doc;
    //
    //        var promise = adapter.find(req);
    //        taste.eventuallyEqual(promise, expected, done);
    //    });
    //});
    //
    //describe('findById()', function () {
    //    it('should find the test document', function (done) {
    //        var req = {
    //            caller: {},
    //            _id: doc._id
    //        };
    //        var expected = doc;
    //
    //        var promise = adapter.findById(req);
    //        taste.eventuallyEqual(promise, expected, done);
    //    });
    //});
    //
    //describe('update()', function () {
    //    it('should update the test document', function (done) {
    //        var val = (new Date()).getTime();
    //        var req = {
    //            where: { _id: doc._id },
    //            data: { val: val }
    //        };
    //
    //        doc.val = val;
    //        var expected = doc;
    //
    //        var promise = adapter.update(req);
    //        taste.all([
    //            promise.should.eventually.have.property('val').that.equals(val)
    //        ], done);
    //    });
    //});
    //
    //describe('remove()', function () {
    //    it('should change the status of the doc to deleted', function (done) {
    //        var req = {
    //            where: { _id: doc._id }
    //        };
    //
    //        doc.status = 'deleted';
    //        var expected = doc;
    //
    //        var promise = adapter.remove(req);
    //        taste.all([
    //            promise.should.eventually.have.property('status').that.equals('deleted')
    //        ], done);
    //    });
    //});
    //
    //describe('removePermanently()', function () {
    //    it('should permenantly remove a doc', function (done) {
    //        var req = {
    //            where: { _id: doc._id }
    //        };
    //
    //        var expected = doc;
    //
    //        var promise = adapter.removePermanently(req);
    //        taste.all([
    //            promise.should.eventually.have.property('_id').that.deep.equals(doc._id)
    //        ], done);
    //    });
    //});
});