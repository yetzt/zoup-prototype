// does what it says on the tin.
module.exports = function(v){
	if (typeof v !== 'string') return false;
	if (v.includes(' ')) return false;
	try {
		const u = new URL(v);
		return (["http:","https:"].includes(u.protocol));
	} catch {
		return false;
	};
};
