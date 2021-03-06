#include <WProgram.h>
#include <Servo.h> 
void setup ();
void loop();
void cmd (char c);
void debug ();
void connect ();
void camera ();
void projector ();
void cam_direction (boolean state);
void proj_direction (boolean state);
void black_frame ();
void log (String msg);
void setDir (String cp, boolean d);
void momentary (int pin, int pause);
#line 1 "src/sketch.ino"
//ino/mcopy_jk_1415033188406.ino
//#include <Servo.h> 
 
Servo black;
const int black_pin = 10;
const int black_start = 120;
const int black_stop = 7;

boolean debug_state = false;

const int cam_pin = 13;//4;
boolean cam_dir = true; //setDir in setup
const int cam_time = 1000;
const int cam_delay = 50;
const int cam_momentary = 200;

const int cam_dir_1 = 6; //left
const int cam_dir_2 = 7; //right

const int proj_pin = 13;//5;
boolean proj_dir = true; //setDir in setup
const int proj_time = 1000;
const int proj_delay = 50;
const int proj_momentary = 200;

const int proj_dir_1 = 8; //left
const int proj_dir_2 = 9; //right

char cmd_char = 'z'; //buffer for input value, never use z
const char cmd_debug = 'd';
const char cmd_connect = 'i';
const char cmd_camera = 'c';
const char cmd_projector = 'p';
const char cmd_black = 'b';
const char cmd_cam_forward = 'e';
const char cmd_cam_backward = 'f';
const char cmd_proj_forward = 'g';
const char cmd_proj_backward = 'h';

void setup () {
  pinMode(cam_pin, OUTPUT);
  pinMode(proj_pin, OUTPUT);
  black.attach(black_pin, 1000, 2000);


  pinMode(cam_dir_1, OUTPUT);
  pinMode(cam_dir_2, OUTPUT);
  setDir("cam", true);
  pinMode(proj_dir_1, OUTPUT);
  pinMode(proj_dir_2, OUTPUT);
  setDir("proj", true);

	Serial.begin(57600);
	delay(100);
  black.write(black_stop);
  delay(250);
  black.write(black_start);

	Serial.flush();
}

void loop() {
  /*  check if data has been sent over serial: */
  if (Serial.available()) {
    /* read the most recent byte */
    cmd_char = (char)Serial.read();
  }
  if (cmd_char != 'z') {
    cmd(cmd_char);
    cmd_char = 'z';
  }
}

void cmd (char c) {
  if (c == cmd_debug) {
    debug();
  } else if (c == cmd_connect) {
  	connect();
  } else if (c == cmd_camera) {
  	camera();
  } else if (c == cmd_projector) {
  	projector();
  } else if (c == cmd_black) {
    black_frame(); 
  } else if (c == cmd_cam_forward) {
  	cam_direction(true); //explicit
  } else if (c == cmd_cam_backward) {
    cam_direction(false);
  } else if (c == cmd_proj_forward) {
  	proj_direction(true);
  } else if (c == cmd_proj_backward) {
    proj_direction(false);
  }else{
    if (debug_state) {
      Serial.print("Command ");
      Serial.print(c);
      Serial.println(" not found.");
    }
  }
  Serial.println(c); //marks end of action to GUI
}
void debug () {
  debug_state = true;
  log("Debugging enabled");
}
void connect () {
	log("connect()");
}
void camera () {
	log("camera()");
  momentary(cam_pin, cam_momentary);
  delay((cam_time - cam_momentary) + cam_delay);
}
void projector () {
	log("projector()");
  momentary(proj_pin, proj_momentary);
  delay((proj_time -  proj_momentary) + proj_delay);
}
void cam_direction (boolean state) {
  setDir("cam", state);
  log("cam_direction ->" + state);
}
void proj_direction (boolean state) {
  setDir("proj", state);
  log("proj_direction -> " + state);
}
void black_frame () {
  log("black_frame()");
  black.write(black_stop);
  delay(250);
  camera();
  black.write(black_start);
  delay(250);
}
void log (String msg) {
  if (debug_state) {
    Serial.println(msg);
  }
}

void setDir (String cp, boolean d) {
  int pin1;
  int pin2;
  if (cp == "cam") {
    pin1 = cam_dir_1;
    pin2 = cam_dir_2;
    cam_dir = d;
  } else if (cp == "proj") {
    pin1 = proj_dir_1;
    pin2 = proj_dir_2;
    proj_dir = d;
  }
  if (d) {
    digitalWrite(pin1, HIGH);
    digitalWrite(pin2, HIGH);
  } else {
    digitalWrite(pin1, LOW);
    digitalWrite(pin2, LOW);
  }
}

void momentary (int pin, int pause) {
  digitalWrite(pin, HIGH);
  delay(pause); //leave pause to be blocking
  digitalWrite(pin, LOW);
}