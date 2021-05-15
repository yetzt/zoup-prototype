const crypto = require("crypto");
const radix = require("./radix.js");

const randid = module.exports = function(){
	// random bytes into integer, modulo max value for 9 chars, create radix(38), pad to 9 chars
	return radix((crypto.randomBytes(6).readUIntLE(0,6)%(Math.pow(38,9)-1))).padStart(9,'_');
};
