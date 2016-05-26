# Pelco D Telemetry Decoder (node-pelcod_decoder)

This module reads Pelco D CCTV Camera Pan/Tilt/Zoom data, validates each command and decode its meaning.
The descripion of each command to the console and the commands decoded include
  Pan  (direction and speed)
  Tilt (direction and speed)
  Zoom
  Manual Focus
  Manual Iris
  Store Preset
  Goto Preset
  Clear Preset
  Auxiliary On
  Auxiliary Off

# Baud Rates
Pelco D often runs at 2400 baud 8-N-1 or at 9600 bald 8-N-1

# Stream Sources
The module will read from a NodeJS stream and currently reads from a Serial Port (using node-serial). It can also run with a Memory Stream

# Future enhancements
A future enhancement would be to drive an I/O module or send USB commands to drive motors or relays.
Another enhancement would be to output a new Pan/Tilt/Zoom telemetry command in a different format to drive other makes of camera (ie a protocol converter)

