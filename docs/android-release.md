# Signed Android release

The Android workflow normally builds a release APK signed with a persistent key stored in GitHub Actions secrets. For an explicitly requested one-time build only, a push commit containing `[one-time-apk]` may use a temporary signing key if the secrets are absent. The temporary key is deleted after the build and is not retained, so future APKs signed with a different key cannot update it in place. The workflow does not publish a debug APK. The app is a Capacitor Android application: the React interface is bundled inside the APK, not deployed as a separate website.

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

Once the secrets are configured, push to the session branch to start the workflow, or run it manually if the workflow is present on the repository's default branch. Download the `RePort-release-apk` artifact from the successful Actions run. A version-tag build also attaches the APK to the corresponding GitHub release.

An APK signed by a different key (including the earlier debug APK) cannot be updated in place; uninstall it first, which may remove its local app data.
