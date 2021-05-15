#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const url = require("url");
const path = require("path");

const bcrypt = require("bcryptjs");
const express = require("express");
const multer = require("multer");
const mustache = require("../lib/mustache");
const zoup = require("../lib/zoup");
const bodyParser = require("body-parser");
const session = require('express-session')
const store = require('express-nedb-session')(session);
const debug = require("debug")("zoup");
const password = require("../lib/password");

// fill in defaults for missing config
const config = require("../lib/config");
if (!config.has('assetstore')) config.set('assetstore', 'assets');
if (!config.has('handletoken')) config.set('handletoken', password(16));

// conf.u = url.parse(config.get("url"));
const u = url.parse(config.get("url"))

const z = zoup({
	path: path.resolve(config.get('datadir')),
	url: config.get('url'),
	assetstore: config.get('assetstore'),
	username: config.get('username'),
});

const server = express();
const app = express.Router();

const upload = multer({ dest: path.resolve(os.tmpdir(),'zoup') });  // FIXME sort out paths // path.resolve(config.get('datadir'), "store") });

server.use(u.pathname, app);

// config
server.set('x-powered-by', false); // remove awkward header
server.set('trust proxy', 1) // trust first proxy


// Use with the session middleware (replace express with connect if you use Connect)
app.use('/', session({
	name: 'zoup',
	secret: config.get("secret"),
	resave: false,
	saveUninitialized: false,
	proxy: true,
	cookie: {
		path: u.pathname,
		domain: u.hostname,
		secure: (u.protocol === 'https:'),
		secureProxy: true, //(conf.u.protocol === 'https:'),
		maxAge: 604800000, // 7d
		sameSite: "Strict",
	},
	rolling: true,
	unset: 'destroy',
	store: new store({
		filename: path.resolve(config.get('datadir'), 'zoup-session.db'),
	})
}));

server.engine('mustache', mustache());
server.set('view engine', "mustache");
server.set('views', __dirname + '/../assets/templates');

// FIXME replace with avatar
app.get("/favicon.ico", function(req,res){
	res.status(204).end();
});

app.use("/zoup", express.static(path.join(__dirname, '/../assets')));
app.use("/"+config.get("assetstore"), express.static(path.resolve(config.get("datadir"), config.get("assetstore"))));


// app.use("/api", bodyParser.json()); // FIXME

// index
app.get('/', function (req, res) {

	// FIXME sane before
	z.feed({
		feed: "main",
	}, function(err, feed){
		if (err) return res.status(500).json();
		res.render('index', {
			req: req,
			current: "stream",
			posts: feed.items
		});
	});

});

// main feed
app.get("/feed.json", function(req, res){
	// FIXME sane before
	z.feed({
		feed: "main",
		before: req.query.before,
	}, function(err, feed){
		if (err) return res.status(500).json();
		res.status(200).json(feed);
	});
});

// single post json
app.get('/post/:id.json', function (req, res) {
	z.get(req.params.id, function(err, post){
		if (err) return res.status(404).render('404');
		// sanitize FIXME
		res.status(200).json(post);
	});
});

// single post
app.get('/post/:id', function (req, res) {
	// FIXME: check valid id
	z.get(req.params.id, function(err, post){
		if (err) return res.status(404).render('404');
		res.status(200).render("post", {
			// human readble date, etc
			...config.store,
			req: req,
			posts: [ post ]
		})
	});
});


// login web interface
app.get('/login', function (req, res) {
	if (!!req.session.auth) return res.redirect(config.get("url"));
	res.render('login', {
		req: req,
		current: "login",
	});
});

// log out
app.get('/logout', function (req, res) {
	if (!!req.session.auth) req.session = null;;
	return res.redirect(config.get("url"));
});

// settings web interface
app.get('/settings', function (req, res) {
	if (!req.session.auth) return res.redirect(config.get("url"));
	res.render('settings', { 
		req: req,
		current: "settings"
	});
	
});

// publish web interface
app.get('/publish', function (req, res) {
	if (!req.session.auth) return res.redirect(config.get("url"));
	res.render('publish', { 
		req: req,
		current: "publish",
	});
});




// set description
app.post("/api/settings/description", bodyParser.json(), function(req, res){
	if (!req.session.auth) return res.status(500).end();
	config.set("description", req.body.description||"");
	res.status(200).json();
});

// set colors
app.post("/api/settings/colors", bodyParser.json(), function(req, res){
	if (!req.session.auth) return res.status(500).end();
	if (!/^#[a-f0-9]{6}$/.test(req.body["main-color"])) return res.status(500).json();
	config.set("main-color", req.body["main-color"]);
	config.set("light-theme", req.body["light-theme"]||false);
	res.status(200).json();
});

// set avatar
app.post("/api/settings/avatar", upload.single('avatar'), function(req, res){
	if (!req.session.auth) return res.status(500).end();
	z.avatar(req.file, function(err, avatar){
		if (err) return res.status(500).json({ error: err.toString() });
		res.status(200).json({ avatar: avatar });
	});
});

// publish api
app.post("/api/publish", upload.array('upload', 12), function(req, res){
	z.create({
		stream: "main",
		upload: req.files,
		...req.body,
	}, function(err, post){
		console.log(err);
		if (err) return res.status(500).json({ error: err.toString() });
		res.status(201).json({ url: post.url });
	});
});

// discover endpoint
app.get('/discover', function (req, res) {

	const handle = url.parse(decodeURIComponent(url.parse(req.url).query), true);

	switch (handle.protocol) {
		case "web+zoup:":
			
			console.log(handle.hostname, handle.query);
			
			// FIXME: check handle token
			
			switch (handle.hostname) {
				case "follow":

					res.status(200).end("follow "+handle.query.url);
					
				break;
				case "repost":

					res.status(200).end("repost "+handle.query.url);
					
				break;
				case "react":

					res.status(200).end("react to "+handle.query.url);
					
				break;
				default:
					// no oether methods for now
					res.status(500).end();
				break;
			}
			
		break;
		default:
			// nothing else to support for now
			res.status(500).end();
		break;
	}
		
	// default to 200
	res.status(200).end();

});


app.use("/login", bodyParser.urlencoded({ extended: true })); 

app.post('/login', function (req, res) {
	if (config.get("username") === req.body.username && bcrypt.compare(req.body.password, config.get("password"))) {
		req.session.auth = req.body.username;
		res.redirect('/');
	} else {
		req.session.auth = null;
		res.render('login', { 
			req: req,
			current: "login",
			error: true 
		});
	}
});




// listen
(function(fn){
	if (config.store.listen === "port") return server.listen(config.store.port, config.store.hostname, function(err){
		fn(err, "http://"+config.store.hostname+":"+config.store.port+"/");
	});
	(function(next){
		fs.access(config.store.socket, fs.constants.F_OK, function(x){
			if (!x) return next();
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
	if (err) return debug(err), process.exit(1);
	debug("Listening on %s", lstn);
});
