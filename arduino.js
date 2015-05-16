var arduino = {},
	serialport = require('serialport'),
	express = require('express'),
	app = express();
mcopy.arduino.serial = new SerialPort(mcopy.arduino.path, {
  baudrate: mcopy.cfg.arduino.baud,
  parser: sp.parsers.readline("\n")
});

app.listen(9555);
