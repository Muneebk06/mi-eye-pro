"""Run locally, review each face in context, and save only human selections."""
import argparse
import csv
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

FIELDS = "crop_file preview_file source_video timestamp_sec det_score blur_score bbox assigned_id view_type".split()
DEFAULT = Path(r"C:\Users\Muneeb\PycharmProjects\Fyp_model\dataset_curated")
PAGE = """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MEye-Pro · Crop review</title><style>
*{box-sizing:border-box}body{margin:18px auto;padding:0 18px;max-width:1280px;background:#f4f7f8;color:#172b32;font:15px/1.4 system-ui}
header,nav,.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
header{margin-bottom:12px}h1{font-size:1.45rem;margin:0}main{background:#fff;padding:18px;border-radius:12px;box-shadow:0 1px 4px #0001}
.targets{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}.badge{padding:4px 10px;border-radius:999px;background:#e8eef0;font-size:.88rem;font-weight:600}
.badge.ready{background:#d1f0df;color:#125c36}.badge.muted{background:#f0f2f3;color:#55656b}
.images{display:grid;grid-template-columns:minmax(240px,1fr) 2.4fr;gap:14px}figure{margin:0}figcaption{font-weight:600;margin:0 0 6px}
img{width:100%;height:clamp(240px,48vh,540px);object-fit:contain;background:#e9eeef;border-radius:8px;border:1px solid #d7e0e3}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;font-size:.92rem}.chip{background:#f1f5f6;padding:4px 9px;border-radius:6px;overflow-wrap:anywhere}
.pills,.buttons{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;align-items:center}
button,input,select{font:inherit;padding:7px 11px;border:1px solid #9aabad;border-radius:6px;background:#fff}
button{cursor:pointer}button:hover,button:focus-visible{background:#dcf2ed;border-color:#2c7a6b}button:disabled{opacity:.45;cursor:default}
.pill{border-radius:999px;padding:5px 13px;font-size:.92rem}.pill.active{background:#175c4f;color:#fff;border-color:#175c4f}
#msg{color:#a13514;margin:8px 0 0;min-height:1.2em}.hint{color:#52666d;font-size:.86rem}nav{margin-top:12px}
@media(max-width:720px){.images{grid-template-columns:1fr}#crop{height:210px}}
</style><header><div><h1>MEye-Pro · Crop review</h1><span id="progress" class="hint"></span></div>
<label>Show <select id="filter"><option value="unlabeled_photos">Unlabeled (Photos First)</option><option value="unlabeled">Unlabeled (CSV Order)</option><option value="photos">Enrollment Photos Only</option><option value="all">All</option></select></label></header>
<div id="targets" class="targets" aria-live="polite"></div>
<main><section id="panel"><div class="images"><figure><figcaption id="face"></figcaption><img id="crop" alt="Candidate face"></figure>
<figure><figcaption>Numbered full-frame preview <span class="hint">(click to zoom)</span></figcaption><a id="open" target="_blank" rel="noopener"><img id="preview" alt="Numbered faces in source frame"></a></figure></div>
<div id="details" class="meta"></div>
<div class="pills"><strong>View:</strong><span id="views" class="pills" style="margin:0"></span></div>
<div id="buttons" class="buttons"></div>
<div class="row"><form id="custom"><label>Custom ID <input id="identity" placeholder="student:Abdullah_Farooqi" required></label> <button>Assign ID</button></form>
<span class="hint">Shortcuts: 1–5 presets · u unknown · s skip · ←/→ prev/next</span></div>
<nav><button id="prev">← Previous</button><span id="position"></span><button id="next">Next →</button></nav></section>
<p id="empty" hidden>No crops in this view.</p><p id="msg" role="status"></p></main>
<script>
const el=id=>document.getElementById(id),TARGET=4;
const presets=['student:Ahmed_Khan','student:Ali_Raza','student:Farrukh_Waheed','student:Muneeb_Khan','teacher:Naseer','unknown','skip'];
const keys=['1','2','3','4','5','u','s'],views=[['','Unspecified'],['front','front'],['side','side'],['angled','angled']];
let rows=[],index=0,busy=false;const extra=new Set();
const isPhoto=r=>r.source_video.startsWith('students/')||r.source_video.startsWith('teacher/');
function filtered(){
 const mode=el('filter').value;
 if(mode==='all')return rows;
 if(mode==='photos')return rows.filter(isPhoto);
 const open=rows.filter(r=>!r.assigned_id.trim());
 return mode==='unlabeled_photos'?[...open.filter(isPhoto),...open.filter(r=>!isPhoto(r))]:open;
}
async function api(url,options){const res=await fetch(url,options);if(!res.ok)throw Error(await res.text());return res.json()}
function syncExtras(){for(const r of rows){const v=r.assigned_id.trim();if(v&&!presets.includes(v))extra.add(v)}}
function renderTargets(){
 const counts={};for(const id of presets.slice(0,5))counts[id]=0;for(const id of extra)counts[id]=0;
 let unk=0,skp=0;
 for(const r of rows){const v=r.assigned_id.trim();if(!v)continue;if(v==='unknown')unk++;else if(v==='skip')skp++;else counts[v]=(counts[v]||0)+1}
 el('targets').replaceChildren();
 for(const [id,n] of Object.entries(counts)){
  const b=document.createElement('span');b.className='badge'+(n>=TARGET?' ready':'');
  b.textContent=id.split(':').pop()+': '+n+'/'+TARGET;el('targets').append(b);
 }
 if(unk||skp){const b=document.createElement('span');b.className='badge muted';b.textContent='unknown: '+unk+' · skip: '+skp;el('targets').append(b)}
}
function render(){
 syncExtras();renderTargets();
 const list=filtered();index=Math.max(0,Math.min(index,list.length-1));const r=list[index];
 el('progress').textContent='Labeled '+rows.filter(x=>x.assigned_id.trim()).length+' / '+rows.length;
 el('panel').hidden=!r;el('empty').hidden=!!r;if(!r)return;
 for(const [id,key] of [['crop','crop_file'],['preview','preview_file']])el(id).src='/image?file='+encodeURIComponent(r[key]);
 el('open').href=el('preview').src;
 const faceTag=r.crop_file.split('_').pop().split('.')[0];
 el('face').textContent='Candidate '+faceTag;
 el('details').replaceChildren(...[
  'Source: '+r.source_video,'Time: '+r.timestamp_sec+'s','Blur: '+r.blur_score,
  'Det: '+r.det_score,'Label: '+(r.assigned_id||'Unlabeled')
 ].map(t=>{const s=document.createElement('span');s.className='chip';s.textContent=t;return s}));
 el('views').replaceChildren();
 for(const [val,label] of views){const b=document.createElement('button');b.type='button';
  b.className='pill'+(r.view_type===val?' active':'');b.textContent=label;
  b.onclick=()=>save(r.assigned_id,val,false);el('views').append(b)}
 el('position').textContent=(index+1)+' of '+list.length;
 el('prev').disabled=index===0;el('next').disabled=index===list.length-1;
 el('buttons').replaceChildren();
 for(const id of new Set([...presets,...extra])){const b=document.createElement('button');const k=keys[presets.indexOf(id)];
  b.textContent=(k?'['+k+'] ':'')+id;b.onclick=()=>save(id,r.view_type);el('buttons').append(b)}
}
async function save(id,viewType,advance=true){
 const list=filtered(),r=list[index];if(!r||busy)return;busy=true;el('msg').textContent='';
 try{const result=await api('/api/label',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({crop_file:r.crop_file,previous:[r.assigned_id,r.view_type],assigned_id:id,view_type:viewType})});
  rows=result;if(id&&!presets.includes(id))extra.add(id);
  if(advance&&!el('filter').value.startsWith('unlabeled'))index++;el('identity').value='';render()}
 catch(e){el('msg').textContent=e.message;rows=await api('/api/crops');render()}finally{busy=false}
}
el('prev').onclick=()=>{if(!busy&&index>0){index--;render()}};
el('next').onclick=()=>{if(!busy&&index<filtered().length-1){index++;render()}};
el('filter').onchange=()=>{index=0;render()};
el('custom').onsubmit=e=>{e.preventDefault();const r=filtered()[index];if(r)save(el('identity').value.trim(),r.view_type)};
document.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.key==='ArrowLeft'){e.preventDefault();el('prev').click();return}
 if(e.key==='ArrowRight'){e.preventDefault();el('next').click();return}
 const i=keys.indexOf(e.key.toLowerCase()),r=filtered()[index];
 if(i>=0&&r){e.preventDefault();save(presets[i],r.view_type)}
});
api('/api/crops').then(data=>{rows=data;render()}).catch(e=>el('msg').textContent=e.message);
</script></html>"""


def load(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != FIELDS:
            raise ValueError("Expected the original nine-column crops_metadata.csv schema")
        return list(reader)


class Review(BaseHTTPRequestHandler):
    def reply(self, status, body, kind="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path)
        if path.path == "/":
            return self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        rows = load(self.server.metadata)
        if path.path == "/api/crops":
            return self.reply(200, json.dumps(rows).encode(), "application/json")
        if path.path == "/image":
            key = parse_qs(path.query).get("file", [""])[0]
            base = self.server.metadata.parent
            image = (base / key).resolve()
            if (image.is_relative_to(base) and image.suffix.lower() == ".jpg"
                    and any(key in (r["crop_file"], r["preview_file"]) for r in rows) and image.is_file()):
                return self.reply(200, image.read_bytes(), "image/jpeg")
        self.reply(404, b"Not found")

    def do_POST(self):
        if self.path != "/api/label":
            return self.reply(404, b"Not found")
        hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        host = self.headers.get("Host")
        origin = self.headers.get("Origin")
        if (host not in hosts or (origin is not None and origin not in {f"http://{h}" for h in hosts})
                or self.headers.get_content_type() != "application/json"):
            return self.reply(403, b"Use the local review page")
        path = self.server.metadata
        try:
            length = int(self.headers.get("Content-Length", 0))
            if not 0 < length <= 8192:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(length))
            label, view = data["assigned_id"].strip(), data["view_type"].strip()
            if label not in ("unknown", "skip", ""):
                role, _, name = label.partition(":")
                role = role.lower()
                if (role not in ("student", "teacher") or not name or len(name) > 100
                        or not all(c.isalnum() or c in "_-" for c in name) or Path(name).is_reserved()):
                    raise ValueError("Use student:<ID> or teacher:<ID> with letters, digits, underscores or hyphens")
                label = f"{role}:{name}"
            if view not in ("front", "side", "angled", ""):
                raise ValueError("Invalid view type")
            rows = load(path)
            row = next((r for r in rows if r["crop_file"] == data["crop_file"]), None)
            if row is None:
                return self.reply(404, b"Unknown crop")
            if data["previous"] != [row["assigned_id"], row["view_type"]]:
                return self.reply(409, b"Crop changed. Review the refreshed label.")
            row.update(assigned_id=label, view_type=view)
            tmp = path.with_suffix(".review.tmp")
            with tmp.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS)
                writer.writeheader()
                writer.writerows(rows)
            tmp.replace(path)
        except (KeyError, ValueError, AttributeError, TypeError) as error:
            return self.reply(400, str(error).encode())
        self.reply(200, json.dumps(rows).encode(), "application/json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--curated-dir", type=Path, default=DEFAULT)
    args = parser.parse_args()
    metadata = args.curated_dir.resolve() / "enrollment_candidates/crops_metadata.csv"
    load(metadata)
    with HTTPServer(("127.0.0.1", args.port), Review) as server:
        server.metadata = metadata
        print(f"Open http://127.0.0.1:{server.server_port} · Ctrl+C to stop", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
