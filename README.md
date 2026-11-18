# Sano Local.TTS

Create English voiceovers and timed captions in your browser. The studio serves its own speech models and processes your scripts and audio on your device. [Open the studio](https://dskhanal.github.io/SanoLocalTTS/)

## Use the studio

- **Narrate a script.** Choose an Australian, American or British voice. Edit or delete the `[pause 2s]` markers at either end, then select **Generate voiceover**. The studio remembers your voice settings for new pages.
- **Export audio and captions.** Save narration as WAV and captions as SRT or WebVTT. To caption existing audio, choose **Record audio → Open audio file**.
- **Save a project.** Use **Project mode** for multiple scripts. **Save JSON** lets you resume editing. **Download all** collects the pages and their exports into a ZIP.

## Run locally

With Node.js 22 installed, run these commands and open the address Vite prints.

```sh
npm ci
npm run dev
```

The first run downloads the models. For production, run `npm run build` and host `dist/` over HTTPS. For GitHub Pages, select **Settings → Pages → Source → GitHub Actions**. Pushes to `main` trigger deployment.

## PowerPoint

On Windows with Microsoft 365, run `.\setup.ps1` once, then `.\start.ps1` from PowerShell. Upload `manifest.xml` through **My Add-ins → Upload My Add-in**. Choose **Get selected text** to narrate slide text, then insert the exported WAV with **Insert → Audio**.

## Model credits

American and British voices use Kokoro. Whisper Tiny English supplies transcription. [Kokoro](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) · [Whisper](https://huggingface.co/Xenova/whisper-tiny.en)

The Australian voices use Data Craftsman Australia’s unmodified Piper model under CC BY 4.0. [Model](https://huggingface.co/DataCraftsmanAustralia/piper-en_AU-librivox-medium) · [Narrator credits](https://huggingface.co/DataCraftsmanAustralia/piper-en_AU-librivox-medium/blob/main/ATTRIBUTION.md) · [Licence](https://creativecommons.org/licenses/by/4.0/)
