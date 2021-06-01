
const fs = require("fs");
const npm = require("npm");
const path  =require("path");
const exec = require("child_process").exec;
const debug = require("debug")("zoup:autoupdate");
const config = require("./config");

if (!config.has("autopupdate")) config.set("autopupdate", true);

const root = path.resolve(__dirname,'..');

const autoupdate = module.exports = function(fn){
	if (typeof fn !== "function") fn = function(err){ if (err) debug(err); };
	if (config.get("autopupdate") !== true) return;

	// check if git repo 
	fs.stat(path.resolve(root, '.git'), function(err, stats){
		if (err) return fn(err);
		if (!stats.isDirectory()) return fn(new Error("Not a repository"));

		// get branch name
		exec('git branch', { cwd: root }, function(err, stdout){
			if (err) return fn(err);
			const branch = stdout.trim().replace(/^\*\s+/,'');
			debug("Branch: %s", branch);

			// fetcgh 
			exec('git fetch origin', { cwd: root }, function(err, stdout){
				if (err) return fn(err);

				// get local commit id
				exec('git rev-parse HEAD', { cwd: root }, function(err, stdout){
					if (err) return fn(err);
					const commit_local = stdout.trim();

					// get remote commit id
					exec('git rev-parse origin/'+branch, { cwd: root }, function(err, stdout){
						if (err) return fn(err);
						const commit_remote = stdout.trim();
						if (commit_remote === commit_local) {
							debug("Up to date: local and remote branch are on commit %s", commit_local);
							return fn(null);
						}

						// get latest common commit id
						exec('git merge-base HEAD origin/'+branch, { cwd: root }, function(err, stdout){
							if (err) return fn(err);
							const commit_common = stdout.trim();
							if (commit_common !== commit_local) {
								debug("Up to date: Local branch looks to be ahead %s", commit_local);
								return fn(null);
							}

							// pull from remote
							debug("Update: Pulling from origin/%s", branch);
							const pull = exec('git pull origin '+branch, { cwd: root, env: { "LC_ALL": "C" } }, function(err, stdout){
								if (err) return fn(err);
								debug("Autoupdated to commit %s", commit_remote);
								// check if successful
								if (pull.exitCode === 0 && !/up to date/i.test(stdout.trim())) {
									
									// npm install
									npm.load(function(){
										debug("Running `npm install`");
										npm.commands.install([],function(err){ 
											if (err) return fn(err);
											if (config.get("pm") !== null) {
												debug("Exiting");
												process.exit(0);
											} else {
												debug("Restart me!");
											}
										});
									});
								} 
							});
						});
					});
				});
			});
		});
	});
};

// check regularly, every 30 minutes is probably fine
setInterval(autoupdate,1800000).unref();
