/*
 * Read and decode CCTV PTZ commands from a Serial Port / COM Port (using node-serialport)
 * (c) Copyright 2016 to 2018 Roger Hardiman
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
var fs = require('fs');
var SerialPort = require('serialport');
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
args.option('-b, --baud <value>','Baud Rate. Default 2400',parseInt);
args.option('--parity <value>','Parity none, even, odd. Default none');
args.option('--nolog','Do not write to the log file. Default is to write logs');
args.parse(process.argv);

// Initial message
console.log('');
console.log('CCTV Telemetry Decoder');
console.log('Pelco D, Pelco P, BBV, Bosch, Philips, Forward Vision, Vicon, Panasonic, American Dynamics, Sensormatic');
console.log('(c) Roger Hardiman 2016 www.rjh.org.uk');
console.log('Use -h for help');
console.log('');

// Show help if there are no commands
if (!process.argv.slice(2).length) {
  args.outputHelp();
  // let it fall through to show the serial ports
}

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



// Defaults 2400 8-N-1
var serial_port = '/dev/ttyUSB0';
var baud_rate = 2400;
var data_bits = 8;
var parity = 'none';
var stop_bits = 1;

// Log File
var log_fd;

// User Settings
if (args.port) serial_port = args.port;
if (args.baud) baud_rate = args.baud;
if (args.parity === 'none' || args.parity === 'odd' || args.parity === 'even') parity = args.parity;

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



// Open Serial Port.
var port = new SerialPort(serial_port, {
    baudrate: baud_rate,
    parity: parity,
    dataBits: data_bits,
    stopBits: stop_bits,
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
        console.log('Serial Port ' + serial_port + ' open ' + baud_rate + '-' + parity + '-' + stop_bits);
    }
});

// Callback - Raw Data received from Serial Port
port.on('data', function(buffer) {

    var now = dateTime.create();
    var nowString = now.format('H:M:S.N');
    var msg = nowString + 'Rx' + BufferToHexString(buffer);

    // write to console
    if (args.verbose) console.log(msg);

    // write to log file if 'fd' is not undefined
    if (log_fd) {
      fs.write(log_fd,msg+'\r\n',function(err) {
        if (err) console.log('Error writing to file');
      });
    }

    // pass to each decoder
    if (pelco_d_decoder) pelco_d_decoder.processBuffer(buffer);
    if (extra_decoder_1) extra_decoder_1.processBuffer(buffer);
});

// Callback - Disconnected (eg USB removal) 
port.on('disconnect', function(err) {
    console.log('Disconnected ' + err);
    process.exit(1);
});

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

