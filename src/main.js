import './style.css';
import { KokoroTTS } from 'kokoro-js';

const app=document.querySelector('#app');
app.innerHTML=`<main><header><div class="logo">K</div><div><h1>Kokoro TTS</h1><p>Local PowerPoint narration</p></div></header>
<section class="card"><label for="text">Narration text</label><textarea id="text" rows="8" placeholder="Select PowerPoint text, then choose Get selected text"></textarea><div class="between"><button id="selection" class="secondary">Get selected text</button><span id="counter">0 characters</span></div></section>
<section class="card"><label for="voice">Voice</label><select id="voice"><option>Loading voices…</option></select><label for="speed">Speed <output id="speedOut">1.00×</output></label><input id="speed" type="range" min="0.5" max="2" value="1" step="0.05"><div class="between small"><span>Runs locally using Kokoro</span><span id="engine">Not loaded</span></div></section>
<button id="generate" class="primary">Generate WAV</button><div id="status" role="status" aria-live="polite"></div>
<section id="result" class="card hidden"><audio id="player" controls></audio><a id="download" class="download" download="kokoro-narration.wav">Download WAV</a><p class="hint">Then use PowerPoint → Insert → Audio → Audio on My PC.</p></section></main>`;
const $=id=>document.getElementById(id); let tts=null, blobUrl=null;
function status(v,bad=false){$('status').textContent=v;$('status').className=bad?'error':''}
function count(){$('counter').textContent=`${$('text').value.length} characters`}
$('text').addEventListener('input',count); $('speed').addEventListener('input',()=>{$('speedOut').value=`${Number($('speed').value).toFixed(2)}×`});
async function initialise(){if(tts)return tts; status('First run: downloading and loading the Kokoro model…'); $('engine').textContent='Loading'; try{tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'wasm'});const voices=tts.list_voices();$('voice').innerHTML='';for(const [id,info] of Object.entries(voices)){const o=document.createElement('option');o.value=id;o.textContent=`${id}${info?.name?` — ${info.name}`:''}`;$('voice').append(o)}$('engine').textContent='Ready';status('Kokoro is ready.');return tts}catch(e){$('engine').textContent='Load failed';status(`Model load failed: ${e.message}`,true);throw e}}
function getSelection(){if(!globalThis.Office){status('Open this task pane inside PowerPoint to read slide selection.',true);return} Office.context.document.getSelectedDataAsync(Office.CoercionType.Text,{valueFormat:Office.ValueFormat.Unformatted},r=>{if(r.status===Office.AsyncResultStatus.Succeeded){$('text').value=(r.value||'').trim();count();status($('text').value?'Selected text added.':'No text was selected.')}else status(r.error.message,true)})}
$('selection').addEventListener('click',getSelection);
$('generate').addEventListener('click',async()=>{const text=$('text').value.trim();if(!text){status('Enter or select some text first.',true);return}const b=$('generate');b.disabled=true;try{const engine=await initialise();status('Generating WAV locally…');const audio=await engine.generate(text,{voice:$('voice').value,speed:Number($('speed').value)});const wav=audio.toBlob ? await audio.toBlob() : pcmToWavBlob(audio);if(!wav)throw new Error('Unable to create a WAV from Kokoro output.');if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(wav);$('player').src=blobUrl;$('download').href=blobUrl;$('result').classList.remove('hidden');status('Narration is ready.')}catch(e){status(e.message,true)}finally{b.disabled=false}});
Office?.onReady?.(()=>{status('PowerPoint add-in ready. Select text or type narration.');});
// Lazy model loading keeps PowerPoint startup fast. Model downloads on first Generate.

function pcmToWavBlob(audio){
  const samples=audio?.audio ?? audio?.data ?? null; const rate=audio?.sampling_rate ?? audio?.samplingRate ?? 24000;
  if(!samples || !samples.length)return null; const buf=new ArrayBuffer(44+samples.length*2),v=new DataView(buf);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))}; w(0,'RIFF');v.setUint32(4,36+samples.length*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const x=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,x<0?x*32768:x*32767,true)} return new Blob([buf],{type:'audio/wav'});
}
