import { buildRipchord, buildScaler, buildXML, parseText } from '../convert-ripchord-scaler.mjs';

const input = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const queue = document.querySelector('#queue');
const fileList = document.querySelector('#file-list');
const downloadAll = document.querySelector('#download-all');
const records = [];
let recordId = 0;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
const outputName = (name, type) => `${name.replace(/\.(rpc|xml)$/i, '')}.${type === 'ripchord' ? 'xml' : 'rpc'}`;

function render() {
  queue.hidden = records.length === 0;
  document.querySelector('#file-count').textContent = records.length ? `${records.length} file${records.length === 1 ? '' : 's'}` : '';
  const completed = records.filter((record) => record.content);
  downloadAll.disabled = completed.length === 0;
  document.querySelector('#queue-note').textContent = `${completed.length} of ${records.length} file${records.length === 1 ? '' : 's'} ready · converted locally`;
  fileList.innerHTML = records.map((record) => `
    <article class="file-row ${record.error ? 'has-error' : ''}" data-id="${record.id}">
      <span class="file-badge ${record.type === 'ripchord' ? 'rip-badge' : record.type === 'scaler' ? 'scaler-badge' : ''}">${record.type === 'ripchord' ? 'R' : record.type === 'scaler' ? 'S' : '!'}</span>
      <div class="file-info"><strong title="${escapeHtml(record.file.name)}">${escapeHtml(record.file.name)}</strong><span>${record.error ? escapeHtml(record.error) : record.content ? `${record.chords} chords · ${record.type === 'ripchord' ? 'Ripchord → Scaler' : 'Scaler → Ripchord'} · ${formatSize(record.file.size)}` : 'Reading file…'}</span></div>
      ${record.content ? `<button class="single-download" data-download="${record.id}" aria-label="Download ${escapeHtml(record.name)}" title="Download ${escapeHtml(record.name)}">↓</button>` : '<span class="row-state">…</span>'}
      <button class="remove-file" data-remove="${record.id}" aria-label="Remove ${escapeHtml(record.file.name)}" title="Remove file">×</button>
    </article>`).join('');
}

async function convertFile(file) {
  const record = { id: ++recordId, file, content: '', name: '', type: '', chords: 0, error: '' };
  records.push(record);
  render();
  try {
    if (!/\.(rpc|xml)$/i.test(file.name)) throw new Error('Unsupported file type. Choose a .rpc or .xml preset.');
    const text = await file.text();
    const parsed = parseText(text, { sharps: document.querySelector('#note-spelling').value === 'true' });
    if (!parsed || !['ripchord', 'scaler'].includes(parsed.type) || parsed.chords.length === 0) {
      throw new Error('This file is empty or is not a valid Ripchord / Scaler preset.');
    }
    const isRipchord = parsed.type === 'ripchord';
    const built = isRipchord
      ? buildScaler(parsed)
      : buildRipchord(parsed, { generateTrigger: true, startValue: Number(document.querySelector('#start-value').value) });
    record.content = buildXML(built);
    record.name = outputName(file.name, parsed.type);
    record.type = parsed.type;
    record.chords = parsed.chords.length;
  } catch (error) {
    record.error = error instanceof Error ? error.message : 'Could not convert this file.';
  }
  render();
}

function addFiles(files) {
  const incoming = [...files].filter((file) => !records.some((record) => record.file.name === file.name && record.file.size === file.size && record.file.lastModified === file.lastModified));
  incoming.forEach((file) => convertFile(file));
  input.value = '';
}

function download(name, content, type = 'application/xml;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A small, dependency-free ZIP writer using stored entries (no compression).
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(10, 0, true); view.setUint16(12, 0x0021, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true); header.set(name, 30);
    local.push(header, data);
    const entry = new Uint8Array(46 + name.length);
    const dir = new DataView(entry.buffer);
    dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true); dir.setUint16(12, 0, true); dir.setUint16(14, 0x0021, true);
    dir.setUint32(16, crc, true); dir.setUint32(20, data.length, true); dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true); dir.setUint32(42, offset, true); entry.set(name, 46);
    central.push(entry);
    offset += header.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}

document.querySelector('#browse-button').addEventListener('click', (event) => { event.stopPropagation(); input.click(); });
dropzone.addEventListener('click', (event) => { if (!event.target.closest('button')) input.click(); });
dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
input.addEventListener('change', () => addFiles(input.files));
for (const eventName of ['dragenter', 'dragover']) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
for (const eventName of ['dragleave', 'drop']) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); });
dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
document.querySelector('#settings-toggle').addEventListener('click', (event) => {
  const panel = document.querySelector('#settings-panel');
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!expanded)); panel.hidden = expanded;
});
document.querySelector('#clear-button').addEventListener('click', () => { records.length = 0; render(); });
fileList.addEventListener('click', (event) => {
  const removeId = Number(event.target.closest('[data-remove]')?.dataset.remove);
  const downloadId = Number(event.target.closest('[data-download]')?.dataset.download);
  if (removeId) { const index = records.findIndex((record) => record.id === removeId); if (index !== -1) records.splice(index, 1); render(); }
  if (downloadId) { const record = records.find((item) => item.id === downloadId); if (record?.content) download(record.name, record.content); }
});
downloadAll.addEventListener('click', () => {
  const completed = records.filter((record) => record.content);
  if (!completed.length) return;
  const usedNames = new Set();
  const zipFiles = completed.map((record) => {
    let name = record.name;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
      const dot = record.name.lastIndexOf('.');
      name = `${record.name.slice(0, dot)} (${suffix})${record.name.slice(dot)}`;
      suffix += 1;
    }
    usedNames.add(name.toLowerCase());
    return { name, content: record.content };
  });
  download('chordshift-presets.zip', makeZip(zipFiles), 'application/zip');
});
