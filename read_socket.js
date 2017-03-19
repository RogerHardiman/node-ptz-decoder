/*
 * Read and decode CCTV PTZ commands from a TCP Socket
 * Copyright 2017 Roger Hardiman
 *
 * use -p to set the port to listen on
 */

// External Dependencies
var fs = require('fs');
var net = require('net');
var dateTime = require('node-datetime');
var PelcoD_Decoder = require('./pelcod_decoder').PelcoD_Decoder;
try {
var Extra_Decoder_1 = require('./extra_decoder_1');
} catch (err) {
// ignore this optional extra decoder
}

var version = require('./package.json').version;
var args = require('commander');

// Command line arguments
args.version(version);
args.description('Pelco D, Pelco P, BBV422, Philips/Bosch, Vicon, Forward Vision, Pansonic and American Dynamics/Sensormatic parser');
args.option('-l, --list','List serial ports');
args.option('-v, --verbose','Verbose mode. Show all data bytes');
args.option('-p, --port <name>','Serial Port eg COM1 or /dev/ttyUSB0');
args.option('--nolog','Do not write to the log file. Default is to write logs');
args.parse(process.argv);

// Initial message
console.log('');
console.log('CCTV Telemetry Decoder');
console.log('Pelco D, Pelco P, BBV, Bosch, Philips, Forward Vision, Vicon, Panasonic, American Dynamics, Sensormatic');
console.log('(c) Roger Hardiman 2017 www.rjh.org.uk');
console.log('Use -h for help');
console.log('');

// List available serial ports
if (args.list || (!args.port)) {
  if (!args.list) {
    console.log('ERROR: No port number to listen on specified');
  }
  return;
}



// Defaults 2400 8-N-1
var port = '9000';

// Log File
var log_fd;

// User Settings
if (args.port) port = args.port;

// Initialise Decoders
if (PelcoD_Decoder)  var pelco_d_decoder = new PelcoD_Decoder();
if (Extra_Decoder_1) var extra_decoder_1 = new Extra_Decoder_1();

// Open log file
var now = dateTime.create();
var filename = 'log_' + now.format('Y_m_d_H_M_S') + '.txt';
if (args.nolog) {
  console.log('Log file disabled');
} else {
  fs.open(filename,'w',function(err,fd) {
    if (err) {
      console.log('ERROR - cannot create log file ' + filename);
      console.log(err);
      console.log('');
      process.exit(1);
    }
    log_fd = fd;
    console.log('Log File Open ('+filename+')');
  });
}



// Open Port.
var server = new net.createServer(function(sock) {

  console.log('Network Connection from ' + sock.remoteAddress + ':' + sock.remotePort + ' received');

  // Callback - Data
  sock.on('data', function(buffer) {

    // write to console
    if (args.verbose) process.stdout.write(BufferToHexString(buffer));

    // write to log file if 'fd' is not undefined
    if (log_fd) {
      var msg = 'Rx' + BufferToHexString(buffer) + '\r\n';
      fs.write(log_fd,msg,function(err) {
        if (err) console.log('Error writing to file');
      });
    }

    // pass to each decoder
    if (pelco_d_decoder) pelco_d_decoder.processBuffer(buffer);
    if (extra_decoder_1) extra_decoder_1.processBuffer(buffer);
  });
  // Callback - Close
  sock.on('close', function(data) {
    console.log('Network Connection from ' + sock.remoteAddress + ':' + sock.remotePort + ' received');
  });
});
server.listen(port,'127.0.0.1');



// Callback - Dedoded protocol
pelco_d_decoder.on('log', function(message) {
    // show on console
    console.log(message);

    // Write to file
    if (log_fd) {
      var msg = '=>' + message + '\r\n';
      fs.write(log_fd,msg,function(err) {
        if (err) console.log('Error writing to file');
      });
    }

});

try{
  extra_decoder_1.on('log', function(message) {
    // show on console
    console.log(message);

    // Write to file
    if (log_fd) {
      var msg = '=>' + message + '\r\n';
      fs.write(log_fd,msg,function(err) {
        if (err) console.log('Error writing to file');
      });
    }

  });
} catch (err) {}


// helper functions
var last_byte = '';
function BufferToHexString(buffer) {
    var byte_string = '';
    for (var i = 0; i < buffer.length; i++) {
        byte_string += '[' + DecToHexPad(buffer[i],2) + ']';
    }
    return byte_string;
}

// helper functions
function DecToHexPad(decimal,size) {
    var ret_string = decimal.toString('16');
    while (ret_string.length < size) {
        ret_string = '0' + ret_string;
    }
    return ret_string;
}

