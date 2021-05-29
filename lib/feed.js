#!/Usr/bin/env node

const needle = require("needle");

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

// get json feed
const check = module.exports.check = function(u, fn){
	needle.get(u, needle_opts, function(err, resp, data){
		if (err) return fn(err);
		if (Math.floor(resp.statusCode/100) !== 2) return fn(new Error("HTTP Status Code "+resp.statusCode), null);
		if (!resp.headers.hasOwnProperty("content-type")) return fn(new Error("No Content-Type"), null);
		if (!/^application\/(feed\+)?json($|;)/i.test(resp.headers["content-type"])) return fn(new Error("Invalid Content-Type"), null);
		
		// parse json
		try {
			data = JSON.parse(data);
		} catch (err) {
			return fn(new Error("Inable to parse feed"));
		}
		
		// check feed
		if (!data.hasOwnProperty("version") || data.version !== "https://jsonfeed.org/version/1.1") return fn(new Error("Not a valid JSON Feed"));
		if (!data.hasOwnProperty("feed_url") || data.feed_url !== u) return fn(new Error("Feed is not pointing to the Feed URL"));
		if (!data.hasOwnProperty("expired") && data.expired === true) return fn(new Error("Feed is expired"));
		
		// check mandatory properties
		if (!data.hasOwnProperty("title") || !data.title) return fn(new Error("Feed is missing a title."));
		if (!data.hasOwnProperty("home_page_url") || !data.home_page_url) return fn(new Error("Feed is missing a homepage URL."));
		if (!data.hasOwnProperty("authors") || !(data.authors instanceof Array) || data.authors.length === 0 || !data.authors[0].name) return fn(new Error("Feed is missing an author"));

		// return
		fn(null, {
			title: data.title,
			description: (data.description || null),
			home_page_url: data.home_page_url,
			feed_url: data.feed_url,
			author: data.authors[0].name,
			favicon: (data.favicon || null),
			icon: (data.icon || null),
		});

	});
};