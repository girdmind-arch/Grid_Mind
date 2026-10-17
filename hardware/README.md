# GridNova tabletop rig: build notes and safety

This folder is for the optional, **low-voltage** ESP32 demo. The main README (section "Hardware demo") explains how it connects to the website and backend; this file is about the bench.

```
hardware/
├── esp32/gridnova_rig/   firmware example (Arduino) + config.example.h
├── tools/mock_device.py  a pretend ESP32 with synthetic numbers, for trying the API with no hardware
└── (pcb/ lives in the GRID MIND Claude project, not in this repo)
```

## What this build is (and the parts list is not a receipt)

Target for this version, as specified: an ESP32-WROOM-32 as the controller, a **USB wall adapter as the "grid"**, a **mobile power bank as the "storage"**, **INA219** current/voltage sensor modules (planned), and **low-voltage LED loads**. No solar panel, fan, household mains, or direct power-bank charging.

Nothing in this repository records which parts have actually been bought, so this folder assumes none of them. The only other hardware material found was a PCB layout in the project files (`hardware/pcb/layout.py`, `route.py`): a 12 V design with a battery, an adapter, a solar input, three INA219s, a transfer relay, four MOSFET zones, panel buttons and a buzzer. That is a different concept from this USB build. It is not used here, and none of its solar or relay behaviour is claimed.

## Wiring rules (non-negotiable)

1. **No mains.** Everything on the table is USB-level (5 V). The wall adapter is a certified, off-the-shelf USB charger, plugged in by you; the rig never switches or touches mains.
2. **Never parallel the adapter and the power bank.** The source selector must be a power-mux arrangement that cannot connect both outputs to the load at once by itself: break-before-make in **hardware** (a power-mux IC with that guarantee, or two interlocked switches with independent enables and reverse-current blocking). The firmware adds a 100 ms dead time and a current-based interlock, but software is a second line of defence, not the first. Rate every part for at least 2× the maximum current (5 V, 3 A) and read the datasheet; this repo does not name a verified part.
3. **Do not charge the power bank from the rig.** There is no charging path in this design.
4. **Power the ESP32 from its own USB cable** (your laptop or a separate charger), not from the switched output, so changing source never reboots the controller.
5. **Everything off at boot.** Put a 10 kΩ pull-down on every source-enable and load-gate line. The ESP32's pins float while it resets, and floating must not mean "on".
6. **Fuse each source** (a polyfuse or a resettable USB-rated fuse) and keep loads to LED branches with proper current-limiting resistors.
7. The pin numbers in `config.example.h` are examples. Confirm each against your wiring.

## INA219 notes

- Two modules on I2C (SDA 21, SCL 22): adapter side at 0x40, battery side at 0x41 (solder pads). They measure what they see; the firmware sends **no value** when a module is missing, out of range or not answering, and the server shows the sensor as unhealthy instead.
- The default shunt tops out around 3.2 A; the firmware uses the 32 V / 2 A calibration and treats anything above 1.9 A as a fault.
- **Power-bank charge is unknown.** A bank regulates its USB output, so the voltage says nothing about how full it is. The firmware has no such field and the server refuses one.

## Bring-up checklist

1. Flash with **loads and both sources disconnected**. Watch Serial at 115200: no pin should go high before the first server contact.
2. With the sources connected but no loads, check the selector with a multimeter: never both outputs live. Try the emergency-stop button.
3. Add one LED branch at a time.
4. Only then run a scenario, with the rig **armed for a few minutes at a time**.
5. Try failure on purpose: unplug Wi-Fi (non-essential branches should go off after 30 s), press the button, and use the Emergency stop in Settings → Hardware.

## Firmware behaviour, in one place

- Boot: all outputs low. After the first successful server exchange (and no latched stop): adapter source, critical branch on.
- Commands: only `select_source`, `set_load`, `estop`, `clear_estop`. Anything else, any unknown name, any expired command, or any command while the server says "not armed" is **rejected** and acknowledged as such.
- The critical branch cannot be commanded off. An emergency stop turns every branch off and latches until `clear_estop`; the button also latches it locally, with or without Wi-Fi.
- Lost server for 30 s: non-essential branches off; the source selector stays where it is (moving it is the riskier action).
- Readings are sent with NTP time; the server rejects a clock that is off by more than 30 s.
- TLS is verified against the root certificate in `config.h`; there is no "insecure" mode.

**Status:** this sketch was written without a board or toolchain available. It has not been compiled or run. Treat it as a reviewed starting point: build it, read it, and test it with the loads disconnected before trusting it. The backend side is covered by automated tests using a mocked device (see the main README).
