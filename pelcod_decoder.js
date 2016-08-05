/*
 *
 * Read and decode Pelco D and Pelco P CCTV commands
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
 *  SOURCE MATERIAL
 *  Pelco D data sheet (official Pelco document - 1999 Edition)
 *  NuOptic D Protocol http://www.nuoptic.com/wp-content/uploads/files/NuOptic_VIS-1000_D-Protocol_Reference.pdf
 *  CommFront 232 Analizer https://www.commfront.com/pages/pelco-d-protocol-tutorial
 *  CommFront 232 Analizer https://www.commfront.com/pages/pelco-p-protocol-tutorial
 *  CodeProject Pelco D and Pelco P pages http://www.codeproject.com/Articles/8034/Pelco-P-and-D-protocol-implementation-in-C
 * 
 *  Pelco D Commands are 7 bytes long, start with 0xFF and have a 'sum' checksum
 *  Checksum is Sum of bytes 2 to 6 Modulo 256
 *  Camera 1 has Address 01
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+
 *  |   BYTE 1  | BYTE 2  |  BYTE 3   |  BYTE 4   | BYTE 5 | BYTE 6 |  BYTE 7   |
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+
 *  |           |         |           |           |        |        |           |
 *  | Sync(0xFF)| Address | Command 1 | Command 2 | Data 1 | Data 2 | Check Sum |
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+
 *
 *  Pelco P Commands are 8 bytes long, include STX and ETX and have a 'XOR' checksum
 *  Checksum is XOR of bytes 1 to 7
 *  Camera 1 has Address 00
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+-----------+
 *  |   BYTE 1  | BYTE 2  |  BYTE 3   |  BYTE 4   | BYTE 5 | BYTE 6 |   BYTE 7  |  BYTE 8   |
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+-----------+
 *  |           |         |           |           |        |        |           |           |
 *  | STX(0xA0) | Address | Command 1 | Command 2 | Data 1 | Data 2 | ETX(0xAF) | Check Sum |
 *  +-----------+---------+-----------+-----------+--------+--------+-----------+-----------+
 *
 *  There are two types of command - Standard and Extended
 *
 *
 * STANDARD COMMANDS
 * Pelco D Format
 * Used to control Pan,Tilt,Zoom,Focus and Iris. Bytes 5 and 6 contain Pan and Tilt speeds
 *  +---------+---------+--------+---------+------------------+---------------+----------+---------+----------+
 *  |         |  BIT 7  | BIT 6  |  BIT 5  |      BIT 4       |     BIT 3     |  BIT 2   |  BIT 1  |  BIT 0   |
 *  +---------+---------+--------+---------+------------------+---------------+----------+---------+----------+
 *  |         |         |        |         |                  |               |          |         |          |
 *  |Command 1|Sense    |Reserved|Reserved |Auto / Manual Scan|Camera On / Off|Iris Close|Iris Open|Focus Near|
 *  |         |         |        |         |                  |               |          |         |          |
 *  |Command 2|Focus Far|Zoom    |Zoom Tele|Down              |Up             |Left      |Right    |Always 0  |
 *  +---------+---------+--------+---------+------------------+---------------+----------+---------+----------+
 *
 * Pelco P Format
 * Used to control Pan,Tilt,Zoom,Focus and Iris. Bytes 5 and 6 contain Pan and Tilt speeds
 *  +---------+--------+-------------+---------------+-------------+----------+---------+---------+----------+
 *  |         |  BIT 7 |    BIT 6    |     BIT 5     |   BIT 4     |  BIT 3   |  BIT 2  |  BIT 1  |  BIT 0   |
 *  +---------+--------+-------------+---------------+-------------+----------+---------+---------+----------+
 *  |         |        |             |               |             |          |         |         |          |
 *  |Command 1|Always 0|Camera On/Off|Autoscan On/Off|Camera On/Off|Iris Close|Iris Open|Focus Near|Focus Far|
 *  |         |        |             |               |             |          |         |         |          |
 *  |Command 2|Always 0|Zoom Wide    |Zoom Tele      |Tilt Down    |Tilt Up   |Pan Left |Pan Right|Always 0  |
 *  +---------+--------+-------------+---------------+-------------+----------+---------+---------+----------+
 * The Pelco P table comes from various web sites and not from any formal documents
 *
 *
 * EXTENDED COMMANDS
 * Bit 0 of Command 2 is set to '1' for extended commands (giving Command 2 an 'odd' numerical value)
 * Byte 4 contains the extended command. Bytes 5 and 6 are used for data values. Byte 3 is used for additional settings
 * There are a large number of extended commands. This code processes the common commands
 *  +--------------------------------+--------+--------+---------------------+-------------+----+
 *  |                                | BYTE 3 | BYTE 4 |       BYTE 5        |   BYTE 6    |D/P |
 *  |                                | Cmd 1  | Cmd 2  |       Data 1        |   Data 2    |    |
 *  +--------------------------------+--------+--------+---------------------+-------------+----+
 *  |                                |        |        |                     |             |    |
 *  | Set Preset                     | 00     | 03     | 00                  | value       |Both|
 *  |                                |        |        |                     |             |    |
 *  | Clear Preset                   | 00     | 05     | 00                  | value       |Both|
 *  |                                |        |        |                     |             |    |
 *  | Go To Preset                   | 00     | 07     | 00                  | value       |Both|
 *  |   Flip (180deg about)          | 00     | 07     | 00                  | 21          |    |
 *  |   Go To Zero Pan               | 00     | 07     | 00                  | 22          |    |
 *  |                                |        |        |                     |             |    |
 *  | Set Auxiliary                  | 00     | 09     | 00                  | value       |D   |
 *  |                                |        |        |                     |             |    |
 *  | Clear Auxiliary                | 00     | 0B     | 00                  | value       |D   |
 *  |                                |        |        |                     |             |    |
 *  | Set Pattern Start              | 00     | 1F     | 00                  | value       |Both|
 *  |                                |        |        |                     |             |    |
 *  | Set Pattern Stop               | 00     | 21     | 00                  | value       |Both|
 *  |                                |        |        |                     |             |    |
 *  | Run Pattern                    | 00     | 23     | 00                  | value       |Both|
 *  |                                |        |        |                     |             |    |
 *  | Set Zoom Speed                 | 00     | 25     | 00                  | value (0-3) |Both|
 *  |                                |        |        |                     |             |    |
 *  +--------------------------------+--------+--------+---------------------+-------------+----+
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
}


PelcoD_Decoder.prototype.processBuffer = function(new_data_buffer) {

    // console.log('received ' + this.bytes_to_string(new_data_buffer) );

    // process each byte from new_data_buffer in turn

    for (var i = 0; i < new_data_buffer.length; i++) {

        // Get the next new byte
        var new_byte = new_data_buffer[i];

        // Add to Pelco D buffer
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

        // Add to Pelco P buffer
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
        //var sync      = pelco_command_buffer[0];
        var camera_id = pelco_command_buffer[1];
        var command_1 = pelco_command_buffer[2];
        var command_2 = pelco_command_buffer[3];
        var data_1 = pelco_command_buffer[4];
        var data_2 = pelco_command_buffer[5];
        //var sync2  = pelco_command_buffer[6];
        //var checksum  = pelco_command_buffer[7];

        var extended_command = ((command_2 & 0x01)==1);
        msg_string += 'P ';
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
