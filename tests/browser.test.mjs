import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium, webkit } from "playwright";
import { stagePages } from "../scripts/stage-pages.mjs";
import { legacy, olderRecords, profile } from "./fixtures.mjs";

const prefix = "/tangtang-diary/";
const clean = ["index.html","app.js","backup.js","styles.css","sw.js","manifest.webmanifest",
  "icon.svg","icon-apple.png","icon-192.png","icon-512.png"];
const MIME = {html:"text/html; charset=utf-8",css:"text/css; charset=utf-8",js:"text/javascript; charset=utf-8",
  webmanifest:"application/manifest+json",svg:"image/svg+xml",png:"image/png"};
const engine = process.env.TANGTANG_BROWSER || "chromium";
let browser, temp, server, origin, served, original, revision;
before(async () => {
  temp=await mkdtemp(join(tmpdir(),"tangtang-browser-"));
  served=original=join(temp,"release-one");
  revision=await stagePages(served);
  server=createServer(async (req,res)=>{
    const base=new URL(req.url,"http://localhost");
    if (base.pathname===prefix.slice(0,-1)) {
      res.writeHead(301,{Location:prefix}).end(); return;
    }
    const dir=base.pathname.startsWith(prefix) ? prefix : "/";
    const file=base.pathname.slice(dir.length) || "index.html";
    if (!clean.includes(file)) {res.writeHead(404).end(); return;}
    try {
      // Upgrade the project path independently; the root app is a different scope.
      const data=await readFile(join(dir===prefix ? served : original,file));
      res.writeHead(200,{"Content-Type":MIME[file.split(".").at(-1)],"Cache-Control":"no-store"}).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok,fail)=>server.listen(0,"127.0.0.1",ok).once("error",fail));
  origin="http://127.0.0.1:"+server.address().port;
  browser=await (engine==="webkit" ? webkit : chromium).launch(engine==="edge" ? {channel:"msedge"} : {});
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve=>server.close(resolve));
  if (temp) await rm(temp,{recursive:true,force:true});
});

const mobile = () => browser.newContext({viewport:{width:375,height:667},deviceScaleFactor:2,
  hasTouch:true,isMobile:true,timezoneId:"Asia/Singapore",acceptDownloads:true});
const nav = (page,tab) => page.locator('button.nav-button[data-tab="'+tab+'"]').click();
const btn = (page,action,kind) => page.locator('button[data-action="'+action+'"]'+(kind ? '[data-kind="'+kind+'"]' : ""));
const field = (page,name) => page.locator('#sheet-root [name="'+name+'"]');
const choice = (page,name,value) => page.locator('label:has(input[name="'+name+'"][value="'+value+'"])').click();
const toast = (page,text) => page.locator("#toast-root .toast").filter({hasText:text}).waitFor();
const ready = page => page.getByRole("heading",{name:"早安，妈妈"}).waitFor();
const open = async (page,kind) => {
  if (!await btn(page,"new-record",kind).count()) {
    await nav(page,"today");
    await btn(page,"record-history",kind).click();
  }
  await btn(page,"new-record",kind).click();
};
const lines = page => page.locator(".record-line");
const submit = async page => {
  await page.locator(".sheet-panel button[type=submit]").click();
  await page.locator(".sheet-layer").waitFor({state:"hidden"});
};
async function getBackup(page, extension="json") {
  const [download]=await Promise.all([page.waitForEvent("download"),btn(page,"export-"+extension).first().click()]);
  const file=join(temp,download.suggestedFilename());
  await download.saveAs(file);
  if (extension === "json") await toast(page,"已发起下载");
  return readFile(file);
}
async function upload(page,value) {
  const [chooser]=await Promise.all([page.waitForEvent("filechooser"),btn(page,"import-json").click()]);
  await chooser.setFiles({name:"test-backup.json",mimeType:"application/json",
    buffer:Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))});
}
async function confirmRestore(page,accept=true) {
  const dialog = page.waitForEvent("dialog").then(async dialog=>{
    assert.match(dialog.message(),/替换本机/);
    await (accept ? dialog.accept() : dialog.dismiss());
  });
  await Promise.all([dialog,page.getByRole("button",{name:"继续恢复"}).click()]);
}
function parseCsv(input) {
  assert.equal(input.charCodeAt(0),0xfeff);
  const rows=[[]];
  const cells=/"((?:[^"]|"")*)"(?:(,)|(\r\n)|$)/gy;
  cells.lastIndex=1;
  let end=1, match;
  while ((match=cells.exec(input))) {
    rows.at(-1).push(match[1].replaceAll('""','"'));
    if (match[3]) rows.push([]);
    end=cells.lastIndex;
  }
  assert.equal(end,input.length);
  assert.ok(rows.every(row=>row.length===rows[0].length));
  return rows.slice(1).map(row=>Object.fromEntries(row.map((cell,i)=>[rows[0][i],cell])));
}

test(engine + " mobile: records, refresh, CSV, new/legacy backup, cancelled or failed restore", {timeout:90000}, async () => {
  const context=await mobile();
  try {
    await context.addInitScript(()=>Object.defineProperty(Navigator.prototype,"canShare",{value:()=>false,configurable:true}));
    const page=await context.newPage();
    const errors=[], requests=[];
    page.on("pageerror", error=>errors.push(error.message));
    page.on("request",req=>requests.push(req.url()));
    await page.goto(origin+prefix.slice(0,-1));
    await ready(page);
    assert.equal(new URL(page.url()).pathname,prefix);
    assert.deepEqual(await page.locator(".metric-number").allTextContents(),["0ml","0次","0次"]);
    assert.deepEqual(await page.locator(".action-tile strong").allTextContents(),["喂奶","尿布","黄疸","体温"]);
    assert.deepEqual(await page.locator(".action-tile .tile-value").allTextContents(),Array(4).fill("暂无记录"));
    for (const [kind,title] of [["bottle","历史奶量"],["diaper","尿布记录"],["bilirubin","黄疸记录"],["temperature","体温记录"]]) {
      await btn(page,"record-history",kind).click();
      await page.getByRole("heading",{name:title,exact:true}).waitFor();
      assert.equal(await page.locator(".sheet-layer").count(),0);
      assert.equal(await lines(page).count(),0);
      assert.equal(await page.locator(".filter-chip.active").getAttribute("data-filter"),kind);
      assert.ok(await btn(page,"new-record",kind).isVisible());
      await nav(page,"today");
    }
    assert.match(await page.locator("#view").innerText(),/还没有记录.*|请填写宝宝昵称/);
    assert.equal(await page.locator(".activity-row").count(),0);
    await btn(page,"profile").click();
    assert.equal(await field(page,"born_at").inputValue(),"");
    await field(page,"nickname").fill("仅测试");
    const dates=await page.evaluate(()=>{
      const formDate=delta=>{
        const d=new Date(Date.now()+delta);
        return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
      };
      return {born:formDate(-72*3600000),yesterday:formDate(-24*3600000)};
    });
    await field(page,"born_at").fill(dates.born);
    await submit(page);
    assert.match(await page.locator(".hero-title").innerText(),/仅测试 · 第 4 天/);

    await open(page,"bottle");
    assert.ok(!await field(page,"has_fortifier").isChecked());
    await page.locator("[data-amount='45']").click();
    await page.locator(".switch-row:has(#fortifier-check)").click();
    assert.equal(await page.locator('#sheet-root [name^="fortifier_"]').count(),0);
    await field(page,"note").fill('测试,"\n含换行');
    await submit(page);
    assert.match(await lines(page).first().innerText(),/瓶喂母乳 · 45 ml · 已添加增强剂/);
    await nav(page,"today");
    assert.deepEqual(await page.locator(".metric-number").allTextContents(),["45ml","1次","0次"]);
    assert.equal(await btn(page,"record-history","bottle").locator(".tile-value").innerText(),"45 ml · 已加增强剂");
    assert.match(await btn(page,"record-history","bottle").locator(".tile-time").innerText(),/^今天 \d{2}:\d{2}$/);
    await open(page,"bottle");
    assert.ok(!await field(page,"has_fortifier").isChecked());
    await btn(page,"close-sheet").click();

    for (const kind of ["wet","dirty","both"]) {
      await open(page,"diaper");
      await page.locator('[data-diaper-quick="'+kind+'"]').click();
      await page.locator(".sheet-layer").waitFor({state:"hidden"});
      await toast(page,"尿布已记录");
      assert.equal(await page.locator(".filter-chip.active").getAttribute("data-filter"),"diaper");
    }
    await nav(page,"today");
    assert.deepEqual(await page.locator(".metric-number").allTextContents(),["45ml","1次","3次"]);
    await open(page,"diaper");
    await btn(page,"diaper-detail").click();
    await field(page,"occurred_at").fill(dates.yesterday);
    await field(page,"color").fill("测试颜色");
    await submit(page);

    await nav(page,"today");
    await btn(page,"record-history","bilirubin").click();
    await page.getByRole("heading",{name:"黄疸记录",exact:true}).waitFor();
    assert.ok(await page.getByText("暂无黄疸记录").isVisible());
    assert.equal(await page.locator(".sheet-layer").count(),0);
    for (const [method,unit] of [["TcB","μmol/L"],["TSB","mg/dL"]]) {
      assert.equal(await btn(page,"new-record","bilirubin").innerText(),"添加黄疸记录");
      await open(page,"bilirubin");
      if (method==="TSB") await choice(page,"method",method);
      await field(page,"unit").selectOption(unit);
      if (method==="TcB") {
        for (const [index,value] of ["1.2","2.1","3.4","4.5"].entries()) {
          if (index) await btn(page,"reading-add").click();
          await field(page,"reading").nth(index).fill(value);
        }
        assert.equal(await page.locator("#bilirubin-average").innerText(),"2.8");
      } else {
        await field(page,"reading").fill("8.1");
      }
      await field(page,"site").fill("测试检测点");
      await field(page,"occurred_at").fill(dates.yesterday);
      await page.locator("#age-hours").filter({hasText:"48"}).waitFor();
      await submit(page);
      if (method==="TcB") {
        assert.match(await lines(page).first().innerText(),/TcB · 平均 2\.8 μmol\/L/);
        await nav(page,"today");
        assert.match(await btn(page,"record-history","bilirubin").innerText(),/平均 2\.8 μmol\/L/);
        await btn(page,"record-history","bilirubin").click();
      }
    }
    assert.equal(await lines(page).count(),2);
    await nav(page,"today");
    await open(page,"temperature");
    await field(page,"value").fill("36.7");
    await field(page,"site").selectOption("腋下");
    await submit(page);
    assert.match(await lines(page).first().innerText(),/36\.7 ℃ · 腋下/);
    await nav(page,"health");
    for (const weight of ["2.65","2.7"]) {
      await open(page,"weight");
      await field(page,"value").fill(weight);
      await field(page,"unit").selectOption("kg");
      await submit(page);
    }
    assert.equal(await page.locator(".trend-box circle").count(),2);
    await open(page,"medication");
    await field(page,"name").fill("=测试药物");
    await field(page,"dose").fill("1");
    await field(page,"unit").fill("测试单位");
    await field(page,"route").fill("测试方式");
    await submit(page);
    await nav(page,"records");
    await page.locator('[data-filter="temperature"]').click();
    await lines(page).getByRole("button",{name:"编辑"}).click();
    await field(page,"note").fill("测试复测备注");
    await submit(page);
    assert.match(await lines(page).innerText(),/测试复测备注/);
    await page.locator('[data-filter="weight"]').click();
    await lines(page).first().getByRole("button",{name:"编辑"}).click();
    await field(page,"note").fill("测试秤备注");
    await submit(page);
    assert.match(await lines(page).first().innerText(),/测试秤备注/);
    await page.locator('[data-filter="medication"]').click();
    assert.equal(await lines(page).count(),1);
    await lines(page).getByRole("button",{name:"编辑"}).click();
    await field(page,"dose").fill("2");
    await submit(page);
    await lines(page).getByRole("button",{name:"删除"}).click();
    await toast(page,"记录已移入回收");
    assert.equal(await lines(page).count(),0);
    await page.getByRole("button",{name:"撤销"}).click();
    await toast(page,"已恢复记录");
    assert.equal(await lines(page).count(),1);
    await page.locator('[data-filter="weight"]').click();
    await lines(page).first().getByRole("button",{name:"删除"}).click();
    await toast(page,"记录已移入回收");
    assert.equal(await lines(page).count(),1);

    await nav(page,"settings");
    assert.equal(await btn(page,"reset-demo").count(),0);
    await page.locator(".settings-card [data-action=theme]").click();
    await page.locator("body.dark").waitFor();
    await page.reload();
    await ready(page);
    assert.ok(await page.locator("body.dark").isVisible());
    assert.match(await page.locator(".hero-title").innerText(),/仅测试/);
    assert.deepEqual(await page.locator(".metric-number").allTextContents(),["45ml","1次","3次"]);
    await nav(page,"records");
    assert.equal(await lines(page).count(),10);

    await nav(page,"settings");
    const backup=JSON.parse(await getBackup(page));
    assert.equal(backup.format,"tangtang-journal-backup");
    assert.equal(backup.schema_version,1);
    assert.ok(Date.parse(backup.exported_at));
    assert.deepEqual(backup.settings,{dark:true});
    assert.equal(backup.records.length,11);
    assert.equal(backup.records.filter(r=>r.deleted_at).length,1);
    assert.deepEqual(backup.records.find(r=>r.type==="bottle").payload,
      {milk_type:"expressed",amount_ml:45,has_fortifier:true,note:'测试,"\n含换行'});
    assert.equal(backup.records.find(r=>r.type==="medication").revision,4);
    const tcb=backup.records.find(r=>r.payload.method==="TcB");
    assert.deepEqual(tcb.payload.readings,[1.2,2.1,3.4,4.5]);
    assert.equal(tcb.payload.value,2.8);
    assert.deepEqual(backup.records.find(r=>r.payload.method==="TSB").payload.readings,[8.1]);
    const csv = parseCsv((await getBackup(page,"csv")).toString());
    assert.equal(csv.length,10);
    const feed=csv.find(row=>row["记录类型"]==="喂奶");
    for (const [heading,value] of Object.entries({"喂奶类型":"瓶喂母乳","奶量(ml)":"45","添加母乳增强剂":"是",
      "增强剂产品":"","增强剂用量":"","增强剂单位":"","增强剂备注":"","备注":'测试,"\n含换行'})) {
      assert.equal(feed[heading],value);
    }
    assert.equal(csv.find(r=>r["记录类型"]==="用药")["药品名称"],"'=测试药物");
    assert.equal(csv.find(r=>r["记录类型"]==="用药")["实际剂量"],"2");
    assert.equal(csv.find(r=>r["记录类型"]==="用药")["给药方式"],"测试方式");
    assert.equal(csv.find(r=>r["记录类型"]==="尿布" && r["尿布颜色状态"])["尿布颜色状态"],"测试颜色");
    assert.equal(csv.find(r=>r["黄疸检测方法"]==="TSB")["黄疸单位"],"mg/dL");
    assert.equal(csv.find(r=>r["黄疸检测方法"]==="TcB")["黄疸数值"],"2.8");
    assert.equal(csv.find(r=>r["黄疸检测方法"]==="TcB")["原始记录时间"],
      backup.records.find(r=>r.payload.method==="TcB").occurred_at);
    assert.equal(csv.find(r=>r["记录类型"]==="体温")["体温(℃)"],"36.7");
    assert.equal(csv.find(r=>r["记录类型"]==="体重")["体重单位"],"kg");

    await upload(page,Buffer.from("{broken"));
    await toast(page,"无法读取");
    await upload(page,{...backup,records:[backup.records[0],backup.records[0]]});
    await toast(page,"编号重复");
    await upload(page,Buffer.alloc(8*1024*1024+1,32));
    await toast(page,"超过 8 MB");
    await upload(page,legacy);
    const sheet=page.getByRole("dialog",{name:"核对备份"});
    assert.match(await sheet.innerText(),/本机：10 条有效记录/);
    assert.match(await sheet.innerText(),/备份：2 条有效记录/);
    await confirmRestore(page,false);
    await toast(page,"已取消恢复");
    assert.deepEqual(JSON.parse(await getBackup(page)).records,backup.records);

    await page.evaluate(()=>{
      const put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(...args) {
        IDBObjectStore.prototype.put=put;
        this.transaction.abort();
      };
    });
    await upload(page,legacy);
    await confirmRestore(page);
    await toast(page,"恢复失败，原有数据仍保留");
    await sheet.getByRole("button",{name:"取消"}).click();
    await page.reload();
    await ready(page);
    await nav(page,"settings");
    assert.deepEqual(JSON.parse(await getBackup(page)).records,backup.records);

    await upload(page,backup);
    await confirmRestore(page);
    await toast(page,"备份已恢复");
    assert.equal(await lines(page).count(),10);
    await nav(page,"settings");
    const replay=JSON.parse(await getBackup(page));
    assert.deepEqual(replay.records,backup.records);
    assert.deepEqual(replay.profile,backup.profile);
    await upload(page,Buffer.concat([Buffer.from("\ufeff"),Buffer.from(JSON.stringify(legacy))]));
    await confirmRestore(page);
    await toast(page,"备份已恢复");
    assert.equal(await lines(page).count(),2);
    await page.reload();
    await ready(page);
    await nav(page,"settings");
    const migrated=JSON.parse(await getBackup(page));
    assert.deepEqual(migrated.records,olderRecords);
    assert.deepEqual(migrated.profile,profile);
    assert.deepEqual(errors,[]);
    assert.ok(requests.every(url=>url===origin+prefix.slice(0,-1)||url.startsWith(origin+prefix)||url.startsWith("blob:")));
  } finally {
    await context.close();
  }
});

test(engine + " mobile: existing IndexedDB is preserved and file share does not claim success", {timeout:30000}, async () => {
  const context=await mobile();
  try {
    const page=await context.newPage();
    await page.goto(origin+prefix);
    await ready(page);
    const snapshot={version:1,profile,records:olderRecords,settings:{dark:true,last_export_at:null}};
    const put = () => page.evaluate(snapshot=>new Promise((ok,fail)=>{
      const req=indexedDB.open("xiaoman-baby-journal-demo-v1",1);
      req.onsuccess=()=>{
        const db=req.result, tx=db.transaction("snapshots","readwrite");
        tx.objectStore("snapshots").put(snapshot,"primary");
        tx.oncomplete=()=>{db.close();ok();};tx.onerror=fail;
      };
      req.onerror=fail;
    }),snapshot);
    await put();
    await page.reload();
    await ready(page);
    assert.match(await page.locator(".hero-title").innerText(),/测试宝宝/);
    await nav(page,"records");
    assert.equal(await lines(page).count(),2);
    await nav(page,"settings");
    await page.evaluate(()=>{
      Object.defineProperties(navigator,{
        canShare:{value:({files})=>files[0] instanceof File},
        share:{value:async ({files})=>{window.fictionalShare=JSON.parse(await files[0].text());}}
      });
    });
    await btn(page,"export-json").first().click();
    await toast(page,"请在“文件”中确认已保存");
    const shared=await page.evaluate(()=>window.fictionalShare);
    assert.deepEqual(shared.records,olderRecords);
    assert.deepEqual(shared.profile,profile);
    await nav(page,"records");
    const bottle=lines(page).filter({hasText:"瓶喂母乳"});
    await bottle.getByRole("button",{name:"编辑"}).click();
    assert.ok(await field(page,"has_fortifier").isChecked());
    assert.equal(await page.locator('#sheet-root [name^="fortifier_"]').count(),0);
    await page.locator("[data-amount='60']").click();
    await submit(page);
    await nav(page,"settings");
    await btn(page,"export-json").first().click();
    await toast(page,"请在“文件”中确认已保存");
    const edited=await page.evaluate(()=>window.fictionalShare);
    assert.deepEqual(edited.records.find(r=>r.type==="bottle").payload,
      {...olderRecords.find(r=>r.type==="bottle").payload,amount_ml:60});
  } finally {
    await context.close();
  }
});

test(engine + " mobile: compact entries show the latest live record and open its history", {timeout:45000}, async () => {
  const context=await mobile();
  try {
    const page=await context.newPage();
    await page.goto(origin+prefix);
    await ready(page);
    const samples=[
      ["bottle",{milk_type:"expressed",amount_ml:65,has_fortifier:false},"65 ml",{milk_type:"expressed",amount_ml:30}],
      ["diaper",{kind:"dirty",color:"绿色"},"大便 · 绿色",{kind:"wet"}],
      ["bilirubin",{method:"TcB",value:3.5,readings:[2,3,4,5],unit:"mg/dL"},"平均 3.5 mg/dL",{method:"TcB",value:2,unit:"mg/dL"}],
      ["temperature",{value:36.9,site:"腋下"},"36.9 ℃",{value:36.5,site:"腋下"}]
    ];
    const records=samples.flatMap(([type,payload,,older])=>[
      {record_id:type+"-old",type,payload:older,occurred_at:"2026-01-01T08:00:00+08:00"},
      {record_id:type+"-latest",type,payload,occurred_at:"2026-01-02T09:20:00+08:00"}
    ]);
    records.push({record_id:"deleted-latest",type:"bottle",payload:{milk_type:"expressed",amount_ml:999},
      occurred_at:"2026-01-03T12:00:00+08:00",deleted_at:"2026-01-04T12:00:00+08:00"});
    await nav(page,"settings");
    await upload(page,{...legacy,records});
    await confirmRestore(page);
    await toast(page,"备份已恢复");
    await nav(page,"today");
    for (const [kind,,summary] of samples) {
      const entry=btn(page,"record-history",kind);
      assert.equal(await entry.locator(".tile-value").innerText(),summary);
      assert.equal(await entry.locator(".tile-time").innerText(),"1月2日 09:20");
      await entry.click();
      assert.equal(await lines(page).count(),2);
      assert.match(await lines(page).first().innerText(),/09:20/);
      assert.equal(await page.locator(".sheet-layer").count(),0);
      await btn(page,"new-record",kind).click();
      assert.equal(await page.locator("#record-form").getAttribute("data-edit"),"");
      await btn(page,"close-sheet").click();
      await nav(page,"today");
    }
    await btn(page,"record-history","temperature").click();
    await lines(page).first().getByRole("button",{name:"删除"}).click();
    await toast(page,"记录已移入回收");
    await nav(page,"today");
    assert.equal(await btn(page,"record-history","temperature").locator(".tile-value").innerText(),"36.5 ℃");
    await page.getByRole("button",{name:"撤销",exact:true}).click();
    await toast(page,"已恢复记录");
    assert.equal(await btn(page,"record-history","temperature").locator(".tile-value").innerText(),"36.9 ℃");
  } finally {
    await context.close();
  }
});

test(engine + " mobile: one, three and five bilirubin readings average dynamically and restore", {timeout:45000}, async () => {
  const context=await mobile();
  try {
    await context.addInitScript(()=>Object.defineProperty(Navigator.prototype,"canShare",{value:()=>false,configurable:true}));
    const page=await context.newPage();
    await page.goto(origin+prefix);
    await ready(page);
    await btn(page,"record-history","bilirubin").click();
    await open(page,"bilirubin");
    assert.equal(await field(page,"reading").count(),1);
    assert.ok(await btn(page,"reading-remove").isDisabled());
    await page.locator(".sheet-panel button[type=submit]").click();
    await toast(page,"请填写至少一个有效的读数");
    assert.equal(await page.locator("#bilirubin-average").innerText(),"—");
    await btn(page,"close-sheet").click();

    const samples=[[0],[2,4,6],[2,4,6,8,10]];
    for (const readings of samples) {
      await open(page,"bilirubin");
      for (const [index,value] of readings.entries()) {
        if (index) await btn(page,"reading-add").click();
        await field(page,"reading").nth(index).fill(String(value));
      }
      const expected=String(readings.reduce((sum,n)=>sum+n,0)/readings.length);
      assert.equal(await page.locator("#bilirubin-average").innerText(),expected);
      await btn(page,"reading-add").click();
      assert.equal(await page.locator("#bilirubin-average").innerText(),expected);
      assert.equal(await page.locator("#bilirubin-count").innerText(),`（已填 ${readings.length} 次）`);
      if (readings.length===3) {
        await field(page,"reading").nth(1).fill("");
        assert.equal(await page.locator("#bilirubin-average").innerText(),"4");
        assert.equal(await page.locator("#bilirubin-count").innerText(),"（已填 2 次）");
        await field(page,"reading").nth(1).fill("4");
      }
      await submit(page);
      const row=lines(page).filter({hasText:new RegExp("平均 "+expected+" μmol/L")});
      assert.equal(await row.count(),1);
      await row.getByRole("button",{name:"编辑"}).click();
      assert.deepEqual(await field(page,"reading").evaluateAll(inputs=>inputs.map(input=>Number(input.value))),readings);
      if (readings.length===5) {
        await page.getByRole("button",{name:"移除第 2 次测量",exact:true}).click();
        assert.equal(await page.locator("#bilirubin-average").innerText(),"6.5");
        assert.deepEqual(await page.locator(".bilirubin-reading .form-field > span").allTextContents(),
          ["第 1 次","第 2 次","第 3 次","第 4 次"]);
      }
      await btn(page,"close-sheet").click();
    }
    await nav(page,"settings");
    const backup=JSON.parse(await getBackup(page));
    assert.deepEqual(backup.records.map(record=>record.payload.readings),samples);
    assert.deepEqual(backup.records.map(record=>record.payload.value),[0,4,6]);
    await upload(page,backup);
    await confirmRestore(page);
    await toast(page,"备份已恢复");
    await page.reload();
    await ready(page);
    await btn(page,"record-history","bilirubin").click();
    assert.equal(await lines(page).count(),3);
    await nav(page,"settings");
    assert.deepEqual(JSON.parse(await getBackup(page)).records,backup.records);
  } finally {
    await context.close();
  }
});

test(engine + " mobile: home day refreshes at local midnight and on return", {timeout:30000}, async () => {
  const context=await mobile();
  try {
    const page=await context.newPage();
    await page.clock.install({time:new Date("2025-12-31T23:58:00+08:00")});
    await page.goto(origin+prefix);
    await ready(page);
    await btn(page,"profile").click();
    await field(page,"nickname").fill("仅测试");
    await field(page,"born_at").fill("2025-12-31T18:35");
    await submit(page);
    assert.match(await page.locator(".hero-title").innerText(),/第 1 天/);
    await open(page,"bottle");
    await page.locator("[data-amount='45']").click();
    await submit(page);
    await nav(page,"today");
    assert.deepEqual(await page.locator(".metric-number").allTextContents(),["45ml","1次","0次"]);

    await page.clock.fastForward(125000);
    assert.match(await page.locator(".hero-title").innerText(),/第 2 天/);
    assert.match(await page.locator(".screen-title .eyebrow").innerText(),/1月1日/);
    assert.deepEqual(await page.locator(".metric-number").allTextContents(),["0ml","0次","0次"]);

    await page.clock.setSystemTime(new Date("2026-01-02T00:30:00+08:00"));
    assert.match(await page.locator(".hero-title").innerText(),/第 2 天/);
    await page.evaluate(()=>window.dispatchEvent(new Event("pageshow")));
    assert.match(await page.locator(".hero-title").innerText(),/第 3 天/);
    assert.match(await page.locator(".screen-title .eyebrow").innerText(),/1月2日/);
  } finally {
    await context.close();
  }
});

test(engine + " mobile: dated milk totals and imported bilirubin batches", {timeout:60000}, async () => {
  const context=await mobile();
  try {
    await context.addInitScript(()=>Object.defineProperty(Navigator.prototype,"canShare",{value:()=>false,configurable:true}));
    const page=await context.newPage();
    await page.goto(origin+prefix);
    await ready(page);
    await page.getByRole("button",{name:"历史奶量"}).click();
    await page.getByText("这段时间没有喂奶记录").waitFor();
    assert.equal(await page.locator(".milk-trend-plot").count(),0);
    const readTime = "2026-01-02T12:30:00+08:00";
    const single = {...olderRecords.find(r=>r.type==="bilirubin"),occurred_at:readTime};
    const batch = [2,2.1,2,2.1].map((value,index)=>({...single,record_id:"synthetic-batch-"+index,
      payload:{...single.payload,value,note:`同次测量的第 ${index+1}/4 个读数，原记录未注明测量部位。`}}));
    const unfinished = batch.slice(0,3).map((record,index)=>({...record,record_id:"other-"+index,
      occurred_at:"2026-01-01T09:30:00+08:00"}));
    const bottle = olderRecords.find(r=>r.type==="bottle");
    const feeds = [
      {...bottle,record_id:"previous-month",occurred_at:"2025-12-10T12:00:00+08:00",payload:{...bottle.payload,amount_ml:25}},
      {...bottle,record_id:"explicit-zero",occurred_at:"2025-12-29T12:00:00+08:00",payload:{...bottle.payload,amount_ml:0}},
      {...bottle,record_id:"early",occurred_at:"2026-01-01T23:55:00+08:00",payload:{...bottle.payload,amount_ml:30}},
      {...bottle,record_id:"late",occurred_at:"2026-01-02T00:05:00+08:00",payload:{...bottle.payload,amount_ml:15}},
      {...bottle,record_id:"second",occurred_at:"2026-01-02T01:00:00+08:00",payload:{...bottle.payload,amount_ml:"35"}},
      {...bottle,record_id:"deleted-feed",occurred_at:"2026-01-02T02:00:00+08:00",deleted_at:readTime}
    ];
    const records = [...feeds,...batch,single,...unfinished];
    await nav(page,"settings");
    await upload(page,{...legacy,records});
    await confirmRestore(page);
    await toast(page,"备份已恢复");
    await nav(page,"today");
    await btn(page,"record-history","bilirubin").click();
    assert.equal(await lines(page).count(),5);
    const average = lines(page).filter({hasText:"平均"});
    assert.equal(await average.count(),1);
    assert.match(await average.innerText(),/平均 2\.05 μmol\/L/);
    assert.equal(await lines(page).filter({hasText:"132 μmol/L"}).count(),1);
    assert.deepEqual((await page.locator(".date-heading > span:first-child").allTextContents()).map(date=>date.slice(-10)),
      ["2026-01-02","2026-01-01"]);
    const addButton=page.getByRole("button",{name:"添加黄疸记录"});
    assert.equal(await addButton.evaluate(button=>!!(document.querySelector(".record-line:last-child").compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)),true);

    await nav(page,"settings");
    const preserved=JSON.parse(await getBackup(page));
    assert.deepEqual(preserved.records,records);
    await nav(page,"records");
    await average.getByRole("button",{name:"编辑"}).click();
    assert.deepEqual(await field(page,"reading").evaluateAll(inputs=>inputs.map(i=>i.value)),["2","2.1","2","2.1"]);
    await field(page,"reading").nth(0).fill("2.4");
    await field(page,"note").fill("测试批次备注");
    await submit(page);
    assert.match(await average.innerText(),/平均 2\.15 μmol\/L/);
    assert.match(await average.innerText(),/测试批次备注/);
    await average.getByRole("button",{name:"删除"}).click();
    await toast(page,"记录已移入回收");
    assert.equal(await lines(page).count(),4);
    await page.getByRole("button",{name:"撤销"}).click();
    await toast(page,"已恢复记录");
    assert.equal(await lines(page).count(),5);
    await nav(page,"settings");
    const edited=JSON.parse(await getBackup(page));
    assert.deepEqual(edited.records.filter(r=>r.record_id.startsWith("synthetic-batch")).map(r=>r.payload.value),
      [2.4,2.1,2,2.1]);
    const csv=parseCsv((await getBackup(page,"csv")).toString());
    assert.equal(csv.filter(row=>row["记录类型"]==="黄疸").length,5);
    assert.equal(csv.find(row=>row["内容摘要"].includes("平均"))["黄疸数值"],"2.15");

    await nav(page,"records");
    await average.getByRole("button",{name:"编辑"}).click();
    await page.getByRole("button",{name:"移除第 4 次测量",exact:true}).click();
    assert.equal(await page.locator("#bilirubin-average").innerText(),"2.17");
    await submit(page);
    assert.match(await average.innerText(),/平均 2\.17 μmol\/L/);
    assert.equal(await lines(page).count(),5);
    await nav(page,"settings");
    const resized=JSON.parse(await getBackup(page));
    const originalBatch=resized.records.filter(r=>r.record_id.startsWith("synthetic-batch"));
    assert.equal(originalBatch.length,4);
    assert.deepEqual(originalBatch[0].payload.readings,[2.4,2.1,2]);
    assert.ok(originalBatch.slice(1).every(r=>r.deleted_at));
    await upload(page,resized);
    await confirmRestore(page);
    await toast(page,"备份已恢复");
    await page.locator('[data-filter="bilirubin"]').click();
    assert.equal(await lines(page).count(),5);
    assert.match(await average.innerText(),/平均 2\.17 μmol\/L/);

    await nav(page,"today");
    await page.getByRole("button",{name:"历史奶量"}).click();
    await page.getByRole("heading",{name:"历史奶量"}).waitFor();
    const summaries=page.locator(".daily-milk");
    const chart=page.getByRole("img",{name:"每日总奶量折线"});
    const marks=chart.locator("circle title");
    assert.deepEqual(await summaries.allTextContents(),
      ["奶量 50 ml · 2 次","奶量 30 ml · 1 次","奶量 0 ml · 1 次","奶量 25 ml · 1 次"]);
    assert.deepEqual(await marks.allTextContents(),["12/29 · 0 ml","1/1 · 30 ml","1/2 · 50 ml"]);
    assert.equal((await chart.locator("path").getAttribute("d")).match(/M/g).length,2);
    const month=page.getByRole("button",{name:"30 天",exact:true});
    await month.click();
    assert.equal(await month.getAttribute("aria-pressed"),"true");
    assert.deepEqual(await marks.allTextContents(),["12/10 · 25 ml","12/29 · 0 ml","1/1 · 30 ml","1/2 · 50 ml"]);
    await page.getByRole("button",{name:"7 天",exact:true}).click();
    const date=page.getByLabel("按日期查看");
    await date.fill("2026-01-01");
    await date.dispatchEvent("change");
    assert.deepEqual(await summaries.allTextContents(),["奶量 30 ml · 1 次"]);
    assert.deepEqual(await marks.allTextContents(),["12/29 · 0 ml","1/1 · 30 ml"]);
    await lines(page).getByRole("button",{name:"编辑"}).click();
    await field(page,"amount_ml").fill("45");
    await submit(page);
    assert.deepEqual(await summaries.allTextContents(),["奶量 45 ml · 1 次"]);
    assert.deepEqual(await marks.allTextContents(),["12/29 · 0 ml","1/1 · 45 ml"]);
    await date.fill("2026-01-03");
    await date.dispatchEvent("change");
    await page.getByText("这天没有喂奶记录").waitFor();
    await page.getByRole("button",{name:"全部日期"}).click();
    assert.deepEqual(await summaries.allTextContents(),
      ["奶量 50 ml · 2 次","奶量 45 ml · 1 次","奶量 0 ml · 1 次","奶量 25 ml · 1 次"]);
    await page.reload();
    await ready(page);
    await page.getByRole("button",{name:"历史奶量"}).click();
    assert.deepEqual(await marks.allTextContents(),["12/29 · 0 ml","1/1 · 45 ml","1/2 · 50 ml"]);
    await date.fill("2026-01-01");
    await date.dispatchEvent("change");
    await open(page,"bottle");
    const today=await page.evaluate(()=>{
      const now=new Date();
      return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    });
    assert.equal((await field(page,"occurred_at").inputValue()).slice(0,10),today);
    await btn(page,"close-sheet").click();
    assert.equal(await date.inputValue(),"2026-01-01");
    await open(page,"bottle");
    await page.locator("[data-amount='45']").click();
    await submit(page);
    assert.equal(await date.inputValue(),"");
    assert.match(await lines(page).first().innerText(),/45 ml/);
    assert.ok((await page.locator(".date-heading").first().innerText()).includes(today));
    assert.equal(await page.locator("#view").evaluate(view=>view.scrollTop),0);
  } finally {
    await context.close();
  }
});

test(engine + " PWA: root and subpath resources, offline launch, reopen and cache upgrade", {timeout:90000}, async () => {
  const context=await mobile();
  try {
    for (const base of ["/",prefix]) {
      for (const file of ["",...clean]) {
        const response=await context.request.get(origin+base+file);
        assert.equal(response.status(),200,base+file);
        assert.ok((await response.body()).length>0,base+file);
      }
    }
    const root=await context.newPage();
    await root.goto(origin+"/");
    await ready(root);
    await root.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await root.close();

    const page=await context.newPage();
    await page.goto(origin+prefix);
    await ready(page);
    await page.waitForFunction(url=>navigator.serviceWorker.controller?.scriptURL===url,origin+prefix+"sw.js");
    const appCache = "tangtang-shell:"+origin+prefix+":";
    const rootCache = "tangtang-shell:"+origin+"/:"+revision;
    const cachesAtStart = await page.evaluate(()=>caches.keys());
    assert.ok(cachesAtStart.includes(rootCache));
    await page.evaluate(()=>caches.open("unrelated-project"));
    await open(page,"diaper");
    await page.locator('[data-diaper-quick="wet"]').click();
    await toast(page,"尿布已记录");
    await context.setOffline(true);
    const offline=await context.newPage();
    await offline.goto(origin+prefix+"?source=pwa",{waitUntil:"domcontentloaded"});
    await ready(offline);
    assert.deepEqual(await offline.locator(".metric-number").allTextContents(),["0ml","0次","1次"]);
    await offline.getByRole("button",{name:"历史奶量"}).click();
    await offline.getByRole("heading",{name:"每日总奶量"}).waitFor();
    await offline.close();
    await context.setOffline(false);

    const update=join(temp,"release-two");
    await cp(original,update,{recursive:true});
    const worker=join(update,"sw.js");
    const css=join(update,"styles.css");
    await writeFile(worker,(await readFile(worker,"utf8")).replace(revision,"test-next-release"));
    await writeFile(css,(await readFile(css,"utf8"))+"\n:root{--release-test: updated}");
    served=update;
    await page.evaluate(async ()=>{const reg=await navigator.serviceWorker.ready;await reg.update();});
    await page.waitForFunction(async ()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--release-test")),"");
    await page.close();

    const upgraded=await context.newPage();
    const restart=()=>upgraded.goto(origin+prefix+"?source=pwa");
    await restart();
    await ready(upgraded);
    await upgraded.waitForFunction(async ()=>!(await navigator.serviceWorker.getRegistration()).waiting);
    // Reload after activation in case the first navigation was still served by the prior worker.
    await restart();
    await ready(upgraded);
    assert.equal((await upgraded.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--release-test"))).trim(),"updated");
    const names=await upgraded.evaluate(()=>caches.keys());
    assert.ok(names.includes("unrelated-project"));
    assert.ok(names.includes(rootCache));
    assert.ok(names.includes(appCache+"test-next-release"));
    assert.ok(!names.includes(appCache+revision));
    assert.deepEqual(await upgraded.locator(".metric-number").allTextContents(),["0ml","0次","1次"]);
  } finally {
    served=original;
    await context.close();
  }
});
