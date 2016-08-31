/*
 * Read and decode Pelco D, Pelco P, BBV422, Bosch/Philips, Forward Vision and Vicon CCTV commands
 * This code is not designed to decode every command.
 * The purpose is to monitor the output from various CCTV systems to confirm the protocols and camera addresses in use.
 * The meanings of certain Aux signals and special Preset values is not shown
 * 
 * (c) Copyright 2016 Roger Hardiman
 *
 * Processes NodeJS Buffer() data.
 * Buffer() objects may have multiple PTZ messages or just part of a message so bytes are cached if needed.
 *
 */

function PelcoD_Decoder() {

    // A Buffer used to cache partial commands
    this.pelco_command_buffer = new Buffer(7);

    // Number of bytes in the current Buffer
    this.pelco_command_index = 0;

    // A Buffer used to cache partial commands for Pelco P
    this.pelco_p_command_buffer = new Buffer(8);

    // Number of bytes in the current Buffer
    this.pelco_p_command_index = 0;

    // A Buffer used for byte Bosch/Philips BiPhase
    // Max length is 128 as length is bits 0 to 6 of header
    this.bosch_command_buffer = new Buffer(128);

    // Number of bytes in the current Buffer
    this.bosch_command_index = 0;

    // A Buffer used for byte Forward Vision Protocol (FV Protocol)
    // Min length is 8. Max length is 255
    this.fv_command_buffer = new Buffer(255);

    // Number of bytes in the current Buffer
    this.fv_command_index = 0;

    // A Buffer used for Vicon
    this.vicon_command_buffer = new Buffer(10);

    // Number of bytes in the current Buffer
    this.vicon_command_index = 0;
}


PelcoD_Decoder.prototype.processBuffer = function(new_data_buffer) {

    // console.log('received ' + this.bytes_to_string(new_data_buffer,new_data_buffer.length) );

    // process each byte from new_data_buffer in turn

    for (var i = 0; i < new_data_buffer.length; i++) {

        // Get the next new byte
        var new_byte = new_data_buffer[i];

        // Add to the end of the Pelco D buffer
	// We cannot simply look for 0xFF as this could be
	// part of the payload as well as the header
        if (this.pelco_command_index < this.pelco_command_buffer.length) {
            // Add the new_byte to the end of the pelco_command_buffer
            this.pelco_command_buffer[this.pelco_command_index] = new_byte;
            this.pelco_command_index++;
        } else {
            // Shift the bytes to make room for the new_byte at the end
            for (var x = 0; x < (this.pelco_command_buffer.length - 1); x++) {
                this.pelco_command_buffer[x] = this.pelco_command_buffer[x + 1];
            }
            // Then add the new_byte to the end
            this.pelco_command_buffer[this.pelco_command_buffer.length-1] = new_byte;
        }

        // Add to the end of Pelco P buffer
	// We cannot simply look for 0xA0 as this could be
	// part of the payload as well as the header value
        if (this.pelco_p_command_index < this.pelco_p_command_buffer.length) {
            // Add the new_byte to the end of the pelco_p_command_buffer
            this.pelco_p_command_buffer[this.pelco_p_command_index] = new_byte;
            this.pelco_p_command_index++;
        } else {
            // Shift the bytes to make room for the new_byte at the end
            for (var x = 0; x < (this.pelco_p_command_buffer.length - 1); x++) {
                this.pelco_p_command_buffer[x] = this.pelco_p_command_buffer[x + 1];
            }
            // Then add the new_byte to the end
            this.pelco_p_command_buffer[this.pelco_p_command_buffer.length-1] = new_byte;
        }

        // Add to Bosch byte buffer
	if (new_byte & 0x80) {
	    // MSB is set to 1. This marks the start of a Bosch command so reset buffer counter
	    this.bosch_command_index = 0;
	}
        if (this.bosch_command_index < this.bosch_command_buffer.length) {
            // Add the new_byte to the end of the bosch_command_buffer
            this.bosch_command_buffer[this.bosch_command_index] = new_byte;
            this.bosch_command_index++;
        }

        // Add to Forward Vision (FV) byte buffer
	if (new_byte == 0x0A) {
	    // Always starts with 0x0A (LineFeed). Other bytes are 'ascii range'. Checksum is >= 128 (0x80 to 0xFF) so 0x0A is unique.
	    this.fv_command_index = 0;
	}
        if (this.fv_command_index < this.fv_command_buffer.length) {
            // Add the new_byte to the end of the fv_command_buffer
            this.fv_command_buffer[this.fv_command_index] = new_byte;
            this.fv_command_index++;
        }

        // Add to Vicon byte buffer
	if (new_byte & 0x80) {
	    // MSB is set to 1. This marks the start of a Vicon command so reset buffer counter
	    this.vicon_command_index = 0;
	}
        if (this.vicon_command_index < this.vicon_command_buffer.length) {
            // Add the new_byte to the end of the vicon_command_buffer
            this.vicon_command_buffer[this.vicon_command_index] = new_byte;
            this.vicon_command_index++;
        }




        // Pelco D Test. Check if we have 7 bytes with byte 0 = 0xFF and with a valid SUM checksum
        if (this.pelco_command_index === 7 && this.pelco_command_buffer[0] === 0xFF
                                           && this.checksum_valid(this.pelco_command_buffer)) {
            // Looks like we have a Pelco command. Try and process it
            this.decode(this.pelco_command_buffer);
            this.pelco_command_index = 0; // empty the buffer
        }

        // Pelco P Test. Check if we have 8 bytes with byte 0 = 0xA0, byte 6 = 0xAF and with a valid XOR checksum
        if (this.pelco_p_command_index === 8 && this.pelco_p_command_buffer[0] === 0xA0
                                             && this.pelco_p_command_buffer[6] === 0xAF
                                             && this.checksum_p_valid(this.pelco_p_command_buffer)) {
            // Looks like we have a Pelco command. Try and process it
            this.decode(this.pelco_p_command_buffer);
            this.pelco_p_command_index = 0; // empty the buffer
        }


        // BBV422 Protocol Test. Check if we have 8 bytes with byte 0 = 0xB0, byte 6 = 0xBF and with a valid XOR checksum
        if (this.pelco_p_command_index === 8 && this.pelco_p_command_buffer[0] === 0xB0
                                             && this.pelco_p_command_buffer[6] === 0xBF
                                             && this.checksum_p_valid(this.pelco_p_command_buffer)) {
            // Looks like we have a Pelco command. Try and process it
            this.decode(this.pelco_p_command_buffer);
            this.pelco_p_command_index = 0; // empty the buffer
        }


        // Bosch Test. First byte has MSB of 1. First byte is the message size (excluding the checksum)
        var bosch_len = this.bosch_command_buffer[0] & 0x7F;
        if ((this.bosch_command_buffer[0] & 0x80)
                                             && this.bosch_command_index == (bosch_len + 1)
                                             && this.checksum_bosch_valid(this.bosch_command_buffer, this.bosch_command_index)) {
            // Looks like we have a Bosch command. Try and process it
            this.decode_bosch(this.bosch_command_buffer);
            this.bosch_command_index = 0; // empty the buffer
        }


        // Forward Vision. Byte 0 is 0x0A. Checksum is only byte with MSB set to 1
        if ((this.fv_command_buffer[0] == 0x0A)
                                             && this.fv_command_index >= 8
				             && (this.fv_command_buffer[this.fv_command_index-1] >= 128) // checksum
                                             && this.checksum_fv_valid(this.fv_command_buffer, this.fv_command_index)) {
            // Looks like we have a Forward Vision command. Try and process it
            this.decode_forward_vision(this.fv_command_buffer, this.fv_command_index);
            this.fv_command_index = 0; // empty the buffer
        }


        // Vicon. 10 bytes where Byte 1 has a MSB of 1
        if ((this.vicon_command_buffer[0] & 0x80)
                                             && (this.vicon_command_index == 10 )) {
            // Looks like we have a Vicon command. Try and process it
            this.decode_vicon(this.vicon_command_buffer, this.vicon_command_index);
            this.vicon_command_index = 0; // empty the buffer
        }

    }
};

PelcoD_Decoder.prototype.checksum_valid = function(buffer) {
    var total = 0;
    // The 0xFF start byte is not included in the checksum
    for (var x = 1; x < (buffer.length - 1); x++) {
        total += buffer[x];
    }
    var computed_checksum = total % 256;
    // Check if computed_checksum matches the last byte in the buffer
    if (computed_checksum === buffer[buffer.length - 1]) {
        return true;
    } else {
        return false;
    }
};

PelcoD_Decoder.prototype.checksum_p_valid = function(buffer) {
    var computed_checksum = 0x00;
    for (var x = 0; x < (buffer.length - 1); x++) {
        computed_checksum = computed_checksum ^ buffer[x]; // xor
    }
    // Check if computed_checksum matches the last byte in the buffer
    if (computed_checksum === buffer[buffer.length - 1]) {
        return true;
    } else {
        return false;
    }
};

PelcoD_Decoder.prototype.checksum_bosch_valid = function(buffer,message_length) {
    var total = 0;
    for (var x = 0; x < (message_length - 1); x++) {
        total += buffer[x];
    }
    var computed_checksum = total & 0x7F; // Checksum has MSB of zero. MSB of 1 is reserved for first byte of message
    // Check if computed_checksum matches the last byte in the buffer
    if (computed_checksum === buffer[message_length - 1]) {
        return true;
    } else {
        return false;
    }
};

PelcoD_Decoder.prototype.checksum_fv_valid = function(buffer,message_length) {
    var computed_checksum = 0x00;
    for (var x = 0; x < (message_length -1 ); x++) {
        computed_checksum = computed_checksum ^ buffer[x]; // xor
    }
    computed_checksum = computed_checksum | 0x80; // set MSB to 1
    // Check if computed_checksum matches the last byte in the buffer
    if (computed_checksum === buffer[message_length - 1]) {
        return true;
    } else {
        return false;
    }
};


PelcoD_Decoder.prototype.decode = function(pelco_command_buffer) {

    var pelco_d = false;
    var pelco_p = false;
    var msg_string ='';

    if (pelco_command_buffer.length == 7) pelco_d = true;
    if (pelco_command_buffer.length == 8) pelco_p = true;

    if (pelco_d) {
        //var sync      = pelco_command_buffer[0];
        var camera_id = pelco_command_buffer[1];
        var command_1 = pelco_command_buffer[2];
        var command_2 = pelco_command_buffer[3];
        var data_1 = pelco_command_buffer[4];
        var data_2 = pelco_command_buffer[5];
        //var checksum  = pelco_command_buffer[6];

        var extended_command = ((command_2 & 0x01)==1);
        msg_string += 'D ';
    }
    if (pelco_p) {
        var stx       = pelco_command_buffer[0];
        var camera_id = pelco_command_buffer[1] + 1; // Pelco P sends Cam1 as 0x00
        var command_1 = pelco_command_buffer[2];
        var command_2 = pelco_command_buffer[3];
        var data_1 = pelco_command_buffer[4];
        var data_2 = pelco_command_buffer[5];
        //var etx  = pelco_command_buffer[6];
        //var checksum  = pelco_command_buffer[7];

        var extended_command = ((command_2 & 0x01)==1);
        if (stx === 0xA0) msg_string += 'P ';
        if (stx === 0xB0) msg_string += 'BBV ';
    }


	
    msg_string += 'Camera ' + camera_id + ' ';
    

    if (extended_command) {
        // Process extended commands
        // Command 1 (byte3) and Command 2 (byte 4) identifies the Extended Command
        // byte 5 and 6 contain additional data used by the extended commands

        if (command_2 === 0x03 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[SET PRESET ' + data_2 + ']';
        } else if (command_2 === 0x05 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[CLEAR PRESET ' + data_2 + ']';
        } else if (command_2 === 0x07 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[GOTO PRESET ' + data_2 + ']';
        } else if (command_2 === 0x09 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[SET AUX ' + data_2 + ']';
        } else if (command_2 === 0x0B && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[CLEAR AUX ' + data_2 + ']';
        } else if (command_2 === 0x1F && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[START RECORDING TOUR ' + data_2 + ']';
        } else if (command_2 === 0x21 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[STOP RECORDING TOUR]';
        } else if (command_2 === 0x23 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[START TOUR ' + data_2 + ']';
        } else if (command_2 === 0x25 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[SET ZOOM SPEED ' + data_2 + ']';
        } else {
            msg_string += 'Unknown extended command';
        }
    } else {
        // Process a normal Pan, Tilt, Zoom, Focus and Iris command

        if (pelco_d) {
            var iris_close = (command_1 >> 2) & 0x01;
            var iris_open = (command_1 >> 1) & 0x01;
            var focus_near = (command_1 >> 0) & 0x01;
            var focus_far = (command_2 >> 7) & 0x01;
            var zoom_out = (command_2 >> 6) & 0x01;
            var zoom_in = (command_2 >> 5) & 0x01;
            var down = (command_2 >> 4) & 0x01;
            var up = (command_2 >> 3) & 0x01;
            var left = (command_2 >> 2) & 0x01;
            var right = (command_2 >> 1) & 0x01;
        }
        if (pelco_p) {
            var iris_close = (command_1 >> 3) & 0x01;
            var iris_open = (command_1 >> 2) & 0x01;
            var focus_near = (command_1 >> 1) & 0x01;
            var focus_far = (command_1 >> 0) & 0x01;
            var zoom_out = (command_2 >> 6) & 0x01;
            var zoom_in = (command_2 >> 5) & 0x01;
            var down = (command_2 >> 4) & 0x01;
            var up = (command_2 >> 3) & 0x01;
            var left = (command_2 >> 2) & 0x01;
            var right = (command_2 >> 1) & 0x01;
        }

        if (left === 0 && right === 0) {
            msg_string += '[pan stop     ]';
        } else if (left === 1 && right === 0) {
            msg_string += '[PAN LEFT ('+data_1+')]';
        } else if (left === 0 && right === 1) {
            msg_string += '[PAN RIGHT('+data_1+')]';
        } else { // left === 1 && right === 1)
            msg_string += '[PAN ???? ('+data_1+')]';
        }

        if (up === 0 && down === 0) {
            msg_string += '[tilt stop    ]';
        } else if (up === 1 && down === 0) {
            msg_string += '[TILT UP  ('+data_2+')]';
        } else if (up === 0 && down === 1) {
            msg_string += '[TILT DOWN('+data_2+')]';
        } else { // (up === 1 && down === 1)
            msg_string += '[TILT ????('+data_2+')]';
        }

        if (zoom_in === 0 && zoom_out === 0) {
            msg_string += '[zoom stop]';
        } else if (zoom_in === 1 && zoom_out === 0) {
            msg_string += '[ZOOM IN  ]';
        } else if (zoom_in === 0 && zoom_out === 1) {
            msg_string += '[ZOOM OUT ]';
        } else { // (zoom_in === 1 && zoom_out === 1)
            msg_string += '[ZOOM ????]';
        }

        if (iris_open === 0 && iris_close === 0) {
            msg_string += '[iris stop ]';
        } else if (iris_open === 1 && iris_close === 0) {
            msg_string += '[IRIS OPEN ]';
        } else if (iris_open === 0 && iris_close === 1) {
            msg_string += '[IRIS CLOSE]';
        } else { // (iris_open === 1 && iris_close === 1)
            msg_string += '[IRIS ???? ]';
        }

        if (focus_near === 0 && focus_far === 0) {
            msg_string += '[focus stop]';
        } else if (focus_near === 1 && focus_far === 0) {
            msg_string += '[FOCUS NEAR]';
        } else if (focus_near === 0 && focus_far === 1) {
            msg_string += '[FOCUS FAR ]';
        } else { // (focus_near === 1 && focus_far === 1)
            msg_string += '[FOCUS ????]';
        }

    }
    console.log(this.bytes_to_string(pelco_command_buffer, pelco_command_buffer.length) + ' ' + msg_string);
};

PelcoD_Decoder.prototype.decode_bosch = function(bosch_command_buffer) {

    // Note Bosch is 9600 8-N-1

    var msg_string ='';

    msg_string += 'Bosch ';

    var length      = bosch_command_buffer[0] & 0x7F;
    var high_order_address = bosch_command_buffer[1];
    var low_order_address = bosch_command_buffer[2];
    var op_code = bosch_command_buffer[3];
    //var data_byte_1 = bosch_command_buffer[4];
    //var data_byte_2 = bosch_command_buffer[5];
    //var data_byte_3 = bosch_command_buffer[6];
    //var data_byte_X = bosch_command_buffer[xxx];
    //var checksum = bosch_command_buffer[the last byte];

    var camera_id = (high_order_address << 7) + low_order_address + 1;

    msg_string += 'Camera ' + camera_id + ' ';
    
    //
    // OSRD Commands
    //
    if (op_code == 0x02) {
        msg_string += 'Start/Stop Fixed Speed PTZ, Focus and Iris';
    }
    else if (op_code == 0x03) {
        msg_string += 'Fixed Speed PTZ for a specified period';
    }
    else if (op_code == 0x04) {
        msg_string += 'Repetitive Fixed Speed PTZ';
    }
    else if (op_code == 0x05) {
        msg_string += 'Start/Stop Variable Speed PTZ = ';
        // 3 data bytes used with this Op Code
        var data_1 = bosch_command_buffer[4];
        var data_2 = bosch_command_buffer[5];
        var data_3 = bosch_command_buffer[6];
        var zoom_speed = (data_1 >> 4) & 0x07;
        var tilt_speed = (data_1 >> 0) & 0x0F;
        var pan_speed  = (data_2 >> 3) & 0x0F;
        var iris_open  = (data_2 >> 2) & 0x01;
        var iris_close = (data_2 >> 1) & 0x01;
        var focus_far  = (data_2 >> 0) & 0x01;
        var focus_near = (data_3 >> 6) & 0x01;
        var zoom_in    = (data_3 >> 5) & 0x01;
        var zoom_out   = (data_3 >> 4) & 0x01;
        var up    = (data_3 >> 3) & 0x01;
        var down  = (data_3 >> 2) & 0x01;
        var left  = (data_3 >> 1) & 0x01;
        var right = (data_3 >> 0) & 0x01;


        if (left === 0 && right === 0) {
            msg_string += '[pan stop     ]';
        } else if (left === 1 && right === 0) {
            msg_string += '[PAN LEFT ('+pan_speed+')]';
        } else if (left === 0 && right === 1) {
            msg_string += '[PAN RIGHT('+pan_speed+')]';
        } else { // left === 1 && right === 1)
            msg_string += '[PAN ???? ('+pan_speed+')]';
        }

        if (up === 0 && down === 0) {
            msg_string += '[tilt stop    ]';
        } else if (up === 1 && down === 0) {
            msg_string += '[TILT UP  ('+tilt_speed+')]';
        } else if (up === 0 && down === 1) {
            msg_string += '[TILT DOWN('+tilt_speed+')]';
        } else { // (up === 1 && down === 1)
            msg_string += '[TILT ????('+tilt_speed+')]';
        }

        if (zoom_in === 0 && zoom_out === 0) {
            msg_string += '[zoom stop]';
        } else if (zoom_in === 1 && zoom_out === 0) {
            msg_string += '[ZOOM IN('+zoom_speed+')]';
        } else if (zoom_in === 0 && zoom_out === 1) {
            msg_string += '[ZOOM OUT('+zoom_speed+')]';
        } else { // (zoom_in === 1 && zoom_out === 1)
            msg_string += '[ZOOM ????]';
        }

        if (iris_open === 0 && iris_close === 0) {
            msg_string += '[iris stop ]';
        } else if (iris_open === 1 && iris_close === 0) {
            msg_string += '[IRIS OPEN ]';
        } else if (iris_open === 0 && iris_close === 1) {
            msg_string += '[IRIS CLOSE]';
        } else { // (iris_open === 1 && iris_close === 1)
            msg_string += '[IRIS ???? ]';
        }

        if (focus_near === 0 && focus_far === 0) {
            msg_string += '[focus stop]';
        } else if (focus_near === 1 && focus_far === 0) {
            msg_string += '[FOCUS NEAR]';
        } else if (focus_near === 0 && focus_far === 1) {
            msg_string += '[FOCUS FAR ]';
        } else { // (focus_near === 1 && focus_far === 1)
            msg_string += '[FOCUS ????]';
        }
    }
    else if (op_code == 0x06) {
        msg_string += 'Repetitive Fixed speed Zoom, Focus and Iris';
    }
    else if (op_code == 0x07) {
        msg_string += 'Auxiliary On/Off and Preposition Set/Shot = ';
        // 2 data bytes used with this Op Code
        var data_1 = bosch_command_buffer[4];
        var data_2 = bosch_command_buffer[5];
        var function_code = data_1 & 0x0F;
        var data = ((data_1 & 0x70)<< 3) + data_2;
        if (function_code == 1) msg_string += 'Aux On ' + data;
        else if (function_code == 2) msg_string += 'Aux Off ' + data;
        else if (function_code == 4) msg_string += 'Pre-position SET ' + data;
        else if (function_code == 5) msg_string += 'Pre-position SHOT ' + data;
        else if (function_code == 8) msg_string += 'Cancel Latching Aux ' + data;
        else if (function_code == 9) msg_string += 'Latching Aux On ' + data;
        else if (function_code == 10) msg_string += 'Latching Aux Off ' + data;
	else msg_string += 'unknown aux or pre-position command ' + function_code + ' with value ' + data;
    }
    else if (op_code == 0x08) {
        msg_string += 'Repetitive Variable-speed PTZ, Focus and Iris';
    }

    //
    // OSRD Extended Commands
    //
    else if (op_code == 0x09) {
        msg_string += 'Fine Speed PTZ';
    }
    else if (op_code == 0x0A) {
        msg_string += 'Position Report and Replay / Position Commands';
    }
    else if (op_code == 0x0C) {
        msg_string += 'Ping Command';
    }
    else if (op_code == 0x0F) {
        msg_string += 'Information Requested / Reply';
    }
    else if (op_code == 0x10) {
        msg_string += 'Title set';
    }
    else if (op_code == 0x12) {
        msg_string += 'Auxiliary Commands with Data';
    }
    else if (op_code == 0x13) {
        msg_string += 'Set Position / Get Position';
    }
    else if (op_code == 0x14) {
        msg_string += 'BiCom message';
    }

    //
    // BiCom within OSRD
    //
    else {
        msg_string += 'Unknown Op Code ' + op_code;
    }

    console.log(this.bytes_to_string(bosch_command_buffer,length+1) + ' ' + msg_string);
};

PelcoD_Decoder.prototype.fv_hex_ascii = function(byte_1,byte_2) {
  // Byte 1 could be 0x31  = ASCII "1"
  // Byte 2 could be 0x46 = ASCII "F"
  // Convert Byte 1 and Byte 2 from 'bytes' into Chars, eg to "1" and "F"
  // Combine the chars to a Hex String eg "0x1F"
  // Convert the Hex String into an integer value

  var hex_string = '0x' + String.fromCharCode(byte_1,byte_2);
  var value = parseInt(hex_string);
  return value;
}


PelcoD_Decoder.prototype.decode_forward_vision = function(fv_command_buffer,fv_command_length) {

    // Note Forward Vision is 9600 8-O-1    *** ODD PARITY ***

    var msg_string ='';

    msg_string += 'FV ';

    var camera_id = this.fv_hex_ascii(fv_command_buffer[1], fv_command_buffer[2]);
    var length = this.fv_hex_ascii(fv_command_buffer[3], fv_command_buffer[4]);
    var control_flag_char = String.fromCharCode(fv_command_buffer[5]);
    var control_code_char = String.fromCharCode(fv_command_buffer[6]);

    msg_string += 'Camera ' + camera_id + ' ';

    if (control_code_char === 'G') {
        var data1 = this.fv_hex_ascii(fv_command_buffer[7], fv_command_buffer[8]);
        var data2 = this.fv_hex_ascii(fv_command_buffer[9], fv_command_buffer[10]);
        var data3 = this.fv_hex_ascii(fv_command_buffer[11], fv_command_buffer[12]);
        var pan_speed  = this.fv_hex_ascii(fv_command_buffer[13], fv_command_buffer[14]);
        var tilt_speed = this.fv_hex_ascii(fv_command_buffer[15], fv_command_buffer[16]);

        var focus_off_on   = (data1 >> 7) & 0x01;
        var focus_near_far = (data1 >> 6) & 0x01;
        var zoom_off_on    = (data1 >> 5) & 0x01;
        var zoom_tele_wide = (data1 >> 4) & 0x01;
        var tilt_off_on    = (data1 >> 3) & 0x01;
        var tilt_up_down   = (data1 >> 2) & 0x01;
        var pan_off_on     = (data1 >> 1) & 0x01;
        var pan_left_right = (data1 >> 0) & 0x01;

        var iris_sense_peak = (data2 >> 7) & 0x01;
        var iris_control    = (data2 >> 4) & 0x07;
        var iris_slow_fast  = (data2 >> 3) & 0x01;
        var focus_slow_fast = (data2 >> 2) & 0x01;
        var zoom_slow_fast  = (data2 >> 1) & 0x01;
        var autopan_off_on  = (data2 >> 0) & 0x01;

        var pan_tilt_scale_off_on = (data3 >> 7) & 0x01;
        var wiper_off_on  = (data3 >> 6) & 0x01;
        var washer_off_on = (data3 >> 5) & 0x01;
        var lamp_control  = (data3 >> 3) & 0x03; // 2 bit value
        var aux_3_off_on  = (data3 >> 2) & 0x01;
        var aux_2_off_on  = (data3 >> 1) & 0x01;
        var aux_1_off_on  = (data3 >> 0) & 0x01;

        if (pan_off_on === 0) {
            msg_string += '[pan stop     ]';
        } else if (pan_off_on === 1 && pan_left_right === 0) {
            msg_string += '[PAN LEFT ('+pan_speed+')]';
        } else if (pan_off_on === 1 && pan_left_right === 1) {
            msg_string += '[PAN RIGHT('+pan_speed+')]';
        } else {
            msg_string += '[PAN ???? ('+pan_speed+')]';
        }

        if (tilt_off_on === 0) {
            msg_string += '[tilt stop    ]';
        } else if (tilt_off_on === 1 && tilt_up_down === 0) {
            msg_string += '[TILT UP  ('+tilt_speed+')]';
        } else if (tilt_off_on === 1 && tilt_up_down === 1) {
            msg_string += '[TILT DOWN('+tilt_speed+')]';
        } else {
            msg_string += '[TILT ????('+tilt_speed+')]';
        }

        if (zoom_off_on === 0) {
            msg_string += '[zoom stop]';
        } else if (zoom_off_on === 1 && zoom_tele_wide === 0) {
            msg_string += '[ZOOM IN ('+zoom_slow_fast+')]';
        } else if (zoom_off_on === 1 && zoom_tele_wide === 1) {
            msg_string += '[ZOOM OUT('+zoom_slow_fast+')]';
        } else {
            msg_string += '[ZOOM ???]';
        }

        if (iris_control === 0) {
            msg_string += '[iris stop]';
        } else if (iris_control === 1) {
            msg_string += '[IRIS CLOSE]';
        } else if (iris_control === 2) {
            msg_string += '[IRIS OPEN]';
        } else if (iris_control === 3) {
            msg_string += '[IRIS AUTO]';
        } else {
            msg_string += '[IRIS ????]';
        }

        if (focus_off_on === 0) {
            msg_string += '[focus stop]';
        } else if (focus_off_on === 1 && focus_near_far === 0) {
            msg_string += '[FOCUS NEAR]';
        } else if (focus_off_on === 1 && focus_near_far === 1) {
            msg_string += '[FOCUS FAR ]';
        } else {
            msg_string += '[FOCUS ????]';
        }

	msg_string += ' Aux1='+aux_1_off_on;
	msg_string += ' Aux2='+aux_2_off_on;
	msg_string += ' Aux3='+aux_3_off_on;
	msg_string += ' Wipe='+wiper_off_on;
	msg_string += ' Wash='+washer_off_on;
	msg_string += ' Lamp='+lamp_control;
        
    }
    else if (control_code_char === 'L') {
        var preset = this.fv_hex_ascii(fv_command_buffer[7], fv_command_buffer[8]);
	
	msg_string += 'Goto Preset ' + preset;
    }
    else if (control_code_char === 'M') {
        var preset = this.fv_hex_ascii(fv_command_buffer[7], fv_command_buffer[8]);
	
	msg_string += 'Store Preset ' + preset;
    }
    else {
        msg_string += 'Unknown Command Code ' + control_code_char;
    }


    console.log(this.bytes_to_string(fv_command_buffer,fv_command_length) + ' ' + msg_string);
};


PelcoD_Decoder.prototype.decode_vicon = function(vicon_command_buffer,vicon_command_length) {

    // Does not appear to be any checksum
    // Byte 1. MSB set to 1.

        var msg_string ='';

        msg_string += 'Vicon ';

        var camera_id = ((vicon_command_buffer[0] & 0x0F)*16) + (vicon_command_buffer[1] & 0x0F);

        var left  = (vicon_command_buffer[2] >> 6) & 0x01;  // 0x40
        var right = (vicon_command_buffer[2] >> 5) & 0x01;  // 0x20
        var up    = (vicon_command_buffer[2] >> 4) & 0x01;  // 0x10
        var down  = (vicon_command_buffer[2] >> 3) & 0x01;  // 0x08
        var auto_pan = (vicon_command_buffer[2] >> 2) & 0x01;  // 0x04

        var zoom_out   = (vicon_command_buffer[3] >> 6) & 0x01;  // 0x40
        var zoom_in    = (vicon_command_buffer[3] >> 5) & 0x01;  // 0x20
        var focus_far  = (vicon_command_buffer[3] >> 4) & 0x01;  // 0x10
        var focus_near = (vicon_command_buffer[3] >> 3) & 0x01;  // 0x08
        var iris_open  = (vicon_command_buffer[3] >> 2) & 0x01;  // 0x04
        var iris_close = (vicon_command_buffer[3] >> 1) & 0x01;  // 0x02

        var goto_preset = (vicon_command_buffer[6] === 0x10 ? 1 : 0); // >> 4) & 0x01;  // 0x10
        var preset_value = (vicon_command_buffer[7]);

        var pan_speed = (vicon_command_buffer[6] << 7) | (vicon_command_buffer[7]);
        var tilt_speed = (vicon_command_buffer[8] << 7) | (vicon_command_buffer[9]);

        msg_string += 'Camera ' + camera_id + ' ';

        if (left === 0 && right === 0) {
            msg_string += '[pan stop     ]';
        } else if (left === 1 && right === 0) {
            msg_string += '[PAN LEFT ('+pan_speed+')]';
        } else if (left === 0 && right === 1) {
            msg_string += '[PAN RIGHT('+pan_speed+')]';
        } else { // left === 1 && right === 1)
            msg_string += '[PAN ???? ('+pan_speed+')]';
        }

        if (up === 0 && down === 0) {
            msg_string += '[tilt stop    ]';
        } else if (up === 1 && down === 0) {
            msg_string += '[TILT UP  ('+tilt_speed+')]';
        } else if (up === 0 && down === 1) {
            msg_string += '[TILT DOWN('+tilt_speed+')]';
        } else { // (up === 1 && down === 1)
            msg_string += '[TILT ????('+tilt_speed+')]';
        }

        if (zoom_in === 0 && zoom_out === 0) {
            msg_string += '[zoom stop]';
        } else if (zoom_in === 1 && zoom_out === 0) {
            msg_string += '[ZOOM IN]';
        } else if (zoom_in === 0 && zoom_out === 1) {
            msg_string += '[ZOOM OUT]';
        } else { // (zoom_in === 1 && zoom_out === 1)
            msg_string += '[ZOOM ???]';
        }

        if (iris_open === 0 && iris_close === 0) {
            msg_string += '[iris stop ]';
        } else if (iris_open === 1 && iris_close === 0) {
            msg_string += '[IRIS OPEN ]';
        } else if (iris_open === 0 && iris_close === 1) {
            msg_string += '[IRIS CLOSE]';
        } else { // (iris_open === 1 && iris_close === 1)
            msg_string += '[IRIS ???? ]';
        }

        if (focus_near === 0 && focus_far === 0) {
            msg_string += '[focus stop]';
        } else if (focus_near === 1 && focus_far === 0) {
            msg_string += '[FOCUS NEAR]';
        } else if (focus_near === 0 && focus_far === 1) {
            msg_string += '[FOCUS FAR ]';
        } else { // (focus_near === 1 && focus_far === 1)
            msg_string += '[FOCUS ????]';
        }

        if (auto_pan === 1) {
            msg_string += '[AutoPan]';
	}

        if (goto_preset === 1) {
            msg_string += '[Goto Preset '+ preset_value + ']';
	}

        console.log(this.bytes_to_string(vicon_command_buffer,vicon_command_length) + ' ' + msg_string);
};



PelcoD_Decoder.prototype.bytes_to_string = function(buffer, length) {
    var byte_string = '';
    for (var i = 0; i < length; i++) {
        byte_string += '[' + this.DecToHexPad(buffer[i],2) + ']';
    }
    return byte_string;
};

PelcoD_Decoder.prototype.DecToHexPad = function(decimal,size) {
    var ret_string = decimal.toString('16');
    while (ret_string.length < size) {
        ret_string = '0' + ret_string;
    }
    return ret_string;
};

module.exports = PelcoD_Decoder;
