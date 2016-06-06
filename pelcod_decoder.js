/*
 *
 * Read and decode Pelco D CCTV commands
 * Used to monitor the output from Pelco systems or the inputs into Pelco cameras
 * Copyright 2016 Roger Hardiman
 *
 *
 * Read the Buffer() objects from the a stream and process Pelco D messages
 * Buffer() objects may have multiple Pelco messages or just part of a message
 * so bytes are cached if needed
 *
 */
/*
 *  Commands are 7 bytes long, start with 0xFF and have a checksum
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+
 *  |   BYTE 1  | BYTE 2  |  BYTE 3   |  BYTE 4   | BYTE 5 | BYTE 6 |  BYTE 7   |
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+
 *  |           |         |           |           |        |        |           |
 *  | Sync Byte | Address | Command 1 | Command 2 | Data 1 | Data 2 | Check Sum |
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+
 *
 *  There are two types of command - Standard and Extended
 *
 *
 * STANDARD COMMANDS
 * Used to control Pan,Tilt,Zoom,Focus and Iris. Bytes 5 and 6 contain Pan and Tilt speeds
 *  +-----------+-----------+----------+-----------+--------------------+-----------------+------------+-----------+------------+
 *  |           |   BIT 7   |  BIT 6   |   BIT 5   |       BIT 4        |      BIT 3      |   BIT 2    |   BIT 1   |   BIT 0    |
 *  +-----------+-----------+----------+-----------+--------------------+-----------------+------------+-----------+------------+
 *  |           |           |          |           |                    |                 |            |           |            |
 *  | Command 1 | Sense     | Reserved | Reserved  | Auto / Manual Scan | Camera On / Off | Iris Close | Iris Open | Focus Near |
 *  |           |           |          |           |                    |                 |            |           |            |
 *  | Command 2 | Focus Far | Zoom     | Zoom Tele | Down               | Up              | Left       | Right     | Always 0   |
 *  +-----------+-----------+----------+-----------+--------------------+-----------------+------------+-----------+------------+
 *
 * EXTENDED COMMANDS
 * Bit 0 of Command 2 is set to '1' for extended commands (giving Command 2 an 'odd' numerical value)
 * Byte 4 contains the extended command. Bytes 5 and 6 are used for data values. Byte 3 is used for additional settings
 * There are a large number of extended commands. This code processes the common commands
 *  +--------------------------------+--------+--------+---------------------+-------------+
 *  |                                | BYTE 3 | BYTE 4 |       BYTE 5        |   BYTE 6    |
 *  |                                | Cmd 1  | Cmd 2  |       Data 1        |   Data 2    |
 *  +--------------------------------+--------+--------+---------------------+-------------+
 *  |                                |        |        |                     |             |
 *  | Set Preset                     | 00     | 03     | 00                  | value       |
 *  |                                |        |        |                     |             |
 *  | Clear Preset                   | 00     | 05     | 00                  | value       |
 *  |                                |        |        |                     |             |
 *  | Go To Preset                   | 00     | 07     | 00                  | value       |
 *  |   Flip (180deg about)          | 00     | 07     | 00                  | 21          |
 *  |   Go To Zero Pan               | 00     | 07     | 00                  | 22          |
 *  |                                |        |        |                     |             |
 *  | Set Auxiliary                  | 00     | 09     | 00                  | value       |
 *  |                                |        |        |                     |             |
 *  | Clear Auxiliary                | 00     | 0B     | 00                  | value       |
 *  |                                |        |        |                     |             |
 *  | Set Pattern Start              | 00     | 1F     | 00                  | value       |
 *  |                                |        |        |                     |             |
 *  | Set Pattern Stop               | 00     | 21     | 00                  | value       |
 *  |                                |        |        |                     |             |
 *  | Run Pattern                    | 00     | 23     | 00                  | value       |
 *  |                                |        |        |                     |             |
 *  +--------------------------------+--------+--------+---------------------+-------------+
 */

function PelcoD_Decoder() {

    // A Buffer used to cache partial commands
    this.pelco_command_buffer = new Buffer(7);

    // Number of bytes in the current Buffer
    this.pelco_command_index = 0;
}


PelcoD_Decoder.prototype.processBuffer = function(new_data_buffer) {

    // console.log('received ' + this.bytes_to_string(new_data_buffer) );

    // process each byte from new_data_buffer in turn

    for (var i = 0; i < new_data_buffer.length; i++) {

        // Get the next new byte
        var new_byte = new_data_buffer[i];

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

        // Check if we have 7 bytes that begin 0xFF
        if (this.pelco_command_index === 7 && this.pelco_command_buffer[0] === 0xFF) {
            // Check that the checksum is valud
            if (this.checksum_valid(this.pelco_command_buffer) === true) {
                // Looks like we have a Pelco command. Try and process it
                this.decode(this.pelco_command_buffer);
                this.pelco_command_index = 0; // empty the buffer
            } else {
                console.log(this.bytes_to_string(this.pelco_command_buffer) + ' Invalid Checksum');
            }
        }
    }
};

PelcoD_Decoder.prototype.checksum_valid = function(buffer) {
    var total = 0;
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


PelcoD_Decoder.prototype.decode = function(pelco_command_buffer) {
    //var sync      = pelco_command_buffer[0];
    var camera_id = pelco_command_buffer[1];
    var command_1 = pelco_command_buffer[2];
    var command_2 = pelco_command_buffer[3];
    var data_1 = pelco_command_buffer[4];
    var data_2 = pelco_command_buffer[5];
    //var checksum  = pelco_command_buffer[6];

    var extended_bit = command_2 & 0x01;

    var msg_string = 'Camera ' + camera_id + ' ';

    if (extended_bit === 1) {
        // Process extended commands
        // Command 2 (byte 4) identifies the Extended Command
        // byte 3, 5 and 6 contain additional data used by the extended commands

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
        } else {
            msg_string += 'Unknown extended command';
        }

    } else {
        // Process a normal Pan, Tilt, Zoom, Focus and Iris command

        var iris_close = (command_1 >> 2) & 0x01;
        var iris_open = (command_1 >> 1) & 0x01;
        var focus_near = (command_1) & 0x01;
        var focus_far = (command_2 >> 7) & 0x01;
        var zoom_out = (command_2 >> 6) & 0x01;
        var zoom_in = (command_2 >> 5) & 0x01;
        var down = (command_2 >> 4) & 0x01;
        var up = (command_2 >> 3) & 0x01;
        var left = (command_2 >> 2) & 0x01;
        var right = (command_2 >> 1) & 0x01;

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
    console.log(this.bytes_to_string(pelco_command_buffer) + ' ' + msg_string);
};

PelcoD_Decoder.prototype.bytes_to_string = function(buffer) {
    var byte_string = '';
    for (var i = 0; i < buffer.length; i++) {
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
