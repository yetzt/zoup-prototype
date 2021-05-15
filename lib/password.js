const crypto = require("crypto");

const chars = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// generate a random string of a specified length containing specified characters
module.exports = function(l,c){
	l=l||16,c=c||chars;// sensible defaults
	return Array.from(crypto.randomBytes(l)).map(function(v,i){
		return c[v%c.length];
	}).join("");
};