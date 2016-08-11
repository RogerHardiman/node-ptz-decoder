/*
 * Read and decode Pelco D and Pelco P CCTV commands from a Serial Port / COM Port (using node-serialport)
 * Copyright 2016 Roger Hardiman
 *
 * Note that the Serial Port varies between operating systems
 * E.g.   COM1 on Windows
 * E.g.   /dev/ttyUSB0 on Linux
 * E.g.   /dev/cu.usbserial on Mac
 * Use -p to change the port
 *
 * The Baud Rate for Pelco D is often 2400 8-N-1
 * The Baud Rate for Pelco P is often 4800 8-N-1
 * Use -b to change the baud rate
 */

// External Dependencies
var SerialPort = require('serialport');
var PelcoD_Decoder = require('./pelcod_decoder');
var version = require('./package.json').version;
var args = require('commander');

// Command line arguments
args.version(version);
args.description('Pelco D and Pelco P parser');
args.option('-p, --port <name>','Serial Port eg COM1 or /dev/ttyUSB0');
args.option('-b, --baud <value>','Baud Rate. Default 2400',parseInt);
args.option('-l, --list','List serial ports');
args.parse(process.argv);

// Initial message
console.log('');
console.log('Decode Pelco D and Pelco P Telemetry');
console.log('(c) Roger Hardiman 2016 www.rjh.org.uk');
console.log('Use -h for help');
console.log('');

// List available serial ports
if (args.list || (!args.port)) {
  if (!args.list) {
    console.log('ERROR: No serial port name specified');
  }
  console.log('Available serial ports are:-');
  SerialPort.list(function(err,ports) {
    if (err) {
      console.log(err);
      return;
    }
    ports.forEach(function(port) {
      console.log(port.comName + '\t' + (port.pnpId || '') + '\t' + (port.manufacturer || ''));
    });
    console.log('');
  });
  return;
}



// Defaults
var baud_rate = 2400;

// User Settings
if (args.port) serial_port = args.port;
if (args.baud) baud_rate = args.baud;

// Open Serial Port.
var pelco_d_decoder = new PelcoD_Decoder();
var port = new SerialPort(serial_port, {
    baudrate: baud_rate,
    parity: 'none',
    dataBits: 8,
    stopBits: 1,
});


// Callback - Error 
port.on('error', function(err) {
    console.log(err);
    console.log('');
    process.exit(1);
});

// Callback - Open
port.on('open', function(err) {
    if (err) {
        console.log('Serial Port Error : ' + err);
    } else {
        console.log('Serial Port ' + serial_port + ' open');
    }
});

// Callback - Data
port.on('data', function(buffer) {
    pelco_d_decoder.processBuffer(buffer);
});

// Callback - Disconnected (eg USB removal) 
port.on('disconnect', function(err) {
    console.log('Disconnected');
    process.exit(1);
});

