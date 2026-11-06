'use strict';
const {spawnSync}=require('node:child_process');
const {readdirSync}=require('node:fs');
const files=['app.js','heptagon.js','layer-engine.js',...readdirSync('pages').filter(x=>x.endsWith('.js')).map(x=>'pages/'+x),...readdirSync('desktop').filter(x=>x.endsWith('.cjs')).map(x=>'desktop/'+x),...readdirSync('scripts').filter(x=>x.endsWith('.cjs')).map(x=>'scripts/'+x)];
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log(`Syntax checked ${files.length} files.`);
