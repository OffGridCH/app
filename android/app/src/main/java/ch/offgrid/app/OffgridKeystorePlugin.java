package ch.offgrid.app;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyStore;

import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.SecretKey;

/** Rechnet HMAC-SHA256 mit einem nicht exportierbaren Schlüssel im Android Keystore. */
@CapacitorPlugin(name = "OffgridKeystore")
public class OffgridKeystorePlugin extends Plugin {

    private static final String KEY_ALIAS = "offgrid_unlock";
    private static final String ANDROID_KEY_STORE = "AndroidKeyStore";
    private static final String HMAC_SHA256 = "HmacSHA256";

    @PluginMethod
    public void hmac(PluginCall call) {
        String encodedData = call.getString("data");
        if (encodedData == null) {
            call.reject("Keine Daten für HMAC angegeben");
            return;
        }

        try {
            byte[] data = Base64.decode(encodedData, Base64.DEFAULT);
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(getOrCreateKey());
            byte[] result = mac.doFinal(data);

            JSObject response = new JSObject();
            response.put("mac", Base64.encodeToString(result, Base64.NO_WRAP));
            call.resolve(response);
        } catch (GeneralSecurityException | IOException | IllegalArgumentException error) {
            call.reject("HMAC konnte nicht berechnet werden", error);
        }
    }

    private synchronized SecretKey getOrCreateKey() throws GeneralSecurityException, IOException {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
        keyStore.load(null);

        Key existing = keyStore.getKey(KEY_ALIAS, null);
        if (existing instanceof SecretKey) {
            return (SecretKey) existing;
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, ANDROID_KEY_STORE);
        generator.init(
            new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_SIGN)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build()
        );
        return generator.generateKey();
    }
}
