/*
__/\\\\____________/\\\\________/\\\\\\\\\_______/\\\\\_______/\\\\\\\\\\\\\____/\\\________/\\\_        
 _\/\\\\\\________/\\\\\\_____/\\\////////______/\\\///\\\____\/\\\/////////\\\_\///\\\____/\\\/__       
  _\/\\\//\\\____/\\\//\\\___/\\\/_____________/\\\/__\///\\\__\/\\\_______\/\\\___\///\\\/\\\/____      
   _\/\\\\///\\\/\\\/_\/\\\__/\\\______________/\\\______\//\\\_\/\\\\\\\\\\\\\/______\///\\\/______     
	_\/\\\__\///\\\/___\/\\\_\/\\\_____________\/\\\_______\/\\\_\/\\\/////////__________\/\\\_______    
	 _\/\\\____\///_____\/\\\_\//\\\____________\//\\\______/\\\__\/\\\___________________\/\\\_______   
	  _\/\\\_____________\/\\\__\///\\\___________\///\\\__/\\\____\/\\\___________________\/\\\_______  
	   _\/\\\_____________\/\\\____\////\\\\\\\\\____\///\\\\\/_____\/\\\___________________\/\\\_______ 
		_\///______________\///________\/////////_______\/////_______\///___by mmcwilliams___\///________
*/

//console.log(process.versions['node-webkit']);
var fs = require('fs'),
	gui = require('nw.gui'),
	win = gui.Window.get(),
	exec = require('child_process').exec,
	//BSON = require('bson').BSONPure.BSON,
	sp = require("serialport"),
	SerialPort = sp.SerialPort,
	express = {},
	app = {},
	mcopy = {};

mcopy.cfgFile = 'cfg.json';
mcopy.cfg = JSON.parse(fs.readFileSync(mcopy.cfgFile, 'utf8'));

mcopy.arg = function (short, lng) {
	if (process.argv.indexOf(short) !== -1 ||
		process.argv.indexOf(lng) !== -1) {
		return true;
	}
	return false;
};

/******
	Initialize mcopy
*******/
mcopy.init = function () {
	mcopy.log('Starting mcopy...');
	mcopy.tests(function () {
		mcopy.gui.spinner(true);
		mcopy.stateinit();
		mcopy.arduino.init(function () {
			mcopy.arduino.connect(mcopy.gui.init);
		});
	});
};
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
	}
};
mcopy.stateinit = function () {
	mcopy.log('Initializing state...');
	mcopy.state.package = JSON.parse(fs.readFileSync('package.json', 'utf8')); //for verifying the file format
	mcopy.state.cfg = mcopy.cfg; //for verifying the file format
	mcopy.state.program_start = +new Date();
	mcopy.local('state', mcopy.state);
	//
};
mcopy.log = function (txt) {
	$('#source').text(txt);
	console.log(txt);
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
mcopy.tests = function (callback) {
	exec('ino -h', function (e1,std1) {
		if (e1) { return mcopy.log('Problem with ino, check install'); }
		if (callback) { callback(); }
	})
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
//commands which respond to a sent char
mcopy.arduino.send = function (cmd, res) {
	if (!mcopy.arduino.lock) {
		mcopy.arduino.lock = true;
		mcopy.arduino.queue[cmd] = res;
		setTimeout(function () {
			mcopy.arduino.serial.write(cmd, function (err, results) {
				if (err) { mcopy.log(err); }
				mcopy.arduino.lock = false;
				mcopy.arduino.timer = new Date().getTime();
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
		} else if (matches.length > 0) {
			mcopy.log('Found ' + matches[0]);
			mcopy.arduino.path = matches[0];
			//once connected to the arduino
			//start user interface
			if (callback) { callback(); }
		}
	});
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
			return mcopy.log('failed to open: '+ error);
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
mcopy.cmd = {
	delay: 20
};
mcopy.cmd.cam_forward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos++;
		//gui action
		mcopy.log('Camera moved +1 frame to ' + mcopy.state.camera.pos);
		if (callback) { callback(); }
	};
	if (!mcopy.state.camera.direction) {
		mcopy.log('Advancing camera...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.cam_forward, function (ms) {
			mcopy.state.camera.direction = true;
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
			}, mcopy.cmd.delay);
		});
	} else {
		setTimeout(function () {
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
		}, mcopy.cmd.delay);
	}
};
mcopy.cmd.cam_backward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos--;
		//gui action
		mcopy.log('Camera moved -1 frame to ' + mcopy.state.camera.pos);
		if (callback) { callback(); }
	};
	if (mcopy.state.camera.direction) {
		mcopy.log('Rewinding camera...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.cam_backward, function (ms) {
			mcopy.state.camera.direction = false;
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
			}, mcopy.cmd.delay);
		});
	} else {
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.camera, res);
	}
};
mcopy.cmd.proj_forward = function (callback) {
	var res = function (ms) {
		mcopy.state.projector.pos++;
		mcopy.log('Projector moved +1 frame to ' + mcopy.state.projector.pos);
		//gui action
		if (callback) { callback(); }
	};
	if (!mcopy.state.projector.direction) {
		mcopy.log('Advancing projector...');
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.proj_forward, function (ms) {
			mcopy.state.projector.direction = true;
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
			}, mcopy.cmd.delay);
		});
	} else {
		setTimeout(function () {
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
		}, mcopy.cmd.delay);
	}
};
mcopy.cmd.proj_backward = function (callback) {
	var res = function (ms) {
		mcopy.state.projector.pos--;
		//gui action
		mcopy.log('Projector moved -1 frame to ' + mcopy.state.projector.pos);
		if (callback) { callback(); }
	};
	if (mcopy.state.projector.direction) {
		mcopy.arduino.send(mcopy.cfg.arduino.cmd.proj_backward, function (ms) {
			mcopy.state.projector.direction = false;
			setTimeout(function () {
				mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
			}, mcopy.cmd.delay);
		});
	} else {
		setTimeout(function () {
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.projector, res);
		}, mcopy.cmd.delay);
	}
};
mcopy.cmd.black_forward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos++;
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
			}, mcopy.cmd.delay);
		});
	} else {
		setTimeout(function () {
			//black
			mcopy.arduino.send(mcopy.cfg.arduino.cmd.black, res);
		}, mcopy.cmd.delay);
	}	
};
mcopy.cmd.black_backward = function (callback) {
	var res = function (ms) {
		mcopy.state.camera.pos--;
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
			}, mcopy.cmd.delay);
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
mcopy.seq.run = function () {
	var cmd = mcopy.state.sequence.arr[mcopy.seq.i],
		action = function () {
			setTimeout(function () {
				mcopy.seq.i++;
				mcopy.seq.run();
			}, 100);
		};
	if (mcopy.seq.i <= mcopy.state.sequence.arr.length && cmd !== undefined) {
		mcopy.log('Sequence step ' + mcopy.seq.i + ' command ' + cmd + '...');
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
	}
};
mcopy.seq.init = function (start) {
	if (!start) { start = 0; }
	mcopy.seq.i = start;
	mcopy.seq.run();
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
	mcopy.gui.spinner(false);
	mcopy.gui.events();

	//win.maximize();
	mcopy.gui.grid.layout();
	//setTimeout(mcopy.arduino.tests, 2000);
};

mcopy.gui.grid = {};
mcopy.gui.grid.layout = function () {
	var check = '';
	$('#cam_forward').append($('<div>').text('CAM'));
	$('#proj_forward').append($('<div>').text('PROJ'));
	$('#black_forward').append($('<div>').text('BLACK'));
	$('#cam_backward').append($('<div>').text('CAM'));
	$('#proj_backward').append($('<div>').text('PROJ'));
	$('#black_backward').append($('<div>').text('BLACK'));
	for (var i = 0; i < mcopy.state.sequence.size; i++) {
		check = '<input type="checkbox" x="xxxx" />'.replace('xxxx', i);
		$('#cam_forward').append($(check).addClass(mcopy.state.sequence.pads.cam_forward));
		$('#proj_forward').append($(check).addClass(mcopy.state.sequence.pads.proj_forward));
		$('#black_forward').append($(check).addClass(mcopy.state.sequence.pads.black_forward));
		$('#cam_backward').append($(check).addClass(mcopy.state.sequence.pads.cam_backward));
		$('#proj_backward').append($(check).addClass(mcopy.state.sequence.pads.proj_backward));

		$('#black_backward').append($('<div>').append($(check).addClass(mcopy.state.sequence.pads.black_backward)).append($('<div>').text(i)));

		mcopy.gui.grid.state(i);
	}
};
mcopy.gui.grid.state = function (i) {
	if (mcopy.state.sequence.arr[i] !== undefined) {
		$('input[x=' + i + ']').prop('checked', false);
		$('.' + mcopy.state.sequence.arr[i] + '[x=' + i + ']').prop('checked', true);
	}
};
mcopy.gui.grid.refresh = function () {
	var check = '';
	$('#cam_forward').empty();
	$('#proj_forward').empty();
	$('#black_forward').empty();
	$('#cam_backward').empty();
	$('#proj_backward').empty();
	$('#black_backward').empty();

	$('#cam_forward').append($('<div>').text('CAM'));
	$('#proj_forward').append($('<div>').text('PROJ'));
	$('#black_forward').append($('<div>').text('BLACK'));
	$('#cam_backward').append($('<div>').text('CAM'));
	$('#proj_backward').append($('<div>').text('PROJ'));
	$('#black_backward').append($('<div>').text('BLACK'));
	for (var i = 0; i < mcopy.state.sequence.size; i++) {
		check = '<input type="checkbox" x="xxxx" />'.replace('xxxx', i);
		$('#cam_forward').append($(check).addClass(mcopy.state.sequence.pads.cam_forward));
		$('#proj_forward').append($(check).addClass(mcopy.state.sequence.pads.proj_forward));
		$('#black_forward').append($(check).addClass(mcopy.state.sequence.pads.black_forward));
		$('#cam_backward').append($(check).addClass(mcopy.state.sequence.pads.cam_backward));
		$('#proj_backward').append($(check).addClass(mcopy.state.sequence.pads.proj_backward));
		$('#black_backward').append($('<div>').append($(check).addClass(mcopy.state.sequence.pads.black_backward)).append('' + i));
			
		mcopy.gui.grid.state(i);
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
};
mcopy.gui.events = function () {
	$(document.body).on('click', 'input[type=checkbox]', function () {
		mcopy.gui.grid.click(this);
	});
};
mcopy.gui.checklist = function () {
	//display checklist
	//bind hide event if all are checked off
	//allow gui layout
};

//mscript view
mcopy.gui.mscript = {};
mcopy.gui.mscript.close = function () {
	//
	$('#mscript').hide();
};
mcopy.gui.mscript.open = function () {
	mcopy.gui.mscript.update();
	$('#mscript').show();
	$('#mscript textarea').focus();
};
mcopy.gui.mscript.update = function () {
	//ehhhhh
	$('#mscript textarea').val(mcopy.state.sequence.arr.join('\n'));
};
/******
	File Handler
*******/
mcopy.file = {};
mcopy.file.open = function (path) {
	var data = JSON.parse(fs.readFileSync(path, 'utf8'));
	if (data.version !== mcopy.state.version) {
		mcopy.log('Cannot open file, wrong version');
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
		if (e) { return mcopy.log(e); }
		var obj = JSON.parse(std);
		console.dir(obj);
		if (callback) { callback(obj); }
	});
};

/******
	Mobile App Control
*******/
mcopy.mobile = function () {
	express = require('express');
	app = express();


	app.get('/', function (req, res) {
		res.send('hi matt');
	});

	app.get('/cmd/:cmd', function (req, res) {
		console.log(req.param('cmd'));
	});


	app.port(mcopy.cfg.ext_port);
};

$(document).ready(mcopy.init);

setTimeout(function () {
	mcopy.arduino.tests();
}, 10000);