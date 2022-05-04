// run setup.js if config is empty

const conf = require("conf");
const color = require("kleur");
const exec = require("child_process").exec;
const pkg = require("../package.json");

const start = function(){
	const config = new conf();
	if (!config.has('configured')) return exec(pkg.scripts.setup, function(err){
		if (err) return console.error(color.red("Setup failed.")), process.exit(1);
		start();
	});
	const pm = (config.get('pm') || "node");
	console.log(color.magenta("> Starting server with `%s`"), color.white(pm));
	exec(pkg.scripts["start-"+pm], function(err){ err && console.error(err); });
};

start();
