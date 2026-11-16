import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../dist/", import.meta.url));
const placeholder = "__SHELL_REVISION__";

export async function stagePages(target) {
  const allowed = ["app.js", "backup.js", "icon-192.png", "icon-512.png", "icon-apple.png", "icon.svg",
    "index.html", "manifest.webmanifest", "styles.css", "sw.js"];
  const filenames = (await readdir(source)).sort();
  if (filenames.join("\n") !== allowed.join("\n")) throw new Error("Review the Pages list before publishing new files");
  const assets = await Promise.all(filenames.map(async name => [name, await readFile(resolve(source,name))]));
  const hash = createHash("sha256");
  for (const [name, data] of assets) hash.update(name+"\0"+data.length+"\0").update(data);
  const revision = hash.digest("hex").slice(0,20);
  await mkdir(target);
  for (const [name, data] of assets) {
    if (name !== "sw.js") {
      await writeFile(resolve(target,name),data,{flag:"wx"});
    } else {
      const worker=data.toString("utf8");
      if (worker.split(placeholder).length !== 2) throw new Error("Shell revision marker is missing or duplicated");
      await writeFile(resolve(target,name),worker.replace(placeholder,revision),{flag:"wx"});
    }
  }
  return revision;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Prepared Pages shell:", await stagePages(resolve(process.argv[2] || ".pages")));
}
