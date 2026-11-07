# FoxAlien Masuter: MVP postprocessor reference

## Machine evidence

Local source: `FoxAlien_Masuter_V2.0/1. Masuter_User_Manual-EN-V2.0.pdf`, printed page 2 (product specifications). The manual lists a 400 × 380 × 55 mm working area, stock 60 W spindle with nominal 10,000 rpm, GRBL firmware 1.1H, XYZ limit switches, and Candle/GRBL-compatible senders. User confirms the stock spindle and controller are installed. Neither the upgraded 300 W spindle nor a tool changer is in scope.

The supplied `Test Code/4. Gearwheel.nc` begins with metric mode, spindle enable at S10000, absolute positioning, then moves into its test pattern. That demonstrates the shipped sample's convention, not proof of the controller's current spindle scaling or safe feeds for new stock. Obtain actual `$I`, `$$`, `$G`, and `$#` readouts before machine commissioning.

## GRBL sources

- https://github.com/gnea/grbl/blob/master/README.md
- https://github.com/gnea/grbl/blob/master/doc/markdown/commands.md
- https://github.com/gnea/grbl/wiki/Grbl-v1.1-Configuration

Upstream documents list G17/G21/G90/G94/G54 modal selection, G40, G49, G80, spindle M3/M5, and program end M2. Use explicit feed values. This postprocessor computes tool compensation in coordinates and emits linear G1 segments; it does not require cutter compensation, drilling canned cycles, tool changes, or a dialect-specific macro engine.

## Implemented setup contract

- One cap per program. Outer face upward. Repeat with new stock; symmetric cap is interchangeable left/right.
- G54 origin is the lower-left corner of the minimum stock rectangle. Set Z0 on the wood's top face. The file clears G92 via G92.1; do not establish the intended work zero only through G92.
- Initialization: G21 G17 G90 G94 G54, G40 G49 G80, G92.1, M5, M9, retract to work safe Z, M3 S setting, two-second dwell.
- Workholding: double-sided tape on sacrificial spoilboard. There are no clamp keepouts, tabs or fixture collision models. Clamped setups are intentionally outside this initial postprocessor.
- Pocket the four screw-head recesses, then the four clearance holes, then the outside contour. Concentric clearing steps are no more than 40% of cutter diameter. Depth increments never exceed specified stepdown.
- Tool center travels outside the cap profile by half the tool diameter. G-code XY is offset into a positive stock rectangle with configurable margin.
- Retract before all rapid XY travel; finish with retract, M5, M9, M2. No automatic homing, alarm unlock, machine-coordinate parking, setting writes, or tool change.
- MVP tool choices: 1.5875 or 3.175 mm flat, center-cutting end mill. Actual flute length and suitability require operator verification.
- Initial feeds (250 mm/min cutting, 80 mm/min plunge, 0.5 mm stepdown) are editable provisional inputs, not validated recipes. Confirm actual `$30` spindle scaling and `$32=0` milling mode outside the job file. Simulate and air-cut before a real cut.

## Future machine profiles

Keep machine travel limits, initialization, spindle semantics, stock/work coordinate conventions and workholding strategies separate from enclosure geometry. Add clamping only with fixture keepouts, tool clearance, and a retained-part strategy.
