package com.demo.upimesh.crypto;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Properties;

/**
 * Holds the server's RSA-2048 keypair.
 *
 * Provides persistent key management so that backend restarts (e.g. Render spin-down
 * or container restarts) DO NOT invalidate in-flight or buffered mesh payment packets!
 *
 * Priority order:
 *  1. Environment variables: UPI_MESH_SERVER_PRIVATE_KEY / UPI_MESH_SERVER_PUBLIC_KEY (Base64)
 *  2. Local persistent keystore file (.server_keystore.properties)
 *  3. Dynamic generation with automated persistence to local file.
 */
@Component
public class ServerKeyHolder {

    private static final Logger log = LoggerFactory.getLogger(ServerKeyHolder.class);
    private static final String KEY_FILE_NAME = ".server_keystore.properties";

    @Value("${upi.mesh.server-private-key:}")
    private String configuredPrivateKey;

    @Value("${upi.mesh.server-public-key:}")
    private String configuredPublicKey;

    private KeyPair keyPair;

    @PostConstruct
    public void init() throws Exception {
        // 1. Try loading from injected configuration / env vars
        if (configuredPrivateKey != null && !configuredPrivateKey.isBlank() &&
            configuredPublicKey != null && !configuredPublicKey.isBlank()) {
            try {
                this.keyPair = loadKeyPairFromBase64(configuredPublicKey.trim(), configuredPrivateKey.trim());
                log.info("Server RSA keypair loaded from environment/configuration. Fingerprint: {}",
                        getPublicKeyBase64().substring(0, 32) + "...");
                return;
            } catch (Exception e) {
                log.warn("Failed to parse configured RSA keys: {}. Falling back to keystore file.", e.getMessage());
            }
        }

        // 2. Try loading from persistent file
        File keyFile = new File(KEY_FILE_NAME);
        if (keyFile.exists() && keyFile.canRead()) {
            try (FileInputStream fis = new FileInputStream(keyFile)) {
                Properties props = new Properties();
                props.load(fis);
                String pubBase64 = props.getProperty("server.public.key");
                String privBase64 = props.getProperty("server.private.key");
                if (pubBase64 != null && privBase64 != null) {
                    this.keyPair = loadKeyPairFromBase64(pubBase64, privBase64);
                    log.info("Server RSA keypair loaded from persistent keystore ({}). Fingerprint: {}",
                            keyFile.getAbsolutePath(), getPublicKeyBase64().substring(0, 32) + "...");
                    return;
                }
            } catch (Exception e) {
                log.warn("Could not read persistent keystore file: {}. Generating fresh key.", e.getMessage());
            }
        }

        // 3. Generate fresh 2048-bit RSA keypair and persist it
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        this.keyPair = gen.generateKeyPair();

        try (FileOutputStream fos = new FileOutputStream(keyFile)) {
            Properties props = new Properties();
            props.setProperty("server.public.key", getPublicKeyBase64());
            props.setProperty("server.private.key", getPrivateKeyBase64());
            props.store(fos, "UPI Offline Mesh - Auto-generated Persistent Server Keypair");
            log.info("Generated new 2048-bit RSA keypair and persisted to {}. Fingerprint: {}",
                    keyFile.getAbsolutePath(), getPublicKeyBase64().substring(0, 32) + "...");
        } catch (Exception e) {
            log.warn("Could not persist generated keypair to file (running in read-only environment): {}", e.getMessage());
        }
    }

    private KeyPair loadKeyPairFromBase64(String pubBase64, String privBase64) throws Exception {
        KeyFactory kf = KeyFactory.getInstance("RSA");
        byte[] pubBytes = Base64.getDecoder().decode(pubBase64);
        X509EncodedKeySpec pubSpec = new X509EncodedKeySpec(pubBytes);
        PublicKey pubKey = kf.generatePublic(pubSpec);

        byte[] privBytes = Base64.getDecoder().decode(privBase64);
        PKCS8EncodedKeySpec privSpec = new PKCS8EncodedKeySpec(privBytes);
        PrivateKey privKey = kf.generatePrivate(privSpec);

        return new KeyPair(pubKey, privKey);
    }

    public PublicKey getPublicKey() {
        return keyPair.getPublic();
    }

    public PrivateKey getPrivateKey() {
        return keyPair.getPrivate();
    }

    public String getPublicKeyBase64() {
        return Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
    }

    public String getPrivateKeyBase64() {
        return Base64.getEncoder().encodeToString(keyPair.getPrivate().getEncoded());
    }
}
