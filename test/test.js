// Mocha tests

var expect    = require("chai").expect;
var PelcoD_Decoder = require("../pelcod_decoder.js").PelcoD_Decoder;

var log_string = '';
var pelcod_decoder = new PelcoD_Decoder();
pelcod_decoder.on('log',function(msg) { 
  console.log('LOG:' + msg);
  log_string = msg;
});

function AppendStringToByteArray(str,bytes)
{
   for (var i = 0; i < str.length; ++i)
   {
      var charCode = str.charCodeAt(i);
      if (charCode > 0xFF) bytes.push('.'); // char > 1 byte unicode.
      else bytes.push(charCode);
   }
}

describe("Pelco D Decoder", function() {

  describe("Test Checksum", function() {
    it("tests checksum", function() {
      var bytes = [0xFF,0x42,0x42,0x42,0x42,0x42,0x42];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Pan Left", function() {
    it("tests Pan Left", function() {
      var bytes = [0xFF,0x01,0x00,0x04,0x20,0x00,0x25];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('PAN LEFT');
    });
  });

  describe("Test Cam 1 Pan Right", function() {
    it("tests Pan right", function() {
      var bytes = [0xFF,0x01,0x00,0x02,0x20,0x00,0x23];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('PAN RIGHT');
    });
  });

  describe("Test Cam 1 Up", function() {
    it("tests up", function() {
      var buf = new Buffer([0xFF,0x01,0x00,0x08,0x00,0x20,0x29]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('TILT UP');
    });
  });

  describe("Test Cam 1 Down", function() {
    it("tests down", function() {
      var buf = new Buffer([0xFF,0x01,0x00,0x10,0x00,0x20,0x31]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('Camera 1');
      expect(log_string).to.contain('TILT DOWN');
    });
  });

  describe("Test Cam 1 Stop", function() {
    it("tests stop", function() {
      var buf = new Buffer([0xFF,0x01,0x00,0x00,0x00,0x00,0x01]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('Camera 1');
      expect(log_string).to.contain('pan stop');
      expect(log_string).to.contain('tilt stop');
    });
  });

  describe("Test Cam 1 Iris Open", function() {
    it("tests iris open", function() {
      var buf = new Buffer([0xFF,0x01,0x02,0x00,0x00,0x00,0x03]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Iris Close", function() {
    it("tests iris close", function() {
      var buf = new Buffer([0xFF,0x01,0x04,0x00,0x00,0x00,0x05]);
      pelcod_decoder.processBuffer(buf);
    });
  });


  describe("Test Cam 1 Focus Near", function() {
    it("tests focus near", function() {
      var buf = new Buffer([0xFF,0x01,0x01,0x00,0x00,0x00,0x02]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Focus Far", function() {
    it("tests focus far", function() {
      var buf = new Buffer([0xFF,0x01,0x00,0x80,0x00,0x00,0x81]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Zoom in", function() {
    it("tests Zoom in", function() {
      var buf = new Buffer([0xFF,0x01,0x00,0x20,0x00,0x00,0x21]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Zoom Out", function() {
    it("tests Zoom Out", function() {
      var buf = new Buffer([0xFF,0x01,0x00,0x40,0x00,0x00,0x41]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Extended Command Coverage", function() {
    it("tests extended commands", function() {
      // Aux On
      var buf = new Buffer([0xFF,0x01,0x00,0x09,0x00,0x05,0x0F]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('SET AUX 5');

      // Aux Off
      var buf = new Buffer([0xFF,0x01,0x00,0x0B,0x00,0x05,0x11]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('CLEAR AUX 5');

      // Set Preset
      var buf = new Buffer([0xFF,0x01,0x00,0x03,0x00,0x01,0x05]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('SET PRESET 1');

      // Goto Preset
      var buf = new Buffer([0xFF,0x01,0x00,0x07,0x00,0x01,0x09]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('GOTO PRESET 1');

      // Clear Preset
      var buf = new Buffer([0xFF,0x01,0x00,0x05,0x00,0x01,0x07]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('CLEAR PRESET 1');

      // Learn Tour
      var buf = new Buffer([0xFF,0x01,0x00,0x1F,0x00,0x00,0x20]);
      pelcod_decoder.processBuffer(buf);

      // Stop Learning the tour
      var buf = new Buffer([0xFF,0x01,0x00,0x21,0x00,0x00,0x22]);
      pelcod_decoder.processBuffer(buf);

      // Start Tour
      var buf = new Buffer([0xFF,0x01,0x00,0x23,0x00,0x00,0x24]);
      pelcod_decoder.processBuffer(buf);

      // Set Zoom Speed
      var buf = new Buffer([0xFF,0x01,0x00,0x25,0x00,0x03,0x29]);
      pelcod_decoder.processBuffer(buf);
      expect(log_string).to.contain('SET ZOOM SPEED 3');

      // Unknown extended command (with valid checksum)
      var buf = new Buffer([0xFF,0x01,0x00,0x01,0x00,0x01,0x03]);
      pelcod_decoder.processBuffer(buf);

      // Set left and right, up and down, zoom in and zoom out, iris open and iris close, focus near and focus far ALL AT SAME TIME
      var buf = new Buffer([0xFF,0x01,0xFF,0xFE,0x00,0x01,0xFF]);
      pelcod_decoder.processBuffer(buf);
    });
  });


  describe("Test byte cache with split bytes (Pan Left)", function() {
    it("tests split command", function() {
      var bytes1 = [0xFF,0x01,0x00,0x04];
      var bytes2 = [0x20,0x00,0x25];
      var buf1 = new Buffer(bytes1);
      var buf2 = new Buffer(bytes2);
      pelcod_decoder.processBuffer(buf1);
      pelcod_decoder.processBuffer(buf2);
    });
  });

  describe("Test byte cache with Pan Left and Stop", function() {
    it("tests multiple commands", function() {
      var bytes = [0xFF,0x01,0x00,0x04,0x20,0x00,0x25,0xFF,0x01,0x00,0x00,0x00,0x00,0x01];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test byte cache with small amount of garbage then real command (stop)", function() {
    it("tests garbage then data", function() {
      var bytes = [0x01,0x02,0x03,0xFF,0x01,0x00,0x00,0x00,0x00,0x01];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test byte cache with large amount of garbage then real command (stop)", function() {
    it("tests garbage then data", function() {
      var bytes = [0x10,0x20,0x30,0x40,0x50,0x60,0x70,0x80,0x90,0xFF,0x01,0x00,0x00,0x00,0x00,0x01];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P Test Pan Left", function() {
    it("tests Pan Left", function() {
      var bytes = [0xA0,0x00,0x00,0x04,0x20,0x00,0xAF,0x2B];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P Test Pan Right", function() {
    it("tests Pan Right", function() {
      var bytes = [0xA0,0x00,0x00,0x02,0x20,0x00,0xAF,0x2D];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P Test Tilt Up", function() {
    it("tests Tilt Up", function() {
      var bytes = [0xA0,0x00,0x00,0x08,0x00,0x20,0xAF,0x27];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P Test Tilt Down", function() {
    it("tests Tilt Down", function() {
      var bytes = [0xA0,0x00,0x00,0x10,0x00,0x20,0xAF,0x3F];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P Test Stop", function() {
    it("tests Stop", function() {
      var bytes = [0xA0,0x00,0x00,0x00,0x00,0x00,0xAF,0x0F];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P bad checksum", function() {
    it("tests bad checksum", function() {
      var bytes = [0xA0,0x00,0x00,0x00,0xFF,0x00,0xAF,0x0F];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P Test byte cache with small amount of garbage then real command (stop)", function() {
    it("tests garbage then data", function() {
      var bytes = [0x01,0x02,0x03,0xA0,0x00,0x00,0x00,0x00,0x00,0xAF,0x0F];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Pelco P Test byte cache with large amount of garbage then real command (stop)", function() {
    it("tests garbage then data", function() {
      var bytes = [0x10,0x20,0x30,0x40,0x50,0x60,0x70,0x80,0x90,0xA0,0x00,0x00,0x00,0x00,0x00,0xAF,0x0F];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Bosch Telemetry (Philips BiPhase) block of data", function() {
    it("tests garbage then data", function() {
      var bytes = [
0x00,0x00,0x00,
0x86,0x00,0x23,0x07,0x02,0x01,0x33,
0x86,0x00,0x23,0x07,0x02,0x02,0x34,
0x86,0x00,0x23,0x07,0x02,0x03,0x35,
0x87,0x00,0x23,0x05,0x7f,0x08,0x01,0x37,
0x87,0x00,0x23,0x05,0x7f,0x08,0x21,0x57,
0x87,0x00,0x23,0x05,0x7f,0x18,0x01,0x47,
0x87,0x00,0x23,0x05,0x7f,0x18,0x02,0x48,
0x87,0x00,0x23,0x05,0x7f,0x20,0x01,0x4f,
0x87,0x00,0x23,0x05,0x7f,0x30,0x01,0x5f,
0x87,0x00,0x23,0x05,0x7f,0x30,0x02,0x60,
0x87,0x00,0x23,0x05,0x7f,0x40,0x01,0x6f,
0x87,0x00,0x23,0x05,0x7f,0x40,0x22,0x10,
0x87,0x00,0x23,0x05,0x7f,0x48,0x01,0x77,
0x87,0x00,0x23,0x05,0x7f,0x48,0x02,0x78,
0x87,0x00,0x23,0x05,0x7f,0x58,0x01,0x07,
0x87,0x00,0x23,0x05,0x7f,0x58,0x02,0x08,
0x87,0x00,0x23,0x05,0x7f,0x60,0x01,0x0f,
0x87,0x00,0x23,0x05,0x7f,0x70,0x02,0x20,
0x87,0x00,0x23,0x05,0x7f,0x78,0x00,0x26,
0x87,0x00,0x23,0x05,0x7f,0x78,0x01,0x27,
0x87,0x00,0x23,0x05,0x7f,0x78,0x02,0x28,
0x87,0x00,0x23,0x05,0x7f,0x78,0x11,0x37,
0x87,0x00,0x23,0x05,0x7f,0x78,0x12,0x38,
0x87,0x00,0x23,0x05,0x7f,0x78,0x20,0x46,
0x87,0x00,0x23,0x05,0x7f,0x78,0x21,0x47
      ];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Bosch Telemetry (Philips BiPhase) wipe", function() {
    it("tests Wipe commands", function() {
      var bytes = [
0x86,0x00,0x31,0x07,0x01,0x05,0x44,
0x86,0x00,0x31,0x07,0x02,0x05,0x45
      ];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Forward Vision Telemetry block of data", function() {
    it("tests garbage then data", function() {
      var bytes = []
      bytes.push(0x01, 0x02, 0x03); // garbage

      // Tilt up Dome 41
      bytes.push(0x0A);
      AppendStringToByteArray('29126G083200008E',bytes);
      bytes.push(0x87);
      pelcod_decoder.processBuffer(bytes);
      expect(log_string).to.contain('TILT UP');

      // Pan left at speed 50 on Dome 2
      bytes = []
      bytes.push(0x0A);
      AppendStringToByteArray('02126G0230003200',bytes);
      bytes.push(0xFA);
      pelcod_decoder.processBuffer(bytes);
      expect(log_string).to.contain('PAN LEFT');

      // Pan right at speed 255 on Dome 2
      bytes = [];
      bytes.push(0x0A);
      AppendStringToByteArray('02126G033000FF00',bytes);
      bytes.push(0xFA);
      pelcod_decoder.processBuffer(bytes);
      expect(log_string).to.contain('PAN RIGHT');

      // Stop on Dome 2
      bytes = [];
      bytes.push(0x0A);
      AppendStringToByteArray('02126G0030000000',bytes);
      bytes.push(0xF9);
      pelcod_decoder.processBuffer(bytes);
      expect(log_string).to.contain('Camera 2');
      expect(log_string).to.contain('tilt stop');
      expect(log_string).to.contain('pan stop');

      // Zoom in on Dome 2
      bytes = [];
      bytes.push(0x0A);
      AppendStringToByteArray('02126G2030000000',bytes);
      bytes.push(0xFB);
      pelcod_decoder.processBuffer(bytes);
      expect(log_string).to.contain('ZOOM IN');

      // Goto preset 7 on Dome 2
      bytes = [];
      bytes.push(0x0A);
      AppendStringToByteArray('020A6L07',bytes);
      bytes.push(0x84);
      pelcod_decoder.processBuffer(bytes);
      expect(log_string).to.contain('Goto Preset 7');

      // Pan right at speed 255 on Dome address 6
      bytes = [];
      bytes.push(0x0A);
      AppendStringToByteArray('06122G033000FF00',bytes);
      bytes.push(0xFA);
      pelcod_decoder.processBuffer(bytes);
      expect(log_string).to.contain('Camera 6');
      expect(log_string).to.contain('PAN RIGHT(255)');
    });
  });

  describe("Vicon Telemetry block of data", function() {
    it("tests garbage then data", function() {
      var bytes = [
0x00,0x00,0x00,
0x83,0x52,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x00,0x04,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x00,0x08,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x00,0x10,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x00,0x20,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x00,0x40,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x40,0x00,0x00,0x00,0x0F,0x78,0x00,0x00,
0x83,0x52,0x20,0x00,0x00,0x00,0x0F,0x78,0x00,0x00,
0x83,0x52,0x10,0x00,0x00,0x00,0x00,0x00,0x0F,0x78,
0x83,0x52,0x08,0x00,0x00,0x00,0x00,0x00,0x0F,0x78,
0x83,0x52,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x83,0x52,0x00,0x00,0x00,0x00,0x10,0x01,0x00,0x00,
0x83,0x52,0x00,0x00,0x00,0x00,0x10,0x1F,0x00,0x00,
0x83,0x62,0x52,0x20,0x00,0x00,0x08,0x00,0x08,0x00

      ];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("American Dynamics / Sensormatic block of data", function() {
    it("tests garbage then AD422 data", function() {
      var bytes = [
0x07,0xC0,0x82,0x0A,0xAD, // 7 Pan Right
0x07,0x83,0x76,           // 7 Stop
0x04,0x81,0x7B,           // 4 Pan Left
0x05,0xC0,0x85,0x1E,0x98, // 5 Tilt Down 30 deg/sec
0x0A,0x86,0x70,           // 10 Stop
0x01,0x84,0x7B,           // 1 Tilt Up
0x03,0xE6,0x17,           // 3 Set output pins 2 and 3 ON, 1 and 4 OFF
0x40,0x98,0x28,           // Suspend Transmission (broadcast address 0x40)
0x08,0xA5,0x53,           // Get position data from Camera 8
0x40,0x99,0x27,           // Normal Transmission (broadcast address 0x40)
0x40,0x98,0x28,           // Suspend Transmission (broadcast address 0x40)
0x03,0xC4,0x02,0x06,0x0C,0x25, // Get Config from Camera 3 (eg firmware)
0x40,0x99,0x27,           // Normal Transmission (broadcast address 0x40)
0x01,0xFA,0xAC,0xC1,0x0D,0xBB,0xA0,0xFE,0x79,0x60,0x00,0x02,0x57, // Relative Move (Degs)
//0x01,0xFA,0xAA,0xC2,0xFF,0xEC,0x78,0x00,0x27,0x10,0xC7,           // Relative Move in Frames. CHECKSUM??
0x01,0xFA,0x0A,0x01,0xFA,                                         // Get current position (Degs)
0x01,0xFA,0x8A,0xC1,0x08,0xCC,0xFF,0xFC,0xA4,0x47,0x00            // Goto position (Degs)
      ];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Panasonic", function() {
    it("tests panasonic data", function() {
      bytes = []
      bytes.push(0x02);
      AppendStringToByteArray('GC7:002110C',bytes);
      bytes.push(0x03);
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);

      bytes = []
      bytes.push(0x02);
      AppendStringToByteArray('GCF:2021400:2022000',bytes);
      bytes.push(0x03);
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);

      bytes = []
      bytes.push(0x02);
      AppendStringToByteArray('GCN:20214B0:2022018:2022001',bytes);
      bytes.push(0x03);
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);

      bytes = []
      bytes.push(0x02);
      AppendStringToByteArray('GCV:20214D0:2022238:2022201:90300C7',bytes);
      bytes.push(0x03);
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);

      bytes = []
      bytes.push(0x02);
      AppendStringToByteArray('GC^:20214C2:2022028:2022439:202203A:2022163',bytes);
      bytes.push(0x03);
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

});
