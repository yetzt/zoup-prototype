const fs = require("fs");
const url = require("url");
const path = require("path");
const debug = require("debug")("zoup:render");

const marked = require("marked");
const sanitize = require("./sanitize");
const mustache = require("./mustache")();

marked.setOptions({
	renderer: new marked.Renderer(),
	headerIds: false,
	sanitizer: sanitize,
});

const render = module.exports = function(content, opts, fn){

	mustache(path.resolve(__dirname, "../assets/templates/_html.mustache"), {
		u: url.parse(opts.url),
		assetstore: opts.assetstore, 
		content: content.map(function(section){
			// prepare for mustache, sanitize everything
			const s = { ...section };
			s["type-"+s.type.replace(/\./g,'-')] = true;
			if (s.type === "link.tweet") s.embeds = s.embeds.map(function(e){ return e["embed-type-"+e.type]=true,e; });
			if (s.caption) s.caption = sanitize(s.caption);
			if (s.text) s.text = self.txt(s.text);
			if (s.html) s.html = sanitize(s.html);
			if (s.markdown) s.markdown = marked(s.markdown);
			return s;
		})
	}, function(err, html){
		if (err) return fn(err);
		html = html.trim().replace(/>\s+</g,'><').replace(/<\/a><a/,'</a> <a'); // FIXME more reliable
		return fn(null, html);
	});
};

// simple text-to-html
render.prototype.txt = function(t, fn){
	return sanitize(t.replace(/\r\n/g,'\n').split(/\n\n+/).map(function(p){
		return '<p>'+p.split(/\n/g).map(function(l){
			// FIXME: clickable links
			return l;
		}).join('<br>')+'</p>';
	}).join("\n"));
};
