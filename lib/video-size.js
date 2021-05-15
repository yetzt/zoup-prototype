// a really small wrapper afround ffpath

const ffprobe = require('ffprobe');
const bin = require('ffprobe-static').path;

module.exports = function(file, fn){
	ffprobe(file, { path: bin }, function(err, data){
		if (err) return fn(err);
		
		const video = data.streams.find(function(stream){
			return stream.codec_type === "video";
		});
		
		if (!video) return fn(new Error("No video"));
		if (typeof video.width !== "number" || typeof video.height !== "number") return fn(new Error("No video dimensions"));
		
		fn(null, {
			width: video.width,
			height: video.height
		});
	});
};
