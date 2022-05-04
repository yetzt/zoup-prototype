// get a few chunks from url and then try ffprobe-wasm
const ffprobe = import("ffprobe-wasm");
const needle = require("needle");
const fs = require("fs");
const os = require("os");
const path = require("path");

module.exports = function(u, fn){
	let chunks = [];
	needle.get(u).on('data', function(chunk){
		chunks.push(chunk);
		if (chunks.length > 5) this.destroy();
	}).on('close', function(){
		const tmpfile = path.resolve(os.tmpdir(),'zoup'+Math.round(Math.random()*1e7).toString(36));
		fs.writeFile(tmpfile, Buffer.concat(chunks), function(err){
			if (err) return fn(err);
			ffprobe.then(async function(probe){
				const worker = new probe.FFprobeWorker();
				let video = null;
				let err = null;
				try {
					video = await worker.getFileInfo(tmpfile);
				} catch (e) {
					err = e;
				}
				worker.terminate();
				fs.unlink(tmpfile, function(){
					fn(err, (err) ? null : {
						width: video.streams.reduce(function(w,s){ return Math.max(w,(s.width||0),(s.codec_width||0)); },0),
						height: video.streams.reduce(function(h,s){ return Math.max(h,(s.height||0),(s.codec_height||0)); },0), 
					});
				});
			});
			
		});
	});

};
