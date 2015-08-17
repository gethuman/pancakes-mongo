/**
 * Copyright 2014 GetHuman LLC
 * Author: Jeff Whelpley
 * Date: 2/25/14
 *
 * Unit test for the mongo persist adapter. NOTE: this set of tests
 * actually sort of suck. The adapter is really more suitable to
 * integration tests, so look for more substantive stuff there.
 */
var name    = 'pancakes.mongo.adapter';
var taste   = require('taste');
var Adapter = taste.target(name);

describe('UNIT ' + name, function () {
    describe('getModel()', function () {
        it('should return back a model', function () {
            var resource = {
                name: 'post',
                fields: {
                    name: String,
                    some: Number
                },
                indexes: [{
                    fields:     { name: 1 },
                    options:    { name: 'name_1' }
                }]
            };

            var adapter = new Adapter(resource);
            taste.should.exist(adapter.Model, 'Model does not exist');
            taste.should.exist(adapter.Model.find, 'Model find does not exist');
            taste.should.exist(adapter.Model.update, 'Model update does not exist');
        });
    });

    describe('clearCache()', function () {
        it('should remove item from the cache', function () {
            taste.should.exist(Adapter.modelCache.post);  // from previous test
            Adapter.clearCache();
            Adapter.modelCache.should.deep.equal({});
        });
    });

    describe('checkStartsWithParam', function () {
        it('should convert startsWith param for letter', function () {
            var adapter = new Adapter({ name: 'blah' });
            var req = { startsWith: 'A' };
            adapter.checkStartsWithParam(req);

            var expected = /^(A|a)/;
            var actual = req.where.name.$regex;
            actual.should.deep.equal(expected);
        });

        it('should convert startsWith param for non-letter', function () {
            var adapter = new Adapter({ name: 'blah' });
            var req = { startsWith: 'Other' };
            adapter.checkStartsWithParam(req);

            var expected = /^[^A-Za-z]/;
            var actual = req.where.name.$regex;
            actual.should.deep.equal(expected);
        });
    });

    describe('setCreatedBy()', function () {
        var resource = {
            name: 'createdByTest',
            fields: { status: String, createDate: Date }
        };
        var adapter = new Adapter(resource);

        it('should do nothing if no status field or createDate field', function () {
            var invalidAdapter = new Adapter({ name: 'invalid', fields: {} });
            var req = {};
            var original = JSON.parse(JSON.stringify(req));
            invalidAdapter.setCreatedBy(req);
            req.should.deep.equal(original);
        });


        it('should get error if no caller passed in', function () {
            function fn() { adapter.setCreatedBy({}); }
            fn.should.throw('No caller found for setCreatedBy');
        });

        it('should add createdBy fields', function () {
            var caller = {
                id: 123,
                name: 'jeff',
                type: 'users'
            };
            var req = {
                resource: resource,
                caller: caller
            };

            var expected = {
                resource: resource,
                caller: caller,
                data: {
                    createUserId: caller._id,
                    createUsername: caller.name,
                    status: 'created'
                }
            };

            adapter.setCreatedBy(req);
            req.should.deep.equal(expected);
        });

        it('should add createdBy fields on behalf of', function () {
            var caller = {
                onBehalfOf: {
                    _id: 123,
                    name: 'jeff',
                    type: 'user'
                }
            };
            var req = {
                resource: resource,
                caller: caller
            };

            var expected = {
                resource: resource,
                caller: caller,
                data: {
                    createUserId: caller.onBehalfOf._id,
                    createUsername: caller.onBehalfOf.name,
                    status: 'created'
                }
            };

            adapter.setCreatedBy(req);
            req.should.deep.equal(expected);
        });
    });

    describe('setModifiedBy()', function () {
        var resource = {
            name: 'modifiedByTest',
            fields: { status: String, modifyDate: Date }
        };
        var adapter = new Adapter(resource);

        it('should do nothing if no status field or modifyDate field', function () {
            var invalidAdapter = new Adapter({ name: 'invalid', fields: {} });
            var req = {};
            var original = JSON.parse(JSON.stringify(req));
            invalidAdapter.setModifiedBy(req);
            req.should.deep.equal(original);
        });


        it('should get error if no caller passed in', function () {
            function fn() { adapter.setModifiedBy({}); }
            fn.should.throw('No caller found for setModifiedBy');
        });

        it('should add modifyBy fields', function () {
            var caller = {
                id: 123,
                name: 'jeff',
                type: 'user'
            };
            var req = {
                resource: resource,
                caller: caller
            };

            var expected = {
                resource: resource,
                caller: caller,
                data: {
                    modifyDate: new Date(),
                    modifyUserId: caller._id,
                    modifyUsername: caller.name
                }
            };

            adapter.setModifiedBy(req);
            req.should.deep.equal(expected);
        });

        it('should add modifyBy fields on behalf of', function () {
            var caller = {
                onBehalfOf: {
                    id: 123,
                    name: 'jeff',
                    type: 'user'
                }
            };
            var req = {
                resource: resource,
                caller: caller
            };

            var expected = {
                resource: resource,
                caller: caller,
                data: {
                    modifyDate: new Date(),
                    modifyUserId: caller.onBehalfOf.id,
                    modifyUsername: caller.onBehalfOf.name
                }
            };

            adapter.setModifiedBy(req);
            req.should.deep.equal(expected);
        });
    });
});
