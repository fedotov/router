/**
 * Router tests
 */

const inspect = require('../../lib/inspect');

var fs = require('fs')
  , http = require('http')
  , Koa = require('koa')
  , methods = require('methods')
  , path = require('path')
  , request = require('supertest')
  , Router = require('../../lib/router')
  , Layer = require('../../lib/layer')
  , expect = require('expect.js')
  , should = require('should');

describe('Router', function () {

  it('creates new router with koa app', function (done) {
    var app = new Koa();
    var router = new Router();
    router.should.be.instanceOf(Router);
    done();
  });

  it('does not capture params for unamtched routes', (done) => { // #292
    let params;
    var app = new Koa();
    var router = new Router();
    router
      .get('/new', function (ctx, next) {
        ctx.body = {ran: '/new'};
        return next();
      })
      .get('/:id', function (ctx, next) {
        ctx.body.ran += '/:id';
        return next();
      })
      .use(function(ctx, next) {
        params = ctx.params;
        return next();
      });

    app.use(router.routes());

    request(http.createServer(app.callback()))
      .get('/new')
      .expect(200)
      .end(function (err, res) {
        expect(res.body.ran).to.eql('/new');
        expect(params).not.to.have.property('id');
        done(err);
      });
  });

  it('prefix does not greedy match', () => { // #415
    const app = new Koa();
    const parentRouter = new Router()
    const router = new Router({prefix: '/countries'})

    router.get('/', async (ctx) => {
      ctx.body = 'countries';
    });
    parentRouter.use(router.routes());
    app.use(parentRouter.routes());
    const agent = request.agent(http.createServer(app.callback()));

    agent
      .get('/countries')
      .expect('countries')
      .end((err) => {
        if (err) return done(err);
        agent
          .get('/some_route_1/countries')
          .expect(404, done)
      });
  });

  it('trims trailing / on nestings', () => { // #335

  });

  it('executes all middleware without a route match', () => { // #257
    // even for nested routers?
  });

  it('matches routes FIFO', () => {

  });

  it("retains ordering of nested routers' routes", () => {

  });

  it('wildcard after and before prefix matches correctly', (done) => { // #438
    const app = new Koa();
    const router = new Router();
    const nestedRouter = new Router();
    nestedRouter.get('*', (ctx) => {
      ctx.body = 'admin';
    });
    router.nest('/admin', nestedRouter);
    router.get('*', (ctx) => {
      ctx.body = 'public'
    });
    app.use(router.routes());
    const agent = request.agent(http.createServer(app.callback()));

    console.log(router.toString(true));

    agent
      .get('/')
      .expect('public')
      .end((err, res) => {
        if (err) return done(err);
        agent
          .get('/admin')
          .expect('admin')
          .end((err, res) => {
            if (err) return done(err);
            agent
              .get('/adminlol')
              .expect('public', done)
          });
      })
  });

  it('shares context between routers', function (done) { // #205
    var app = new Koa();
    var router1 = new Router();
    var router2 = new Router();
    router1.get('/', function (ctx, next) {
      ctx.foo = 'bar';
      return next();
    });
    router2.get('/', function (ctx, next) {
      ctx.baz = 'qux';
      ctx.body = { foo: ctx.foo };
      return next();
    });
    app.use(router1.routes()).use(router2.routes());
    request(http.createServer(app.callback()))
      .get('/')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.have.property('foo', 'bar');
        done();
      });
  });

  it('does not register middleware more than once', function (done) { // #184
    var app = new Koa();
    var parentRouter = new Router();
    var nestedRouter = new Router();

    nestedRouter
      .get('/first-nested-route', function (ctx, next) {
        ctx.body = { n: ctx.n };
      })
      .get('/second-nested-route', function (ctx, next) {
        return next();
      })
      .get('/third-nested-route', function (ctx, next) {
        return next();
      });

    parentRouter.use('/parent-route', function (ctx, next) {
      ctx.n = ctx.n ? (ctx.n + 1) : 1;
      return next();
    }, nestedRouter.routes());

    app.use(parentRouter.routes());

    request(http.createServer(app.callback()))
      .get('/parent-route/first-nested-route')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.have.property('n', 1);
        done();
      });
  });

  it('router can be accessed with ctx', function (done) {
      var app = new Koa();
      var router = new Router();
      router.get('home', '/', function (ctx) {
          ctx.body = {
            url: ctx.router.url('home')
          };
      });
      app.use(router.routes());
      request(http.createServer(app.callback()))
          .get('/')
          .expect(200)
          .end(function (err, res) {
              if (err) return done(err);
              expect(res.body.url).to.eql("/");
              done();
          });
  });

  it('registers multiple middleware for one route', function(done) {
    var app = new Koa();
    var router = new Router();

    router.get('/double', function(ctx, next) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          ctx.body = {message: 'Hello'};
          resolve(next());
        }, 1);
      });
    }, function(ctx, next) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          ctx.body.message += ' World';
          resolve(next());
        }, 1);
      });
    }, function(ctx, next) {
      ctx.body.message += '!';
    });

    app.use(router.routes());

    request(http.createServer(app.callback()))
      .get('/double')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body.message).to.eql('Hello World!');
        done();
      });
  });

  it('does not break when nested-routes use regexp paths', function (done) {
    var app = new Koa();
    var parentRouter = new Router();
    var nestedRouter = new Router();

    nestedRouter
      .get(/^\/\w$/i, function (ctx, next) {
        return next();
      })
      .get('/first-nested-route', function (ctx, next) {
        return next();
      })
      .get('/second-nested-route', function (ctx, next) {
        return next();
      });

    parentRouter.use('/parent-route', function (ctx, next) {
      return next();
    }, nestedRouter.routes());

    app.use(parentRouter.routes());
    app.should.be.ok;
    done();
  });

  it('exposes middleware factory', function (done) {
    var app = new Koa();
    var router = new Router();
    router.should.have.property('routes');
    router.routes.should.be.type('function');
    var middleware = router.routes();
    should.exist(middleware);
    middleware.should.be.type('function');
    done();
  });

  it('supports promises for async/await', function (done) {
    var app = new Koa();
    var router = new Router();
    router.get('/async', function (ctx, next) {
      return new Promise(function (resolve, reject) {
        setTimeout(function() {
          ctx.body = {
            msg: 'promises!'
          };
          resolve();
        }, 1);
      });
    });

    app.use(router.routes()).use(router.allowedMethods());
    request(http.createServer(app.callback()))
      .get('/async')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.have.property('msg', 'promises!');
        done();
      });
  });

  it('matches middleware only if route was matched', function (done) { // #182
    var app = new Koa();
    var router = new Router();
    var otherRouter = new Router();

    router.use(function (ctx, next) {
      ctx.body = { bar: 'baz' };
      return next();
    });

    otherRouter.get('/bar', function (ctx) {
      ctx.body = ctx.body || { foo: 'bar' };
    });

    app.use(router.routes()).use(otherRouter.routes());

    request(http.createServer(app.callback()))
      .get('/bar')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.have.property('foo', 'bar');
        expect(res.body).to.not.have.property('bar');
        done();
      })
  });

  it('matches first to last', function (done) {
    var app = new Koa();
    var router = new Router();

    router
      .get('user_page', '/user/(.*).jsx', function (ctx) {
        ctx.body = { order: 1 };
      })
      .all('app', '/app/(.*).jsx', function (ctx) {
        ctx.body = { order: 2 };
      })
      .all('view', '(.*).jsx', function (ctx) {
        ctx.body = { order: 3 };
      });

    request(http.createServer(app.use(router.routes()).callback()))
      .get('/user/account.jsx')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.have.property('order', 1);
        done();
      })
  });

  it('does not run subsequent middleware without calling next', function (done) {
    var app = new Koa();
    var router = new Router();

    router
      .get('user_page', '/user/(.*).jsx', function (ctx) {
        // no next()
      }, function (ctx) {
        ctx.body = { order: 1 };
      });

    request(http.createServer(app.use(router.routes()).callback()))
      .get('/user/account.jsx')
      .expect(404)
      .end(done)
  });

  it('nests routers with prefixes at root', function (done) {
    var app = new Koa();
    var forums = new Router({prefix: '/forums'});
    var posts = new Router({prefix: '/:fid/posts'});
    var server;

    posts
      .get('/', function (ctx, next) {
        ctx.status = 204;
        return next();
      })
      .get('/:pid', function (ctx, next) {
        ctx.body = ctx.params;
        return next();
      });

    forums.nest(posts);

    server = http.createServer(app.use(forums.routes()).callback());

    request(server)
      .get('/forums/1/posts')
      .expect(204)
      .end(function (err) {
        if (err) return done(err);

        request(server)
          .get('/forums/1')
          .expect(404)
          .end(function (err) {
            if (err) return done(err);

            request(server)
              .get('/forums/1/posts/2')
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err);

                expect(res.body).to.have.property('fid', '1');
                expect(res.body).to.have.property('pid', '2');
                done();
              });
          });
      });
  });

  it('nests routers with prefixes at path', function (done) {
    var app = new Koa();
    var forums = new Router({prefix: '/api'});
    var posts = new Router({prefix: '/posts'});
    var server;

    posts
      .get('/', function (ctx, next) {
        ctx.status = 204;
        return next();
      })
      .get('/:pid', function (ctx, next) {
        ctx.body = ctx.params;
        return next();
      });

    forums.nest('/forums/:fid', posts);

    server = http.createServer(app.use(forums.routes()).callback());

    request(server)
      .get('/api/forums/1/posts')
      .expect(204)
      .end(function (err) {
        if (err) return done(err);

        request(server)
          .get('/api/forums/1')
          .expect(404)
          .end(function (err) {
            if (err) return done(err);

            request(server)
              .get('/api/forums/1/posts/2')
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err);

                expect(res.body).to.have.property('fid', '1');
                expect(res.body).to.have.property('pid', '2');
                done();
              });
          });
      });
  });

  it('runs subrouter middleware after parent', function (done) {
    var app = new Koa();
    var subrouter = new Router()
      .use(function (ctx, next) {
        ctx.msg = 'subrouter';
        return next();
      })
      .get('/', function (ctx) {
        ctx.body = { msg: ctx.msg };
      });
    var router = new Router()
      .use(function (ctx, next) {
        ctx.msg = 'router';
        return next();
      })
      .nest(subrouter);
    request(http.createServer(app.use(router.routes()).callback()))
      .get('/')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.have.property('msg', 'subrouter');
        done();
      });
  });

  it('runs parent middleware for subrouter routes', function (done) {
    var app = new Koa();
    var subrouter = new Router()
      .get('/sub', function (ctx) {
        ctx.body = { msg: ctx.msg };
      });
    var router = new Router()
      .use(function (ctx, next) {
        ctx.msg = 'router';
        return next();
      })
      .nest('/parent', subrouter);
    request(http.createServer(app.use(router.routes()).callback()))
      .get('/parent/sub')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.have.property('msg', 'router');
        done();
      });
  });

  it('matches corresponding requests', function (done) {
    var app = new Koa();
    var router = new Router();

    router.get('/:category/:title', function (ctx) {
      ctx.should.have.property('params');
      ctx.params.should.have.property('category', 'programming');
      ctx.params.should.have.property('title', 'how-to-node');
      ctx.status = 204;
    });
    router.post('/:category', function (ctx) {
      ctx.should.have.property('params');
      ctx.params.should.have.property('category', 'programming');
      ctx.status = 204;
    });
    router.put('/:category/not-a-title', function (ctx) {
      ctx.should.have.property('params');
      ctx.params.should.have.property('category', 'programming');
      ctx.params.should.not.have.property('title');
      ctx.status = 204;
    });

    app.use(router.routes());

    var server = http.createServer(app.callback());
    request(server)
      .get('/programming/how-to-node')
      .expect(204)
      .end(function (err, res) {
        if (err) return done(err);
        request(server)
        .post('/programming')
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);
          request(server)
            .put('/programming/not-a-title')
            .expect(204)
            .end(function (err, res) {
              done(err);
            });
        });
    });
  });

  it('executes route middleware using `app.context`', function (done) {
    var app = new Koa();
    var router = new Router();

    router.use(function (ctx, next) {
      ctx.bar = 'baz';
      return next();
    });
    router.get('/:category/:title', function (ctx, next) {
      ctx.foo = 'bar';
      return next();
    }, function (ctx) {
      ctx.should.have.property('bar', 'baz');
      ctx.should.have.property('foo', 'bar');
      ctx.should.have.property('app');
      ctx.should.have.property('req');
      ctx.should.have.property('res');
      ctx.status = 204;
      done();
    });

    app.use(router.routes());

    request(http.createServer(app.callback()))
      .get('/match/this')
      .expect(204)
      .end(function (err) {
        if (err) return done(err);
      });
  });

  it('does not match after ctx.throw()', function (done) {
    var app = new Koa();
    var counter = 0;
    var router = new Router();

    router.get('/', function (ctx) {
      counter++;
      ctx.throw(403);
    });
    router.get('/', function () {
      counter++;
    });

    app.use(router.routes());

    var server = http.createServer(app.callback());
      request(server)
      .get('/')
      .expect(403)
      .end(function (err, res) {
        if (err) return done(err);
        counter.should.equal(1);
        done();
    });
  });

  it('supports promises for route middleware', function (done) {
    var app = new Koa();
    var router = new Router();

    var readVersion = function () {
      return new Promise(function (resolve, reject) {
        var packagePath = path.join(__dirname, '..', '..', 'package.json');
        fs.readFile(packagePath, 'utf8', function (err, data) {
          if (err) return reject(err);
          resolve(JSON.parse(data).version);
        });
      });
    };
    router
      .get('/', function (ctx, next) {
        return next();
      }, function (ctx) {
        return readVersion().then(function () {
          ctx.status = 204;
        });
      });

    app.use(router.routes());

    request(http.createServer(app.callback()))
      .get('/')
      .expect(204)
      .end(done);
  });

  describe('Router#allowedMethods()', function () {
    it('responds to OPTIONS requests', function (done) {
      var app = new Koa();
      var router = new Router();
      router.get('/users', function (ctx, next) {});
      router.put('/users', function (ctx, next) {});

      app.use(router.routes());
      app.use(router.allowedMethods());

      request(http.createServer(app.callback()))
        .options('/users')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.header.should.have.property('content-length', '0');
          res.header.should.have.property('allow', 'HEAD, GET, PUT');
          done();
        });
    });

    it('responds with 405 Method Not Allowed', function (done) {
      var app = new Koa();
      var router = new Router();
      router.get('/users', function () {});
      router.put('/users', function () {});
      router.post('/events', function () {});
      app.use(router.routes());
      app.use(router.allowedMethods());
      request(http.createServer(app.callback()))
      .post('/users')
      .expect(405)
      .end(function (err, res) {
        if (err) return done(err);
        res.header.should.have.property('allow', 'HEAD, GET, PUT');
        done();
      });
    });

    it('responds with 405 Method Not Allowed using the "throw" option', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      app.use(function (ctx, next) {
        return next().catch(function (err) {
          // assert that the correct HTTPError was thrown
          err.name.should.equal('MethodNotAllowedError');
          err.statusCode.should.equal(405);

          // translate the HTTPError to a normal response
          ctx.body = err.name;
          ctx.status = err.statusCode;
        });
      });
      app.use(router.allowedMethods({ throw: true }));
      router.get('/users', function () {});
      router.put('/users', function () {});
      router.post('/events', function () {});
      request(http.createServer(app.callback()))
      .post('/users')
      .expect(405)
      .end(function (err, res) {
        if (err) return done(err);
        // the 'Allow' header is not set when throwing
        res.header.should.not.have.property('allow');
        done();
      });
    });

    it('responds with user-provided throwable using the "throw" and "methodNotAllowed" options', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      app.use(function (ctx, next) {
        return next().catch(function (err) {
          // assert that the correct HTTPError was thrown
          err.message.should.equal('Custom Not Allowed Error');
          err.statusCode.should.equal(405);

          // translate the HTTPError to a normal response
          ctx.body = err.body;
          ctx.status = err.statusCode;
        });
      });
      app.use(router.allowedMethods({
        throw: true,
        methodNotAllowed: function () {
          var notAllowedErr = new Error('Custom Not Allowed Error');
          notAllowedErr.type = 'custom';
          notAllowedErr.statusCode = 405;
          notAllowedErr.body = {
            error: 'Custom Not Allowed Error',
            statusCode: 405,
            otherStuff: true
          };
          return notAllowedErr;
        }
      }));
      router.get('/users', function () {});
      router.put('/users', function () {});
      router.post('/events', function () {});
      request(http.createServer(app.callback()))
      .post('/users')
      .expect(405)
      .end(function (err, res) {
        if (err) return done(err);
        // the 'Allow' header is not set when throwing
        res.header.should.not.have.property('allow');
        res.body.should.eql({ error: 'Custom Not Allowed Error',
          statusCode: 405,
          otherStuff: true
        });
        done();
      });
    });

    it('responds with 501 Not Implemented', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      app.use(router.allowedMethods());
      router.get('/users', function () {});
      router.put('/users', function () {});
      request(http.createServer(app.callback()))
      .search('/users')
      .expect(501)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
    });

    it('responds with 501 Not Implemented using the "throw" option', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      app.use(function (ctx, next) {
        return next().catch(function (err) {
          // assert that the correct HTTPError was thrown
          err.name.should.equal('NotImplementedError');
          err.statusCode.should.equal(501);

          // translate the HTTPError to a normal response
          ctx.body = err.name;
          ctx.status = err.statusCode;
        });
      });
      app.use(router.allowedMethods({ throw: true }));
      router.get('/users', function () {});
      router.put('/users', function () {});
      request(http.createServer(app.callback()))
      .search('/users')
      .expect(501)
      .end(function (err, res) {
        if (err) return done(err);
        // the 'Allow' header is not set when throwing
        res.header.should.not.have.property('allow');
        done();
      });
    });

    it('responds with user-provided throwable using the "throw" and "notImplemented" options', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      app.use(function (ctx, next) {
        return next().catch(function (err) {
          // assert that our custom error was thrown
          err.message.should.equal('Custom Not Implemented Error');
          err.type.should.equal('custom');
          err.statusCode.should.equal(501);

          // translate the HTTPError to a normal response
          ctx.body = err.body;
          ctx.status = err.statusCode;
        });
      });
      app.use(router.allowedMethods({
        throw: true,
        notImplemented: function () {
          var notImplementedErr = new Error('Custom Not Implemented Error');
          notImplementedErr.type = 'custom';
          notImplementedErr.statusCode = 501;
          notImplementedErr.body = {
            error: 'Custom Not Implemented Error',
            statusCode: 501,
            otherStuff: true
          };
          return notImplementedErr;
        }
      }));
      router.get('/users', function () {});
      router.put('/users', function () {});
      request(http.createServer(app.callback()))
      .search('/users')
      .expect(501)
      .end(function (err, res) {
        if (err) return done(err);
        // the 'Allow' header is not set when throwing
        res.header.should.not.have.property('allow');
        res.body.should.eql({ error: 'Custom Not Implemented Error',
          statusCode: 501,
          otherStuff: true
        });
        done();
      });
    });

    it('does not send 405 if route matched but status is 404', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      app.use(router.allowedMethods());
      router.get('/users', function (ctx, next) {
        ctx.status = 404;
      });
      request(http.createServer(app.callback()))
      .get('/users')
      .expect(404)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
    });

    it('sets the allowed methods to a single Allow header #273', function (done) {
      // https://tools.ietf.org/html/rfc7231#section-7.4.1
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      app.use(router.allowedMethods());

      router.get('/', function (ctx, next) {});

      request(http.createServer(app.callback()))
        .options('/')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.header.should.have.property('allow', 'HEAD, GET');
          let allowHeaders = res.res.rawHeaders.filter((item) => item == 'Allow');
          expect(allowHeaders.length).to.eql(1);
          done();
        });
    });

  });

  describe('Router#[verb]()', function () {
    it('registers route specific to HTTP verb', function () {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      methods.forEach(function (method) {
        router.should.have.property(method);
        router[method].should.be.type('function');
        router[method]('/', function () {});
      });
      router.stack.should.have.length(methods.length);
    });

    it('registers route with a regexp path', function () {
      var router = new Router();
      methods.forEach(function (method) {
        router[method](/^\/\w$/i, function () {}).should.equal(router);
      });
    });

    it('registers route with a given name', function () {
      var router = new Router();
      methods.forEach(function (method) {
        router[method](method, '/', function () {}).should.equal(router);
      });
    });

    it('registers route with with a given name and regexp path', function () {
      var router = new Router();
      methods.forEach(function (method) {
        router[method](method, /^\/$/i, function () {}).should.equal(router);
      });
    });

    it('enables route chaining', function () {
      var router = new Router();
      methods.forEach(function (method) {
        router[method]('/', function () {}).should.equal(router);
      });
    });

    it('registers array of paths', function () { // #203
      var router = new Router();
      router.get(['/one', '/two'], function (ctx, next) {
        return next();
      });
      expect(router.stack).to.have.property('length', 2);
      expect(router.stack[0]).to.have.property('path', '/one');
      expect(router.stack[1]).to.have.property('path', '/two');
    });

    it('resolves non-parameterized routes without attached parameters', function(done) {
      var app = new Koa();
      var router = new Router();

      router.get('/notparameter', function (ctx, next) {
        ctx.body = {
          param: ctx.params.parameter,
        };
      });

      router.get('/:parameter', function (ctx, next) {
        ctx.body = {
          param: ctx.params.parameter,
        };
      });

      app.use(router.routes());
      request(http.createServer(app.callback()))
        .get('/notparameter')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body.param).to.equal(undefined);
          done();
        });
    });

  });

  describe('Router#use()', function (done) {
    it('uses router middleware without path', function (done) {
      var app = new Koa();
      var router = new Router();

      router.use(function (ctx, next) {
        ctx.foo = 'baz';
        return next();
      });

      router.use(function (ctx, next) {
        ctx.foo = 'foo';
        return next();
      });

      router.get('/foo/bar', function (ctx) {
        ctx.body = {
          foobar: ctx.foo + 'bar'
        };
      });

      app.use(router.routes());
      request(http.createServer(app.callback()))
        .get('/foo/bar')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property('foobar', 'foobar');
          done();
        });
    });

    it('uses router middleware at given path', function (done) {
      var app = new Koa();
      var router = new Router();

      router.use('/foo/bar', function (ctx, next) {
        ctx.foo = 'foo';
        return next();
      });

      router.get('/foo/bar', function (ctx) {
        ctx.body = {
          foobar: ctx.foo + 'bar'
        };
      });

      app.use(router.routes());
      request(http.createServer(app.callback()))
        .get('/foo/bar')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property('foobar', 'foobar');
          done();
        });
    });

    it('runs router middleware before subrouter middleware', function (done) {
      var app = new Koa();
      var router = new Router();
      var subrouter = new Router();

      router.use(function (ctx, next) {
        ctx.foo = 'boo';
        return next();
      });

      subrouter
        .use(function (ctx, next) {
          ctx.foo = 'foo';
          return next();
        })
        .get('/bar', function (ctx) {
          ctx.body = {
            foobar: ctx.foo + 'bar'
          };
        });

      router.use('/foo', subrouter.routes());
      app.use(router.routes());
      request(http.createServer(app.callback()))
        .get('/foo/bar')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property('foobar', 'foobar');
          done();
        });
    });

    it('assigns middleware to array of paths', function (done) {
      var app = new Koa();
      var router = new Router();

      router.use(['/foo', '/bar'], function (ctx, next) {
        ctx.foo = 'foo';
        ctx.bar = 'bar';
        return next();
      });

      router.get('/foo', function (ctx, next) {
        ctx.body = {
          foobar: ctx.foo + 'bar'
        };
      });

      router.get('/bar', function (ctx) {
        ctx.body = {
          foobar: 'foo' + ctx.bar
        };
      });

      app.use(router.routes());
      request(http.createServer(app.callback()))
        .get('/foo')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          expect(res.body).to.have.property('foobar', 'foobar');
          request(http.createServer(app.callback()))
            .get('/bar')
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);
              expect(res.body).to.have.property('foobar', 'foobar');
              done();
            });
        });
    });

    it('without path, does not set params.0 to the matched path', function (done) { // #247
      var app = new Koa();
      var router = new Router();

      router.use(function(ctx, next) {
        return next();
      });

      router.get('/foo/:id', function(ctx) {
        ctx.body = ctx.params;
      });

      app.use(router.routes());
      request(http.createServer(app.callback()))
        .get('/foo/815')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          expect(res.body).to.have.property('id', '815');
          expect(res.body).to.not.have.property('0');
          done();
        });
    });

    it('does not add an erroneous (.*) to unprefiexed nested routers', function (done) { // #369 #410
      var app = new Koa();
      var router = new Router();
      var nested = new Router();
      var called = 0;

      nested
        .get('/', (ctx, next) => {
          ctx.body = 'root';
          called += 1;
          return next();
        })
        .get('/test', (ctx, next) => {
          ctx.body = 'test';
          called += 1;
          return next();
        });

      router.use(nested.routes());
      app.use(router.routes());

      request(app.callback())
        .get('/test')
        .expect(200)
        .expect('test')
        .end(function (err, res) {
          if (err) return done(err);
          expect(called).to.eql(1, 'too many routes matched');
          done();
        });
    });
  });

  describe('Router#register()', function () {
    it('registers new routes', function (done) {
      var app = new Koa();
      var router = new Router();
      router.should.have.property('register');
      router.register.should.be.type('function');
      var route = router.register('/', ['GET', 'POST'], function () {});
      app.use(router.routes());
      router.stack.should.be.an.instanceOf(Array);
      router.stack.should.have.property('length', 1);
      router.stack[0].should.have.property('path', '/');
      done();
    });
  });

  describe('Router#redirect()', function () {
    it('registers redirect routes', function (done) {
      var app = new Koa();
      var router = new Router();
      router.should.have.property('redirect');
      router.redirect.should.be.type('function');
      router.redirect('/source', '/destination', 302);
      app.use(router.routes());
      router.stack.should.have.property('length', 1);
      router.stack[0].should.be.instanceOf(Layer);
      router.stack[0].should.have.property('path', '/source');
      done();
    });

    it('redirects using route names', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      router.get('home', '/', function () {});
      router.get('sign-up-form', '/sign-up-form', function () {});
      router.redirect('home', 'sign-up-form');
      request(http.createServer(app.callback()))
        .post('/')
        .expect(301)
        .end(function (err, res) {
          if (err) return done(err);
          res.header.should.have.property('location', '/sign-up-form');
          done();
        });
    });
  });

  describe('Router#route()', function () {
    it('inherits routes from nested router', function () {
      var app = new Koa();
      var subrouter = new Router().get('child', '/hello', function (ctx) {
        ctx.body = { hello: 'world' };
      });
      var router = new Router().use(subrouter.routes());
      expect(router.route('child')).to.have.property('name', 'child');
    });
  });

  it('', () => { // #432

  });

  describe('Router#routes()', () => {

    it('returns a function that has a _name property', () => { // #386

    });

  });

  describe('Router#url()', function () {
    it('generates URL for given route name', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      router.get('books', '/:category/:title', function (ctx) {
        ctx.status = 204;
      });
      var url = router.url('books', { category: 'programming', title: 'how to node' });
      url.should.equal('/programming/how%20to%20node');
      url = router.url('books', 'programming', 'how to node');
      url.should.equal('/programming/how%20to%20node');
      done();
    });

    it('generates URL for given route name within embedded routers', function (done) {
        var app = new Koa();
        var router = new Router({
          prefix: "/books"
        });

        var embeddedRouter = new Router({
          prefix: "/chapters"
        });
        embeddedRouter.get('chapters', '/:chapterName/:pageNumber', function (ctx) {
          ctx.status = 204;
        });
        router.use(embeddedRouter.routes());
        app.use(router.routes());
        var url = router.url('chapters', { chapterName: 'Learning ECMA6', pageNumber: 123 });
        url.should.equal('/books/chapters/Learning%20ECMA6/123');
        url = router.url('chapters', 'Learning ECMA6', 123);
        url.should.equal('/books/chapters/Learning%20ECMA6/123');
        done();
    });

    it('generates URL for given route name within two embedded routers', function (done) {
      var app = new Koa();
      var router = new Router({
        prefix: "/books"
      });
      var embeddedRouter = new Router({
        prefix: "/chapters"
      });
      var embeddedRouter2 = new Router({
        prefix: "/:chapterName/pages"
      });
      embeddedRouter2.get('chapters', '/:pageNumber', function (ctx) {
        ctx.status = 204;
      });
      embeddedRouter.use(embeddedRouter2.routes());
      router.use(embeddedRouter.routes());
      app.use(router.routes());
      var url = router.url('chapters', { chapterName: 'Learning ECMA6', pageNumber: 123 });
      url.should.equal('/books/chapters/Learning%20ECMA6/pages/123');
      done();
    });

    it('generates URL for given route name with params and query params', function(done) {
        var app = new Koa();
        var router = new Router();
        router.get('books', '/books/:category/:id', function (ctx) {
          ctx.status = 204;
        });
        var url = router.url('books', 'programming', 4, {
          query: { page: 3, limit: 10 }
        });
        url.should.equal('/books/programming/4?page=3&limit=10');
        var url = router.url('books',
          { category: 'programming', id: 4 },
          { query: { page: 3, limit: 10 }}
        );
        url.should.equal('/books/programming/4?page=3&limit=10');
        var url = router.url('books',
          { category: 'programming', id: 4 },
          { query: 'page=3&limit=10' }
        );
        url.should.equal('/books/programming/4?page=3&limit=10');
        done();
    })


    it('generates URL for given route name without params and query params', function(done) {
        var app = new Koa();
        var router = new Router();
        router.get('category', '/category', function (ctx) {
          ctx.status = 204;
        });
        var url = router.url('category', {
          query: { page: 3, limit: 10 }
        });
        url.should.equal('/category?page=3&limit=10');
        done();
    })
  });

  describe('Router#param()', function () {
    it('runs parameter middleware', function (done) {
      var app = new Koa();
      var router = new Router();
      app.use(router.routes());
      router
        .param('user', function (id, ctx, next) {
          ctx.user = { name: 'alex' };
          if (!id) return ctx.status = 404;
          return next();
        })
        .get('/users/:user', function (ctx, next) {
          ctx.body = ctx.user;
        });
      request(http.createServer(app.callback()))
        .get('/users/3')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.should.have.property('body');
          res.body.should.have.property('name', 'alex');
          done();
        });
    });

    it('runs parameter middleware in order of URL appearance', function (done) {
      var app = new Koa();
      var router = new Router();
      router
        .param('user', function (id, ctx, next) {
          ctx.user = { name: 'alex' };
          if (ctx.ranFirst) {
            ctx.user.ordered = 'parameters';
          }
          if (!id) return ctx.status = 404;
          return next();
        })
        .param('first', function (id, ctx, next) {
          ctx.ranFirst = true;
          if (ctx.user) {
            ctx.ranFirst = false;
          }
          if (!id) return ctx.status = 404;
          return next();
        })
        .get('/:first/users/:user', function (ctx) {
          ctx.body = ctx.user;
        });

      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .get('/first/users/3')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.should.have.property('body');
        res.body.should.have.property('name', 'alex');
        res.body.should.have.property('ordered', 'parameters');
        done();
      });
    });

    it('runs parameter middleware in order of URL appearance even when added in random order', function(done) {
      var app = new Koa();
      var router = new Router();
      router
        // intentional random order
        .param('a', function (id, ctx, next) {
          ctx.state.loaded = [ id ];
          return next();
        })
        .param('d', function (id, ctx, next) {
          ctx.state.loaded.push(id);
          return next();
        })
        .param('c', function (id, ctx, next) {
          ctx.state.loaded.push(id);
          return next();
        })
        .param('b', function (id, ctx, next) {
          ctx.state.loaded.push(id);
          return next();
        })
        .get('/:a/:b/:c/:d', function (ctx, next) {
          ctx.body = ctx.state.loaded;
        });

      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .get('/1/2/3/4')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);
        res.should.have.property('body');
        res.body.should.eql([ '1', '2', '3', '4' ]);
        done();
      });
    });

    it('runs parent parameter middleware for subrouter', function (done) {
      var app = new Koa();
      var router = new Router();
      var subrouter = new Router();
      subrouter.get('/:cid', function (ctx) {
        ctx.body = {
          id: ctx.params.id,
          cid: ctx.params.cid
        };
      });
      router
        .param('id', function (id, ctx, next) {
          ctx.params.id = 'ran';
          if (!id) return ctx.status = 404;
          return next();
        })
        .use('/:id/children', subrouter.routes());

      request(http.createServer(app.use(router.routes()).callback()))
      .get('/did-not-run/children/2')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.should.have.property('body');
        res.body.should.have.property('id', 'ran');
        res.body.should.have.property('cid', '2');
        done();
      });
    });
  });

  describe('Router#opts', function () {
    it('responds with 200', function (done) {
      var app = new Koa();
      var router = new Router({
        strict: true
      });
      router.get('/info', function (ctx) {
        ctx.body = 'hello';
      });
      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .get('/info')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.text.should.equal('hello');
        done();
      });
    });

    it('should allow setting a prefix', function (done) {
      var app = new Koa();
      var routes = Router({ prefix: '/things/:thing_id' });

      routes.get('/list', function (ctx) {
        ctx.body = ctx.params;
      });

      app.use(routes.routes());

      request(http.createServer(app.callback()))
        .get('/things/1/list')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.thing_id.should.equal('1');
          done();
        });
    });

    it('responds with 404 when has a trailing slash', function (done) {
      var app = new Koa();
      var router = new Router({
        strict: true
      });
      router.get('/info', function (ctx) {
        ctx.body = 'hello';
      });
      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .get('/info/')
      .expect(404)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
    });
  });

  describe('use middleware with opts', function () {
    it('responds with 200', function (done) {
      var app = new Koa();
      var router = new Router({
        strict: true
      });
      router.get('/info', function (ctx) {
        ctx.body = 'hello';
      })
      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .get('/info')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.text.should.equal('hello');
        done();
      });
    });

    it('responds with 404 when has a trailing slash', function (done) {
      var app = new Koa();
      var router = new Router({
        strict: true
      });
      router.get('/info', function (ctx) {
        ctx.body = 'hello';
      })
      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .get('/info/')
      .expect(404)
      .end(function (err, res) {
        if (err) return done(err);
        done();
      });
    });
  });

  describe('router.routes()', function () {
    it('should return composed middleware', function (done) {
      var app = new Koa();
      var router = new Router();
      var middlewareCount = 0;
      var middlewareA = function (ctx, next) {
        middlewareCount++;
        return next();
      };
      var middlewareB = function (ctx, next) {
        middlewareCount++;
        return next();
      };

      router.use(middlewareA, middlewareB);
      router.get('/users/:id', function (ctx) {
        should.exist(ctx.params.id);
        ctx.body = { hello: 'world' };
      });

      var routerMiddleware = router.routes();

      expect(routerMiddleware).to.be.a('function');

      request(http.createServer(
        app
          .use(routerMiddleware)
          .callback()))
      .get('/users/1')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('hello', 'world');
        expect(middlewareCount).to.equal(2);
        done();
      });
    });

    it('places a `_matchedRoute` value on context', function(done) {
      var app = new Koa();
      var router = new Router();
      var middleware = function (ctx, next) {
        expect(ctx._matchedRoute).to.be('/users/:id')
        return next();
      };

      router.use(middleware);
      router.get('/users/:id', function (ctx, next) {
        expect(ctx._matchedRoute).to.be('/users/:id')
        should.exist(ctx.params.id);
        ctx.body = { hello: 'world' };
      });

      var routerMiddleware = router.routes();

      request(http.createServer(
        app
          .use(routerMiddleware)
          .callback()))
      .get('/users/1')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);
        done();
      });
    });

    it('places a `_matchedRouteName` value on the context for a named route', function(done) {
      var app = new Koa();
      var router = new Router();

      router.get('users#show', '/users/:id', function (ctx, next) {
        expect(ctx._matchedRouteName).to.be('users#show')
        ctx.status = 200
      });

      request(http.createServer(app.use(router.routes()).callback()))
      .get('/users/1')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);
        done();
      });
    });

    it('does not place a `_matchedRouteName` value on the context for unnamed routes', function(done) {
      var app = new Koa();
      var router = new Router();

      router.get('/users/:id', function (ctx, next) {
        expect(ctx._matchedRouteName).to.be(undefined)
        ctx.status = 200
      });

      request(http.createServer(app.use(router.routes()).callback()))
      .get('/users/1')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);
        done();
      });
    });
  });

  describe('If no HEAD method, default to GET', function () {
    it('should default to GET', function (done) {
      var app = new Koa();
      var router = new Router();
      router.get('/users/:id', function (ctx) {
        should.exist(ctx.params.id);
        ctx.body = 'hello';
      });
      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .head('/users/1')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.be.empty();
        done();
      });
    });

    it('should work with middleware', function (done) {
      var app = new Koa();
      var router = new Router();
      router.get('/users/:id', function (ctx) {
        should.exist(ctx.params.id);
        ctx.body = 'hello';
      })
      request(http.createServer(
        app
          .use(router.routes())
          .callback()))
      .head('/users/1')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.be.empty();
        done();
      });
    });
  });

  describe('Router#prefix', function () {

    it('should prefix existing routes', function () {
      const app = new Koa();
      const router = new Router();
      router.get('/users/:id', function (ctx) {
        ctx.body = 'test';
      });
      router.prefix('/things/:thing_id');
      app.use(router.routes());

      request(http.createServer(app.callback()))
        .get('/things/1/users/2')
        .expect('test');
    });

    describe('when used with .use(fn)', function () { // #247
      it('does not set params.0 to the matched path', function (done) {
        var app = new Koa();
        var router = new Router();

        router.use(function(ctx, next) {
          return next();
        });

        router.get('/foo/:id', function(ctx) {
          ctx.body = ctx.params;
        });

        router.prefix('/things');

        app.use(router.routes());
        request(http.createServer(app.callback()))
          .get('/things/foo/108')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            expect(res.body).to.have.property('id', '108');
            expect(res.body).to.not.have.property('0');
            done();
          });
      });
    });

    describe('with trailing slash', testPrefix('/admin/'));
    describe('without trailing slash', testPrefix('/admin'));

    function testPrefix(prefix) {
      return function () {
        var server;
        var middlewareCount = 0;

        before(function () {
          var app = new Koa();
          var router = new Router();
          router.use(function (ctx, next) {
            middlewareCount++;
            ctx.thing = 'worked';
            return next();
          });
          router.get('/', function (ctx) {
            middlewareCount++;
            ctx.body = { name: ctx.thing };
          });
          router.prefix(prefix);
          app.use(router.routes());
          server = http.createServer(app.callback());
        });

        after(function () {
          server.close();
        });

        beforeEach(function () {
          middlewareCount = 0;
        });

        it('should support root level router middleware', function (done) {
          request(server)
            .get(prefix)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);
              expect(middlewareCount).to.equal(2);
              expect(res.body).to.be.an('object');
              expect(res.body).to.have.property('name', 'worked');
              done();
            });
        });

        it('should support requests with a trailing path slash', function (done) {
          request(server)
            .get('/admin/')
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);
              expect(middlewareCount).to.equal(2);
              expect(res.body).to.be.an('object');
              expect(res.body).to.have.property('name', 'worked');
              done();
            });
        });

        it('should support requests without a trailing path slash', function (done) {
          request(server)
            .get('/admin')
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);
              expect(middlewareCount).to.equal(2);
              expect(res.body).to.be.an('object');
              expect(res.body).to.have.property('name', 'worked');
              done();
            });
        });
      }
    }
  });

  describe('Static Router#url()', function () {
    it('generates route URL', function () {
        var url = Router.url('/:category/:title', { category: 'programming', title: 'how-to-node' });
        url.should.equal('/programming/how-to-node');
    });

    it('escapes using encodeURIComponent()', function () {
      var url = Router.url('/:category/:title', { category: 'programming', title: 'how to node' });
      url.should.equal('/programming/how%20to%20node');
    });
  });
});
