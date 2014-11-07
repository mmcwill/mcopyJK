var fs = require('fs'),
	input = process.argv[2],
	json = process.argv.indexOf('-j');

var cmd = [
	'CF',
	'PF',
	'BF',
	'CB',
	'PB',
	'BB'
];

var state = {
	cam : 0,
	proj : 0,
	loops : [],
	rec : -1
};

var mcopy_script = function (text) {
	var lines = text.split('\n'),
		two = '',
		arr = [],
		loop,
		parent,
		target = 0,
		dist = 0,
		output = {};
	for (var i = 0; i < lines.length; i++) {
		lines[i] = lines[i].replace(/\t+/g, ""); //strip tabs
		two = lines[i].substring(0,2);
		if (cmd.indexOf(two) !== -1) {
			if (state.loops.length > 0) {
				state.loops[state.rec].arr.push.apply(state.loops[state.rec].arr, str_to_arr(lines[i], two));
			} else {
				arr.push.apply(arr, str_to_arr(lines[i], two));
			}
		} else if (lines[i].substring(0, 4) === 'LOOP') {
			//if (state.loop.on) { fail('Cannot loop within a loop... yet.'); }
			//loopCmd = lines[i];
			state.loops.push({
				arr : [],
				cam : 0,
				proj : 0,
				cmd : lines[i] + ''
			});
			state.rec++;
		} else if (lines[i].substring(0, 3) === 'END') {
			//state.loop.on = false;
			for (var x = 0; x < loop_count(state.loops[state.rec].cmd); x++) {
				if (state.rec === 0) {
					arr.push.apply(arr, state.loops[state.rec].arr);
				} else if (state.rec >= 1) {
					state.loops[state.rec - 1].arr.push.apply(state.loops[state.rec - 1].arr, state.loops[state.rec].arr);
				}
			}
			state_update('END', loop_count(state.loops[state.rec].cmd));
			delete state.loops[state.rec];
			state.rec--;
		} else if (lines[i].substring(0, 3) === 'CAM') { //directly go to that frame (black?)
			if (state.loops.length > 0) { fail('Cannot go to absolute camera frame within a loop... yet.'); }
			target = parseInt(lines[i].split('CAM ')[1]);
			if (target > state.cam) {
				dist = target - state.cam;
				for (var x = 0; x < dist; x++) {
					arr.push('BF');
					state_update('BF');
				} 
			} else {
				dist = state.cam - target;
				for (var x = 0; x < dist; x++) {
					arr.push('BB');
					state_update('BB');
				}
			}
		} else if (lines[i].substring(0, 4) === 'PROJ') { //directly go to that frame
			if (state.loops.length > 0) { fail('Cannot go to absolute projector frame within a loop... yet.'); }
			target = parseInt(lines[i].split('PROJ ')[1]);
			if (target > state.proj) {
				dist = target - state.proj;
				for (var x = 0; x < dist; x++) {
					arr.push('PF');
					state_update('PF');
				} 
			} else {
				dist = state.proj - target;
				for (var x = 0; x < dist; x++) {
					arr.push('PB');
					state_update('PB');
				} 
			}
		} else if (lines[i].substring(0, 3) === 'SET') { //set that state
			if (lines[i].substring(0, 7) === 'SET CAM') {
				state.cam = parseInt(lines[i].split('SET CAM')[1]);
			} else if (lines[i].substring(0, 8) === 'SET PROJ') {
				state.proj = parseInt(lines[i].split('SET PROJ')[1]);
			}
		} else if (lines[i].substring(0, 1) === '#' || lines[i].substring(0, 2) === '//') {
			//comments
			//ignore while parsing
		}
	}
	output.success = true;
	output.arr = arr;
	output.cam = state.cam;
	output.proj = state.proj;
	return console.log(JSON.stringify(output));
};

var last_loop = function () {

	return state.loops[state.loops.length - 1];
};

var parent_loop = function () {

	return state.loops[state.loops.length - 2];
};

var state_update = function (cmd, val) {
	if (cmd === 'END') {
		for (var i = 0; i < val; i++) {
			if (state.rec === 0) {
				state.cam += state.loops[state.rec].cam;
				state.proj += state.loops[state.rec].proj;
			} else if (state.rec >= 1) {
				state.loops[state.rec - 1].cam += state.loops[state.rec].cam;
				state.loops[state.rec - 1].proj += state.loops[state.rec].proj;
			}
		}
	} else if (cmd === 'CF') {
		if (state.loops.length < 1) {
			state.cam++;
		} else {
			state.loops[state.rec].cam++;
		}
	} else if (cmd === 'CB') {
		if (state.loops.length < 1) {
			state.cam--;
		} else {
			state.loops[state.rec].cam--;
		}
	} else if (cmd === 'PF') {
		if (state.loops.length < 1) {
			state.proj++;
		} else {
			state.loops[state.rec].proj++;
		}		
	} else if (cmd === 'PB') {
		if (state.loops.length < 1) {
			state.proj--;
		} else {
			state.loops[state.rec].proj--;
		}		
	} else if (cmd === 'BF') {
		if (state.loops.length < 1) {
			state.cam++;
		} else {
			state.loops[state.rec].cam++;
		}		
	} else if (cmd === 'BB') {
		if (state.loops.length < 1) {
			state.cam++;
		} else {
			state.loops[state.rec].cam++;
		}		
	}
};

var str_to_arr = function (str, cmd) {
	var cnt = str.split(cmd),
		c = parseInt(cnt[1]),
		arr = [];
	if (cnt[1] === '') {
		c = 1;
	} else {
		c = parseInt(cnt[1]);
	}
	for (var i = 0; i < c; i++) {
		arr.push(cmd);
		state_update(cmd);
	}
	return arr;
};

var loop_count = function (str) {
	return parseInt(str.split('LOOP ')[1]);
};

var fail = function (reason) {
	console.error(JSON.stringify({success: false, error: true, msg : reason}));
	process.exit();
};

if (input.indexOf('\n') !== -1) {
	mcopy_script(input);
} else {
	mcopy_script(fs.readFileSync(input, 'utf8'));
}