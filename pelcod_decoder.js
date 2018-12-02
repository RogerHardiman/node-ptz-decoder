/*
 * Read and decode Pelco D, Pelco P, BBV422, Bosch/Philips, Forward Vision, Vicon, American Dynamics/Sensormatic, VCL and JVC CCTV PTZ commands
 * This code is not designed to decode every command.
 * The purpose is to monitor the output from various CCTV systems to confirm the protocols and camera addresses in use.
 * The meanings of certain Aux signals and special Preset values is not shown
 * 
 * (c) Copyright 2016-2018 Roger Hardiman
 *
 * Processes NodeJS Buffer() data.
 * Buffer() objects may have multiple PTZ messages or just part of a message so bytes are cached if needed.
 *
 */

var EventEmitter = require('events');

class PelcoD_Decoder extends EventEmitter {
  constructor() {
    super();

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

    // A Buffer used for VCL (variable length message)
    this.vcl_command_buffer = new Buffer(128);

    // Number of bytes in the current Buffer
    this.vcl_command_index = 0;

    // A Buffer used for American Dynamics/Sensormatic (variable length message)
    this.ad_command_buffer = new Buffer(128);

    // Number of bytes in the current Buffer
    this.ad_command_index = 0;

    // A Buffer used for Panasonic (variable length message)
    this.panasonic_command_buffer = new Buffer(128);

    // Number of bytes in the current Buffer
    this.panasonic_command_index = 0;

    // A Buffer used for Visca (variable length message)
    this.visca_command_buffer = new Buffer(128);

    // Number of bytes in the current Buffer
    this.visca_command_index = 0;

    // A Buffer used for JVC (variable length message)
    this.jvc_command_buffer = new Buffer(128);

    // Number of bytes in the current Buffer
    this.jvc_command_index = 0;
}

// Get the ascii value of a character. Even 'A' is a String in javascript so cannot
// simply match 'A' with 65 without a helper function
ascii(str) {
    return str.charCodeAt(0);
}



// new_data_buffer can be a NodeJS Buffer or a Javascript array
// as the only methods called are .length and the array index '[]' operator
processBuffer(new_data_buffer) {

    // this.emit("log",'received ' + this.bytes_to_string(new_data_buffer,new_data_buffer.length) );

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


        // VCL. First byte is 0x80 to 0xFF and is the camera number.
	// Rest of the command is either 2 bytes or 3 bytes
        // Byte 2 and Byte 3 are 0x00 to 0x7F
        // There is no 'End Byte' so need to process each byte as it arrives
        {
            this.decode_vcl(new_byte);
        }


        // Add to American Dynamics byte buffer accumulating bytes
        // AD422 is minimum of 3 bytes.
        // It starts with an address (1..99 [0x01..0x63] where 64[0x40] is for broadcast) followed by a command (0x81 to 0xFA)
        // and then either the Checksum OR a variable length payload and Checksum
        // Ensure first 2 bytes meet the range criteria
        if (this.ad_command_index == 0 && new_byte>=0x01 && new_byte <=0x63) {
            // Add the new_byte to the end of the ad_command_buffer
            this.ad_command_buffer[this.ad_command_index] = new_byte;
            this.ad_command_index++;
        }
        else if (this.ad_command_index == 1 && new_byte >= 0x81 && new_byte <= 0xFA) {
            // Add the new_byte to the end of the ad_command_buffer
            this.ad_command_buffer[this.ad_command_index] = new_byte;
            this.ad_command_index++;
        }
        else if (this.ad_command_index == 2) {
            // Add the new_byte to the end of the ad_command_buffer
            this.ad_command_buffer[this.ad_command_index] = new_byte;
            this.ad_command_index++;
        }
        else if (this.ad_command_index > 2 && this.ad_command_index < this.ad_message_length(this.ad_command_buffer[1],this.ad_command_buffer[2])) {
            // Add the new_byte to the end of the ad_command_buffer
            this.ad_command_buffer[this.ad_command_index] = new_byte;
            this.ad_command_index++;
        } else {
            // We have not met the critera. Reset the buffer
            this.ad_command_index = 0;
        }

        // Add to Panasonic byte buffer accumulating bytes
        // It starts with 0x02 (STX) and ends with 0x03 (ETX)
        // The rest of the data bytes are ASCII characters 0..9 and A..Z
        // and also : and ; which are used to split parts of the command
        // and a length byte that is is 7,F,N,V,^[0x5e],f,n,v,~[0x7e] and '('[0x28]
        if (new_byte == 0x02) {
            // Always starts with 0x02 (STX)
            this.panasonic_command_index = 0;
        }
        var valid_byte = false;
        if (new_byte == 0x02 || new_byte == 0x03) valid_byte = true;
        if (new_byte >= this.ascii('0') && new_byte <= this.ascii('9')) valid_byte = true;
        if (new_byte >= this.ascii('A') && new_byte <= this.ascii('Z')) valid_byte = true;
        if (new_byte == this.ascii(':') || new_byte == this.ascii(';')) valid_byte = true;
        if (new_byte == this.ascii('7') || new_byte == this.ascii('F')
           || new_byte == this.ascii('N') || new_byte == this.ascii('V')
           || new_byte == 0x5E || new_byte == this.ascii('f')
           || new_byte == this.ascii('n') || new_byte == this.ascii('v')
           || new_byte == 0x7E || new_byte == 0x28) valid_byte = true;
        if (valid_byte == false) {
            // not panasonic data. Reset the buffer
            this.panasonic_command_index = 0;
        }

        if (this.panasonic_command_index < this.panasonic_command_buffer.length
             && valid_byte == true ) {
            // Add the new_byte to the end of the panasonic_command_buffer
            this.panasonic_command_buffer[this.panasonic_command_index] = new_byte;
            this.panasonic_command_index++;
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
        if ((bosch_len > 1)
                                             && (this.bosch_command_buffer[0] & 0x80)
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


        // Vicon. 10 bytes where Byte 1 upper nibble is 1000
	// and Byte 2 has bit 6 set (meaning extended command)
        if (((this.vicon_command_buffer[0] & 0xF0) === 0x80)
                                             && (this.vicon_command_buffer[1] & 0x40)
                                             && (this.vicon_command_index == 10 )) {
            // Looks like we have a Vicon command. Try and process it
            this.decode_vicon(this.vicon_command_buffer, this.vicon_command_index);
            this.vicon_command_index = 0; // empty the buffer
        }


        // American Dynamics AD422 / Sensormatic
        // First Byte = Address 0x01 to 0x63
        // Second Byte = Command 0x81 to 0xFA
        // Third Byte = Checksum OR a Payload and Checksum
        // Then a variable length payload (zero, 1, 2 or more bytes)
        // This code does not handle the 0xDE SET TEXT command as the payload size is in the 5th byte
        if ((this.ad_command_buffer[0] >= 0x01 && this.ad_command_buffer[0] <= 0x63)
                                             && (this.ad_command_buffer[1] >= 0x81 && this.ad_command_buffer[1] <= 0xFA)
                                             && (this.ad_command_index == this.ad_message_length(this.ad_command_buffer[1],this.ad_command_buffer[2]))
                                             && (this.checksum_ad_valid(this.ad_command_buffer, this.ad_command_index))) {
            // Looks like we have an American Dynamics AD422 / Sensormatic command. Try and process it
            this.decode_ad422(this.ad_command_buffer);
            this.ad_command_index = 0; // empty the buffer
        }

	// Panasonic is STX (0x02) then payload and then ETX (0x03)
        // The Payload is at least 11 bytes eg GC7:9034002 so the shortest message is 13 bytes
        if ((this.panasonic_command_buffer[0] == 0x02)
              && (this.panasonic_command_buffer[this.panasonic_command_index - 1] == 0x03)
              && (this.panasonic_command_index >= 13)) {
            // Looks like we have a Panasonic command. Try and process it
            this.decode_panasonic(this.panasonic_command_buffer, this.panasonic_command_index);
            this.panasonic_command_index = 0; // empty the buffer
        }

        // Collect VISCA data
        // Starts with MSBit = 1
        // Ends with 0xFF
        if ((new_byte & 0x80) && (new_byte != 0xFF)) {
            // MSB is set to 1. This marks the start of a the command so reset buffer counter
            this.visca_command_buffer[0] = new_byte;
            this.visca_command_index = 1;
        } else if (this.visca_command_index < this.visca_command_buffer.length) {
            // Add the new_byte to the end of the command_buffer
            this.visca_command_buffer[this.visca_command_index] = new_byte;
            this.visca_command_index++;
        }

        // Check for valid command
        if ((this.visca_command_index >= 3) // at least 3 bytes
           &&(this.visca_command_buffer[0] & 0x80) // first byte has MSB set to 1
           &&(this.visca_command_buffer[this.visca_command_index - 1] == 0xFF) // last byte is 0xFF
        ){
            // Looks like a VISCA command. Process it
            this.decode_visca(this.visca_command_buffer,this.visca_command_index);
            this.visca_command_index = 0;
        }

        // Collect JVC data
        // Starts with 0xB1
        // Either 6 or 7 bytes. Length is in 4th byte, lower nibble
        if (new_byte == 0xB1) {
            // This marks the start of a the command so reset buffer counter
            this.jvc_command_buffer[0] = new_byte;
            this.jvc_command_index = 1;
        } else if (this.jvc_command_index < this.jvc_command_buffer.length) {
            // Add the new_byte to the end of the command_buffer
            this.jvc_command_buffer[this.jvc_command_index] = new_byte;
            this.jvc_command_index++;
        }

        // Check for valid command
        if (((this.jvc_command_index == 6)    // 6 bytes commands have 0x82 in 4th byte
           &&((this.jvc_command_buffer[3] & 0x0F) == 2)) // 4th byte, 0x82
           ||((this.jvc_command_index == 7)   // 7 byte commands have 0x83 in 4th byte
           &&((this.jvc_command_buffer[3] & 0x0F) == 3)) // 4th byte, 0x83
        ){
            // Looks like a JVC command. Process it
            this.decode_jvc(this.jvc_command_buffer,this.jvc_command_index);
            this.jvc_command_index = 0;
        }


    }
};

checksum_valid(buffer) {
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

checksum_p_valid(buffer) {
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

checksum_bosch_valid(buffer,message_length) {
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

checksum_fv_valid(buffer,message_length) {
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


checksum_ad_valid(buffer,message_length) {
    var total = 0;
    for (var x = 0; x < (message_length - 1); x++) {
        total += buffer[x];
    }
    var computed_checksum = (0 - total) & 0xFF;
    // Check if computed_checksum matches the last byte in the buffer
    if (computed_checksum === buffer[message_length - 1]) {
        return true;
    } else {
        return false;
    }
};



decode(pelco_command_buffer) {

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
        } else if (command_2 === 0x27 && command_1 === 0x00 && data_1 === 0x00) {
            msg_string += '[SET FOCUS SPEED ' + data_2 + ']';
        } else if (command_2 === 0x2B && command_1 === 0x00 && data_1 === 0x00 && data_2 == 0x00) {
            msg_string += '[AUTO FOCUS SET TO AUTOMATIC]';
        } else if (command_2 === 0x2B && command_1 === 0x00 && data_1 === 0x00 && data_2 != 0x00) {
            // 2012 spec says 0 = Automatic Operation. 1 = Auto Focus Off
            // 1999 spec says range 0..2  Automatic,On,Off
            msg_string += '[AUTO FOCUS SETTING ' + data_2 + ']';
        } else if (command_2 === 0x2D && command_1 === 0x00 && data_1 === 0x00 && data_2 == 0x00) {
            msg_string += '[AUTO IRIS SET TO AUTOMATIC]';
        } else if (command_2 === 0x2D && command_1 === 0x00 && data_1 === 0x00 && data_2 != 0x00) {
            // 2012 spec says 0 = Automatic Operation. 1 = Auto Iris Off
            // 1999 spec says range 0..2  Automatic,On,Off
            msg_string += '[AUTO IRIS SETTING ' + data_2 + ']';
        } else if (command_2 === 0x31 && command_1 === 0x00 && data_1 === 0x00 && data_2 == 0x00) {
	    // 2012 spec says Prior to Spectra IV, data_2 is 1=OFF, 2=ON
            // 2012 spec says but Spectra IV the data_2 is 0=OFF, NON-ZERO=ON
            msg_string += '[BACKLIGHT COMPENSATION ' + data_2 + '] SPECTRA IV MODE = OFF';
        } else if (command_2 === 0x31 && command_1 === 0x00 && data_1 === 0x00 && data_2 == 0x01) {
            msg_string += '[BACKLIGHT COMPENSATION ' + data_2 + '] GENERIC MODE = ON / SPECTRA IV MODE = ON';
        } else if (command_2 === 0x31 && command_1 === 0x00 && data_1 === 0x00 && data_2 == 0x02) {
            msg_string += '[BACKLIGHT COMPENSATION ' + data_2 + '] GENERIC MODE = OFF / SPECTRA IV MODE = ON';
        } else if (command_2 === 0x31 && command_1 === 0x00 && data_1 === 0x00 && data_2 >= 0x02) {
            msg_string += '[BACKLIGHT COMPENSATION ' + data_2 + '] SPECTRA IV MODE = ON';
        } else {
            msg_string += 'Unknown extended command 0x' + this.DecToHexPad(command_2, 2);
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
    this.emit("log",this.bytes_to_string(pelco_command_buffer, pelco_command_buffer.length) + ' ' + msg_string);
};

decode_bosch(bosch_command_buffer) {

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
            msg_string += '[pan stop ('+pan_speed+')]';
        } else if (left === 1 && right === 0) {
            msg_string += '[PAN LEFT ('+pan_speed+')]';
        } else if (left === 0 && right === 1) {
            msg_string += '[PAN RIGHT('+pan_speed+')]';
        } else { // left === 1 && right === 1)
            msg_string += '[PAN ???? ('+pan_speed+')]';
        }

        if (up === 0 && down === 0) {
            msg_string += '[tilt stop('+tilt_speed+')]';
        } else if (up === 1 && down === 0) {
            msg_string += '[TILT UP  ('+tilt_speed+')]';
        } else if (up === 0 && down === 1) {
            msg_string += '[TILT DOWN('+tilt_speed+')]';
        } else { // (up === 1 && down === 1)
            msg_string += '[TILT ????('+tilt_speed+')]';
        }

        if (zoom_in === 0 && zoom_out === 0) {
            msg_string += '[zoom stop('+zoom_speed+')]';
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

    this.emit("log",this.bytes_to_string(bosch_command_buffer,length+1) + ' ' + msg_string);
};

fv_hex_ascii(byte_1,byte_2) {
  // Byte 1 could be 0x31  = ASCII "1"
  // Byte 2 could be 0x46 = ASCII "F"
  // Convert Byte 1 and Byte 2 from 'bytes' into Chars, eg to "1" and "F"
  // Combine the chars to a Hex String eg "0x1F"
  // Convert the Hex String into an integer value

  var hex_string = '0x' + String.fromCharCode(byte_1,byte_2);
  var value = parseInt(hex_string);
  return value;
}


decode_forward_vision(fv_command_buffer,fv_command_length) {

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
	msg_string += ' PropZoom='+pan_tilt_scale_off_on;
        
    }
    else if (control_code_char === 'L') {
        var preset = this.fv_hex_ascii(fv_command_buffer[7], fv_command_buffer[8]);

        msg_string += 'Goto Preset ' + preset;
    }
    else if (control_code_char === 'M') {
        var preset = this.fv_hex_ascii(fv_command_buffer[7], fv_command_buffer[8]);

        msg_string += 'Store Preset ' + preset;
    }
    else if (control_code_char === 'O') {
        msg_string += 'Get Current Position';
    }
    else if (control_code_char === 'W') {
        var data1 = this.fv_hex_ascii(fv_command_buffer[7], fv_command_buffer[8]);
        msg_string += 'Reset Value=' + data1;
    }
    else if (control_code_char === 'Y') {
        msg_string += 'Get SW Version';
    }
    else {
        msg_string += 'Unknown Command Code ' + control_code_char;
    }


    this.emit("log",this.bytes_to_string(fv_command_buffer,fv_command_length) + ' ' + msg_string);
};


decode_vicon(vicon_command_buffer,vicon_command_length) {

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

        this.emit("log",this.bytes_to_string(vicon_command_buffer,vicon_command_length) + ' ' + msg_string);
};





// Returns the length of a command (as this protocol uses variable length messages)
ad_message_length(command,byte3) { // ,byte4,byte5) {
    if (command == 0xA6) return 13; // Goto Abs Position
    if (command == 0xC0) return 5; // Proportional Speed
    if (command == 0xC4) return 6; // Get Config
    if (command == 0xC7) return 5; // Set and Goto Preset
    if (command == 0xCC) return 4; // Various config commands
    if (command == 0xCD) return 5; // QuickSet
    if (command == 0xDE) return 0; // Variable Length ASCII message. 5th Byte tells us ASCII string length
    // Check for 0xFA 'get' command has bit 7 clear. Goes not use command length bits
    if (command == 0xFA && (byte3>>7 == 0)) return 4 + 1; // Variable Length Network Position Command. 4 bytes plus checsksum
    // Check for 0xFA 'set' command has bit 7 set. Obey command length bits
    if (command == 0xFA && (byte3>>7 == 1)) return (byte3 & 0x1F) + 1; // Variable Length Network Position Command plus checsksum
    return 3;  // all other commands are 3 bytes long (address, command, checksum)
};


decode_vcl(new_byte) {

    // VLC has no checksum or end byte so accumulate bytes until there is a command
    // Bytes between 0x80 and 0xFF start a command and are the camera number
    // Bytes between 0x00 and 0x7F are commands or additional data (eg speed)

    // Add the byte to the VCL buffer

    if (new_byte >= 0x80 && new_byte <= 0xFF) {
        // This marks the start of a VCL command reset buffer counter
        this.vcl_command_index = 0;
        this.vcl_command_buffer[this.vcl_command_index] = new_byte;
        this.vcl_command_index++;
    }
    else if (this.vcl_command_index > 0 && this.vcl_command_index < this.vcl_command_buffer.length) {
        // Add the new_byte to the end of the vcl_command_buffer
        this.vcl_command_buffer[this.vcl_command_index] = new_byte;
        this.vcl_command_index++;
    }

    // Check if we have at least 2 bytes
    if (this.vcl_command_index < 2) return;

    var msg_string ='';

    msg_string += 'VCL ';

    var camera_id = this.vcl_command_buffer[0] - 0x7F;
    msg_string += 'Camera ' + camera_id + ' ';


    var byte2 = this.vcl_command_buffer[1];

    var has_byte3 = false;
    var byte3 = 0
    if (this.vcl_command_index >= 3) {
        has_byte3 = true;
        byte3 = this.vcl_command_buffer[2];
    }

    if      (byte2 == 0x2A) msg_string += '[Zoom In Stop]';
    else if (byte2 == 0x2B) msg_string += '[Zoom Out Stop]';
    else if (byte2 == 0x2C) msg_string += '[Focus Near Stop]';
    else if (byte2 == 0x2D) msg_string += '[Focus Far Stop]';
    else if (byte2 == 0x2E) msg_string += '[Iris Open Stop]';
    else if (byte2 == 0x2F) msg_string += '[Iris Close Stop]';
    else if (byte2 == 0x3A) msg_string += '[Zoom In]';
    else if (byte2 == 0x3B) msg_string += '[Zoom Out]';
    else if (byte2 == 0x3C) msg_string += '[Focus Near]';
    else if (byte2 == 0x3D) msg_string += '[Focus Far]';
    else if (byte2 == 0x3E) msg_string += '[Iris Open]';
    else if (byte2 == 0x3F) msg_string += '[Iris Close]';
    else if (byte2 == 0x41) msg_string += '[Auto Focus]';
    else if (byte2 == 0x4D) msg_string += '[Auto Iris]';
    else if (byte2 == 0x5B) msg_string += '[Aux 1 On]';
    else if (byte2 == 0x5C) msg_string += '[Aux 2 On]';
    else if (byte2 == 0x5D) msg_string += '[Aux 3 On]';
    else if (byte2 == 0x61) msg_string += '[Manual Focus]';
    else if (byte2 == 0x6C) msg_string += '[Pan Stop 2 (6c)]';
    else if (byte2 == 0x6D) msg_string += '[Manual Iris]';
    else if (byte2 == 0x6E) msg_string += '[Tilt Stop 2 (6e)]';
    else if (byte2 == 0x70) msg_string += '[Stop Recording Pattern]';
    else if (byte2 == 0x72) msg_string += '[Pan Stop 1]';
    else if (byte2 == 0x75) msg_string += '[Tilt Stop 1]';
    else if (byte2 == 0x7B) msg_string += '[Aux 1 Off]';
    else if (byte2 == 0x7C) msg_string += '[Aux 2 Off]';
    else if (byte2 == 0x7D) msg_string += '[Aux 3 Off]';
    else if (byte2 == 0x42 && has_byte3) msg_string += '[Goto Preset ' + byte3 + ']';
    else if (byte2 == 0x47 && has_byte3) msg_string += '[Store Preset ' + byte3 + ']';
    else if (byte2 == 0x4E && has_byte3) msg_string += '[Tilt Down ' + byte3 + ']';
    else if (byte2 == 0x4C && has_byte3) msg_string += '[Pan Left ' + byte3 + ']';
    else if (byte2 == 0x50 && has_byte3) msg_string += '[Start Recording Pattern ' + byte3 + ']';
    else if (byte2 == 0x52 && has_byte3) msg_string += '[Pan Right ' + byte3 + ']';
    else if (byte2 == 0x55 && has_byte3) msg_string += '[Tilt Up ' + byte3 + ']';
    else if (byte2 == 0x5E && has_byte3) msg_string += '[Start Tour/Pattern ' + byte3 + ']';
    else {
        // invalid command (byte2 not in our list)
        // do nothing. We wait for a 0x80..0xFF value to arrive
        // TESTING.. this.emit("log",'unknown command 0x' + byte2.toString(16));
        return;
    }

    this.emit("log",this.bytes_to_string(this.vcl_command_buffer,this.vcl_command_length) + ' ' + msg_string);

    this.vcl_command_index = 0; // reset the buffer
};


// Returns the length of a command (as this protocol uses variable length messages)
ad_message_length(command,byte3) { // ,byte4,byte5) {
    if (command == 0xA6) return 13; // Goto Abs Position
    if (command == 0xC0) return 5; // Proportional Speed
    if (command == 0xC4) return 6; // Get Config
    if (command == 0xC7) return 5; // Set and Goto Preset
    if (command == 0xCC) return 4; // Various config commands
    if (command == 0xCD) return 5; // QuickSet
    if (command == 0xDE) return 0; // Variable Length ASCII message. 5th Byte tells us ASCII string length
    // Check for 0xFA 'get' command has bit 7 clear. Goes not use command length bits
    if (command == 0xFA && (byte3>>7 == 0)) return 4 + 1; // Variable Length Network Position Command. 4 bytes plus checsksum
    // Check for 0xFA 'set' command has bit 7 set. Obey command length bits
    if (command == 0xFA && (byte3>>7 == 1)) return (byte3 & 0x1F) + 1; // Variable Length Network Position Command plus checsksum
    return 3;  // all other commands are 3 bytes long (address, command, checksum)
};

decode_ad422(ad_command_buffer) {

    var msg_string ='';

    msg_string += 'AD/Sens ';

    var camera_id = ad_command_buffer[0];
    var command_code = ad_command_buffer[1];
    var length = this.ad_message_length(ad_command_buffer[1],ad_command_buffer[2]);

    msg_string += 'Camera ' + camera_id + ' ';
    
    if (command_code == 0x81) {
        msg_string += 'Pan Left';
    }
    else if (command_code == 0x82) {
        msg_string += 'Pan Right';
    }
    else if (command_code == 0x83) {
        msg_string += 'Pan Stop';
    }
    else if (command_code == 0x84) {
        msg_string += 'Tilt Up';
    }
    else if (command_code == 0x85) {
        msg_string += 'Tilt Down';
    }
    else if (command_code == 0x86) {
        msg_string += 'Tilt Stop';
    }
    else if (command_code == 0x87) {
        msg_string += 'Focus Near';
    }
    else if (command_code == 0x88) {
        msg_string += 'Focus Far';
    }
    else if (command_code == 0x89) {
        msg_string += 'Focus Stop';
    }
    else if (command_code == 0x8A) {
        msg_string += 'Zoom In';
    }
    else if (command_code == 0x8B) {
        msg_string += 'Zoom Out';
    }
    else if (command_code == 0x8C) {
        msg_string += 'Zoom Stop';
    }
    else if (command_code == 0x90) {
        msg_string += 'Iris Open';
    }
    else if (command_code == 0x91) {
        msg_string += 'Iris Close';
    }
    else if (command_code == 0x92) {
        msg_string += 'Iris Stop';
    }
    else if (command_code == 0x93) {
        msg_string += 'All Stop';
    }
    else if (command_code == 0x98) {
        msg_string += 'Suspend replies from camera';
    }
    else if (command_code == 0x99) {
        msg_string += 'Resume replies from camera';
    }
    else if (command_code == 0xA5) {
        msg_string += 'Request Position';
    }
    else if (command_code == 0xA8) {
        msg_string += 'Store Target 1';
    }
    else if (command_code == 0xA9) {
        msg_string += 'Store Target 2';
    }
    else if (command_code == 0xAA) {
        msg_string += 'Store Target 3';
    }
    else if (command_code == 0xAB) {
        msg_string += 'Store Target 4';
    }
    else if (command_code == 0xB4) {
        msg_string += 'Goto Target 1';
    }
    else if (command_code == 0xB5) {
        msg_string += 'Goto Target 2';
    }
    else if (command_code == 0xB6) {
        msg_string += 'Goto Target 3';
    }
    else if (command_code == 0xB7) {
        msg_string += 'Goto Target 4';
    }
    else if (command_code == 0xB9) {
        msg_string += 'Store Target 5';
    }
    else if (command_code == 0xBA) {
        msg_string += 'Store Target 6';
    }
    else if (command_code == 0xBB) {
        msg_string += 'Store Target 7';
    }
    else if (command_code == 0xBC) {
        msg_string += 'Goto Target 5';
    }
    else if (command_code == 0xBD) {
        msg_string += 'Goto Target 6';
    }
    else if (command_code == 0xBE) {
        msg_string += 'Goto Target 7';
    }
    else if (command_code == 0xC0) {
        var direction = ad_command_buffer[2];
        var speed = ad_command_buffer[3];
        if (direction == 0x81) msg_string += 'Pan Left (' + speed + ')';
        else if (direction == 0x82) msg_string += 'Pan Right (' + speed + ')';
        else if (direction == 0x84) msg_string += 'Tilt Up (' + speed + ')';
        else if (direction == 0x85) msg_string += 'Tilt Down (' + speed + ')';
    }
    else if (command_code == 0xC4) {
        msg_string += 'Get Configuration Buffer';
    }
    else if (command_code == 0xCC) {
        var additional_command = ad_command_buffer[2];
        if (additional_command == 0x08) msg_string += 'Auto Focus Auto Iris';
    }
    else if (command_code == 0xC7) {
        var additional_command = ad_command_buffer[2];
        var preset = ad_command_buffer[3];
        if (additional_command == 0x01) msg_string += 'Set Preset ' + preset;
        if (additional_command == 0x02) msg_string += 'Goto Preset ' + preset;
    }
    else if (command_code >= 0xE0 && command_code <= 0xEF) {
        msg_string += 'Controlling Output Pins 0x' + this.DecToHexPad(command_code & 0x0F,1)
    }
    else if (command_code == 0xFA) {
        var cmd_bit7 = (ad_command_buffer[2] >> 7) & 0x01; // get/set
        var cmd_bit5 = (ad_command_buffer[2] >> 5) & 0x01; // abs/rel
        var units_bit6 = (ad_command_buffer[3] >> 6) & 0x01; // auto focus
        var units_bit7 = (ad_command_buffer[3] >> 7) & 0x01; // auto iris
        if (cmd_bit7 == 0 && cmd_bit5 == 0) {
            msg_string += 'Get Absolute Position';
        }
        if (cmd_bit7 == 0 && cmd_bit5 == 1) {
            msg_string += 'Get Relative Position';
        }
        if (cmd_bit7 == 1 && cmd_bit5 == 0) {
            msg_string += 'Set Absolute Position';
        }
        if (cmd_bit7 == 1 && cmd_bit5 == 1) {
            msg_string += 'Set Relative Position';
        }
        if (cmd_bit7 == 1 && units_bit6 == 0) {
            msg_string += ' AutoFocus=Off';
        }
        if (cmd_bit7 == 1 && units_bit6 == 1) {
            msg_string += ' AutoFocus=On';
        }
        if (cmd_bit7 == 1 && units_bit7 == 0) {
            msg_string += ' AutoIris=Off';
        }
        if (cmd_bit7 == 1 && units_bit7 == 1) {
            msg_string += ' AutoIris=On';
        }
    }
    else {
        msg_string += 'Unknown Command Code 0x' + this.DecToHexPad(command_code,2);
command_code;
    }

    this.emit("log",this.bytes_to_string(ad_command_buffer,length) + ' ' + msg_string);

    return;
};

decode_panasonic(buffer,length) {

    var msg_string = "";

    msg_string += "Panasonic ";

    var command = '';
    for (var i = 1; i < length -1; i++) {
        command += String.fromCharCode(buffer[i]);
    }
    msg_string += command;
    msg_string += ' ';

    var commands = command.split(/[;:]/); // split regex on : or ;

    var cmd_index = 0;
    for (cmd_index = 0; cmd_index < commands.length; cmd_index++) {
      if (commands[cmd_index] == '0021002') { msg_string += '[Iris Open With Timeout]';}
      if (commands[cmd_index] == '0021003') { msg_string += '[Iris Close With Timeout]';}
      if (commands[cmd_index] == '0021004') { msg_string += '[Iris Stop]';}
      if (commands[cmd_index] == '0021005') { msg_string += '[Iris Reset]';}
      if (commands[cmd_index] == '0021040') { msg_string += '[B/W On]';}
      if (commands[cmd_index] == '0021041') { msg_string += '[B/W Off]';}

      if (commands[cmd_index] == '00219F0') { 
         cmd_index++; // add extra increment as we are processing 2 commands
         var txt_str = commands[cmd_index];
         var value = parseInt('0x' + txt_str.substring(4,6));
         if (txt_str >= '0022000' && txt_str <= '00223F0') msg_string += '[Call Preset ' + (value+1) + ']';
         if (txt_str >= '0022640' && txt_str <= '0022A30') msg_string += '[Set Preset ' + ((value-0x64)+1)+ ']';
      }
  
      if (commands[cmd_index] == '2021160') { msg_string += '[Aux 1 On]';}
      if (commands[cmd_index] == '2021161') { msg_string += '[Aux 1 Off]';}
      if (commands[cmd_index] == '2021224') { msg_string += '[Zoom Stop & Focus Stop With Timeout]';}
  
      if (commands[cmd_index] == '2021228') { msg_string += '[Zoom In With Timeout]';}
      if (commands[cmd_index] == '202122C') { msg_string += '[Zoom Out With Timeout]';}
      if (commands[cmd_index] == '202126A') { msg_string += '[Focus Far With Timeout]';}
      if (commands[cmd_index] == '202126E') { msg_string += '[Focus Near With Timeout]';}

      if (commands[cmd_index].startsWith('90310')) { 
        var preset_number = parseInt('0x' + commands[cmd_index].substring(5,7));
        msg_string += '[Call Preset ' + preset_number + ']';
      }
      if (commands[cmd_index].startsWith('90311')) {
        var preset_number = parseInt('0x' + commands[cmd_index].substring(5,7));
        msg_string += '[Set Preset ' + preset_number + ']';
      }

      if (commands[cmd_index].startsWith("AD")) { msg_string += '[Cam NN]';}
      if (commands[cmd_index].startsWith("D")) {
        var zoom_char = commands[cmd_index].charAt(1);
        var pt_dir_char = commands[cmd_index].charAt(2);
        var pan_speed_str = commands[cmd_index].substring(3,5);
        var tilt_speed_str = commands[cmd_index].substring(5,7);
        var zoom_byte = parseInt(zoom_char,16); // Hex to Dec
        var pt_direction_byte = parseInt(pt_dir_char,16); // Hex to Dec
        var pan_speed = parseInt(pan_speed_str,16); // Hex to Dec
        var tilt_speed = parseInt(tilt_speed_str,16); // Hex to Dec

	if (pt_direction_byte == 1) msg_string += '[Pan Stop][Tilt Stop]';
	else if (pt_direction_byte == 8) msg_string += '[Pan Left (' + pan_speed + ')]';
	else if (pt_direction_byte == 9) msg_string += '[Pan Left (' + pan_speed + ')]' + 'Tilt Up (' + tilt_speed + ')]';
	else if (pt_direction_byte == 12) msg_string += '[Pan Right (' + pan_speed + ')]';
	else if (pt_direction_byte == 10) msg_string += '[Tilt Up (' + tilt_speed + ')]';
	else if (pt_direction_byte == 11) msg_string += '[Pan Right (' + pan_speed + ')]' + 'Tilt Up (' + tilt_speed + ')]';
	else if (pt_direction_byte == 13) msg_string += '[Pan Right (' + pan_speed + ')]' + 'Tilt Down (' + tilt_speed + ')]';
	else if (pt_direction_byte == 14) msg_string += '[Tilt Down (' + tilt_speed + ')]';
	else if (pt_direction_byte == 15) msg_string += '[Pan Left (' + pan_speed + ')]' + 'Tilt Down (' + tilt_speed + ')]';
        else msg_string += '[Other Pan/Tilt/Zoom command]';

        msg_string += '[Zoom byte is ' + zoom_byte + ']';
      }

    }

    this.emit("log",msg_string);
    return;
};

decode_visca(buffer,length) {

    var msg_string = "";

    msg_string += "VISCA ";

    // Get Sender and Receiver (or Broadcast) address details
    var sender_id = (buffer[0] >> 4) & 0x07;
    var broadcast_bit = (buffer[0] >> 3) & 0x01;
    var receiver_id = (buffer[0]) & 0x07;

    if (buffer[0] == 0x88) msg_string += 'From ' + sender_id + ' To All ';
    else if (broadcast_bit == 0) msg_string += 'From ' + sender_id + ' To ' + receiver_id + ' ';
    else {
      // does not look like a VISCA command. broatcast bit is '1' but byte is not 0x88
      return;
    }

    // buffer[1] is 0x01 for Command messages
    //              0x09 for Inquiry messages
    //              0x2x for Cancel messages
    //              0x30 for Broadcast messages
    //              0x4x for reply ACK messages
    //              0x5x for reply Completion Command messages
    //              0x6x for reply Error messages
    var process = false;
    if (buffer[1] == 0x01) process=true;
    if (buffer[1] == 0x09) process=true;
    if ((buffer[1]&0xF0) == 0x20) process=true;
    if (buffer[1] == 0x30) process=true;
    if ((buffer[1]&0xF0) == 0x40) process=true;
    if ((buffer[1]&0xF0) == 0x50) process=true;
    if ((buffer[1]&0xF0) == 0x60) process=true;

    if (process==false) return;


    if (length == 9 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x01) {
        // Pan/Tilt command
        var pan_speed = buffer[4];
        var tilt_speed = buffer[5];
        var pan_direction = buffer[6];
        var tilt_direction = buffer[7];

        if (pan_direction == 0x01) msg_string += '[Pan Left(' + pan_speed + ')]';
        else if (pan_direction == 0x02) msg_string += '[Pan Right(' + pan_speed + ')]';
        else if (pan_direction == 0x03) msg_string += '[Pan Stop]';
        else msg_string += '[Pan ????]';

        if (tilt_direction == 0x01) msg_string += '[Tilt Up(' + tilt_speed + ')]';
        else if (tilt_direction == 0x02) msg_string += '[Tilt Down(' + tilt_speed + ')]';
        else if (tilt_direction == 0x03) msg_string += '[Tilt Stop]';
        else msg_string += '[Tilt ????]';
    } else if (length == 15 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x02) {
        // Pan/Tilt command (15 byte version. There is a 16 byte version too)
        var pan_speed = buffer[4];
        var tilt_speed = buffer[5];
        var pan_pos = ( ((buffer[6]&0x0F) << 24)
                      + ((buffer[7]&0x0F) << 16)
                      + ((buffer[8]&0x0F) << 8)
                      + ((buffer[9]&0x0F) << 0) );
        var tilt_pos = ( ((buffer[10]&0x0F) << 24)
                       + ((buffer[11]&0x0F) << 16)
                       + ((buffer[12]&0x0F) << 8)
                       + ((buffer[13]&0x0F) << 0) );

        msg_string += 'Absolute Move. PanSpeed='+pan_speed+' TiltSpeed='+tilt_speed+' PanPos='+pan_pos+' TiltPos='+tilt_pos;
    } else if (length == 5 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x04) {
        msg_string += 'Home';
    } else if (length == 6 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x06 && buffer[4] == 0x02) {
        msg_string += 'OSD Menu on';
    } else if (length == 6 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x06 && buffer[4] == 0x02) {
        msg_string += 'OSD Menu off';
    } else if (length == 6 && buffer[1] == 0x01 && buffer[2] == 0x04) {
        var b3 = buffer[3];
        var b4 = buffer[4];
        // Power
        if      (b3 == 0x00 && b4 == 0x02) msg_string += 'Power On';
        else if (b3 == 0x00 && b4 == 0x03) msg_string += 'Power Off';
	// Zoom
        else if (b3 == 0x07 && b4 == 0x00) msg_string += '[Zoom Stop]';
        else if (b3 == 0x07 && b4 == 0x02) msg_string += '[Zoom In]';
        else if (b3 == 0x07 && b4 == 0x03) msg_string += '[Zoom Out]';
        else if (b3 == 0x07 && ((b4 & 0xF0) == 0x20)) msg_string += '[Zoom In('+(b4 & 0x0F)+')]';
        else if (b3 == 0x07 && ((b4 & 0xF0) == 0x30)) msg_string += '[Zoom Out('+(b4 & 0x0F)+')]';
	// Focus
        else if (b3 == 0x08 && b4 == 0x00) msg_string += '[Focus Stop]';
        else if (b3 == 0x08 && b4 == 0x02) msg_string += '[Focus Far]';
        else if (b3 == 0x08 && b4 == 0x03) msg_string += '[Focus Near]';
        else if (b3 == 0x08 && ((b4 & 0xF0) == 0x20)) msg_string += '[Focus Far('+(b4 & 0x0F)+')]';
        else if (b3 == 0x08 && ((b4 & 0xF0) == 0x30)) msg_string += '[Focus Near('+(b4 & 0x0F)+')]';
        else if (b3 == 0x38 && b4 == 0x02) msg_string += '[Auto Focus]';
        else if (b3 == 0x38 && b4 == 0x03) msg_string += '[Manual Focus]';
        else if (b3 == 0x38 && b4 == 0x10) msg_string += '[Auto/Manual Focus]';
        else if (b3 == 0x18 && b4 == 0x01) msg_string += '[One Push Trigger Focus]';
        else if (b3 == 0x18 && b4 == 0x02) msg_string += '[Infinity Focus]';
	// Automatic Exposure (AE)
        else if (b3 == 0x39 && b4 == 0x00) msg_string += '[Full Auto Exposure]';
        else if (b3 == 0x39 && b4 == 0x03) msg_string += '[Manual Exposire]';
        else if (b3 == 0x39 && b4 == 0x0A) msg_string += '[Shutter Prioirty Exposure]';
        else if (b3 == 0x39 && b4 == 0x0B) msg_string += '[Iris Priority Exposure]';
        else if (b3 == 0x39 && b4 == 0x0D) msg_string += '[Bright Exposure]';
	// Iris
        else if (b3 == 0x0B && b4 == 0x00) msg_string += '[Iris Reset]';
        else if (b3 == 0x0B && b4 == 0x02) msg_string += '[Iris Up]';
        else if (b3 == 0x0B && b4 == 0x03) msg_string += '[Iris Down]';
        else msg_string += 'Other VISCA command';
    } else if (length == 7 && buffer[1] == 0x01 && buffer[2] == 0x04) {
        var b3 = buffer[3];
        var b4 = buffer[4];
        var b5 = buffer[5]; // range starts at zero
        if      (b3 == 0x3f && b4 == 0x00) msg_string += '[Reset Preset '+(b5)+']';
        else if (b3 == 0x3f && b4 == 0x01) msg_string += '[Set Preset '+(b5)+']';
        else if (b3 == 0x3f && b4 == 0x02) msg_string += '[Goto Preset '+(b5)+']';
	else msg_string += 'Other VISCA command';
    } else if (length == 9 && buffer[1] == 0x01 && buffer[2] == 0x04) {
        var b3 = buffer[3];
        var time = ( ((buffer[4]&0x0F) << 24)
                   + ((buffer[5]&0x0F) << 16)
                   + ((buffer[6]&0x0F) << 8)
                   + ((buffer[7]&0x0F) << 0) );
        if (b3 == 0x40) msg_string += 'Auto PowerOff '+time+' seconds'; //D100
	else msg_string += 'Other VISCA command';
    } else if (length == 4 && buffer[1] == 0x30 && buffer[2] == 0x01) {
    } else if (length == 4 && buffer[1] == 0x30 && buffer[2] == 0x01) {
        msg_string += 'Address Set Command';
    } else if (length == 5 && buffer[1] == 0x01 && buffer[2] == 0x00 && buffer[3] == 0x01) {
        msg_string += 'IF_Clear Command';
    } else {
        msg_string += 'Other VISCA command';
    }

    this.emit("log",this.bytes_to_string(buffer,length) + ' ' + msg_string);

    return;
};

decode_jvc(buffer,length) {

    var msg_string = "";

    msg_string += "JVC ";

    if (buffer[0] != 0xB1) return;   // Looks like Header could be 0xB101 
    if (length < 6) return;

    var camera_id = buffer[2]; // If cameras is C177, (0xb1) it will be confused with Header Byte
    msg_string += 'Camera ' + camera_id + ' ';

    var command_length = 4 + (buffer[3]&0x0F); // 4th byte tells you the number of bytes to follow

    var cmd_1 = buffer[4];
    var cmd_2 = buffer[5];

    if      (cmd_1 == 0x42 && cmd_2 == 0x00) msg_string += '[GOTO PRESET ' + buffer[6] + ']';
    else if (cmd_1 == 0x42 && cmd_2 == 0x39) msg_string += '[Unknown - Preset Related Command ' + buffer[6] + ']';
    else if (cmd_1 == 0x42 && cmd_2 == 0x11 && buffer[6]==0x01) msg_string += '[AUTO IRIS ON]';
    else if (cmd_1 == 0x42 && cmd_2 == 0x11 && buffer[6]==0x00) msg_string += '[AUTO IRIS OFF?]';
    else if (cmd_1 == 0x42 && cmd_2 == 0x15 && buffer[6]==0x01) msg_string += '[BACKLIGHT COMPENSATION ON]';
    else if (cmd_1 == 0x42 && cmd_2 == 0x15 && buffer[6]==0x00) msg_string += '[BACKLIGHT COMPENSATION OFF]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x28) msg_string += '[STORE PRESET ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x00) msg_string += '[PAN   RIGHT ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x01) msg_string += '[PAN   LEFT  ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x02) msg_string += '[PAN   STOP]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x03) msg_string += '[TILT  UP   ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x04) msg_string += '[TILT  DOWN ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x05) msg_string += '[TILT  STOP]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x06) msg_string += '[IRIS  OPEN]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x07) msg_string += '[IRIS  CLOSE]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x08) msg_string += '[IRIS  STOP]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x09) msg_string += '[FOCUS FAR  ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x0A) msg_string += '[FOCUS NEAR ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x0B) msg_string += '[FOCUS STOP]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x0C) msg_string += '[ZOOM  IN  ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x0D) msg_string += '[ZOOM  OUT ' + buffer[6] + ']';
    else if (cmd_1 == 0x45 && cmd_2 == 0x0E) msg_string += '[ZOOM  STOP]';
    else if (cmd_1 == 0x45 && cmd_2 == 0x1F) msg_string += '[FOCUS AUTO]';
    else msg_string += "[Unknown JVC command]";

    var padding = '';
    if (command_length == 6) padding = '    '; // '[..]' // add padding to 6 byte commands so length is same as 7 byte commands in the Hex dump

    this.emit("log",this.bytes_to_string(buffer,length) + padding + ' ' + msg_string);

    return;
};


bytes_to_string(buffer, length) {
    var byte_string = '';
    for (var i = 0; i < length; i++) {
        byte_string += '[' + this.DecToHexPad(buffer[i],2) + ']';
    }
    return byte_string;
};

DecToHexPad(decimal,size) {
    var ret_string = decimal.toString('16');
    while (ret_string.length < size) {
        ret_string = '0' + ret_string;
    }
    return ret_string;
};
} // end class

module.exports = { PelcoD_Decoder };
