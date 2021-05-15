const fs = require("fs");
const url = require("url");
const quu = require("quu");
const path = require("path");
const sharp = require("sharp");
const events = require("events");
const mkdirp = require("mkdirp");
const imgsize = require("image-size");

const db = require("./db");
const link = require("./link");
const mime = require("./mime");
const render = require("./render");
const randid = require("./randid");
const vidsize = require("./video-size");
const latinize = require("./latinize");
const sanitize = require("./sanitize");

const config = require("./config");

const u = url.parse(config.get("url"));

const debug  =require("debug")("zoup");

const zoup = function(opts){ // opts is the config object
	if (!(this instanceof zoup)) return new zoup(opts);
	const self = this;
	
	self.opts = {
		path: path.resolve(config.get('datadir')),
		username: config.get('username'),
		assetstore: config.get('assetstore'),
		avatar: config.get('avatar'),
		url: config.get('url'),
	};
	
	// posts database
	self.posts = new db("posts", { autoload: true });
	self.posts.ensureIndex({ fieldName: '_type' }); // private property: post, repost, reaction, imported
	self.posts.ensureIndex({ fieldName: '_stream' }); // private property: main, friends
	self.posts.ensureIndex({ fieldName: 'date_published' });
	self.posts.ensureIndex({ fieldName: 'tags' });
	self.posts.ensureIndex({ fieldName: 'url' }); // for quick lookups of third party posts by url reference

	// feeds database
	/* FIXME later
	self.feeds = new db("feeds", autoload: true });
	self.feeds.ensureIndex({ fieldName: '_type' });
	self.feeds.ensureIndex({ fieldName: '_stream' });
	self.feeds.ensureIndex({ fieldName: '_updated' });
	*/
	
	events.call(this);
	
	return this;
};

require("util").inherits(zoup, events);

// create post
zoup.prototype.create = function(post, fn){
	const self = this;
	
	// FIXME check?
	
	self.ingest(post, function(err, post){
		if (err) return fn(err);
		
		self.posts.insert(post, function(err, post){
			if (err) return fn(err);

			self.emit("post", self.item(post));

			return fn(null, post);
		});

	});
	
	return this;
};

// update post
zoup.prototype.update = function(post, fn){
	const self = this;
	
	if (!post.hasOwnProperty("_id")) return fn(new Error("Missing _id"));
	
	self.prepare(post, function(err, post){
		if (err) return fn(err);

		self.posts.update({ _id: post._id }, { ...post }, {}, function(err, num){
			if (err) return fn(err);
			if (num === 0) return fn(new Error("Update failed"));
			return fn(null, post);
		});

	});
	
	return this;
};

// delete post
zoup.prototype.delete = function(id, fn){
	const self = this;
	
	self.posts.remove({ _id: id }, {}, function(err, num){
		if (err) return fn(err);
		if (num === 0) return fn(new Error("Update failed"));
		return fn(null, id);
	});
	
	return this;
};

// retrieve post
zoup.prototype.get = function(id, fn){
	const self = this;

	self.posts.find({ _id: id }, function(err, posts){
		if (err) return fn(err);
		if (posts.length === 0) return fn(new Error("Post does not exist"));
		return fn(null, posts[0]);
	});
	
	return this;
};

// retrieve posts
zoup.prototype.query = function(opt, fn){
	const self = this;
	
	const opts = {
		skip: 0,
		limit: 100, // FIXME is this sane?
		stream: "main",
		query: {},
		...opt
	};
	
	self.posts.find({ _stream: opts.stream, ...opts.query }).skip(opts.skip).limit(opts.limit).sort({ date_published: -1 }).exec(fn);
	
	return this;
};

// build feed
zoup.prototype.feed = function(opt, fn){
	const self = this;

	const opts = {
		skip: 0,
		stream: "main",
		query: {},
		...opt,
		limit: 32+1,
	};
	
	opts.feed = (opts.stream === "main") ? "feed.json" : opts.stream+".json";

	if (opts.before) opts.query.date_published = { $lt: new Date(parseInt(opts.before,10)) }

	self.query(opts, function(err, data){
		if (err) return fn(err);
				
		// prepare result
		const result = {
			"version": "https://jsonfeed.org/version/1.1",
			"title": config.get("title"),
			"description": config.get("description") || undefined,
			"home_page_url": config.get("url"),
			"feed_url": url.resolve(config.get("url"), opts.feed),
			"next_url": null,
			"icon": config.get("avatar"),
			"favicon": config.get("avatar-small"),
			"authors": [{ // this is about the curation of the feed, not the posts authors
				name: self.opts.username,
				url: self.opts.url,
				avatar: self.opts.avatar,
			}],
			/* FIXME implement
			"hubs": [{ 
				"type": "websocket", 
				"url": "wss://zoup.example.org/stream.json" 
			}],
			*/
			"items": []
		};
		
		// check if feed continues
		if (data.length > (opts.limit-1)) {
			data.pop(); // remove overflow item
			result.next_url = url.resolve(config.get("url"), opts.feed+"?before="+data[data.length-1].date_published.valueOf()); // set next feed url
		} else {
			result.next_url = undefined;
		};

		// set items
		result.items = data.map(function(item){
			// strip content, clean up
			return self.item(item);
		});
		
		// clean up
		
		return fn(null, result);

	});

	return this;
};

// sanitize item
zoup.prototype.item = function(item){
	return {
		id: item._id,
		...item,
		_id: undefined,
		_type: undefined,
		_stream: undefined,
		_content: undefined,
		external_url: (item.external_url || undefined),
		title: (item.title || undefined),
		attachments: (item.attachments.length > 0) ? item.attachments : undefined,
		authors: item.authors.map(function(author){
			return {
				...author,
				avatar: (author.avatar || undefined),
			}
		}),
		_zoup: {
			from: (item._zoup.from||undefined),
			via: (item._zoup.from||undefined),
			reaction: (item._zoup.from||undefined),
			reposts: ((item._zoup.reposts&&item._zoup.reposts.length>0)?item._zoup.reposts:undefined),
			reactions: ((item._zoup.reactions&&item._zoup.reactions.length>0)?item._zoup.reactions:undefined),
		}
	};
};

// repost
zoup.prototype.repost = function(id, fn){
	const self = this;
	
	fn(new Error("not implemented"))
	
	return this;
};

// reaction
zoup.prototype.react = function(fn){
	const self = this;
	
	fn(new Error("not implemented"))
	
	return this;
};

// follow remote feed
zoup.prototype.follow = function(feed, opts, fn){
	const self = this;
	
	fn(new Error("not implemented"))
	
	return this;
};

// unfollow remote feed
zoup.prototype.unfollow = function(feed, fn){
	const self = this;
	
	fn(new Error("not implemented"))
	
	return this;
};

// sanitize tags
zoup.prototype.tags = function(tags){ // FIXME wtf
	if (!tags) return [];
	if (typeof tags === "string") tags = tags.split(/,\s*/g); // (tags.includes("#")) ? tags.split(/#/g) : (tags.includes(",")) ? tags.split(/,\s*/g) : tags.split(/\s+/g);
	if (!(tags instanceof Array)) return [];
	return tags.filter(function(t){
		return (typeof t === "string");
	}).map(function(t){
		return latinize(t.trim().toLowerCase().replace(/^#/,''));
	}).filter(function(t){
		return t !== "";
	});
};

// handle avatar
zoup.prototype.avatar = function(file, fn){
	const self = this;

	const id = randid();

	const img = sharp(file.path);
	
	img.clone().resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(path.join(self.opts.path, self.opts.assetstore, id+".png"), function(err, result){
		if (err) return fn(err);
		img.clone().resize({ width: 64, height: 64, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(path.join(self.opts.path, self.opts.assetstore, id+".min.png"), function(err, result){
			if (err) return fn(err);
			
			// set as avatar in config
			config.set("avatar", url.resolve(self.opts.url, path.join(self.opts.assetstore, id+".png")));
			config.set("avatar-small", url.resolve(self.opts.url, path.join(self.opts.assetstore, id+".min.png")));
			
			return fn(null, config.get("avatar"));
		
		});
	});

	return this;
};

// handle upload
zoup.prototype.upload = function(file, fn){
	const self = this;
	
	(function(next){
		
		file.id = randid();
		file.mime = file.mimetype;
	
		if (mime.hasOwnProperty(file.mimetype)) {
		
			file.ext = "."+mime[file.mimetype].ext;
			file.type = mime[file.mimetype].type;
		
			switch (mime[file.mimetype].type) {
				case "image":
					// image dimensions
					imgsize(file.path, function (err, dimensions) {
						if (!err) {
							file.width = dimensions.width;
							file.height = dimensions.height;
						}
						next(); // FIXME enforce limits, optimize
					});
				break;
				case "video":
					// video dimensions
					vidsize(file.path, function (err, dimensions) {
						if (!err) {
							file.width = dimensions.width;
							file.height = dimensions.height;
						}
						next();
					});
				break;
				case "audio":
					// pass through
					next();
				break;
				default:
					// pass sthrough
					next();
				break;
			}
		} else {
			// it is what it is
			file.ext = "."+((path.basename(path.extname(file.originalname))||".").substr(1)||"bin");

			if (mime.hasOwnProperty(file.ext)) {
				file.ext = mime[file.ext].ext;
				file.type = mime[file.ext].type;
			} else {
				file.type = "file";
			}

			// pass through
			next();

		};
				
	})(function(){
		
		// move file to its destination FIXME
		file.destname = file.id+file.ext;
		file.dest = path.join(self.opts.path, self.opts.assetstore, file.destname);
		file.url = url.resolve(self.opts.url, path.join(self.opts.assetstore, file.destname));

		mkdirp(path.dirname(file.dest), function(err){
			if (err) return fs.unlink(file.path, function(uerr){
				fn(err);
			});

			fs.rename(file.path, file.dest, function(err){
				// if move fails, unlink uploaded files
				if (err) return fs.unlink(file.path, function(uerr){
					fn(err);
				});

				// FIXME compression?
				fn(null, {
					id: file.id,
					type: file.type,
					filename: file.destname,
					url: file.url,
					width: file.width || null,
					height: file.height || null,
					mime: file.mime,
					size: file.size,
				});
			
			});
			
		});

	});
	
};

// post
zoup.prototype.ingest = function(post, fn){
	const self = this;

	const id = (post.id || randid());

	const result = {
		_id: id,
		_type: (post.type||post._type||self.opts.type||"post"), // post, repost, reaction, import
		_stream: (post.stream||post._stream||self.opts.stream||"main"),
		date_published: (post.date_published||(new Date())),
		date_modified: (new Date()),
		url: url.resolve(self.opts.url, path.join("post", id)),
		title: ((post.title) ? post.title.trim() : null),
		tags: self.tags(post.tags),
		content_html: "",
		_content: [],
		external_url: null,
		attachments: [],
		authors: post.authors || [{
			name: self.opts.username,
			url: self.opts.url,
			avatar: self.opts.avatar || null,
		}],
		_zoup: { // federation meta
			from: (post.from||undefined), // FIXME: resolve user and avatar if url
			via: (post.via||undefined), // FIXME: resolve user and avatar if url
			reposts: [],
			reaction: (post.reaction||undefined), // FIXME: resolve user and avatar if url
			reactions: [],
		},

	};
	
	(function(next){
		
		switch (post.type){ 
			case "text":
				if (post.hasOwnProperty("text")) { // FIXME: switchable editors in publish.js
					result._content.push({
						type: "text",
						text: post.text
					});
				} else if (post.hasOwnProperty("html")) {
					result._content.push({
						type: "html",
						html: post.html
					});
				} else if (post.hasOwnProperty("markdown")) {
					result._content.push({
						type: "markdown",
						markdown: post.markdown
					});
				}
				return next(result);
			break;
			case "upload":
				const uq = quu(5);
				var files = [];
			
				post.upload.forEach(function(file, i){
					uq.push(function(done){
						self.upload(file, function(err, file){
							if (!err) {
								files[i] = file;
								result.attachments.push({
									url: file.url,
									mime_type: file.mime
								});
							}
							done();
						});
					});
				});
			
				uq.done(function(){
					// strip failed files
					files.filter(function(f){ return f; }).forEach(function(f){ result._content.push(f); });
					
					if (post.caption){
						result._content.push({
							type: "caption",
							caption: (post.caption||"").trim(),
						});
					}
					
					next(result);
				});
			
			break;
			case "link":
				link(post.link, function(err, link){
					if (err) fn(new Error("Unable to resolve link"));

					result._content.push(link);
					
					if (post.caption){
						result._content.push({
							type: "caption",
							caption: post.caption,
						});
					}
					
					next(result);
				});
			break;
			default: 
				return fn(new Error("Unknown post type"));
			break;
		}
		
	})(function(post){
		
		// create html from post
		render(result._content, self.opts, function(err, html){
			if (err) return fn(err);
			result.content_html = html;
			debug("ingest", result);
			return fn(null, result);
		});
		
	});

	return self;
};

module.exports = zoup();