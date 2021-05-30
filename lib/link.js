
const fs = require("fs");
const url = require("url");
const path = require("path");

const quu = require("quu");
const needle = require("needle");
const imgsize = require("probe-image-size");
const vidsize = require("remote-ffprobe");
const tweethtml = require("tweet-html");
const metascraper = require("metascraper");

const config = require("./config");
const hashid = require("./hashid");
const mime = require("./mime");

// global queue
const q = quu(5);

const needle_opts = {
	compressed: true,
	follow_max: 5,
	rejectUnauthorized: true,
	response_timeout: 5000,
	read_timeout: 5000,
	parse_response: false,
	decode_response: true,
	user_agent: "Mozilla/5.0 (compatible; Zoup/1.0)", // FIXME
	follow_set_cookies: true,
};

const link = function(u, fn){
	if (!(this instanceof link)) return new link(u, fn);
	const self  = this;

	// no callback, no action
	if (!fn || typeof fn !== "function") return this;

	// check if url is parable
	try {
		self.url = new URL(u);
		self.href = self.url.toString();
	} catch (err) {
		fn(err);
		return self;
	}
	
	// check protocol
	switch (self.url.protocol) {
		case "http:":
		case "https:":
			self.fetch(self.href, function(err, lnk){
				return fn(null, (lnk || {
					type: "link",
					url: self.href,
				}));
			});
		break;
		// FIXME: add in more protocols here? 'data:'
		default:
			return fn(null, {
				type: "link",
				url: self.href,
			});
		break;
	}
		
	return self;
};

link.prototype.fetch = function(u, fn){
	const self = this;
	
	needle.head(u, needle_opts, function(err, resp, data){
		if (err) return fn(err);
		if (Math.floor(resp.statusCode/100) !== 2) return fn(new Error("HTTP Status Code "+resp.statusCode), null);
		if (!resp.headers.hasOwnProperty("content-type")) return fn(new Error("No Content-Type"), null);

		const mime_type = resp.headers["content-type"].split(';').shift().toLowerCase().trim();
		
		switch (mime_type) {
			case "text/html":
			case "application/xhtml+xml":
				switch (self.url.hostname.replace(/^www\./,'')) {
					case "youtube.com":
					case "youtu.be":
						self.youtube(u, fn);
					break;
					case "twitter.com":
						self.twitter(u, fn);
					break;
					case "instagram.com":
						self.instagram(u, fn);
					break;
					case "open.spotify.com":
					case "spotify.com":
					case "sptfy.com":
					case "spoti.fi":
						self.spotify(u, fn);
					break;
					case "soundcloud.com":
					case "snd.sc":
						self.soundcloud(u, fn);
					break;
					case "vimeo.com":
					case "player.vimeo.com":
						self.vimeo(u, fn);
					break;
					// FIXME: add Dailymotion, Deviantart, Flickr, Gfycat, GIPHY, Reddit, TikTok
					default:
						// metascraper
						self.metascraper(u, fn);
					break;
				}
			break;
			case "image/gif":
			case "image/jpeg":
			case "image/png":
			case "image/webp":
			case "image/svg+xml":
				
				// get dimensions
				imgsize(u).then(function(data){
					return fn(null, {
						type: "link.image",
						mime: data.mime,
						url: u,
						width: data.width,
						height: data.width,
					});
				}).catch(function(err){
					return fn(err, { type: "link", url: u });
				});
				
			break;
			case "audio/webm":
			case "audio/aac":
			case "audio/mpeg":
			case "audio/mp3":
			case "audio/ogg":
			case "audio/opus":

				// use player
				return fn(null, {
					type: "link.audio",
					mime: mime_type,
					url: u,
				});

			break;
			case "video/mp4":
			case "video/mpeg":
			case "video/ogg":
			case "video/webm":
				// use player
				
				vidsize(u, { timeout: 5000 }).then(function(data){

					const video = data.streams.find(function(stream){
						return stream.codec_type === "video";
					});
		
					if (!video) return fn(new Error("No video"), { type: "link", url: u });
					if (typeof video.width !== "number" || typeof video.height !== "number") return fn(new Error("No video dimensions", {
						type: "link.video",
						mime: mime_type,
						url: u,
					}));
		
					fn(null, {
						type: "link.video",
						mime: mime_type,
						url: u,
						width: video.width,
						height: video.height
					});

				}).catch(function(err){
					return fn(err);
				});
				
			break;
			default:
				// something we don't understand
				return fn(null); // default link
			break;
		}
		
	});
	
	return this;
}

link.prototype.get = function(u, opts, fn){
	const self = this;

	if (typeof opts === 'function') {
		var fn = opts;
		var opts = {};
	};

	q.push(function(done){
		needle.get(u, { ...needle_opts, ...opts }, function(err, resp, body){
			done();
			if (Math.floor(resp.statusCode/100) !== 2) return fn(new Error("HTTP Status Code "+resp.statusCode), null);
			if (!resp.headers.hasOwnProperty("content-type")) return fn(new Error("No Content-Type"), null);
			fn(null, resp, body);
		});
	});
	
	return this;
};

// create local copy of a file with a deterministic name
link.prototype.mirror = function(u, fn){
	const self = this;

	self.fetch(u, function(err, data){
		if (err) return fn(err);
		
		const ext = mime.hasOwnProperty(data.mime_type) ? mime[data.mime_type] : ((path.basename(path.extname(new URL(u).pathname))||".").substr(1)||"");
		if (!ext) return fn(new Error("Unknown file type"));

		const up = new URL(u);

		const id = [ "~", hashid(up.origin), hashid(up.pathname) ];
		if (!!up.search) id.push(hashid(up.search));
		
		const filename = [id.join(""),ext].join(".");
		const dest = path.join(path.resolve(config.get('datadir')), config.get('assetstore'), filename);
		const desturl = url.resolve(config.get('url'), path.join(config.get('assetstore'), filename));

		// check if file exists
		fs.access(dest, fs.constants.F_OK, function(e){
			if (!e) return fn(null, desturl);

			// download
			needle.get(u, needle_opts).pipe(fs.createWriteStream(dest).on('finish', function() {
				fn(null, desturl);
			}).on('error', function(err){
				return fn(err);
			}));
			
		});
		
	});

	return self;
};

link.prototype.metascraper = function(u, fn){
	const self = this;
		
	self.get(u, function(err, resp, html){
		if (err) return fn(err)
		const mime_type = resp.headers["content-type"].split(';').shift().toLowerCase().trim();
		if (!["text/html","application/xhtml+xml"].includes(mime_type)) return fn(new Error("Wrong Content-Type"));

		metascraper([
			require('metascraper-title')(),
			require('metascraper-description')(),
		])({ html, u }).then(function(data){
			
			return fn(null, { 
				type: "link.web", 
				url: u,
				title: data.title,
				image: data.image,
				description: data.description,
			});
			
		}).catch(function(err){
			return fn(err);
		});
	
	});
	
	return self;
};

link.prototype.twitter = function(u, fn){
	const self = this;

	if (/^https:\/\/twitter\.com\/([a-zA-Z0-9\_]+)\/status\/([0-9]+)(\/.*)?$/.test(u)) { // embed whole tweet instead of specific media FIXME

		self.get("https://cdn.syndication.twimg.com/tweet?id="+(RegExp.$2), function(err, resp, data){ // hopefully this api stays usable
			if (err || Math.floor(resp.statusCode/100) !== 2) return fn(err || new Error("HTTP Status "+resp.statusCode), null);
			try {
				tweet = JSON.parse(data);
			} catch (err) {
				return fn(err, null);
			}
			
			if (tweet.display_text_range && tweet.display_text_range.length === 2) {
				tweet.text = tweet.text.substr(tweet.display_text_range[0], tweet.display_text_range[1]);
			}
			
			// tweethtml links the display name instead of the screen name. m(
			if (tweet.entities && tweet.entities.user_mentions) tweet.entities.user_mentions = tweet.entities.user_mentions.map(function(mention){
				mention.name = mention.screen_name;
				return mention;
			});

			const result = {
				type: "link.tweet",
				url: u,
				username: tweet.user.screen_name,
				userimg: tweet.user.profile_image_url_https,
				// too lazy to write my own tweet assembler, do later; remove those ugly t.co links FIXME
				content: tweethtml(tweet, tweet.user.screen_name).replace(/\r?\n/g,'<br>').replace(/^.*<div class="text">(.*)<\/div>$/,'$1'),
				embeds: [ ...(tweet.photos||[]).map(function(p){
					return {
						type: "image",
						src: p.url,
						width: p.width,
						height: p.height
					}
				}), ...((tweet.video)?[tweet.video]:[]).map(function(v){

					// find best
					const video = v.variants.filter(function(vr){
						return ["video/mp4","video/mpeg","video/ogg","video/webm"].includes(vr.type);
					}).map(function(vr){
						if (/vid\/([0-9]+)x([0-9]+)\//.test(vr.src)) {
							vr.width = parseInt(RegExp.$1,10);
							vr.height = parseInt(RegExp.$2,10);
						} else {
							vr.width = v.aspectRatio[0];
							vr.height = v.aspectRatio[1];
						}
						return vr;
					}).sort(function(a,b){
						return a.width - b.width;
					}).pop();
					
					if (!video) return null;

					return {
						type: "video",
						src: video.src,
						mime: video.type,
						width: video.width,
						height: video.height,
					};
					
				}).filter(function(v){ return !!v; })],
			};

			if (!result.userimg && result.embeds.length === 0) fn(null, result);
			
			const tq = quu(5,true);
			
			if (result.userimg) tq.push(function(done){
				self.mirror(result.userimg, function(err, userimg){
					if (!err) result.userimg = userimg;
					done();
				});
			});
			
			result.embeds.forEach(function(emb,i){
				tq.push(function(done){
					self.mirror(emb.src, function(err,src){
						if (!err) {
							result.embeds[i].src_orig = result.embeds[i].src;
							result.embeds[i].src = src;
						}
						done();
					});
					
				});
			});
			
			tq.run(function(){
				return fn(null, result);
			});
			
		});
		
	} else {
		// it's some other link to twitter.com, i don't care
		return fn(null, null);
	}
	
	return this;
};

link.prototype.youtube = function(u, fn){
	const self = this;
	
	self.get("https://www.youtube.com/oembed?format=json&url="+encodeURIComponent(u), function(err, resp, data){
		if (err || Math.floor(resp.statusCode/100) !== 2) return fn(err || new Error("HTTP Status "+resp.statusCode), null);
		try {
			data = JSON.parse(data);
		} catch (err) {
			return fn(err, null);
		}
		
		fn(null, {
			type: "link.embed",
			url: u,
			src: data.html.replace(/^.*<iframe [^>]*src="([^"]+)"[^>]*><\/iframe>.*$/,'$1').replace(/youtube\.com/,'youtube-nocookie.com'),
			width: data.width,
			title: data.title,
			height: data.height,
		});
		
	});
	
	return this;
};

link.prototype.vimeo = function(u, fn){
	const self = this;
	
	self.get("https://vimeo.com/api/oembed.json?url="+encodeURIComponent(u), function(err, resp, data){
		if (err || Math.floor(resp.statusCode/100) !== 2) return fn(err || new Error("HTTP Status "+resp.statusCode), null);
		try {
			data = JSON.parse(data);
		} catch (err) {
			return fn(err, null);
		}
		
		fn(null, {
			type: "link.embed",
			url: u,
			src: data.html.replace(/^.*<iframe [^>]*src="([^"]+)"[^>]*><\/iframe>.*$/,'$1'),
			title: data.title,
			width: data.width,
			height: data.height,
		});
		
	});
	
	return this;
};

link.prototype.soundcloud = function(u, fn){
	const self = this;

	// super simple iframe
	fn(null, {
		type: "link.embed",
		url: u,
		src: "https://w.soundcloud.com/player/?auto_play=false&visual=true&url="+encodeURIComponent(u),
		width: null,
		height: 165, // good value at the time of filming
	});

	return this;
};

link.prototype.spotify = function(u, fn){
	const self = this;
	
	self.get("https://open.spotify.com/oembed?url="+encodeURIComponent(u), function(err, resp, data){
		if (err || Math.floor(resp.statusCode/100) !== 2) return fn(err || new Error("HTTP Status "+resp.statusCode), null);
		try {
			data = JSON.parse(data);
		} catch (err) {
			return fn(err, null);
		}
		
		fn(null, {
			type: "link.embed",
			url: u,
			src: data.html.replace(/^.*<iframe [^>]*src="([^"]+)"[^>]*><\/iframe>.*$/,'$1'),
			title: data.title,
			width: data.width,
			height: data.height,
		});
		
	});
	
	
	return this;
};

link.prototype.instagram = function(u, fn){
	const self = this;
		
	// instagram wants an access token for oembed and does not yield any opengraph tags
	return fn(new Error("Fuck Instagram"));
	
	return self;
};

module.exports = link;
