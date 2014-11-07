/*
__/\\\\____________/\\\\________/\\\\\\\\\_______/\\\\\_______/\\\\\\\\\\\\\____/\\\________/\\\_        
 _\/\\\\\\________/\\\\\\_____/\\\////////______/\\\///\\\____\/\\\/////////\\\_\///\\\____/\\\/__       
  _\/\\\//\\\____/\\\//\\\___/\\\/_____________/\\\/__\///\\\__\/\\\_______\/\\\___\///\\\/\\\/____      
   _\/\\\\///\\\/\\\/_\/\\\__/\\\______________/\\\______\//\\\_\/\\\\\\\\\\\\\/______\///\\\/______     
	_\/\\\__\///\\\/___\/\\\_\/\\\_____________\/\\\_______\/\\\_\/\\\/////////__________\/\\\_______    
	 _\/\\\____\///_____\/\\\_\//\\\____________\//\\\______/\\\__\/\\\___________________\/\\\_______   
	  _\/\\\_____________\/\\\__\///\\\___________\///\\\__/\\\____\/\\\___________________\/\\\_______  
	   _\/\\\_____________\/\\\____\////\\\\\\\\\____\///\\\\\/_____\/\\\___________________\/\\\_______ 
		_\///______________\///________\/////////_______\/////_______\///________by MDM______\///________
*/

var fs = require('fs'),
	exec = require('child_process').exec,
	tmpl = require('handlebars'),
	moment = require('moment');
	//serial = require('serialport');
	//moment
	//nw
	//


/******
	mcopy for JK edition
*******/
var mcopy = {};

/******
	Configuration Object
*******/
mcopy.cfgFile = 'cfg.json';
mcopy.cfg = JSON.parse(fs.readFileSync(mcopy.cfgFile, 'utf8'));

mcopy.tests = function (callback) {
	var cmd = 'ino -h';
	exec(cmd, function (e, std) {
		if (e) { return console.log("There's a problem with your ino install"); }
		if (callback) { callback (); }
	});
};

/******
	Command handler
*******/
mcopy.command = function () {
	var cmd = process.argv[2];
	if (cmd !== undefined) {
		//console.log(cmd);
		if (cmd === 'firmware') {
			mcopy.arduino.build();
			//process.exit();
		} else if (cmd === 'run') {
			mcopy.run();
		} else if (cmd === 'mobile') {
			mcopy.mobile();
		} else {
			console.log('Command ' + cmd + ' not found');
		}
	} else {
		console.log('No command provided');
	}
};

/******
	Initialize App
*******/
mcopy.init = function () {
	
	mcopy.tests(mcopy.command); //checks for user commands, otherwise launches main app
};
mcopy.run = function () {
	var cmd = '(cd ..; nodewebkit mcopy_jk)';
	exec(cmd, function () {});
};

/******
	Arduino Object
*******/
mcopy.arduino = {};
mcopy.arduino.build = function () {
	var compile = true;
	if (process.argv.indexOf('-n') !== -1 ||
		process.argv.indexOf('--no') !== -1) {
		compile = false;
	}
	console.log('Building arduino firmware code...');
	console.time('Firmware build');
	var tmplFile = 'tmpl/mcopy_jk.ino.tmpl',
		a = mcopy.cfg.arduino,
		template = tmpl.compile(fs.readFileSync(tmplFile, 'utf8')),
		file = template(a),
		t = +new Date(),
		path = tmplFile.replace('.tmpl', '').replace('_jk', '_jk_' + t).replace('tmpl/','ino/');
	exec('mv ino/* ino_old/', function () {
		fs.writeFileSync(path, file, 'utf8');
		fs.writeFileSync('deploy/src/sketch.ino', '//' + path + '\n' + file, 'utf8');
		console.log('Firmware template rendered!');
		if (compile) {
			mcopy.arduino.compile(path);
		} else {
			console.log('Skipping firmware compilation...');
			console.timeEnd('Firmware build');
			console.log('Built new firmware ' + outFile.split('/').pop() + '!');

		}
	});
};
mcopy.arduino.compile = function (path) {
	console.log('Compiling firmware...');
	exec('(cd deploy; ino build -m ' + mcopy.cfg.arduino.board + ' -v)', function (e, std) {
		if (e) { 
			console.log('Error compiling :(');
			return console.log(e);
		}
		console.log(std);
		console.log('Firmware compiled successfully!')
		mcopy.arduino.upload(path);
	});
};
mcopy.arduino.upload = function (path) {
	console.log('Uploading to arduino...');
	exec('(cd deploy; ino upload -m ' + mcopy.cfg.arduino.board + ')', function (e, std) {
		if (e) { 
			console.log('Error uploading :(');
			return console.log(e);
		}
		console.log(std);
		console.timeEnd('Firmware build');
		console.log('Built and uploaded new firmware ' + path.split('/').pop() + '!');
	});
};

mcopy.init();