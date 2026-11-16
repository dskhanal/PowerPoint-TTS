# Kokoro TTS for PowerPoint — JavaScript-only, sideloadable build

This package uses `kokoro-js` 1.2.1 and runs speech inference in the Office task pane through WebAssembly. It has no Python service.

## Requirements
- Windows 10/11
- PowerPoint for Microsoft 365 desktop
- Node.js 20 or 22 LTS for local sideload testing only
- Internet access on first generation so the quantised Kokoro model can be downloaded

## One-time setup
1. Extract the ZIP to a permanent folder, such as `C:\KokoroPowerPointJS`.
2. Open PowerShell in that folder.
3. Run: `Set-ExecutionPolicy -Scope Process Bypass`
4. Run: `.\setup.ps1`
5. Accept the prompt to trust the Microsoft Office add-in development certificate.

The script installs npm packages, creates a trusted localhost HTTPS certificate, builds the production assets, and validates `manifest.xml`.

## Start and sideload
1. Run `.\start.ps1` and leave PowerShell open.
2. Confirm `https://localhost:3000` opens in Edge without a certificate warning.
3. In PowerPoint select **Home > Add-ins > More Add-ins > My Add-ins > Upload My Add-in**.
4. Browse to this folder and select `manifest.xml`.
5. Open **Kokoro TTS for PowerPoint** from **Home > Add-ins**.

If **Upload My Add-in** is unavailable on a managed Holmesglen device, use an approved network shared-folder catalogue or ask Microsoft 365 administrators to upload `manifest.xml` through **Integrated apps**.

## Use
Select slide text, choose **Get selected text**, select a voice and speed, and choose **Generate WAV**. Download the WAV and add it using **Insert > Audio > Audio on My PC**.

## Production deployment
End users do not need Node.js when `dist/` is hosted centrally. Publish `dist/` to an organisational HTTPS site, replace every `https://localhost:3000/` value in `manifest.xml` with that origin, validate the manifest, and deploy it through Microsoft 365 Integrated apps.

## Privacy and network behaviour
Narration inference runs on the user's computer. The model and voice assets are downloaded from the model repository configured by `kokoro-js` on first use. For restricted networks, mirror those assets to an approved internal host before broad deployment.
