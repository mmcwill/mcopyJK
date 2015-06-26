var arduino = {},
	fs = require('fs'),
	sp = require('serialport'),
	SerialPort = sp.SerialPort,
	express = require('express'),
	app = express(),
	arduino = {};

arduino.cfgFile = './data/cfg.json';
arduino.cfg = JSON.parse(fs.readFileSync(arduino.cfgFile, 'utf8'));

arduino.serial = new SerialPort('/dev/ttyACM0', {
  baudrate: arduino.cfg.arduino.baud,
  parser: sp.parsers.readline("\n")
});

app.get('/connect', function (req, res) {
	var output = {
		success: false
	}
	res.json(output);
})

app.listen(9555);
