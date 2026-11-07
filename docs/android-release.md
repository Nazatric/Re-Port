# Signed Android release

The current Android workflow builds the native Kotlin and Compose debug variant for testing, and names the download RePort. A future production release would require changing the workflow to build and sign a release variant using a persistent key; the notes below describe how to prepare that key.

## One-time signing setup

Use an existing Android release keystore if you already have one. Otherwise, create one on a secure computer with the JDK installed, outside the repository:

```sh
keytool -genkeypair -v -keystore "$HOME/re-port-release.jks" -alias report -keyalg RSA -keysize 4096 -validity 10000
```

Choose and securely retain the keystore password. Back up the keystore securely: every future update must be signed with the same key or Android will not install it over the existing app. Never commit the keystore or share the passwords in chat.

In the repository's **Settings → Secrets and variables → Actions**, add these repository secrets:

- `KEYSTORE_BASE64`: the base64-encoded contents of the keystore file.
- `KEYSTORE_PASSWORD`: the keystore password.
- `KEY_ALIAS`: the signing key alias (for the example above, `report`).
- `KEY_PASSWORD`: the key password (for a PKCS12 keystore created with the example above, normally the same as the keystore password).

Alternatively, an administrator with GitHub CLI access can set these secrets from their own machine without displaying them in the terminal or putting passwords in shell history:

```sh
base64 < "$HOME/re-port-release.jks" | gh secret set KEYSTORE_BASE64
printf '%s' report | gh secret set KEY_ALIAS
read -rs -p 'Keystore password: ' RE_PORT_PASSWORD; echo
printf '%s' "$RE_PORT_PASSWORD" | gh secret set KEYSTORE_PASSWORD
# For PKCS12 keystores, the key password is normally the same as the keystore password.
printf '%s' "$RE_PORT_PASSWORD" | gh secret set KEY_PASSWORD
unset RE_PORT_PASSWORD
```

Run those commands from this repository, and adjust the alias, path, and key password if using an existing keystore. Do not send any of the values to the assistant.

These secrets alone do not change the current debug workflow. Before distributing a production release, update the workflow to build `assembleRelease`, sign it using the secrets, and verify the signature. Keep the signing key outside the repository.

An APK signed by a different key (including the earlier debug APK) cannot be updated in place; uninstall it first, which may remove its local app data.
