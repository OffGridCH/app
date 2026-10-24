package ch.offgrid.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.hoho.android.usbserial.driver.CdcAcmSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** USB-Serial-Plugin für die Antenne. Die Daten werden als Base64-kodierte UTF-8-Bytes übergeben. */
@CapacitorPlugin(name = "UsbSerial")
public class UsbSerialPlugin extends Plugin {

    private static final String EVENT_DATA = "data";
    private static final String EVENT_DETACHED = "detached";
    private static final String EVENT_ERROR = "error";
    private static final String USB_PERMISSION_ACTION = "ch.offgrid.app.USB_PERMISSION";
    private static final int BAUD_RATE = 115200;

    private UsbManager usbManager;
    private BroadcastReceiver receiver;
    private boolean receiverRegistered;

    private PluginCall pendingConnectCall;
    private UsbDevice pendingDevice;
    private UsbDevice connectedDevice;
    private UsbSerialPort serialPort;
    private UsbDeviceConnection connection;
    private SerialInputOutputManager serialManager;

    @Override
    public void load() {
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (USB_PERMISSION_ACTION.equals(action)) {
                    handlePermissionResult(intent);
                } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                    handleDetached(intent);
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(USB_PERMISSION_ACTION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        receiverRegistered = true;
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        JSArray devices = new JSArray();
        if (usbManager != null) {
            for (UsbDevice device : usbManager.getDeviceList().values()) {
                if (driverFor(device) == null) {
                    continue;
                }
                JSObject item = new JSObject();
                item.put("deviceId", device.getDeviceId());
                item.put("vendorId", device.getVendorId());
                item.put("productId", device.getProductId());
                item.put("name", device.getDeviceName());
                devices.put(item);
            }
        }

        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        Integer deviceId = call.getInt("deviceId");
        Integer baudRate = call.getInt("baudRate");
        if (deviceId == null || baudRate == null || baudRate != BAUD_RATE || usbManager == null) {
            call.reject("Ungültige USB-Serial-Verbindung", "OPEN_FAILED");
            return;
        }

        UsbDevice device = findDevice(deviceId);
        if (device == null || driverFor(device) == null) {
            call.reject("Kein passender USB-Serial-Treiber", "NO_DRIVER");
            return;
        }

        synchronized (this) {
            if (pendingConnectCall != null || connectedDevice != null) {
                call.reject("USB-Serial ist bereits verbunden", "OPEN_FAILED");
                return;
            }
        }

        if (usbManager.hasPermission(device)) {
            openSerial(call, device);
            return;
        }

        synchronized (this) {
            pendingConnectCall = call;
            pendingDevice = device;
        }

        try {
            Intent permissionIntent = new Intent(USB_PERMISSION_ACTION).setPackage(getContext().getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(),
                device.getDeviceId(),
                permissionIntent,
                flags
            );
            usbManager.requestPermission(device, pendingIntent);
        } catch (RuntimeException error) {
            synchronized (this) {
                pendingConnectCall = null;
                pendingDevice = null;
            }
            call.reject("USB-Berechtigung konnte nicht angefordert werden", "PERMISSION_DENIED");
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        String data = call.getString("data");
        SerialInputOutputManager manager;
        synchronized (this) {
            manager = serialManager;
        }
        if (data == null || manager == null) {
            call.reject("USB-Serial ist nicht verbunden", "OPEN_FAILED");
            return;
        }

        try {
            manager.writeAsync(data.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Schreiben auf USB-Serial fehlgeschlagen", "OPEN_FAILED");
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        PluginCall pendingCall;
        synchronized (this) {
            pendingCall = pendingConnectCall;
            pendingConnectCall = null;
            pendingDevice = null;
        }
        if (pendingCall != null) {
            pendingCall.reject("USB-Serial-Verbindung wurde abgebrochen", "OPEN_FAILED");
        }
        closeConnection();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (receiverRegistered) {
            try {
                getContext().unregisterReceiver(receiver);
            } catch (IllegalArgumentException ignored) {
                // Der Receiver wurde bereits abgemeldet.
            }
            receiverRegistered = false;
        }

        PluginCall pendingCall;
        synchronized (this) {
            pendingCall = pendingConnectCall;
            pendingConnectCall = null;
            pendingDevice = null;
        }
        if (pendingCall != null) {
            pendingCall.reject("USB-Serial-Plugin wurde beendet", "OPEN_FAILED");
        }
        closeConnection();
        super.handleOnDestroy();
    }

    private void handlePermissionResult(Intent intent) {
        PluginCall call;
        UsbDevice device;
        synchronized (this) {
            call = pendingConnectCall;
            device = pendingDevice;
            pendingConnectCall = null;
            pendingDevice = null;
        }
        if (call == null || device == null) {
            return;
        }

        UsbDevice resultDevice = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
        if (resultDevice != null && resultDevice.getDeviceId() != device.getDeviceId()) {
            call.reject("USB-Berechtigung wurde für ein anderes Gerät erteilt", "PERMISSION_DENIED");
            return;
        }

        boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
        if (!granted) {
            call.reject("Keine USB-Berechtigung", "PERMISSION_DENIED");
            return;
        }
        openSerial(call, device);
    }

    private void handleDetached(Intent intent) {
        UsbDevice detached = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
        if (detached == null) {
            return;
        }

        boolean matches;
        synchronized (this) {
            matches = connectedDevice != null && connectedDevice.getDeviceId() == detached.getDeviceId();
        }
        if (!matches) {
            return;
        }

        closeConnection();
        notifyListeners(EVENT_DETACHED, new JSObject());
    }

    private void openSerial(PluginCall call, UsbDevice device) {
        UsbSerialDriver driver = driverFor(device);
        if (driver == null) {
            call.reject("Kein passender USB-Serial-Treiber", "NO_DRIVER");
            return;
        }

        List<UsbSerialPort> ports = driver.getPorts();
        if (ports.isEmpty()) {
            call.reject("Kein passender USB-Serial-Treiber", "NO_DRIVER");
            return;
        }

        UsbSerialPort port = ports.get(0);
        UsbDeviceConnection openedConnection = device.openConnection();
        if (openedConnection == null) {
            call.reject("USB-Serial konnte nicht geöffnet werden", "OPEN_FAILED");
            return;
        }

        try {
            port.open(openedConnection);
            // Sofort deaktivieren, sonst startet der ESP32 durch das Öffnen neu.
            port.setDTR(false);
            port.setRTS(false);
            port.setParameters(
                BAUD_RATE,
                UsbSerialPort.DATABITS_8,
                UsbSerialPort.STOPBITS_1,
                UsbSerialPort.PARITY_NONE
            );
            port.setFlowControl(UsbSerialPort.FlowControl.NONE);
        } catch (IOException | RuntimeException error) {
            closePort(port, openedConnection);
            call.reject("USB-Serial konnte nicht geöffnet werden", "OPEN_FAILED");
            return;
        }

        SerialInputOutputManager manager = new SerialInputOutputManager(
            port,
            new SerialInputOutputManager.Listener() {
                @Override
                public void onNewData(byte[] data) {
                    JSObject payload = new JSObject();
                    payload.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
                    notifyListeners(EVENT_DATA, payload);
                }

                @Override
                public void onRunError(Exception error) {
                    JSObject payload = new JSObject();
                    payload.put("message", error.getMessage() == null ? "USB-Serial-Fehler" : error.getMessage());
                    notifyListeners(EVENT_ERROR, payload);
                    closeConnection();
                }
            }
        );

        synchronized (this) {
            connectedDevice = device;
            serialPort = port;
            connection = openedConnection;
            serialManager = manager;
        }

        try {
            manager.start();
            call.resolve();
        } catch (RuntimeException error) {
            closeConnection();
            call.reject("USB-Serial konnte nicht gestartet werden", "OPEN_FAILED");
        }
    }

    private UsbDevice findDevice(int deviceId) {
        if (usbManager == null) {
            return null;
        }
        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (device.getDeviceId() == deviceId) {
                return device;
            }
        }
        return null;
    }

    private UsbSerialDriver driverFor(UsbDevice device) {
        UsbSerialDriver driver = UsbSerialProber.getDefaultProber().probeDevice(device);
        if (driver == null && CdcAcmSerialDriver.probe(device)) {
            driver = new CdcAcmSerialDriver(device);
        }
        return driver;
    }

    private void closeConnection() {
        SerialInputOutputManager manager;
        UsbSerialPort port;
        UsbDeviceConnection openedConnection;
        synchronized (this) {
            manager = serialManager;
            port = serialPort;
            openedConnection = connection;
            serialManager = null;
            serialPort = null;
            connection = null;
            connectedDevice = null;
        }

        if (manager != null) {
            manager.stop();
        }
        closePort(port, openedConnection);
    }

    private void closePort(UsbSerialPort port, UsbDeviceConnection openedConnection) {
        if (port != null) {
            try {
                port.close();
            } catch (IOException ignored) {
                // Die Verbindung ist bereits geschlossen.
            }
        }
        if (openedConnection != null) {
            openedConnection.close();
        }
    }
}
