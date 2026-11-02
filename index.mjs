import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { buildRipchord, buildScaler, buildXML, parseText } from './convert-ripchord-scaler.mjs';

const args = process.argv.slice(2);
const startArgIndex = args.indexOf('--start');
const startValue = startArgIndex === -1 ? 48 : Number(args[startArgIndex + 1]);
const files = startArgIndex === -1 ? args : args.filter((arg, index) => arg !== '--start' && index !== startArgIndex + 1);

if (!files.length || !Number.isInteger(startValue) || startValue < 0 || startValue > 127) {
  console.error('Usage: node index.mjs <preset.rpc|preset.xml> [more files...] [--start MIDI_NOTE]');
  process.exitCode = 1;
} else {
  for (const file of files) {
    try {
      const parsed = parseText(await readFile(file, 'utf8'));
      if (!parsed || !parsed.chords.length) throw new Error('Not a valid Ripchord or Scaler preset.');
      const built = parsed.type === 'ripchord'
        ? buildScaler(parsed)
        : buildRipchord(parsed, { generateTrigger: true, startValue });
      const ext = parsed.type === 'ripchord' ? '.xml' : '.rpc';
      const outputPath = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}${ext}`);
      await writeFile(outputPath, buildXML(built), 'utf8');
      console.log(`${file} → ${outputPath}`);
    } catch (error) {
      console.error(`${file}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
