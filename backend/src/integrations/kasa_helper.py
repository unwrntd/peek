#!/usr/bin/env python3
"""
Kasa device helper script using python-kasa library.
This provides KLAP protocol support for newer Kasa firmware.
Called from Node.js backend via subprocess.
"""

import asyncio
import json
import sys
import warnings
import os

# Suppress deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from kasa import Discover, Device, Credentials

# Get credentials from environment variables (passed from Node.js)
KASA_EMAIL = os.environ.get('KASA_EMAIL', '')
KASA_PASSWORD = os.environ.get('KASA_PASSWORD', '')


def get_credentials() -> Credentials | None:
    """Get credentials if available."""
    if KASA_EMAIL and KASA_PASSWORD:
        return Credentials(KASA_EMAIL, KASA_PASSWORD)
    return None


async def discover_devices(timeout: int = 10) -> list[dict]:
    """Discover Kasa devices on the network."""
    devices = []
    creds = get_credentials()
    try:
        found = await Discover.discover(timeout=timeout, credentials=creds)
        for ip, device in found.items():
            try:
                await device.update()
                devices.append(device_to_dict(device))
            except Exception as e:
                print(f"Error updating device {ip}: {e}", file=sys.stderr)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
    return devices


async def get_device(ip: str) -> dict | None:
    """Get a single device by IP using the new API."""
    creds = get_credentials()
    try:
        # Use the new API: Discover.discover_single returns a connected device
        device = await Discover.discover_single(ip, timeout=10, credentials=creds)
        if device:
            await device.update()
            return device_to_dict(device)
    except Exception as e:
        return {"error": str(e), "ip": ip}
    return None


async def get_devices(ips: list[str]) -> list[dict]:
    """Get multiple devices by IP."""
    devices = []
    for ip in ips:
        result = await get_device(ip)
        if result and "error" not in result:
            devices.append(result)
        elif result and "error" in result:
            print(f"Error for {ip}: {result['error']}", file=sys.stderr)
    return devices


def get_device_type(device: Device) -> str:
    """Determine the device type."""
    device_type = device.device_type.name.lower() if hasattr(device, 'device_type') else 'unknown'

    # Check for strip/power strip
    if hasattr(device, 'is_strip') and device.is_strip:
        return "power_strip"
    if 'strip' in device_type:
        return "power_strip"

    # Check for bulb types
    if hasattr(device, 'is_bulb') and device.is_bulb:
        if hasattr(device, 'is_color') and device.is_color:
            return "bulb_color"
        if hasattr(device, 'is_variable_color_temp') and device.is_variable_color_temp:
            return "bulb_tunable"
        if hasattr(device, 'is_dimmable') and device.is_dimmable:
            return "bulb_dimmable"
        return "bulb"
    if 'bulb' in device_type:
        return "bulb"

    # Check for plug types
    if hasattr(device, 'is_plug') and device.is_plug:
        if hasattr(device, 'has_emeter') and device.has_emeter:
            return "plug_energy"
        return "plug"
    if 'plug' in device_type:
        return "plug_energy" if (hasattr(device, 'has_emeter') and device.has_emeter) else "plug"

    # Check for dimmer
    if hasattr(device, 'is_dimmer') and device.is_dimmer:
        return "dimmer"
    if 'dimmer' in device_type:
        return "dimmer"

    return "plug"


def device_to_dict(device: Device) -> dict:
    """Convert device to dictionary for JSON serialization."""
    result = {
        "deviceId": getattr(device, 'device_id', None) or device.host,
        "alias": getattr(device, 'alias', 'Unknown'),
        "deviceType": get_device_type(device),
        "model": getattr(device, 'model', 'Unknown'),
        "host": device.host,
        "isOn": getattr(device, 'is_on', False),
        "hasEnergyMonitoring": getattr(device, 'has_emeter', False),
    }

    # Add optional fields safely
    if hasattr(device, 'mac') and device.mac:
        result["mac"] = device.mac

    # Firmware and hardware versions
    if hasattr(device, 'hw_info') and device.hw_info:
        hw = device.hw_info
        if isinstance(hw, dict):
            if 'sw_ver' in hw:
                result["fwVersion"] = hw['sw_ver']
            if 'hw_ver' in hw:
                result["hwVersion"] = hw['hw_ver']

    # RSSI
    if hasattr(device, 'rssi') and device.rssi is not None:
        result["rssi"] = device.rssi

    # LED status
    if hasattr(device, 'led') and device.led is not None:
        result["ledOff"] = not device.led

    # Bulb-specific properties
    if hasattr(device, 'brightness') and device.brightness is not None:
        result["brightness"] = device.brightness
    if hasattr(device, 'color_temp') and device.color_temp:
        result["colorTemp"] = device.color_temp
    if hasattr(device, 'hsv') and device.hsv:
        hsv = device.hsv
        if hsv:
            result["hue"] = hsv[0] if len(hsv) > 0 else None
            result["saturation"] = hsv[1] if len(hsv) > 1 else None

    # Power strip children
    if hasattr(device, 'children') and device.children:
        result["children"] = []
        for child in device.children:
            result["children"].append({
                "id": getattr(child, 'device_id', child.host if hasattr(child, 'host') else 'unknown'),
                "alias": getattr(child, 'alias', 'Unknown'),
                "isOn": getattr(child, 'is_on', False),
            })

    return result


async def get_energy(ip: str) -> dict | None:
    """Get energy usage for a device."""
    creds = get_credentials()
    try:
        device = await Discover.discover_single(ip, timeout=10, credentials=creds)
        if not device:
            return None

        await device.update()

        if not getattr(device, 'has_emeter', False):
            return None

        result = {
            "deviceId": getattr(device, 'device_id', None) or device.host,
            "alias": getattr(device, 'alias', 'Unknown'),
            "currentPower": 0,
            "voltage": 0,
            "current": 0,
            "todayEnergy": 0,
            "monthEnergy": 0,
            "totalEnergy": 0,
        }

        # Get realtime energy data
        if hasattr(device, 'emeter_realtime') and device.emeter_realtime:
            realtime = device.emeter_realtime
            # Handle both mW and W units
            result["currentPower"] = realtime.get('power', realtime.get('power_mw', 0) / 1000 if 'power_mw' in realtime else 0)
            result["voltage"] = realtime.get('voltage', realtime.get('voltage_mv', 0) / 1000 if 'voltage_mv' in realtime else 0)
            result["current"] = realtime.get('current', realtime.get('current_ma', 0) / 1000 if 'current_ma' in realtime else 0)
            result["totalEnergy"] = realtime.get('total', realtime.get('total_wh', 0) / 1000 if 'total_wh' in realtime else 0)

        # Today's energy
        if hasattr(device, 'emeter_today') and device.emeter_today is not None:
            result["todayEnergy"] = device.emeter_today

        # This month's energy
        if hasattr(device, 'emeter_this_month') and device.emeter_this_month is not None:
            result["monthEnergy"] = device.emeter_this_month

        return result
    except Exception as e:
        return {"error": str(e), "ip": ip}


async def get_all_energy(ips: list[str]) -> list[dict]:
    """Get energy usage for multiple devices."""
    results = []
    for ip in ips:
        result = await get_energy(ip)
        if result and "error" not in result:
            results.append(result)
    return results


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command specified"}))
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "discover":
            timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            devices = await discover_devices(timeout)
            print(json.dumps({"devices": devices}))

        elif command == "get-device":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "No IP specified"}))
                sys.exit(1)
            ip = sys.argv[2]
            device = await get_device(ip)
            print(json.dumps({"device": device}))

        elif command == "get-devices":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "No IPs specified"}))
                sys.exit(1)
            ips = [ip.strip() for ip in sys.argv[2].split(",") if ip.strip()]
            devices = await get_devices(ips)
            print(json.dumps({"devices": devices}))

        elif command == "get-energy":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "No IP specified"}))
                sys.exit(1)
            ip = sys.argv[2]
            energy = await get_energy(ip)
            print(json.dumps({"energy": energy}))

        elif command == "get-all-energy":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "No IPs specified"}))
                sys.exit(1)
            ips = [ip.strip() for ip in sys.argv[2].split(",") if ip.strip()]
            energies = await get_all_energy(ips)
            print(json.dumps({"devices": energies}))

        elif command == "test":
            # Test connection - try to discover or connect to specific IPs
            if len(sys.argv) > 2 and sys.argv[2]:
                ips = [ip.strip() for ip in sys.argv[2].split(",") if ip.strip()]
                devices = await get_devices(ips)
                if devices:
                    print(json.dumps({"success": True, "devices": devices, "count": len(devices)}))
                else:
                    print(json.dumps({"success": False, "error": "No devices found at specified IPs"}))
            else:
                timeout = int(sys.argv[3]) if len(sys.argv) > 3 else 10
                devices = await discover_devices(timeout)
                if devices:
                    print(json.dumps({"success": True, "devices": devices, "count": len(devices)}))
                else:
                    print(json.dumps({"success": False, "error": "No devices discovered"}))

        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
