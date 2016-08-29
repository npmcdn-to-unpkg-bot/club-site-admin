var Promise = require('es6-promise')
      .Promise;
var _ = require('underscore');
var keystone = require('keystone');
var Page = keystone.list('Page');
var HomePage = keystone.list('HomePage');

function getInsertedId(saveOp) {
  return saveOp.emitted.complete[0]._id;
}
var homeId, l1Id, l2aId, l2bId, l3Id;

function insertTestPages(done) {
  /*
    * create a 3-level hierarcy:
    * home
    *   '-> level1
    *       '-> level2a
    *           '-> level3
    *       '-> level2b
    */
  new HomePage.model({
    title: 'home'
  }).save(function(err) {
    if (err)
      done(err);
    homeId = getInsertedId(this);
    new Page.model({
      title: 'level1',
      isPublished: true,
      parent: homeId
    }).save(function(err) {
      if (err)
        done(err);
      l1Id = getInsertedId(this);
      new Page.model({
        title: 'level2a',
        isPublished: true,
        parent: l1Id
      }).save(function(err) {
        if (err)
          done(err);
        l2aId = getInsertedId(this);
        new Page.model({
          title: 'level3',
          isPublished: true,
          parent: l2aId
        }).save(function(err) {
          if (err)
            done(err);
          l3Id = getInsertedId(this);
          new Page.model({
            title: 'level2b',
            isPublished: true,
            parent: l1Id
          }).save(function(err) {
            if (err)
              done(err);
            l2bId = getInsertedId(this);
            done();
          });
        });
      });
    });
  });
}

describe('For Pages', function() {
  beforeEach(function(done) {
    keystone.list('NavNode').model.find().remove(function(err) {
      if (err)
        done(err);
      insertTestPages(done);
    });
  });

  describe('when getting nodes to root', function() {
    var nodesToRoot;

    beforeEach(function(done) {
      Page.model.findOne(l3Id).exec(function(err, page) {
        if (err) {
          done(err);
          return;
        }
        nodesToRoot = page.getNodesToRoot();
        done();
      });
    });

    it('should get nodes in correct order', function() {
      return expect(nodesToRoot).to.eventually.satisfy(function(ns) {
        function idxEq(idx, id) {
          return ns[idx]._id.equals(id);
        }
        return idxEq(0,l3Id) && idxEq(1,l2aId) && idxEq(2,l1Id) && idxEq(3,homeId);
      });
    });
  });

  describe('when getting descendants', function() {
    var descendents;

    beforeEach(function(done) {
      Page.model.findOne(homeId).exec(function(err, page) {
        if (err) {
          done(err);
          return;
        }
        descendents = page.getAllDescendentNodes();
        done();
      });
    });

    it('should get correct number', function() {
      return expect(descendents).to.eventually.have.lengthOf(4);
    });

    it('should get all descendent items', function() {
      function isIn(id, ds) {
        return _.find(ds, function(d) { return d._id.equals(id); });
      }
      return expect(descendents).to.eventually.satisfy(function(ds) {
        return isIn(l1Id, ds) &&
               isIn(l2aId, ds) &&
               isIn(l2bId, ds) &&
               isIn(l3Id, ds);
      });
    });
  });

  describe('when a Page is saved', function() {

    function editAndSave(pageId, editCb) {
      return new Promise(function (resolve, reject) {
        Page.model.findOne({_id: pageId}).exec(function(err, page) {
          if (err) {
            reject(err);
            return;
          }
          editCb(page);
          if (!page.isModified()) {
            resolve(page);
          }
          page.save(function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve(page);
          });
        });
      });
    }

    function editAndSaveThenWaitBeforeGettingChildren(pageId, editCb, waitSeconds)
    {
      waitSeconds = waitSeconds || 25;
      // if we need to look at changes that have been triggered on descendents
      // we need to wait for those saves to take place.
      // Adding a small wait after the save, before getting the children
      // is the best/only solution I can think of...
      return editAndSave(pageId, editCb)
        .then(function(page) {
          return new Promise(function (resolve, reject) {
            function doIt() {
              page.getAllDescendentNodes()
                .then(function(nodes) {
                  resolve(nodes);
                }).catch(resolve);
            }
            setTimeout(doIt, waitSeconds);
          });
        });
    }

    it('should set routePath with updated valid parent', function() {
      return expect(editAndSave(l3Id, function(page) {
        page.parent = l2bId;
      })).to.eventually.satisfy(function(page) {
        return page.routePath === '/home/level1/level2b/level3';
      });
    });

    it('should succeed with updated valid parent', function() {
      return expect(editAndSave(l3Id, function(page) {
        page.parent = homeId;
      })).to.be.fulfilled;
    });

    it('should fail when self selected as parent', function() {
      return expect(editAndSave(l2bId, function(page) {
        page.parent = page._id;
      })).to.be.rejectedWith(/cannot select an item as its own menu parent/);
    });

    it('should fail when no parent', function() {
      return expect(editAndSave(l2bId, function(page) {
        page.parent = undefined;
      })).to.be.rejectedWith(/must select a menu parent/);
    });

    it('should fail when a descendant selected as parent', function() {
      return expect(editAndSave(l1Id, function(page) {
        page.parent = l3Id;
      })).to.be.rejectedWith(/cannot select a child\/descendent item as menu parent/);
    });

    it('descendents should also become unpublished if unpublished', function() {
      return expect(editAndSaveThenWaitBeforeGettingChildren(l1Id, function(page) {
        page.isPublished = false;
      })).to.eventually.satisfy(function(ds) {
        return _.every(ds, function(d) { return !d.isPublished; });
      });
    });
  });
});
