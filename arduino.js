var arduino = {},
	fs = require('fs'),
	sp = require('serialport'),
	SerialPort = sp.SerialPort,
	express = require('express'),
	app = express(),
	arduino = {};

arduino.cfgFile = './data/cfg.json';
arduino.cfg = JSON.parse(fs.readFileSync(arduino.cfgFile, 'utf8'));
arduino.serial = undefined;

console.log('Starting arduino server for mcopyJK (ARM)');

var holding;
var hold = function (func) {
	holding = func;
};
var release = function (data) {
	if (holding !== undefined) {
		holding(data);
		holding = undefined;
	}
};

app.get('/connect', function (req, res) {
	var output = {
		success: false
	};
	if (arduino.serial !== undefined) {
		arduino.serial.close();
	}
	setTimeout(function () {
		if (req.query) {
			arduino.serial = new SerialPort(req.query.path, {
				baudrate: arduino.cfg.arduino.baud,
				parser: sp.parsers.readline("\n")
			});
			arduino.serial.on('data', function (data) {
				data = data.replace('\r', '');
				release(data);
			});
			console.log('Successfully connected to ' + req.query.path);
			output.success = true;
		}
		res.json(output);
	}, 200);
});
//CMDS
app.get('/cmd', function (req, res) {
	var output = {
		success: false
	};
	if (req.query) {
		arduino.serial.write(req.query.cmd, function (err) {
			hold(function (data) {
				output.success = true;
				output.cmd = data;
				res.json(output);
			});
		})
	} else {
		res.json(output);
	}
	
});

app.listen(9555);
