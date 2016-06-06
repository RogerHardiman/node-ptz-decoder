// Mocha tests
// Note - currently the checks rely upon checking the 

var expect    = require("chai").expect;
var PelcoD_Decoder = require("../pelcod_decoder.js");

describe("Pelco D Decoder", function() {

  describe("Test Checksum", function() {
    it("tests checksum", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var bytes = [0xFF,0x42,0x42,0x42,0x42,0x42,0x42];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Pan Left", function() {
    it("tests Pan Left", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var bytes = [0xFF,0x01,0x00,0x04,0x20,0x00,0x25];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Pan Right", function() {
    it("tests Pan right", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var bytes = [0xFF,0x01,0x00,0x02,0x20,0x00,0x23];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Up", function() {
    it("tests up", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x00,0x08,0x00,0x20,0x29]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Down", function() {
    it("tests down", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x00,0x10,0x00,0x20,0x31]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Stop", function() {
    it("tests stop", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x00,0x00,0x00,0x00,0x01]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Iris Open", function() {
    it("tests iris open", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x02,0x00,0x00,0x00,0x03]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Iris Close", function() {
    it("tests iris close", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x04,0x00,0x00,0x00,0x05]);
      pelcod_decoder.processBuffer(buf);
    });
  });


  describe("Test Cam 1 Focus Near", function() {
    it("tests focus near", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x01,0x00,0x00,0x00,0x02]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Focus Far", function() {
    it("tests focus far", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x00,0x80,0x00,0x00,0x81]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Zoom in", function() {
    it("tests Zoom in", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x00,0x20,0x00,0x00,0x21]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Cam 1 Zoom Out", function() {
    it("tests Zoom Out", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var buf = new Buffer([0xFF,0x01,0x00,0x40,0x00,0x00,0x41]);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test Extended Command Coverage", function() {
    it("tests extended commands", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      // Aux On
      var buf = new Buffer([0xFF,0x01,0x00,0x09,0x00,0x05,0x0F]);
      pelcod_decoder.processBuffer(buf);

      // Aux Off
      var buf = new Buffer([0xFF,0x01,0x00,0x0B,0x00,0x05,0x11]);
      pelcod_decoder.processBuffer(buf);

      // Set Preset
      var buf = new Buffer([0xFF,0x01,0x00,0x03,0x00,0x01,0x05]);
      pelcod_decoder.processBuffer(buf);

      // Goto Preset
      var buf = new Buffer([0xFF,0x01,0x00,0x07,0x00,0x01,0x09]);
      pelcod_decoder.processBuffer(buf);

      // Clear Preset
      var buf = new Buffer([0xFF,0x01,0x00,0x05,0x00,0x01,0x07]);
      pelcod_decoder.processBuffer(buf);

      // Learn Tour
      var buf = new Buffer([0xFF,0x01,0x00,0x1F,0x00,0x00,0x20]);
      pelcod_decoder.processBuffer(buf);

      // Stop Learning the tour
      var buf = new Buffer([0xFF,0x01,0x00,0x21,0x00,0x00,0x22]);
      pelcod_decoder.processBuffer(buf);

      // Start Tour
      var buf = new Buffer([0xFF,0x01,0x00,0x23,0x00,0x00,0x24]);
      pelcod_decoder.processBuffer(buf);

      // Unknown extended command (with valid checksum)
      var buf = new Buffer([0xFF,0x01,0x00,0x01,0x00,0x01,0x03]);
      pelcod_decoder.processBuffer(buf);

      // Set left and right, up and down, zoom in and zoom out, iris open and iris close, focus near and focus far ALL AT SAME TIME
     var buf = new Buffer([0xFF,0x01,0xFF,0xFE,0x00,0x01,0x01]);
  pelcod_decoder.processBuffer(buf);
    });
  });


  describe("Test byte cache with split bytes (Pan Left)", function() {
    it("tests split command", function() {
      var pelcod_decoder = new PelcoD_Decoder();
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
      var pelcod_decoder = new PelcoD_Decoder();
      var bytes = [0xFF,0x01,0x00,0x04,0x20,0x00,0x25,0xFF,0x01,0x00,0x00,0x00,0x00,0x01];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

  describe("Test byte cache with garbage then real command (stop)", function() {
    it("tests garbage then data", function() {
      var pelcod_decoder = new PelcoD_Decoder();
      var bytes = [0x01,0x02,0x03,0xFF,0x01,0x00,0x00,0x00,0x00,0x01];
      var buf = new Buffer(bytes);
      pelcod_decoder.processBuffer(buf);
    });
  });

});

