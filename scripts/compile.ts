import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import { Cell } from "@ton/core";
import { compileFunc } from "@ton-community/func-js";
import { resolve } from "node:path";

const __dirname = import.meta.dirname;

const exist = async (path: string): Promise<boolean> => {
  try {
    await fsPromises.lstat(path);
    return true;
  } catch {
    return false;
  }
};

async function compileScript() {
  const [mainCode, stdlibCode] = await Promise.all([
    fsPromises.readFile(resolve(__dirname, "../contracts/main.fc"), "utf-8"),
    fsPromises.readFile(
      resolve(__dirname, "../contracts/imports/stdlib.fc"),
      "utf-8"
    ),
  ]);
  const compilationResult = await compileFunc({
    targets: ["main.fc"],
    sources: {
      "main.fc": mainCode,
      "imports/stdlib.fc": stdlibCode,
    },
  });

  if (compilationResult.status !== "ok")
    throw new Error("failed to compile", { cause: compilationResult });
  const buildDir = resolve(__dirname, "../build");

  if (!(await exist(buildDir))) {
    await fsPromises.mkdir(buildDir);
  }

  const hexArtifact = resolve(buildDir, "main.compiled.json");
  const cellCode = Cell.fromBoc(
    Buffer.from(compilationResult.codeBoc, "base64")
  )[0]
    .toBoc()
    .toString("hex");

  await fsPromises.writeFile(
    hexArtifact,
    JSON.stringify({
      hex: cellCode,
    }),
    "utf-8"
  );
  console.log("successfully build into ", hexArtifact);
}
compileScript();
