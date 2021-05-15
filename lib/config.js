// run setup.js if config is empty

const path = require("path");
const conf = require("conf");

module.exports = (function(){
	const conf_try = new conf();
	if (conf_try.has('configured')) return conf_try;

	require("child_process").execFileSync(process.execPath, [path.resolve(__dirname, "../bin/setup.js")], {
		cwd: process.cwd(),
		stdio: 'inherit',
		windowsHide: true,
	});

	const conf_tryagain = new conf();
	if (conf_tryagain.has('configured')) return conf_tryagain;
	
	console.error("Not configured. Please run Setup.");
	process.exit(1);
	
})();
