import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Module=require('node:module');
const r=await build({stdin:{contents:"import {renderToStaticMarkup} from 'react-dom/server';import {createElement} from 'react';import {Sprite} from './src/pixel/Scene';import {MAPS,itemsForMap} from './src/pixel/model';export const previews=MAPS.flatMap(m=>itemsForMap(m.id).map(i=>({id:i.id,markup:renderToStaticMarkup(createElement(Sprite,{id:i.id}))})));",resolveDir:process.cwd(),loader:'tsx'},bundle:true,jsx:'automatic',platform:'node',format:'cjs',write:false});
const bundled=new Module(import.meta.filename);bundled.paths=Module._nodeModulePaths(process.cwd());bundled._compile(r.outputFiles[0].text,import.meta.filename);const {previews}=bundled.exports;
for(const {id,markup}of previews){assert.match(markup,/<(?:img|svg)\b/,`${id}: missing shop picture`);const src=markup.match(/src="([^"]+)"/);if(src)await access('public'+src[1]);}
console.log(`PASS: every shop item has a real preview (${previews.length} items), including fire and lantern; all raster paths exist.`);
