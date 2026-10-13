const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
test('Every shipped JavaScript file parses, including UI code outside model fixtures',()=>{
 for(const file of fs.readdirSync('.').filter(name=>name.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,file+'\n'+result.stderr)}
});
test('Every inline script in the shipped HTML parses',()=>{
 const html=fs.readFileSync('index.html','utf8');let count=0;for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!match[2].trim()||match[1].includes('type="module"'))continue;count++;assert.doesNotThrow(()=>new vm.Script(match[2]),'Inline script '+count)}assert(count>0);
});
