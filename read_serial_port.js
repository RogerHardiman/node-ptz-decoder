/*
 *
 * Read and decode Pelco D CCTV commands from a Serial Port / COM Port (using node-serialport)
 * Copyright 2016 Roger Hardiman
 *
 */

// External Dependencies
var SerialPort = require('serialport').SerialPort;
var PelcoD_Decoder = require('./pelcod_decoder');

// User Settings
var SERIAL_PORT = 'COM2';    // or /dev/ttyUSB0 on Linux
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