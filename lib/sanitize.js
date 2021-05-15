const sanitize = require("sanitize-html");

const config = {
	"allowedTags": [
		"a", "abbr", "b", "bdi", "bdo", "blockquote", "br", "caption", "cite", "code", "col", "colgroup", "data", 
		"dd", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", 
		"i", "img", "kbd", "li", "mark", "ol", "p", "pre", "q", "rb", "rp", "rt", "rtc", "ruby", "s", "samp", "small", 
		"span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", 
		"var", "wbr", "audio", "video", "source"
	],
	"disallowedTagsMode": "discard",
	"allowedAttributes": {
		"abbr": [ "title" ],
		"blockquote": [ "cite" ],
		"q": [ "cite" ],
		"code": [ "class" ], // needned for code highlight, shouldnt hurt
		"span": [ "class" ], // needned for code highlight, shouldnt hurt
		"dfn": [ "title" ],
		"time": [ "datetime" ],
		"a": [ "href", "name", "data-width", "data-height", "data-src" ],
		"img": [ "src", "alt", "title", "width", "height" ],
		"audio": [ "controls", "width", "height" ],
		"video": [ "controls", "width", "height" ],
		"source": [ "src", "type" ],
	},
	/* wish this would allow regexes
	"allowedClasses": {
		"code": [ /^language-/ ],
	},*/
	"selfClosing": [ "img", "br", "hr", "wbr" ],
	"allowedSchemesByTag": {
		"img": ["https", "data"],
		"blockquote": ["http", "https"],
		"q": ["http", "https"],
		"a": ["http", "https", "ftp", "ftps", "mailto", "tel", "magnet"],
	},
	"allowedSchemesAppliedToAttributes": [ "href", "src", "cite" ],
};

module.exports = function(content){
	return sanitize(content, config).replace(/<([a-z]+)><\/\1>/g,'');
};
