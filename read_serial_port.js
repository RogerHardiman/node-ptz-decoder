/*
 *
 * Read and decode Pelco D and Pelco P CCTV commands from a Serial Port / COM Port (using node-serialport)
 * Copyright 2016 Roger Hardiman
 *
 * You will need to set the SERIAL_PORT and the BAUD_RATE
 * Note that the Serial Port varies between operating systems
 * E.g.   COM1 on Windows
 * E.g.   /dev/ttyUSB0 on Linux
 * E.g.   /dev/cu.usbserial-141 on Mac
 *
 * The Baud Rate for Pelco D is often 2400 8-N-1
 * The Baud Rate for Pelco P is often 4800 8-N-1
 */

// External Dependencies
var SerialPort = require('serialport').SerialPort;
var PelcoD_Decoder = require('./pelcod_decoder');

// User Settings
var SERIAL_PORT = '/dev/ttyUSB0';
var BAUD_RATE = 2400;

// Globals
var pelco_d_decoder = new PelcoD_Decoder();
var port = new SerialPort(SERIAL_PORT, {
    baudrate: BAUD_RATE,
    parity: 'none',
    dataBits: 8,
    stopBits: 1,
});


// Callback - Open
port.on('open', function(err) {
    if (err) {
        console.log('Serial Port Error : ' + err);
    } else {
        console.log('Serial Port ' + SERIAL_PORT + ' open');
    }
});

// Callback - Data
port.on('data', function(buffer) {
    pelco_d_decoder.processBuffer(buffer);
});
