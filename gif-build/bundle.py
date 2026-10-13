"""Bundle pinned MIT packages with no build-time JavaScript execution."""
from pathlib import Path
import re, json
base=Path(__file__).parent
modules={}
def collect(path):
    path=path.resolve()
    key=str(path.relative_to(base.resolve())).replace('\\','/')
    if key in modules:return key
    modules[key]=''
    def replace(match):
        name=match.group(1)
        if name.startswith('.'):
            target=path.parent/name
            target=target/'index.js' if target.is_dir() else target.with_suffix('.js')
        else:
            parts=name.split('/')
            target=base/parts[0]/'package'
            target=target.joinpath(*parts[1:]) if len(parts)>1 else target/'lib/index.js'
            if not target.suffix:target=target.with_suffix('.js')
        return 'require('+json.dumps(collect(target))+')'
    modules[key]=re.sub(r'require\([\"\']([^\"\']+)[\"\']\)',replace,path.read_text())
    return key
decoder=collect(base/'gifuct-js/package/lib/index.js')
encoder=collect(base/'gifenc/package/dist/gifenc.js')
out='/* gifuct-js 2.1.2, gifenc 1.0.3, js-binary-schema-parser 2.0.3; MIT. See gif-codec-LICENSE.txt. */\n(function(root){const modules={\n'
out+=',\n'.join(json.dumps(k)+':function(module,exports,require){\n'+v+'\n}' for k,v in modules.items())
out+='\n},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports}const api={...require('+json.dumps(decoder)+'),...require('+json.dumps(encoder)+')};root.FocusGifCodec=api;if(typeof module!=="undefined")module.exports=api;})(globalThis);\n'
(base.parent/'vendor/gif-codec.js').write_text(out,encoding='utf-8')
licenses=[]
for name in ['gifuct-js','gifenc','js-binary-schema-parser']:
    licenses.append(name+'\n'+next((base/name/'package').glob('LICENSE*')).read_text())
(base.parent/'vendor/gif-codec-LICENSE.txt').write_text('\n\n'.join(licenses),encoding='utf-8')
