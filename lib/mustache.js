// mustache wrapper for express

const fs = require("fs");
const url = require("url");
const path = require("path");

const debug = require("debug")("zoup:mustache");
const mustache = require("mustache");
const quu = require("quu");

const config = require("../lib/config");
const u = url.parse(config.get("url"));

const r = {
	base: u.href.replace(/\/$/,''),
	zoup: url.resolve(u.pathname, "zoup"),
	asset: url.resolve(u.pathname, config.get("assetstore")),
	'avatar': config.get("avatar"),
	'avatar-small': config.get("avatar-small"),
	'light-theme': config.get("light-theme")||false,
	'main-color': config.get("main-color")||false,
	'title': config.get("title")||false,
	'description': config.get("description")||false,
};

// listen to changes
Object.keys(r).forEach(function(k){
	config.onDidChange(k, function(v){
		r[k]=v;
	});
});

const m = module.exports = function(opts){
	if (!(this instanceof m)) return new m(opts);
	const self = this;

	// options
	self.opts = {
		ext: ".mustache",
		...opts
	};

	// memory cache of templates
	self.cache = {};

	// render function for express
	return function(file, data, fn){
		
		self.get(file, function(err, template, partials){
			if (err) return fn(err);

			// current sire indicator
			const current = {};
			current["current-"+data.current] = "current";

			try {
				fn(null, mustache.render(template, {
					auth: (data.req && data.req.session && data.req.session.auth),
					...r,
					...data,
					...current,
					templates: partials,
				}, partials));
			} catch (err) {
				return fn(err);
			}
		});
	};
};

m.prototype.partials = function(template) {
	const self = this;
	const partials = [];
	
	template.forEach(function(t){
		switch (t[0]) {
			case ">":
				if (!partials.includes(t[1])) partials.push(t[1]);
			break;
			case "#":
				self.partials(t[4]).forEach(function(p){
					if (!partials.includes(p)) partials.push(p);
				});
			break;
		}
	});
	return partials;
};

m.prototype.get = function(file, fn){
	const self = this;
		
	self.load(file, function(err, template){
		if (err) return fn(err)
		
		const partials = {}; 
		const q = quu(null, true);
		
		self.partials(mustache.parse(template)).map(function(p){ return partials[p]=null,p; }).forEach(function(partial){
			q.push(function(done){
				self.load(path.resolve(path.dirname(file), '_'+partial+self.opts.ext), function(err, content){
					partials[partial] = content;
					done(err);
				});
			});
		});
		
		// check if queue is nessecary
		if (Object.keys(partials).length === 0) return fn(null, template, partials);
		
		// run partial loader queue
		q.run(function(err){
			if (err.length > 0) return fn(err.shift()); // use first error
			fn(null, template, partials);
		});
	});
	
	return this;
};

m.prototype.load = function(file,fn){
	const self = this;
	fs.stat(file, function(err, stat){
		if (err) return debug("[load] '%s': %s". file, err), fn(err, "");
		if (self.cache.hasOwnProperty(file) && self.cache[file].stat.mtime === stat.mtime) return fn(null, self.cache[file].content);
		fs.readFile(file, function(err, content){
			if (err) return debug("[load] '%s': %s". file, err), fn(err, "");
			self.cache[file] = { stat: stat, content: content.toString() };
			return fn(null, self.cache[file].content);
		});
	});
	return this;
};
