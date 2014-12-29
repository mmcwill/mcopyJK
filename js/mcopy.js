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
	os = require('os'),
	exec = require('child_process').exec,
	humanizeDuration = require("humanize-duration"),
	//moment = require('moment'),
	//BSON = require('bson').BSONPure.BSON,
	sp = require("serialport"),
	SerialPort = sp.SerialPort,
	express = {},
	app = {},
	server = {},
	io = {}
	mcopy = {};

mcopy.cfgFile = 'cfg.json';
mcopy.cfg = JSON.parse(fs.readFileSync(mcopy.cfgFile, 'utf8'));
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
	mcopy.bindings();
	mcopy.tests(function () {
		process.on('uncaughtException', function (err) {
    		console.dir(err);
		});
		mcopy.gui.menu();
		mcopy.gui.mscript.init();
		mcopy.gui.overlay(true);
		mcopy.gui.spinner(true);
		mcopy.stateinit();
		mcopy.arduino.init(function () {
			mcopy.arduino.connect(mcopy.gui.init);
		});
	    if (mcopy.arg('-m', '--mobile')) {
	    	mcopy.mobile.init();
	    }
  
	});
};
/******
	State shared by ALL interfaces
*******/
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
mcopy.tests = function (callback) {
	exec('ino -h', function (e1,std1) {
		if (e1) { return mcopy.log('Problem with ino, check install', 0); }
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
				if (err) { mcopy.log(err, 0); }
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
			mcopy.gui.overlay(true);
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
mcopy.seq.run = function () {
	var cmd = mcopy.state.sequence.arr[mcopy.seq.i],
		action = function () {
			setTimeout(function () {
				mcopy.seq.i++;
				mcopy.seq.run();
			}, mcopy.cfg.arduino.sequenceDelay);
		};
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
		mcopy.log('Sequence completed!');
		//clear gui
		$('.row input').removeClass('h');
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
	if (!start) { start = 0; }
	mcopy.seq.stop(false);
	mcopy.seq.i = start;
	mcopy.seq.run();
};
mcopy.seq.timing = function () {
	var ms = 0,
		cmd = '';
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
	}
	if (ms < 2000) {
		$('#stats .timing span').text(ms + 'ms');
	} else {
		$('#stats .timing span').text(humanizeDuration(ms));
	}
	return ms;
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
		$('#traditional').show();
	} else if (t.innerHTML === 'Sequencer') {
		$('#sequencer').show();
	} else if (t.innerHTML === 'Script') {
		mcopy.gui.mscript.open(last);
	}
	$(t).addClass('current');
};
mcopy.gui.overlay = function (state) {
	if (state) {
		$('#overlay').show();
	} else {
		$('#overlay').hide();
	}
};
mcopy.gui.menu = function () {
	var menu = new gui.Menu({type:"menubar"});
	if (process.platform === "darwin") {
		menu.createMacBuiltin("mcopy");
	}
	gui.Window.get().menu = menu;
	console.dir(gui.Window.get().menu.item)
};

/******
	Sequencer grid
*******/
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
	mcopy.seq.timing();
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
	mcopy.seq.timing();
};
mcopy.gui.grid.clear = function () {
	//
	//
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

/******
	Traditional view
*******/
mcopy.gui.trad = {};
mcopy.gui.trad.mode = 'alt_mode';
mcopy.gui.trad.counterFormat = function (t, normal, prevent) {
	var len = 6,
		raw = t.value,
		str = t.value + '';
	if (raw < 0) {
		t.value = '-' + Array(len - (str.length - 1)).join('0') + str.replace('-', '');
	} else {
		if (str.length < len) {
			t.value = Array(len - str.length).join('0') + str;
		} else if (str.length >= len) {
			str = parseInt(str) + '';
			t.value = Array(len - str.length).join('0') + str;
		}
	}
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
		console.log('You screwed up the markup.');
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
        alert('You pressed enter!');
    }
};
mcopy.gui.trad.changeMode = function (t) {
	var elem = $(t),
		name = elem.attr('name'),
		val = elem[0].value;

	if (val === 'on') {
		if (name === 'alt_mode') {
			mcopy.gui.trad.name_val('step_mode', 'off').checked = true;
			mcopy.gui.trad.name_val('skip_mode', 'off').checked = true;
		} else if (name === 'step_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'off').checked = true;
			mcopy.gui.trad.name_val('skip_mode', 'off').checked = true;
		} else if (name === 'skip_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'off').checked = true;
			mcopy.gui.trad.name_val('step_mode', 'off').checked = true;
		}
		mcopy.gui.trad.mode = name;
	} else if (val === 'off') {
		if (name === 'alt_mode') {
			mcopy.gui.trad.name_val('step_mode', 'on').checked = true;
			mcopy.gui.trad.mode = 'step_mode';
		} else if (name === 'step_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'on').checked = true;
			mcopy.gui.trad.mode = 'alt_mode';
		} else if (name === 'skip_mode') {
			mcopy.gui.trad.name_val('alt_mode', 'on').checked = true;
			mcopy.gui.trad.mode = 'alt_mode';
		}
	}
	//
};

mcopy.gui.trad.name_val = function (n, v) {
	var radios = $('#trad_loop input[type=radio]'),
		out;
	radios.each(function () {
		if ($(this).val() === v && $(this).attr('name') === n) {
			out = $(this);
		}
	});
	return out[0];
};

mcopy.gui.trad.step = function (cam, proj) {
	var cam_str = '',
		proj_str = '',
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
	cam = Array.apply(null, new Array(cam)).map(Number.prototype.valueOf, cam_str);
	proj = Array.apply(null, new Array(proj)).map(Number.prototype.valueOf, proj_str);
	for (var i = 0; i < cam.length; i++) {
		seq.push(cam[i]);
		if (typeof proj[i] !== 'undefined') {
			seq.push(proj[i]);
		}
	}
};

/******
	Traditional view's sequence object
*******/
mcopy.gui.trad.seq = [];
mcopy.gui.trad.seq_next = function () {

	alert('Perform next action in sequence');
};
mcopy.gui.trad.seq_refresh = function () {};

//mscript view
mcopy.gui.mscript = {};
mcopy.gui.mscript.data = [];
mcopy.gui.mscript.raw = '';
mcopy.gui.mscript.init = function () {
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
mcopy.gui.mscript.last = '';
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

/******
	Event Bindings
*******/
mcopy.bindings = function () {
	$('.section').on('click', function () {
		var label = 'current';
		if (!$(this).hasClass(label)) {
			$('.section').removeClass(label);
			$(this).addClass(label);
		}
	});
};

/******
	Mobile App Control
*******/
mcopy.mobile = {};
mcopy.mobile.init = function () {
	mcopy.log('Starting mobile app...');
	express = require('express');
	app = express();
	io = require('socket.io')();
	ip = mcopy.mobile.getIp();

	app.get('/', function (req, res) {
		res.send(fs.readFileSync('tmpl/mcopy_index.html', 'utf8'));
	});
	app.get('/js/mcopy_mobile.js', function (req, res) {
		res.send(fs.readFileSync('js/mcopy_mobile.js', 'utf8'));
	});
	app.get('/js/jquery.js', function (req, res) {
		res.send(fs.readFileSync('js/jquery.js', 'utf8'));
	});

	server = app.listen(mcopy.cfg.ext_port);
	io.listen(server);

	io.sockets.on('connection', function (socket) {
		mcopy.mobile.log('Device connected');
		socket.emit('message', {'message': mcopy.state});
	});

	mcopy.log('Mobile server started. Connect at http://' + ip + ':' + mcopy.cfg.ext_port);
};
mcopy.mobile.stop = function () {
	mcopy.log('Stopping mobile app...');
	server.close();
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
	console.log(os.networkInterfaces());
	return '10.0.0.1';
};
mcopy.mobile.log = function (str, status) {
	str = 'mobile > ' + str;
	mcopy.log(str, status);
};

$(document).ready(mcopy.init);

setTimeout(function () {
	mcopy.arduino.tests();
}, 10000);