// run setup.js if config is empty

const npm = require("npm");
const conf = require("conf");
const color = require("kleur");

npm.load(function(){
	const start = function(){
		const config = new conf();
		if (!config.has('configured')) return npm.commands.run('setup', function(err){
			if (err) return console.error(color.red("Setup failed.")), process.exit(1);
			start();
		});
		const pm = (config.get('pm') || "node");
		console.log(color.magenta("> Starting server with `%s`"), color.white(pm));
		npm.commands.run(["start-"+pm], function(err){ err && console.error(err); });
	};
	start();
});
