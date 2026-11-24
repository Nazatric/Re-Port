# Android end-to-end flows (Maestro)

Run by the `android-e2e` job in `.github/workflows/android.yml` on an emulator, against the debug APK built in the same run.
The flows use only visible text (bottom tabs, the search box and game titles), so they do not depend on the catalog order.

Run locally with the Maestro CLI installed and an emulator or device attached:

    maestro test maestro/
