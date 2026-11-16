// Entirely fictional records for local/CI tests; never served by Pages.
export const time = "2026-01-01T12:34:56.789+08:00";
export const profile = {nickname:"测试宝宝", born_at:"2025-12-29T12:34:00+08:00",
  gestational_weeks:38, gestational_days:0, birth_weight_g:2800};
export const olderRecords = [
  {type:"bottle", payload:{milk_type:"expressed", amount_ml:45, has_fortifier:true,
    fortifier_product:"测试产品", fortifier_amount:"", fortifier_unit:"袋", note:"测试记录"}},
  {type:"diaper", payload:{kind:"dirty",color:"测试颜色",note:""}, deleted_at:time},
  {type:"bilirubin", payload:{method:"TcB",value:132,unit:"μmol/L",site:"额头",note:""}}
].map((record,index) => ({record_id:"fixture-" + index, occurred_at:time, created_at:time,
  updated_at:time, revision:2, deleted_at:null, ...record}));
export const legacy = {format:"xiaoman-journal-backup", schema_version:1, exported_at:time,
  profile, records:olderRecords, settings:{dark:true}};
