#!/usr/bin/env node

const config = require("../lib/config");

// ensure config FIXME: to config
if (!config.has('assetstore')) config.set('assetstore', 'assets');

const fs = require("fs");
const os = require("os");
const url = require("url");
const path = require("path");
const bcrypt = require("bcryptjs");
const debug = require("debug")("zoup");

const express = require("express");
const session = require("express-session")
const multer = require("multer");
const bodyparser = require("body-parser");
const websocket = require("express-ws");

const mustache = require("../lib/mustache");
const store = require("../lib/session-store");
const zoup = require("../lib/zoup");

const server = express();
const router = express.Router();

websocket(server);

const upload = multer({ dest: path.resolve(os.tmpdir(),'zoup') });  // FIXME sort out paths // path.resolve(config.get('datadir'), "store") });

const root = url.parse(config.get("url"))

server.use(root.pathname, router);

// config
server.set("x-powered-by", false);
server.set("trust proxy", 1) 

server.engine("mustache", mustache());
server.set("view engine", "mustache");
server.set('views', path.resolve(__dirname, "../assets/templates"));

// configure sessions
router.use('/', session({
	name: 'zoup',
	secret: config.get("secret"),
	resave: false,
	saveUninitialized: false,
	proxy: true,
	cookie: {
		path: root.pathname,
		domain: root.hostname,
		secure: (root.protocol === 'https:'),
		secureProxy: true, //(root.protocol === 'https:'),
		maxAge: 604800000, // 7d
		sameSite: "Strict",
	},
	rolling: true,
	unset: 'destroy',
	store: store(session),
}));

// staic files
router.use("/zoup", express.static(path.resolve(__dirname, '../assets')));
router.use("/"+config.get("assetstore"), express.static(path.resolve(config.get("datadir"), config.get("assetstore"))));

// empty favicon FIXME replace with avatar / default avatar
router.get("/favicon.ico", function(req,res){ 
	if (config.has("avatar-small")) {
		res.redirect(config.get("avatar-small"));
	} else {
		res.status(204).end(); 
	}
});

/* html interfaces */

// main stream
router.get('/', function(req, res){
	// FIXME different api that sanitizes posts
	zoup.feed({
		feed: "main",
		before: req.query.before, // FIXME sanitize
	}, function(err, feed){
		if (err) return res.status(500).json();
		res.render('index', {
			req: req,
			current: "stream",
			posts: feed.items,
			next_url: feed.next_url,
			before: ((feed.next_url) ? feed.items[feed.items.length-1].date_published.valueOf() : null),
		});
	});
});

// friends stream
router.get('/friends', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// settings
router.get('/settings', function(req, res){
	if (!req.session.auth) return res.redirect(config.get("url")); // FIXME make this middleware
	res.render('settings', { 
		req: req,
		current: "settings",
	});
});

// standalone publish
router.get('/publish', function(req, res){
	if (!req.session.auth) return res.redirect(config.get("url")); // FIXME make middleware
	res.render('publish', { 
		req: req,
		current: "publish",
	});
});

// subscription management
router.get('/subscriptions', function(req, res){
	if (!req.session.auth) return res.redirect(config.get("url")); // FIXME make this middleware
	res.render('subscriptions', { 
		req: req,
		current: "subscriptions",
	});
});

/* public feeds */

// main feed
router.get('/feed.json', function(req, res){
	// FIXME sane before
	zoup.feed({
		feed: "main",
		before: req.query.before,
	}, function(err, feed){
		if (err) return res.status(500).json();
		res.status(200).json(feed);
	});
});

// friend feed
router.get('/friends.json', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

/* public streams */

// websocket stream
router.ws('/stream.json', function(ws, res){

	// deliver current posts
	/*
	zoup.feed({
		feed: "main",
	}, function(err, feed){
		if (err) return;
		feed.items.reverse().forEach(function(post){
			ws.send(JSON.stringify(post));
		});
	});
	*/

	const msg = function(post){
		ws.send(JSON.stringify(post));
	}

	zoup.on("post", msg);

	ws.on("close", function(){
		zoup.off("post", msg);
	});

});

/* basics */

// logout FIXME csrf protection
router.get('/logout', function(req, res){
	if (req.session.auth) req.session = null;
	return res.redirect(config.get("url"));
});

// login
router.get('/login', function(req, res){
	if (req.session.auth) return res.redirect(config.get("url"));
	res.render('login', {
		req: req,
		current: "login",
	});
});


// login action
router.post('/login', bodyparser.urlencoded({ extended: true }), function(req, res){
	if (config.get("username") === req.body.username && bcrypt.compare(req.body.password, config.get("password"))) {
		req.session.auth = true;
		res.redirect(config.get("url"));
	} else {
		req.session = null;
		res.render('login', { 
			req: req,
			current: "login",
			error: true 
		});
	}
});

/* single post */

// post json
router.get('/post/:id.json', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// post html
router.get('/post/:id', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// tag feed
router.get('/tag/:tag', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});


/* ping interface */

// follow ping
router.get('/ping/follow', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// repost ping
router.get('/ping/repost', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// reaction ping
router.get('/ping/reaction', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

/* intents */

// follow intent
router.get('/intent/follow', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// repost intent
router.get('/intent/repost', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// react intent
router.get('/intent/react', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

/* discovery */

// discover
router.get('/discover', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});


/* posts */

// publish a post
router.post("/api/publish", upload.array('upload', 12), function(req, res){
	if (!req.session.auth) return res.status(401).end("Unauthorized"); // FIXME make middleware
	zoup.create({
		stream: "main",
		type: "post",
		upload: req.files,
		...req.body,
	}, function(err, post){
		if (err) return res.status(500).json({ error: err.toString() });
		res.status(201).json({ url: post.url });
	});
});


// unpublish a post
router.post('/api/unpublish', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// repost
router.post('/api/repost', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// create reaction post
router.post('/api/react', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

/* settings */

// get settings
router.get('/api/settings', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// set color settings
router.post('/api/settings/color', function(req, res){
	if (!req.session.auth) return res.status(401).end("Unauthorized"); // FIXME make middleware
	if (!/^#[a-f0-9]{6}$/.test(req.body["main-color"])) return res.status(500).json();
	config.set("main-color", req.body["main-color"]);
	config.set("light-theme", req.body["light-theme"]||false);
	res.status(200).json(true);
});

// set description
router.post('/api/settings/description', bodyparser.json(), function(req, res){
	if (!req.session.auth) return res.status(401).end("Unauthorized"); // FIXME make middleware
	config.set("description", req.body.description||"");
	res.status(200).json(true);
});

// change avatar
router.post('/api/settings/avatar', upload.single('avatar'), function(req, res){
	if (!req.session.auth) return res.status(401).end("Unauthorized"); // FIXME make middleware
	zoup.avatar(req.file, function(err, avatar){
		if (err) return res.status(500).json({ error: err.toString() });
		res.status(200).json({ avatar: avatar });
	});
});

/* subscriptions */

// subscriptions
router.post('/api/subscriptions', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// new subscription
router.post('/api/subscriptions/follow', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// end subscription
router.post('/api/subscriptions/unfollow', function(req, res){
	res.status(500).end("Not implemented."); // FIXME
});

// listen
(function(fn){
	if (config.store.listen === "port") return server.listen(config.store.port, config.store.hostname, function(err){
		fn(err, "http://"+config.store.hostname+":"+config.store.port+"/");
	});
	(function(next){
		fs.access(config.store.socket, fs.constants.F_OK, function(x){
			if (x) return next();
			fs.unlink(config.store.socket, function(err){
				if (err) return fn(err);
				next();
			});
		});
	})(function(){
		return server.listen(config.store.socket, function(err){
			if (err) return fn(err);
			fs.chmod(config.store.socket, 0o777, function(err){
				if (err) return fn(err);
				fn(null, config.store.socket);
			});
		});
	});
})(function(err, lstn){
	if (err) return console.error(err), process.exit(1);
	debug("listening on %s", lstn);
});
