/*
__/\\\\____________/\\\\________/\\\\\\\\\_______/\\\\\_______/\\\\\\\\\\\\\____/\\\________/\\\_
 _\/\\\\\\________/\\\\\\_____/\\\////////______/\\\///\\\____\/\\\/////////\\\_\///\\\____/\\\/__
  _\/\\\//\\\____/\\\//\\\___/\\\/_____________/\\\/__\///\\\__\/\\\_______\/\\\___\///\\\/\\\/____
   _\/\\\\///\\\/\\\/_\/\\\__/\\\______________/\\\______\//\\\_\/\\\\\\\\\\\\\/______\///\\\/______
	_\/\\\__\///\\\/___\/\\\_\/\\\_____________\/\\\_______\/\\\_\/\\\/////////__________\/\\\_______
	 _\/\\\____\///_____\/\\\_\//\\\____________\//\\\______/\\\__\/\\\___________________\/\\\_______
	  _\/\\\_____________\/\\\__\///\\\___________\///\\\__/\\\____\/\\\___________________\/\\\_______
	   _\/\\\_____________\/\\\____\////\\\\\\\\\____\///\\\\\/_____\/\\\___________________\/\\\_______
		_\///______________\///________\/////////_______\/////_______\///___by m mcwilliams__\///________
*/

var fs = require('fs'),
	gui = require('nw.gui'),
	win = gui.Window.get(),
	os = require('os'),
	exec = require('child_process').exec,
	humanizeDuration = require("humanize-duration"),
	moment = require('moment'),
	uuid = require('node-uuid'),
	sp,
	SerialPort,
	express = {},
	app = {},
	mcopy = {};

mcopy.cfg = {};
mcopy.cfgFile = './data/cfg.json';
mcopy.cfgInit = function () {
	if (!fs.existsSync(mcopy.cfgFile)) {
		mcopy.log('Using default configuration...');
		fs.writeFileSync(mcopy.cfgFile, fs.readFileSync('./data/cfg.json.default'));
	}
	mcopy.cfg = JSON.parse(fs.readFileSync(mcopy.cfgFile, 'utf8'));
};
mcopy.cfgStore = function () {
	var data = JSON.stringify(mcopy.cfg);
	fs.writeFileSync(mcopy.cfgFile, data, 'utf8');
};

mcopy.editor = {};

mcopy.exec = function (cmd, callback, error) {
	var mb = {
		maxBuffer: 100 * 1024
	};
	exec(cmd, mb, function (err, std) {
		if (err) {
			if (error) { error(err); }
			return mcopy.log(err, 0);
		}
		if (callback) { callback(std); }
	});
};
mcopy.arg = function (shrt, lng) {
	if (gui.App.argv.indexOf(shrt) !== -1 ||
		gui.App.argv.indexOf(lng) !== -1) {
		return true;
	}
	return false;
};
mcopy.fmtZero = function (val, len) {
	var raw = val,
		str = val + '',
		output = ''
	if (raw < 0) {
		output = '-' + Array(len - (str.length - 1)).join('0') + str.replace('-', '');
	} else {
		if (str.length < len) {
			output = Array(len - str.length).join('0') + str;
		} else if (str.length >= len) {
			str = parseInt(str) + '';
			output = Array(len - str.length).join('0') + str;
		}
	}
	return output;
};
mcopy.notify = function (title, message) {
	//osascript -e 'display notification "Lorem ipsum dolor sit amet" with title "Title"'
	//Todo: fix icon (maybe write script to file, change icon, evaluate applescript)
	title = title.replace(new RegExp("'", 'g'), '');
	message = message.replace(new RegExp("'", 'g'), '');
	var str = 'display notification "' + message + '" with title "' + title + '"',
		cmd = "osascript -e '" + str + "';";
	mcopy.exec(cmd);
};
mcopy.log = function (txt, status) {
	$('#source').text('> ' + txt).attr('class', '');
	console.log(txt);
	if (status === 0) {
		$('#source').addClass('error');
	} else if (status === 1) {
		$('#source').addClass('success');
	}
};
mcopy.local = function (key, value) {
    var has = function () {
        try {
            return 'localStorage' in window && window['localStorage'] !== null;
        } catch (e) {
            return false;
        }
    };
    if (value === undefined) {
        if (has()) {
            var val = window['localStorage'][key];
            if (val !== undefined) {
                val = JSON.parse(val);
            }
            return val;
        } else {
            return undefined;
        }
    } else {
        if (has()) {
            window['localStorage'][key] = JSON.stringify(value);
            return true;
        } else {
            return false;
        }
    }
};

/******
	Initialize mcopy
*******/
mcopy.init = function () {
	mcopy.log('Starting mcopy...');
	mcopy.cfgInit();
	mcopy.bindings();
	mcopy.tests(function () {
		process.on('uncaughtException', function (err, a, b) {
    		console.dir(err);
    		mcopy.log(a, 0);
		});
		mcopy.gui.menu();
		mcopy.gui.mscript.init();
		mcopy.gui.overlay(true);
		mcopy.gui.spinner(true);
		mcopy.stateinit();
		if (mcopy.arg('-m', '--mobile')) {
	    	//mcopy.mobile.init();
	    	mcopy.mobile.toggle();
	    }
		mcopy.arduino.init(function (success) {
			if (!success) {
				return mcopy.arduino.fakeConnect(mcopy.gui.init);
			}
			mcopy.arduino.connect(mcopy.gui.init);
		});

	});
};
/******
	State shared by ALL interfaces
*******/
mcopy.state = {};
mcopy.stateinit = function () {
	mcopy.log('Initializing state...');
	mcopy.state = {
		version : 'alpha', //use for file compatibility check
		camera : {
			pos : 0,
			direction: true
		},
		projector : {
			pos : 0,
			direction: true
		},
		sequence : {
			size : 24,
			arr : ['CF', 'PF'],
			cmd : {
				camera: mcopy.cfg.arduino.cmd.camera,
				projector: mcopy.cfg.arduino.cmd.projector,
				cam_direction: mcopy.cfg.arduino.cmd.cam_direction,
				cam_direction: mcopy.cfg.arduino.cmd.proj_direction
			},
			pads: {
				cam_forward: 'CF',
				proj_forward : 'PF',
				black_forward : 'BF',
				cam_backward: 'CB',
				proj_backward : 'PB',
				black_backward : 'BB'
			}
		},
		mode : 'trad'
	};
	mcopy.state.package = JSON.parse(fs.readFileSync('package.json', 'utf8')); //for verifying the file format
	mcopy.state.cfg = mcopy.cfg; //for verifying the file format
	mcopy.state.program_start = +new Date();
	mcopy.local('state', mcopy.state);
	//
};
mcopy.tests = function (callback) {
	var str, release, parts, targetDir, source, cmd;
	if (mcopy.arg('-m', '--mobile')) {
		mcopy.log('Mobile mode enabled');
	}
	//tests if serialport is configured for node-webkit
	try {
		sp = require('serialport');
	} catch (e) {
		if (e.code === 'MODULE_NOT_FOUND') {
			str = e.toString().split("Error: Cannot find module '")[1].split("'")[0].trim();
			parts = str.split('/');
			release = str.split('/Release/')[0] + '/Release/';
			mcopy.exec('ls ' + release, function (list) {
				list = list.split('\n');
				list.pop();
				source = release + list[0] + '/' + parts[parts.length - 1];
				targetDir = parts[parts.length - 2];
				conf = confirm('Duplicating serialport release "' + list[0] + '" as "' + targetDir + '". Proceed?');
				if (conf) {
					mcopy.log('Duplicating serialport...');
					cmd = 'mkdir -p "' + release + targetDir + '"; cp "' + source + '" "' + str + '"';
					mcopy.exec(cmd, function (data) {
						alert('Files copied successfully. App will now shut down. Please relaunch.');
						process.exit();
					});
				} else {
					//process.exit();
				}
			});
		} else {
			console.error(e);
		}
	}
	SerialPort = sp.SerialPort;

	//ino not used in mcopy... yet
	exec('ino -h', function (e1,std1) {
		if (e1) { mcopy.log('Problem with ino, check install', 0); }
		if (callback) { callback(); }
	});
};

/******
	Arduino handlers
*******/
mcopy.arduino = {
	path : '',
	known: [
		'/dev/tty.usbmodem1a161',
		'/dev/tty.usbserial-A800f8dk',
		'/dev/tty.usbserial-A900cebm',
		'/dev/tty.usbmodem1a131',
		'/dev/tty.usbserial-a900f6de',
		'/dev/tty.usbmodem1a141'
	],
	serial : {},
	queue : {},
	timer : 0,
	lock : false
};
mcopy.arduino.init = function (callback) {
	mcopy.log('Searching for devices...');
	var cmd = 'ls /dev/tty.*';
	exec(cmd, function (e, std) {
		var devices = std.split('\n'),
			matches = [];
		devices.pop();
		for (var i = 0; i < devices.length; i++) {
			if (devices[i].indexOf('usbserial') !== -1
				||devices[i].indexOf('usbmodem') !== -1){
				matches.push(devices[i]);
			}
		}
		if (matches.length === 0) {
			mcopy.log('No devices found.');
			mcopy.gui.spinner(false);
			mcopy.gui.overlay(true);
			if (callback) { callback(false); }
		} else if (matches.length > 0) {
			mcopy.log('Found ' + matches[0]);
			mcopy.arduino.path = matches[0];
			//once connected to the arduino
			//start user interface
			if (callback) { callback(true); }
		}
	});
};
//commands which respond to a sent char
mcopy.arduino.send = function (cmd, res) {
	if (!mcopy.arduino.lock) {
		mcopy.arduino.lock = true;
		mcopy.arduino.queue[cmd] = res;
		setTimeout(function () {
			mcopy.arduino.serial.write(cmd, function (err, results) {
				if (err) { mcopy.log(err, 0); }
				mcopy.arduino.lock = false;
				mcopy.arduino.timer = +new Date();
			});
		}, mcopy.cfg.arduino.serialDelay);
	}
};
//with same over serial when done
mcopy.arduino.end = function (data) {
	var end = new Date().getTime(),
		ms = end - mcopy.arduino.timer;
	if (mcopy.arduino.queue[data] !== undefined) {
		mcopy.arduino.lock = false;
		mcopy.log('Command ' + data + ' took ' + ms + 'ms');
		mcopy.arduino.queue[data](ms);

		mcopy.arduino.queue = {};
	} else {
		//console.log('Received stray "' + data + '" from ' + mcopy.arduino.path); //silent to user
	}
};
mcopy.arduino.connect = function (callback) {
	mcopy.log('Connecting to ' + mcopy.arduino.path + '...');
	mcopy.state.arduino = mcopy.arduino.path;
	mcopy.arduino.serial = new SerialPort(mcopy.arduino.path, {
	  baudrate: mcopy.cfg.arduino.baud,
	  parser: sp.parsers.readline("\n")
	});
	mcopy.arduino.serial.open(function (error) {
		if ( error ) {
			return mcopy.log('failed to open: '+ error, 0);
		} else {
			mcopy.log('Opened connection with ' + mcopy.arduino.path);
			mcopy.arduino.serial.on('data', function (data) {
				data = data.replace('\r', '');
				mcopy.arduino.end(data);
			});
			setTimeout(function () {
				mcopy.log('Verifying firmware...');
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.connect, function () {
					mcopy.log('Firmware verified');
					mcopy.log('Optical printer ready!');
					if (callback) { callback(); }
				});
			}, 2000);
		}
	});
};

mcopy.arduino.fakeConnect = function (callback) {
	mcopy.log('Connecting to fake arduino...');
	mcopy.state.arduino = '/dev/null';
	mcopy.arduino.serial = {
		write : function (cmd, res) {
			var t = {
				c : mcopy.cfg.arduino.cam.time + mcopy.cfg.arduino.cam.delay,
				p : mcopy.cfg.arduino.proj.time + mcopy.cfg.arduino.proj.delay
			},
			timeout = t[cmd];
			if (typeof timeout === 'undefined') timeout = 500;
			mcopy.arduino.timer = +new Date();
			setTimeout(function () {
				mcopy.arduino.end(cmd);
			}, timeout);
		}
	};
	if (callback) callback();
};

mcopy.arduino.miniConnect = function () {
	//sudo apt-get install minicom
	//sudo minicom -D /dev/ttyACM0 -b 9600
};

mcopy.arduino.tests = function () {
	//var keys = Object.keys(mcopy.cfg.arduino.cmd);
	//for (var i = 0; i < keys.length; i++) {
		//mcopy.cfg.arduino.cmd[keys[i]]
	//}

	//mcopy.cmd.cam_forward();

	//mcopy.file.save('test.json');
	//mcopy.file.mscript('mscript/test.mscript');
};

/******
	Application-level commands
*******/
mcopy.cmd = {};
mcopy.cmd.cam_forward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos++;
		//gui action
		mcopy.gui.updateState();
		mcopy.log('Camera moved +1 frame to ' + mcopy.state.camera.pos);
		if (callback) { callback(); }
	};
	if (!mcopy.state.camera.direction) {
		mcopy.log('Advancing camera...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.cam_forward, function (ms) {
			mcopy.state.camera.direction = true;
			mcopy.gui.trad.updateDir({value:'cam_forward'});
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
			}, mcopy.cfg.arduino.serialDelay);
		});
	} else {
		setTimeout(function () {
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
		}, mcopy.cfg.arduino.serialDelay);
	}
};
mcopy.cmd.cam_backward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos--;
		//gui action
		mcopy.gui.updateState();
		mcopy.log('Camera moved -1 frame to ' + mcopy.state.camera.pos);
		if (callback) { callback(); }
	};
	if (mcopy.state.camera.direction) {
		mcopy.log('Rewinding camera...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.cam_backward, function (ms) {
			mcopy.state.camera.direction = false;
			mcopy.gui.trad.updateDir({value:'cam_backward'});
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
			}, mcopy.cfg.arduino.serialDelay);
		});
	} else {
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
	}
};
mcopy.cmd.proj_forward = function (callback) {
	var res = function (ms) {
		mcopy.state.projector.pos++;
		mcopy.gui.updateState();
		mcopy.log('Projector moved +1 frame to ' + mcopy.state.projector.pos);
		//gui action
		if (callback) { callback(); }
	};
	if (!mcopy.state.projector.direction) {
		mcopy.log('Advancing projector...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.proj_forward, function (ms) {
			mcopy.state.projector.direction = true;
			mcopy.gui.trad.updateDir({value:'proj_forward'});
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
			}, mcopy.cfg.arduino.serialDelay);
		});
	} else {
		setTimeout(function () {
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
		}, mcopy.cfg.arduino.serialDelay);
	}
};
mcopy.cmd.proj_backward = function (callback) {
	var res = function (ms) {
		mcopy.state.projector.pos--;
		mcopy.gui.updateState();
		//gui action
		mcopy.log('Projector moved -1 frame to ' + mcopy.state.projector.pos);
		if (callback) { callback(); }
	};
	if (mcopy.state.projector.direction) {
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.proj_backward, function (ms) {
			mcopy.state.projector.direction = false;
			mcopy.gui.trad.updateDir({value:'proj_backward'});
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
			}, mcopy.cfg.arduino.serialDelay);
		});
	} else {
		setTimeout(function () {
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
		}, mcopy.cfg.arduino.serialDelay);
	}
};
mcopy.cmd.black_forward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos++;
		mcopy.gui.updateState();
		//gui action
		mcopy.log('Camera moved +1 BLACK frame to ' + mcopy.state.camera.pos);
		if (callback) { callback(); }
	};
	if (!mcopy.state.camera.direction) {
		mcopy.log('Advancing camera...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.cam_forward, function (ms) {
			mcopy.state.camera.direction = true;
			setTimeout(function () {
				//black
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.black, res);
			}, mcopy.cfg.arduino.serialDelay);
		});
	} else {
		setTimeout(function () {
			//black
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.black, res);
		}, mcopy.cfg.arduino.serialDelay);
	}
};
mcopy.cmd.black_backward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos--;
		mcopy.gui.updateState();
		//gui action
		mcopy.log('Camera moved -1 BLACK frame to ' + mcopy.state.camera.pos);
		if (callback) { callback(); }
	};
	if (mcopy.state.camera.direction) {
		mcopy.log('Rewinding camera...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.cam_backward, function (ms) {
			mcopy.state.camera.direction = false;
			setTimeout(function () {
				//black
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.black, res);
			}, mcopy.cfg.arduino.serialDelay);
		});
	} else {
		//black
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.black, res);
	}
};

/******
	Sequence Object
*******/
mcopy.seq = {};
mcopy.seq.i = 0;
mcopy.loop = 1;
mcopy.loopCount = 0;
mcopy.seq_time = 0;
mcopy.seq.run = function () {
	var cmd = mcopy.state.sequence.arr[mcopy.seq.i],
		action = function () {
			setTimeout(function () {
				mcopy.seq.i++;
				mcopy.seq.run();
			}, mcopy.cfg.arduino.sequenceDelay);
		},
		timeEnd = 0;
	if (mcopy.seq.stop()) {
		$('.row input').removeClass('h');
		mcopy.log('Sequence stepped');
		return false;
	}
	if (mcopy.seq.i <= mcopy.state.sequence.arr.length && cmd !== undefined) {
		mcopy.log('Sequence step ' + mcopy.seq.i + ' command ' + cmd + '...');
		//gui action
		$('.row input').removeClass('h');
		$('.row input[x=' + mcopy.seq.i + ']').addClass('h');
		if (cmd === 'CF'){
			mcopy.cmd.cam_forward(action);
		} else if (cmd === 'CB') {
			mcopy.cmd.cam_backward(action);
		} else if (cmd === 'PF') {
			mcopy.cmd.proj_forward(action);
		} else if (cmd === 'PB') {
			mcopy.cmd.proj_backward(action);
		} else if (cmd === 'BF') {
			mcopy.cmd.black_forward(action);
		} else if (cmd === 'BB') {
			mcopy.cmd.black_backward(action);
		}
	} else {
		mcopy.loopCount++;
		if (mcopy.loopCount < mcopy.loop) {
			mcopy.log('Loop ' + mcopy.loopCount + ' completed!');
			$('.row input').removeClass('h');
			mcopy.seq.i = 0;
			mcopy.seq.run();
		} else {
			mcopy.log('Sequence completed!');
			timeEnd = +new Date();
			timeEnd = timeEnd - mcopy.seq_time;
			setTimeout(function () {
				if (timeEnd < 2000) {
					mcopy.log('Sequence took ' + timeEnd + 'ms');
				} else {
					mcopy.log('Sequence took ' + humanizeDuration(timeEnd));
				}
			}, 500);
			//clear gui
			$('.row input').removeClass('h');
			mcopy.seq.stats();
		}
	}
};
mcopy.seq.stopState = false;
mcopy.seq.stop = function (state) {
	if (typeof state === 'undefined') {
		return mcopy.seq.stopState;
	} else {
		mcopy.seq.stopState = state;
	}
};
mcopy.seq.init = function (start) {
	if (typeof start === 'undefined') {
		start = 0;
		mcopy.loopCount = 0;
		mcopy.seq_time = +new Date();
	}
	mcopy.seq.stop(false);
	mcopy.seq.i = start;
	mcopy.seq.run();
};
mcopy.seq.stats = function () {
	var ms = 0,
		cmd = '',
		cam_total = 0,
		proj_total = 0,
		real_total = mcopy.state.sequence.arr.filter(function (elem) {
			if (elem === undefined) {
				return false;
			}
			return true;
		});

	//timing
	for (var i = 0; i < mcopy.state.sequence.arr.length; i++) {
		cmd = mcopy.state.sequence.arr[i];
		if (cmd === 'CF' || cmd === 'CB'){
			ms += mcopy.cfg.arduino.cam.time;
			ms += mcopy.cfg.arduino.cam.delay;
			ms += mcopy.cfg.arduino.serialDelay;
		}
		if (cmd === 'PF' || cmd === 'PB'){
			ms += mcopy.cfg.arduino.proj.time;
			ms += mcopy.cfg.arduino.proj.delay;
			ms += mcopy.cfg.arduino.serialDelay;
		}
		if (cmd === 'BF' || cmd === 'BB'){
			ms += mcopy.cfg.arduino.black.before;
			ms += mcopy.cfg.arduino.black.after;
			ms += mcopy.cfg.arduino.cam.time;
			ms += mcopy.cfg.arduino.cam.delay;
			ms += mcopy.cfg.arduino.serialDelay;
		}
		ms += mcopy.cfg.arduino.sequenceDelay;

		if (cmd === 'CF' || cmd === 'BF') {
			cam_total++;
		}
		if (cmd === 'CB' || cmd === 'BB') {
			cam_total--;
		}
		if (cmd === 'PF') {
			proj_total++;
		}
		if (cmd === 'PB') {
			proj_total--;
		}
	}

	//timing
	ms = ms * mcopy.loop;
	if (ms < 2000) {
		$('#seq_stats .timing span').text(ms + 'ms');
	} else {
		$('#seq_stats .timing span').text(humanizeDuration(ms));
	}

	//ending frames
	cam_total = cam_total * mcopy.loop;
	proj_total = proj_total * mcopy.loop;

	$('#seq_stats .cam_end span').text(mcopy.fmtZero(mcopy.state.camera.pos + cam_total, 6));
	$('#seq_stats .proj_end span').text(mcopy.fmtZero(mcopy.state.projector.pos + proj_total, 6));

	//count
	$('#seq_stats .seq_count span').text(real_total.length * mcopy.loop);
	return ms;
};
mcopy.seq.clear = function () {
	mcopy.state.sequence.size = 24;
	mcopy.state.sequence.arr = [];
};

/******
	GUI Object
*******/
mcopy.gui = {};
mcopy.gui.spinner = function (state) {
	var cfg = {
		lines: 11, // The number of lines to draw
		length: 15, // The length of each line
		width: 7, // The line thickness
		radius: 20, // The radius of the inner circle
		corners: 1, // Corner roundness (0..1)
		rotate: 0, // The rotation offset
		direction: 1, // 1: clockwise, -1: counterclockwise
		color: '#F2F2F1', // #rgb or #rrggbb or array of colors
		speed: 1, // Rounds per second
		trail: 60, // Afterglow percentage
		shadow: true, // Whether to render a shadow
		hwaccel: true, // Whether to use hardware acceleration
		className: 'spinner', // The CSS class to assign to the spinner
		zIndex: 2e9, // The z-index (defaults to 2000000000)
		top: '50%', // Top position relative to parent
		left: '50%' // Left position relative to parent
	},
	target,
	spinner;
	if (state) {
		target = document.getElementById('spinner');
		spinner = new Spinner(cfg).spin(target);
	} else {
		$('#spinner').hide();
	}
};
mcopy.gui.init = function () {
	//
	mcopy.gui.overlay(false);
	mcopy.gui.spinner(false);
	mcopy.gui.events();

	//win.maximize();
	mcopy.gui.grid.layout();
	//setTimeout(mcopy.arduino.tests, 2000);
};
mcopy.gui.updateState = function () {
	var cpos = mcopy.state.camera.pos,
		ppos = mcopy.state.projector.pos;
	$('#trad_cam_count').val(cpos).change();
	$('#trad_proj_count').val(ppos).change();

	$('#seq_cam_count').val(cpos).change();
	$('#seq_proj_count').val(ppos).change();

	$('#goto_cam').val(cpos).change();
	$('#goto_proj').val(ppos).change();
};
mcopy.gui.changeView = function (t) {
	var last = $('.nav.current')[0].id;
	$('.nav').removeClass('current');
	$('.view').hide();
	if (t.innerHTML === 'Traditional') {
		mcopy.state.mode = 'trad';
		$('#traditional').show();
	} else if (t.innerHTML === 'Sequencer') {
		mcopy.state.mode = 'seq';
		$('#sequencer').show();
	} else if (t.innerHTML === 'Script') {
		mcopy.state.mode = 'script';
		mcopy.gui.mscript.open(last);
	}
	$(t).addClass('current');
	$('body').removeClass();
	$('body').addClass(mcopy.state.mode);
};
mcopy.gui.overlay = function (state) {
	if (state) {
		$('#overlay').show();
	} else {
		$('#overlay').hide();
	}
};
mcopy.gui.menu = function () {
	mcopy.log('Initializing native GUI menu...');
	var menu = new gui.Menu({type:"menubar"});
	if (process.platform === "darwin") {
		menu.createMacBuiltin("mcopy");
	}
	gui.Window.get().menu = menu;
	//console.dir(gui.Window.get().menu.item)
};

/******
	Sequencer grid
*******/
mcopy.gui.grid = {};
mcopy.gui.grid.layout = function () {
	mcopy.gui.grid.refresh();
	mcopy.seq.stats();
};
mcopy.gui.grid.state = function (i) {
	if (mcopy.state.sequence.arr[i] !== undefined) {
		$('input[x=' + i + ']').prop('checked', false);
		$('.' + mcopy.state.sequence.arr[i] + '[x=' + i + ']').prop('checked', true);
	}
};
mcopy.gui.grid.refresh = function () {
	var cmds = ['cam_forward', 'proj_forward', 'black_forward', 'cam_backward', 'proj_backward', 'black_backward'],
		check = '',
		width = 970 + ((940 / 24) * Math.abs(24 - mcopy.state.sequence.size));
	$('#sequence').width(width + 'px');
	for (var i = 0; i < cmds.length; i++) {
		$('#' + cmds[i]).empty();
		if (cmds[i].substring(0, 3) === 'cam') {
			$('#' + cmds[i]).append($('<div>').text('CAM'));
		} else if (cmds[i].substring(0, 4) === 'proj') {
			$('#' + cmds[i]).append($('<div>').text('PROJ'));
		} else if (cmds[i].substring(0, 5) === 'black') {
			$('#' + cmds[i]).append($('<div>').text('BLACK'));
		}
		for (var x = 0; x < mcopy.state.sequence.size; x++) {
			check = '<input type="checkbox" x="xxxx" />'.replace('xxxx', x);

			if (i === cmds.length - 1) {
				$('#' + cmds[i]).append($('<div>').append($(check).addClass(mcopy.state.sequence.pads[cmds[i]])).append($('<div>').text(x)));
			} else {
				$('#' + cmds[i]).append($(check).addClass(mcopy.state.sequence.pads[cmds[i]]));
			}
			mcopy.gui.grid.state(x);
		}
	}
};
mcopy.gui.grid.click = function (t) {
	var i = parseInt($(t).attr('x'));
	if ($(t).prop('checked')) {
		mcopy.log( $(t).attr('class').replace('.', ''));
		mcopy.state.sequence.arr[i] = $(t).attr('class').replace('.', '');
		mcopy.gui.grid.state(i);
	} else {
		mcopy.state.sequence.arr[i] = undefined;
		delete mcopy.state.sequence.arr[i];
	}
	mcopy.seq.stats();
};
mcopy.gui.grid.clear = function () {
	var doit = confirm('Are you sure you want to clear this sequence?');
	if (doit) {
		mcopy.seq.clear();
		mcopy.gui.grid.refresh();
		mcopy.seq.stats();
		mcopy.log('Sequencer cleared');
	}
};
mcopy.gui.grid.loopChange = function (t) {
	count = parseInt(t.value);
	mcopy.loop = count;
	mcopy.log('Loop count set to ' + mcopy.loop);
	mcopy.seq.stats();
};
mcopy.gui.grid.plus_24 = function () {
	mcopy.state.sequence.size += 24;
	mcopy.gui.grid.refresh();
	mcopy.log('Sequencer expanded to ' + mcopy.state.sequence.size + ' steps');
};
mcopy.gui.events = function () {
	$(document.body).on('click', 'input[type=checkbox]', function () {
		mcopy.gui.grid.click(this);
	});
};

/******
	Traditional view
*******/
mcopy.gui.trad = {};
mcopy.gui.trad.seq = [];
mcopy.gui.trad.seqCount = 0;
mcopy.gui.trad.seqStop = false;
mcopy.gui.trad.seqTime = 0;
mcopy.gui.trad.mode = 'seq';
mcopy.gui.trad.seqMode = 'alt';
mcopy.gui.trad.counterFormat = function (t, normal, prevent) {
	var raw = t.value;
	t.value = mcopy.fmtZero(raw, 6);
	if (typeof normal !== 'undefined' && parseInt(raw) !== normal) {
		$(t).addClass('changed');
	} else {
		$(t).removeClass('changed');
	}
	if (typeof prevent === 'undefined') { prevent = false; }
	if (!prevent) {
		mcopy.gui.trad.shootGoto(t);
	}
};
mcopy.gui.trad.shootGoto = function (t) {
	var elem = $(t),
		id = elem.attr('id').split('_'),
		val = 0,
		comp = 0,
		other = {};
	if (id[1] === 'cam') {
		comp = mcopy.state.camera.pos;
	} else if (id[1] === 'proj') {
		comp = mcopy.state.projector.pos;
	}
	if (id[0] === 'shoot') {
		other = $('#goto_' + id[1]);
		val = parseInt(elem.val()) + comp;
		other.val(val);
		mcopy.gui.trad.counterFormat(other[0], comp, true);
		//other.trigger('change');
	} else if (id[0] === 'goto'){
		other = $('#shoot_' + id[1]);
		val = parseInt(elem.val()) - comp;
		other.val(val);
		mcopy.gui.trad.counterFormat(other[0], undefined, true);
	} else {
		//ALLOW TO EXECUTE WITH NO RESULTS
		//console.log('You screwed up the markup.');
	}
};
mcopy.gui.trad.updateCam = function (t) {
	var val = t.value,
		change;
	if (parseInt(val) === mcopy.state.camera.pos) { return false; }
	change = confirm('Are you sure you want to set camera counter to ' + val + '?');
	if (change) {
		mcopy.state.camera.pos = parseInt(val);
		mcopy.gui.updateState();
	} else {
		t.value = mcopy.state.camera.pos;
		mcopy.gui.trad.counterFormat(t);
	}
};
mcopy.gui.trad.updateProj = function (t) {
	var val = t.value,
		change;
	if (parseInt(val) === mcopy.state.projector.pos) { return false; }
	change = confirm('Are you sure you want to set projector counter to ' + val + '?');
	if (change) {
		mcopy.state.projector.pos = parseInt(val);
		mcopy.gui.updateState();
	} else {
		t.value = mcopy.projector.projector.pos;
		mcopy.gui.trad.counterFormat(t);
	}
};
mcopy.gui.trad.updateDir = function (t) {
	if (t.value === 'cam_forward') {
		mcopy.state.camera.direction = true;
		$('#trad_cam h1').removeClass('backward');
		if (!confirm('Set belts for CAMERA FORWARD or cancel.')) {
			mcopy.state.camera.direction = false;
			$('#trad_cam h1').addClass('backward');
			$('input[value=cam_backward').prop('checked', true);
		} else {
			$('input[value=cam_forward').prop('checked', true);
		}
	} else if (t.value === 'cam_backward') {
		mcopy.state.camera.direction = false;
		$('#trad_cam h1').addClass('backward');
		if (!confirm('Set belts for CAMERA REVERSE or cancel.')) {
			mcopy.state.camera.direction = true;
			$('#trad_cam h1').removeClass('backward');
			$('input[value=cam_forward').prop('checked', true);
		} else {
			$('input[value=cam_backward').prop('checked', true);
		}
	} else if (t.value === 'proj_forward') {
		mcopy.state.projector.direction = true;
		$('#trad_proj h1').removeClass('backward');
		if (!confirm('Set belts for PROJECTOR FORWARD or cancel')) {
			mcopy.state.projector.direction = false;
			$('#trad_proj h1').addClass('backward');
			$('input[value=proj_backward').prop('checked', true);
		} else {
			$('input[value=proj_forward').prop('checked', true);
		}
	} else if (t.value === 'proj_backward') {
		mcopy.state.projector.direction = false;
		$('#trad_proj h1').addClass('backward');
		if (!confirm('Set belts for PROJECTOR REVERSE or cancel')) {
			mcopy.state.projector.direction = true;
			$('#trad_proj h1').removeClass('backward');
			$('input[value=proj_forward').prop('checked', true);
		} else {
			$('input[value=proj_backward').prop('checked', true);
		}
	}
};
mcopy.gui.trad.keypress = function (t, e) {
    if (e.which === 13) {
    	if (t.id === 'trad_cam_count') {
			mcopy.gui.trad.updateCam(t);
    	} else if (t.id === 'trad_proj_count') {
    		mcopy.gui.trad.updateProj(t);
    	} else {
    		console.log('How in the heck?');
    		console.stack();
    	}
    }
};
mcopy.gui.trad.changeSeqMode = function (t) {
	var elem = $(t),
		name = elem.attr('name'),
		val = elem[0].value;

	if (val === 'on') {
		if (name === 'alt_mode') {
			mcopy.gui.trad.name_val('step_mode', 'off').checked = true;
			mcopy.gui.trad.name_val('skip_mode', 'off').checked = true;
			mcopy.gui.trad.seqMode = 'alt';
		} else if (name === 'step_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'off').checked = true;
			mcopy.gui.trad.name_val('skip_mode', 'off').checked = true;
			mcopy.gui.trad.seqMode = 'step';
		} else if (name === 'skip_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'off').checked = true;
			mcopy.gui.trad.name_val('step_mode', 'off').checked = true;
			mcopy.gui.trad.seqMode = 'skip';
		}
	} else if (val === 'off') {
		if (name === 'alt_mode') {
			mcopy.gui.trad.name_val('step_mode', 'on').checked = true;
			mcopy.gui.trad.seqMode = 'step';
		} else if (name === 'step_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'on').checked = true;
			mcopy.gui.trad.seqMode = 'alt';
		} else if (name === 'skip_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'on').checked = true;
			mcopy.gui.trad.seqMode = 'alt';
		}
	}
	//
};
mcopy.gui.trad.name_val = function (n, v) {
	var radios = $('#trad_loop input[type=radio]'),
		out;
	radios.each(function () {
		if ($(this).val() === v
			&& $(this).attr('name') === n) {
			out = $(this);
		}
	});
	return out[0];
};
mcopy.gui.trad.alt = function () {
	mcopy.gui.trad.seq = [];
	var proj = $('#trad_seq_proj').val(),
		cam = $('#trad_seq_cam').val(),
		cam_str = '',
		proj_str = '',
		cam_arr = [],
		proj_arr = [],
		seq = [];
	if (mcopy.state.camera.direction) {
		cam_str = 'CF';
	} else {
		cam_str = 'CB';
	}
	if (mcopy.state.projector.direction) {
		proj_str = 'PF';
	} else {
		proj_str = 'PB';
	}
	for (var i = 0; i < cam; i++) {
		cam_arr.push(cam_str);
	}
	console.dir(cam_arr);
	for (var i = 0; i < proj; i++) {
		proj_arr.push(proj_str);
	}
	mcopy.gui.trad.seq = cam_arr.concat(proj_arr);

};
mcopy.gui.trad.step = function () {
	var proj = $('#trad_seq_proj').val(),
		cam = $('#trad_seq_cam').val(),
		cam_str = '',
		proj_str = '',
		cam_arr = [],
		proj_arr = [],
		seq = [],
		len = 0;
	if (mcopy.state.camera.direction) {
		cam_str = 'CF';
	} else {
		cam_str = 'CB';
	}
	if (mcopy.state.projector.direction) {
		proj_str = 'PF';
	} else {
		proj_str = 'PB';
	}
	for (var i = 0; i < cam; i++) {
		cam_arr.push(cam_str);
	}
	for (var i = 0; i < proj; i++) {
		proj_arr.push(proj_str);
	}
	len = proj_arr.length;
	if (len < cam_arr.length) {
		len = cam_arr.length;
	}
	for (var i = 0; i < len; i++) {
		seq.push(cam_arr[i]);
		if (typeof proj_arr[i] !== 'undefined') {
			seq.push(proj_arr[i]);
		}
	}
	mcopy.gui.trad.seq = seq;
};
mcopy.gui.trad.skip = function () {
	var proj = $('#trad_seq_proj').val(),
		cam = $('#trad_seq_cam').val(),
		cam_str = '',
		proj_str = '',
		cam_arr = [],
		proj_arr = [],
		seq = [],
		len = 0;
	if (mcopy.state.camera.direction) {
		cam_str = 'CF';
	} else {
		cam_str = 'CB';
	}
	if (mcopy.state.projector.direction) {
		proj_str = 'PF';
	} else {
		proj_str = 'PB';
	}
	for (var i = 0; i < cam; i++) {
		cam_arr.push(cam_str);
	}
	for (var i = 0; i < proj; i++) {
		proj_arr.push(proj_str);
	}
	len = proj_arr.length;
	if (len < cam_arr.length) {
		len = cam_arr.length;
	}
	for (var i = 0; i < len; i++) {
		if (typeof cam_arr[i] !== 'undefined') {
			seq.push(cam_arr[i]);
		}
		seq.push(proj_arr[i]);
	}
	mcopy.gui.trad.seq = seq;
};
mcopy.gui.trad.loop = function () {
	if (mcopy.gui.trad.seqMode === 'alt') {
		mcopy.gui.trad.alt();
	} else if (mcopy.gui.trad.seqMode === 'step') {
		mcopy.gui.trad.step();
	} else  if (mcopy.gui.trad.seqMode === 'skip') {
		mcopy.gui.trad.skip();
	}
};
mcopy.gui.trad.seq_run = function () {
	if (mcopy.gui.trad.mode === 'cam') {
		mcopy.gui.trad.dedicated(mcopy.gui.trad.mode);
	} else if (mcopy.gui.trad.mode === 'proj') {
		mcopy.gui.trad.dedicated(mcopy.gui.trad.mode);
	} else if (mcopy.gui.trad.mode === 'seq') {
		mcopy.gui.trad.loop();
	}
	mcopy.gui.trad.seqTime = +new Date();
	mcopy.gui.trad.seqCount = 0;
	mcopy.gui.trad.run();
};
mcopy.gui.trad.seq_next = function () {

	alert('Perform next action in sequence');
};
mcopy.gui.trad.seq_refresh = function () {

};
mcopy.gui.trad.dedicated = function (type) {
	mcopy.gui.trad.seq = [];
	var current,
		dir,
		shoot = parseInt($('#shoot_' + type).val()),
		go_to = parseInt($('#goto_' + type).val()),
		cont = true,
		cmd = '';
	if (type === 'cam') {
		current = mcopy.state.camera.pos;
		dir = mcopy.state.camera.direction;
		cmd = 'C';
	} else if (type === 'proj') {
		current = mcopy.state.projector.pos;
		dir = mcopy.state.projector.direction;
		cmd = 'P';
	}
	if (go_to < current && dir) {
		//direction is wrong
		mcopy.gui.trad.updateDir({value: type + '_backward'});
		dir = false;
	}
	if (go_to > current && !dir) {
		//direction is wrong
		mcopy.gui.trad.updateDir({value: type + '_forward'});
		dir = true;
	}
	if (dir) {
		cmd += 'F';
	} else {
		cmd += 'B';
	}
	for (var i = 0; i < Math.abs(shoot); i++) {
		mcopy.gui.trad.seq.push(cmd);
	}
};
mcopy.gui.trad.log = function (msg) {

	$('#status').val(msg);
};
mcopy.gui.trad.run = function () {
	var cmd = mcopy.gui.trad.seq[mcopy.gui.trad.seqCount],
		action = function () {
			setTimeout(function () {
				mcopy.gui.trad.seqCount++;
				mcopy.gui.trad.run();
			}, mcopy.cfg.arduino.sequenceDelay);
		},
		timeEnd;
	if (mcopy.gui.trad.seqStop) {
		mcopy.gui.trad.log('Stopped');
		mcopy.log('Sequence stopped');
		return false;
	}
	if (mcopy.gui.trad.seqCount <= mcopy.gui.trad.seq.length && cmd !== undefined) {
		mcopy.gui.trad.log(mcopy.gui.trad.seqCount + ' : ' + cmd);
		mcopy.log('Sequence step ' + mcopy.gui.trad.seqCount + ' command ' + cmd + '...');
		if (cmd === 'CF'){
			mcopy.cmd.cam_forward(action);
		} else if (cmd === 'CB') {
			mcopy.cmd.cam_backward(action);
		} else if (cmd === 'PF') {
			mcopy.cmd.proj_forward(action);
		} else if (cmd === 'PB') {
			mcopy.cmd.proj_backward(action);
		} else if (cmd === 'BF') {
			mcopy.cmd.black_forward(action);
		} else if (cmd === 'BB') {
			mcopy.cmd.black_backward(action);
		}
	} else {
		mcopy.log('Sequence completed!');
		mcopy.notify('mcopy', 'Sequence completed!');
		$('#goto_cam').change();
		$('#shoot_cam').change();
		$('#goto_proj').change();
		$('#shoot_proj').change();
		$('#status').val('Done');
		timeEnd = +new Date();
		timeEnd = timeEnd - mcopy.gui.trad.seqTime;
		setTimeout(function () {
			if (timeEnd < 2000) {
				mcopy.log('Sequence took ' + timeEnd + 'ms');
			} else {
				mcopy.log('Sequence took ' + humanizeDuration(timeEnd));
			}
		}, 500);
	}
};

/******
	Mscript GUI
*******/
mcopy.gui.mscript = {};
mcopy.gui.mscript.data = {};
mcopy.gui.mscript.raw = '';
mcopy.gui.mscript.last = '';
mcopy.gui.mscript.init = function () {
	mcopy.log('Initializing mscript CodeMirror GUI...');
	mcopy.editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
		lineNumbers: true,
		mode: "text/html",
		matchBrackets: true,
		theme: 'monokai'
	});
	mcopy.editor.setSize(null, $(window).height());
	mcopy.editor.on('change', function (e) {
		var data = mcopy.editor.getValue(),
			output = mcopy.gui.mscript.parse(data);
	});
};
mcopy.gui.mscript.close = function () {
	$('#mscript').hide();
	$('#' + mcopy.gui.mscript.last).click();
};
mcopy.gui.mscript.open = function (last) {
	mcopy.gui.mscript.last = last;
	mcopy.editor.setSize(null, $(window).height() - 20);
	mcopy.gui.mscript.update();
	$('#mscript').show();
	mcopy.editor.refresh();
	setTimeout(function () {
		mcopy.editor.focus();
	}, 300);
};
mcopy.gui.mscript.update = function () {
	//ehhhhh
	$('#mscript textarea').val(mcopy.state.sequence.arr.join('\n'));
};
mcopy.gui.mscript.parse = function (str) {
	var cmd = 'node mscript.js "' + str + '\n"';
	mcopy.gui.mscript.raw = str;
	mcopy.exec(cmd, function (data) {
		mcopy.gui.mscript.data = JSON.parse(data);
	});
};
mcopy.gui.mscript.generate = function () {
	var script = '',
		seq = mcopy.state.sequence.arr,
		last = null,
		count = 0;
	for (var i = 0; i < seq.length; i++) {
		if (seq[i] === last) {
			count++;
		} else {
			script += seq[i];
			if (count !== 0 && seq[i + 1] !== seq[i]) {
				script += count + '\n';
			}
			count = 0;
		}

		last = seq[i];
	}

	mcopy.editor.setValue(script);
	$('#nav_script').click();
};
mcopy.gui.mscript.sequencer = function () {
	//sends current script to sequencer view

	//$()
};
/******
	File Handler
*******/
mcopy.file = {};
mcopy.file.open = function (path) {
	var data = JSON.parse(fs.readFileSync(path, 'utf8'));
	if (data.version !== mcopy.state.version) {
		mcopy.log('Cannot open file, wrong version', 0);
	}
	mcopy.state = data;
	mcopy.state.program_start = +new Date();
};
mcopy.file.save = function (path) {
	var data = mcopy.state;
	data.created = +new Date();
	if (path.indexOf('.mcopy') === -1){
		path += '.mcopy';
	}
	fs.writeFileSync(path, JSON.stringify(data, null, '\t'), 'utf8');
	//fs.writeFileSync(path + '.bson', BSON.serialize(data, false, true, false), 'utf8'); //json good enough
};
mcopy.file.mscript = function (input, callback) {
	var cmd = '(node mscript.js "' + input + '")';
	exec(cmd, function (e, std) {
		if (e) { return mcopy.log(e, 0); }
		var obj = JSON.parse(std);
		console.dir(obj);
		if (callback) { callback(obj); }
	});
};
mcopy.gui.trad.sections = function () {
	var label = 'current';
	if (!$(this).hasClass(label)) {
		var id = $(this).attr('id');
		$('.section').removeClass(label);
		$(this).addClass(label);
		if (id === 'trad_cam') {
			mcopy.gui.trad.mode = 'cam';
		} else if (id === 'trad_proj') {
			mcopy.gui.trad.mode = 'proj';
		} else if (id === 'trad_loop') {
			mcopy.gui.trad.mode = 'seq';
		}
	}
};

/******
	Event Bindings
*******/
mcopy.bindings = function () {

	$('#traditional .section').on('mousedown', mcopy.gui.trad.sections);
};

/******
	Mobile App Control
*******/
mcopy.mobile = {};
mcopy.mobile.fail = function (res, msg) {

	res.json(500, {success: false, err: msg});
};
mcopy.mobile.init = function () {
	mcopy.log('Starting mobile app...');

	express = require('express');
	app = express(),
	ip = mcopy.mobile.getIp();


	app.get('/', function (req, res) {
		mcopy.mobile.log('Device connected');
		res.send(fs.readFileSync('tmpl/mcopy_index.html', 'utf8'));
	});
	app.get('/js/mcopy_mobile.js', function (req, res) {
		res.send(fs.readFileSync('js/mcopy_mobile.js', 'utf8'));
	});
	app.get('/js/jquery.js', function (req, res) {
		res.send(fs.readFileSync('js/jquery.js', 'utf8'));
	});
	app.get('/cmd/:cmd', function (req, res) {
		if (typeof req.params.cmd !== 'undefined') {
			mcopy.log(req.params.cmd);
		} else {
			mcopy.mobile.fail('No command provided');
		}
	});
	app.get('/state', function (req, res) {
		res.json({
			camera: mcopy.state.camera,
			projector: mcopy.state.projector
		});
	});
	var http = require('http');
	http.createServer(app).listen(mcopy.cfg.ext_port);

	mcopy.log('Mobile server started. Connect at http://' + ip + ':' + mcopy.cfg.ext_port);
	mcopy.notify('mcopy', 'Started mobile server at http://' + ip + ':' + mcopy.cfg.ext_port);
};
mcopy.mobile.stop = function () {
	mcopy.log('Stopping mobile app...');
	app.close();
	mcopy.log('Stopped mobile app.');
};
mcopy.mobile.toggle = function () {
	var elem = $('i#mobile'),
		onClass = 'active';
	if (elem.hasClass(onClass)) {
		mcopy.mobile.stop();
		elem.removeClass(onClass);
	} else {
		mcopy.mobile.init();
		elem.addClass(onClass);
	}
};
mcopy.mobile.getIp = function () {
	var iface = os.networkInterfaces();
	console.dir(iface);
	if (typeof iface.en0 !== 'undefined') {
		if (typeof iface.en0[1] !== 'undefined' && typeof iface.en0[1].address !== 'undefined') {
			return iface.en0[1].address;
		}
	}
	return '127.0.0.1';
};
mcopy.mobile.log = function (str, status) {
	str = 'mobile > ' + str;
	mcopy.log(str, status);
};

$(document).ready(mcopy.init);
