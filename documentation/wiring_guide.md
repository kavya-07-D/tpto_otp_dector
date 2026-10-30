# Hardware Wiring & Pin Mapping Guide

This document specifies the electrical wiring between the **ESP32 DevKit V1**, the **16x2 HD44780 LCD display**, and the **4x3 matrix keypad**.

---

## 1. Safety & Electrical Requirements

> [!WARNING]
> **ESP32 3.3V Logic Level Constraint:**
> All ESP32 GPIO pins are rated for **3.3V logic levels only**. Exceeding 3.6V on any GPIO pin can permanently damage the microcontroller.
> - While 5V can be supplied to the LCD module's `VDD` pin, the ESP32 only sends outputs (`RS`, `E`, `D4-D7`) to the LCD. Because the LCD `RW` pin is permanently tied to **GND**, the LCD never drives 5V data signals back to the ESP32 GPIOs.

> [!IMPORTANT]
> **Common Ground (GND):**
> Ensure that the ESP32 `GND`, the LCD `VSS` (Pin 1), the potentiometer ground, and any external 5V power supply grounds are connected to a common ground rail.

---

## 2. 16x2 LCD Display (HD44780 Parallel 4-Bit Mode)

The 16x2 LCD is operated in 4-bit data bus mode, minimizing GPIO usage while providing high refresh rates via the Arduino `LiquidCrystal` library.

### Pinout Table

| LCD Pin # | LCD Pin Label | Connection Target | Description |
|:---|:---|:---|:---|
| **Pin 1** | **VSS** | `GND` | Ground reference |
| **Pin 2** | **VDD** | `5V` (or `VIN`) | Display power supply |
| **Pin 3** | **VO** | **10k Potentiometer Wiper** | Contrast adjustment (middle pin of pot) |
| **Pin 4** | **RS** | `GPIO 13` | Register Select (Commands vs Data) |
| **Pin 5** | **RW** | `GND` | Read/Write select (tied to GND for Write) |
| **Pin 6** | **E** | `GPIO 14` | Clock Enable strobe |
| **Pins 7–10** | **D0–D3** | *Unconnected (NC)* | Unused in 4-bit parallel mode |
| **Pin 11** | **D4** | `GPIO 18` | High-nibble data line 4 |
| **Pin 12** | **D5** | `GPIO 19` | High-nibble data line 5 |
| **Pin 13** | **D6** | `GPIO 21` | High-nibble data line 6 |
| **Pin 14** | **D7** | `GPIO 22` | High-nibble data line 7 |
| **Pin 15** | **A (LED+)** | `5V` or `3.3V` via `220Ω` | Backlight Anode (+). Use resistor to prevent burn-out |
| **Pin 16** | **K (LED-)** | `GND` | Backlight Cathode (-) |

### Contrast Potentiometer Wiring (10k Ohm)
1. **Outer Pin 1**: Connect to `5V`.
2. **Center Pin (Wiper)**: Connect to LCD **Pin 3 (VO)**.
3. **Outer Pin 2**: Connect to `GND`.
*Adjust the potentiometer with a screwdriver until the 5x8 character dots become crisp without blanking or showing solid black boxes.*

---

## 3. 4x3 Matrix Keypad Wiring (7 Pins)

The membrane or tactile matrix keypad uses 7 pins corresponding to 4 rows and 3 columns.

### Pinout Table

| Keypad Pin | Matrix Identifier | ESP32 GPIO | Associated Keys |
|:---|:---|:---|:---|
| **Pin 1** | **Row 1 (R1)** | `GPIO 23` | Keys `1`, `2`, `3` |
| **Pin 2** | **Row 2 (R2)** | `GPIO 25` | Keys `4`, `5`, `6` |
| **Pin 3** | **Row 3 (R3)** | `GPIO 26` | Keys `7`, `8`, `9` |
| **Pin 4** | **Row 4 (R4)** | `GPIO 27` | Keys `*`, `0`, `#` |
| **Pin 5** | **Column 1 (C1)** | `GPIO 32` | Keys `1`, `4`, `7`, `*` |
| **Pin 6** | **Column 2 (C2)** | `GPIO 33` | Keys `2`, `5`, `8`, `0` |
| **Pin 7** | **Column 3 (C3)** | `GPIO 16` | Keys `3`, `6`, `9`, `#` |

### Pin Ordering & 7-Pin vs 8-Pin Verification

> [!CAUTION]
> **Check your Keypad Header:**
> - A standard **4x3 keypad has 7 pins**.
> - If your module has **8 pins**, it is a **4x4 keypad** featuring letters `A`, `B`, `C`, `D` in Column 4.
> - When using an 8-pin keypad with this 7-pin code, leave Pin 8 (Column 4) unconnected, and ensure Pins 1–7 correspond to Rows 1–4 and Columns 1–3.

---

## 4. USB Data Cable & Flashing Interface

1. **Use a True Data Micro-USB Cable:**
   Many USB cables sold for phone chargers carry only power wires ($V_{BUS}$ and $GND$) and omit $D+$ and $D-$. Ensure your cable supports serial data transfer.
2. **Serial Chipset Drivers:**
   ESP32 DevKit boards typically use the **CP2102** or **CH340G** USB-to-UART bridge. Ensure the driver is installed so your computer assigns a valid COM port (e.g. `COM3` on Windows).
3. **Baud Rate:**
   The serial monitor in `esp32_totp_auth.ino` is configured for **115200 baud**.
