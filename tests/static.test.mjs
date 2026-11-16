import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BACKUP_LIMIT, bilirubinAverage, makeBackup, quoteCSV, validateBackup } from "../dist/backup.js";
import { stagePages } from "../scripts/stage-pages.mjs";
import { legacy, olderRecords, profile, time } from "./fixtures.mjs";

const asset = name => readFile(new URL("../dist/" + name, import.meta.url));

test("manifest launch, URL scope and icons work at the root and at a project path", async () => {
  const manifest = JSON.parse(await asset("manifest.webmanifest"));
  assert.equal(manifest.name,"糖糖日记");
  assert.equal(manifest.short_name,"糖糖日记");
  assert.equal(manifest.display,"standalone");
  const html = (await asset("index.html")).toString();
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(([,ref])=>ref);
  for (const directory of ["https://example.org/", "https://example.org/tangtang-diary/"]) {
    assert.equal(new URL(manifest.scope,directory).href,directory);
    assert.equal(new URL(manifest.id,directory).href,directory);
    assert.equal(new URL(manifest.start_url,directory).href,directory+"?source=pwa");
    for (const ref of [...refs, ...manifest.icons.map(i=>i.src)]) {
      assert.equal(new URL(ref,directory).href,directory+ref.replace(/^\.\//,""));
      assert.ok((await asset(ref)).length);
    }
  }
  for (const [name,size] of [["icon-apple.png",180],["icon-192.png",192],["icon-512.png",512]]) {
    const png = await asset(name);
    assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16),size);
    assert.equal(png.readUInt32BE(20),size);
    assert.equal(png[24],8);
  }
});

test("staging publishes only the shell and stamps a stable content ID", async () => {
  const temp = await mkdtemp(join(tmpdir(),"tangtang-stage-"));
  try {
    const revision = await stagePages(join(temp,"first"));
    assert.equal(await stagePages(join(temp,"second")),revision);
    const worker = await readFile(join(temp,"first","sw.js"),"utf8");
    assert.ok(worker.includes(revision));
    assert.ok(!worker.includes("__SHELL_REVISION__"));
  } finally {
    await rm(temp,{recursive:true,force:true});
  }
});

test("legacy and new backups preserve all records, exact dates, profile and deletion markers", () => {
  const snapshot=validateBackup(JSON.parse(JSON.stringify(legacy)));
  assert.deepEqual(snapshot,{version:1,profile,records:olderRecords,settings:{dark:true,last_export_at:null}});
  const exported=makeBackup(snapshot,time);
  assert.equal(exported.format,"tangtang-journal-backup");
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(exported))),snapshot);
  const blank={...exported,profile:{nickname:"",born_at:null},records:[]};
  assert.deepEqual(validateBackup(blank).profile,blank.profile);
});

test("reject invalid versions, profile, timestamp, type, payload, revision and duplicate or excessive records", () => {
  const record = olderRecords[0];
  for (const [changes, error] of [
    [{format:"unrelated"},/备份/],
    [{schema_version:2},/备份/],
    [{exported_at:"2026-02-30T14:00:00Z"},/导出时间/],
    [{profile:{...profile,born_at:0}},/宝宝资料/],
    [{settings:{dark:"true"}},/设置/],
    [{records:[record, record]},/编号重复/],
    [{records:[{...record,record_id:" "}]},/编号/],
    [{records:[{...record,type:"sleep"}]},/类型/],
    [{records:[{...record,occurred_at:"2026-01-01"}]},/时间/],
    [{records:[{...record,created_at:null}]},/时间/],
    [{records:[{...record,deleted_at:"unknown"}]},/时间/],
    [{records:[{...record,revision:-1}]},/修订/],
    [{records:[{...record,payload:[]}]},/内容/],
    [{records:[{...record,payload:{...record.payload,amount_ml:""}}]},/内容/],
    [{records:new Array(50001)},/记录过多/]
  ]) assert.throws(()=>validateBackup({...legacy,...changes}),error);
  assert.equal(BACKUP_LIMIT,8*1024*1024);
});

test("CSV escapes quotes, commas and line breaks while protecting spreadsheet cells", () => {
  assert.equal(quoteCSV('甲,"\n乙'),'"甲,""\n乙"');
  assert.equal(quoteCSV(45),'"45"');
  for (const text of ["=CMD()","+测试","-测试","@测试"," \t＝测试","\n测试"]) {
    assert.equal(quoteCSV(text),'"' + "'" + text + '"');
  }
});

test("four original bilirubin readings remain in a version-one backup", () => {
  const original = olderRecords.find(record=>record.type==="bilirubin");
  const readings = [2,"2.1",2,"2.1"];
  assert.equal(bilirubinAverage(readings),2.05);
  assert.equal(bilirubinAverage([0,0,0,0]),0);
  const record = {...original,payload:{...original.payload,readings,value:2.05}};
  const saved = makeBackup(validateBackup({...legacy,records:[record]}),time);
  assert.deepEqual(validateBackup(saved).records,[record]);
  for (const invalid of [[1,2,3],[1,2,3,""],[1,2,3,-1],[1,2,3,Infinity],new Array(4)]) {
    assert.equal(bilirubinAverage(invalid),null);
    assert.throws(()=>validateBackup({...saved,records:[{...record,payload:{...record.payload,readings:invalid}}]}),/内容/);
  }
});
