/*
 * Read and decode CCTV PTZ commands from a TCP Socket
 * Copyright 2017,2018 Roger Hardiman
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
args.option('-v, --verbose','Verbose mode. Show all data bytes');
args.option('-r, --remote <hostname>','Hostname of Remote TCP Serial Server (raw TCP stream)');
args.option('-p, --port <number>','TCP Port to listen on (or Port at Remote Site)');
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
if (args.remote) {
  // CONNECT TO REMOTE SITE
    var sock = new net.Socket();
  console.log('Connecting to '+ args.remote + ':' + args.port);
    sock.connect(args.port, args.remote, function() {

  console.log('Connected to remote site');

  // Callback - Data
  sock.on('data', function(buffer) {

    var now = dateTime.create();
    var nowString = now.format('H:M:S.N');
    var msg = nowString + 'Rx' + BufferToHexString(buffer) + '\r\n';

    // write to console
    if (args.verbose) console.log(msg);

    // write to log file if 'fd' is not undefined
    if (log_fd) {
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
    console.log('Network close from ' + sock.remoteAddress + ':' + sock.remotePort + ' received');
  });

  // Callback - Error
  sock.on('error', function(err) {
    console.log('Network error ' + err);
  });
});

} else {
    // LISTEN FOR INCOMING CONNECTIONS

    // Open Port.
    var server = new net.createServer(function(sock) {

      console.log('Network Connection from ' + sock.remoteAddress + ':' + sock.remotePort + ' received');

      // Callback - Data
      sock.on('data', function(buffer) {

        var now = dateTime.create();
        var nowString = now.format('H:M:S.N');
        var msg = nowString + 'Rx' + BufferToHexString(buffer) + '\r\n';

        // write to console
        if (args.verbose) console.log(msg);

        // write to log file if 'fd' is not undefined
        if (log_fd) {
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
        console.log('Network close from ' + sock.remoteAddress + ':' + sock.remotePort + ' received');
      });

      // Callback - Error
      sock.on('error', function(err) {
        console.log('Network error ' + err);
      });
    });
    server.listen(port,'127.0.0.1');
}



// Callback - Decoded protocol
pelco_d_decoder.on('log', function(message) {

    var now = dateTime.create();
    var nowString = now.format('H:M:S.N');
    var msg = nowString + '=>' + message;

    // show on console
    console.log(msg);

    // Write to file
    if (log_fd) {
      fs.write(log_fd,msg+'\r\n',function(err) {
        if (err) console.log('Error writing to file');
      });
    }

});

try{
  extra_decoder_1.on('log', function(message) {

    var now = dateTime.create();
    var nowString = now.format('H:M:S.N');
    var msg = nowString + '=>' + message;

    // show on console
    console.log(msg);

    // Write to file
    if (log_fd) {
      fs.write(log_fd,msg+'\r\n',function(err) {
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

