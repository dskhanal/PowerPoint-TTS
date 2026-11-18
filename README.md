# Open Local.TTS for PowerPoint — JavaScript-only, sideloadable build

This package uses `kokoro-js` 1.2.1 and runs speech inference in the Office task pane through WebAssembly. It has no Python service.

## Browser studio

With Node.js 20 or 22 installed, run `npm ci` and `npm run dev` from this folder. Open the local address printed by Vite in a current desktop browser.

Type or paste an English script, import a plain-text file, or choose **Use sample**. Select an Australian, American or British English voice and set the speed between 0.5× and 2×. Choose **Generate voiceover**. The first generation downloads the model for the selected voice family. The app runs synthesis in a browser worker and supports cancellation.

Place the cursor in your script, choose a duration and select **Insert pause**. For example, `Welcome.[pause 2s]Let’s begin.` inserts two seconds of silence. An ellipsis (`...` or `…`) inserts one second. Caption cues stop for the pause and resume with the next spoken phrase.

Choose an **Emotion** (Calm, Cheerful, Serious or Excited) and adjust **Intensity**. These local audio presets shape pitch, vocal brightness and syllable emphasis. In text-to-speech they also adjust speaking pace within the 0.5× to 2× range. Neutral and 0% intensity use the voice’s ordinary delivery. Preview a phrase to hear how the effect suits the speaker and script.

Choose **Vocal pitch** to raise or lower the voice by two or four semitones while preserving its pace. **Volume and fades** adjusts the exported level and the fade at each end of the track. **Preview voice** plays the first spoken phrase with your settings, or a sample if the script is empty. Choose **Generate voiceover** to apply edits to the full WAV and captions.

Play or seek the finished narration in the audio monitor and choose **Export audio** for a mono WAV (22.05 kHz for Australian voices, 24 kHz for Kokoro voices). Open **Captions** to play from a cue, edit its wording and export an SRT or WebVTT file. Each cue uses the duration of its generated phrase. Export the files before closing the studio.

## Recording and local Whisper captions

Open **Record audio**, select **Start recording**, and allow microphone access. **Stop recording** releases the microphone and prepares a 48 kHz mono WAV. **Export audio** saves it immediately, including while Whisper is transcribing. **Open audio file** also accepts recordings in formats your browser can decode.

Whisper Tiny English transcribes the audio in a separate browser worker. Select **Review captions** to listen from each timestamp, edit the recognised text, and export SRT or WebVTT. You can cancel transcription and retry with the same WAV. Recording and TTS keep separate audio and caption edits for the current session. Download the files you want to keep before closing the page.

After transcription, the recorder’s **Emotion** and **Apply to recording** controls let you adjust a take and export the result. Each adjustment starts from the original WAV and keeps its duration and caption edits. Select **Neutral** and apply to restore the original.

The first development start or production build installs about 43 MB of pinned, checksum-verified model files under `public/models/Xenova/whisper-tiny.en/`. To prepare them explicitly, run `npm run prepare:whisper`. Subsequent builds reuse the files offline. Vite includes them and the WebAssembly runtime in `dist/`. Whisper reads from the app’s own server, with remote model loading disabled. Microphone capture requires localhost or HTTPS and permission from the browser or Office host. [Whisper model and licence](https://huggingface.co/Xenova/whisper-tiny.en)

## Australian English voices

The Australian English group includes Angus, Banjo, Bindi, Flynn, Kirra, Marlo, Matilda, Tully and Willow. They share a 77 MB model that the browser caches when storage is available. These voices were trained on audiobook readings and have a literary delivery. The speed control, timed captions and WAV export work with every speaker.

The studio uses Data Craftsman Australia’s unmodified Piper model under CC BY 4.0. The publisher lists the source recordings and narrators in its attribution file. [Model and samples](https://huggingface.co/DataCraftsmanAustralia/piper-en_AU-librivox-medium) · [Narrator credits](https://huggingface.co/DataCraftsmanAustralia/piper-en_AU-librivox-medium/blob/main/ATTRIBUTION.md) · [Licence](https://creativecommons.org/licenses/by/4.0/)

## PowerPoint requirements
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
5. Open **Open Local.TTS for PowerPoint** from **Home > Add-ins**.

If **Upload My Add-in** is unavailable on a managed Holmesglen device, use an approved network shared-folder catalogue or ask Microsoft 365 administrators to upload `manifest.xml` through **Integrated apps**.

## Using narration in PowerPoint

Select slide text and choose **Get selected text** in the task pane. Generate and export the voiceover, then insert the WAV using **Insert > Audio > Audio on My PC**. Export WebVTT from the Captions tab when you need a caption file.

## Production deployment
End users do not need Node.js when `dist/` is hosted centrally. Publish `dist/` to an organisational HTTPS site, replace every `https://localhost:3000/` value in `manifest.xml` with that origin, validate the manifest, and deploy it through Microsoft 365 Integrated apps.

## Privacy and network behaviour
Narration inference runs on the user's computer. Voice assets are downloaded from the Kokoro or Australian Piper model repository on Hugging Face when first used. For restricted networks, mirror those assets to an approved internal host before broad deployment.
