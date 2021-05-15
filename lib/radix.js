
const r = module.exports = function(v,rdx){
	const radix = rdx||"_abcdefghijklmnopqrstuvwxyz-0123456789";
	let result;
	switch (typeof v) {
		case "number": // endcode
			result = [];
			do {
				result.unshift(radix[(v%radix.length)]);
				v = Math.floor(v/radix.length);
			} while (v > 0);
			return result.join("");
		break;
		case "string": // decode
			result = 0;
			for (let i = 0; i < v.length; i++) result = (result * radix.length) + radix.indexOf(v[i]);
			return result;
		break;
		default: 
			return null;
		break;
	};
}
