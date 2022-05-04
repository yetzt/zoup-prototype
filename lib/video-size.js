// a really small wrapper around ffprobe-wasm
const ffprobe = import("ffprobe-wasm");
module.exports = function(f, fn){
	ffprobe.then(async function(probe){
		const worker = new probe.FFprobeWorker();
		const video = await worker.getFileInfo(f);
		worker.terminate();
		fn(null, {
			width: video.streams.reduce(function(w,s){ return Math.max(w,(s.width||0),(s.codec_width||0)); },0),
			height: video.streams.reduce(function(h,s){ return Math.max(h,(s.height||0),(s.codec_height||0)); },0), 
		});
	});
};

module.exports("/Applications/DJI Fly.app/Wrapper/DJI Fly.app/start_video.mp4", console.log);