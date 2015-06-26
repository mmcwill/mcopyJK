var arduino = {},
	serialport = require('serialport'),
	express = require('express'),
	app = express(),
	arduino = {};

arduino.cfgFile = './data/cfg.json';
arduino.cfg = JSON.parse(fs.readFileSync(arduino.cfgFile, 'utf8'));


arduino.serial = new serialport('/dev/ttyACM0', {
  baudrate: arduino.cfg.arduino.baud,
  parser: sp.parsers.readline("\n")
});

app.listen(9555);
