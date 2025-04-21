import type { WithLimitFs } from "$lib/utils/fs-helper.js";
import { type Resolver, ResolverFactory, type FileSystem } from "enhanced-resolve";
import { exists, parts, safelyGetFileContent, safelyStatFile } from "./utils.js";

type Stat = Exclude<Parameters<Parameters<FileSystem["stat"]>[2]>[1], undefined>;

let resolver: Resolver | undefined;

export const getResolver = (fs: WithLimitFs<"readFile" | "readdir">) => ResolverFactory.createResolver({
  fileSystem: {
    readFile: (path, cbOrOptions: any, callback) => {
      if (typeof path === "string" && typeof cbOrOptions === "function")
        exists(fs, path, true).then(
          exists => exists
            ? fs.readFile(path).then(buffer => cbOrOptions(null, buffer))
            : cbOrOptions(new Error("File not found"))
        );
      else {
        console.error("readFile", { path, cbOrOptions, callback });
        throw new Error("Not Implemented: readFile");
      }
    },
    readlink: (path, cbOrOptions: any, callback) => {
      if (typeof path === "string" && typeof cbOrOptions === "function") {
        safelyGetFileContent(fs, path, "utf-8").then(content => {
          if (!content) cbOrOptions(new Error("File not found"));
          else cbOrOptions(null, content);
        })
      }
      else {
        console.error("readlink", { path, cbOrOptions, callback });
        throw new Error("Not Implemented: readlink");
      }
    },
    stat: (path, cbOrOptions: any, callback) => {
      if (typeof path === "string" && typeof cbOrOptions === "function") {
        safelyStatFile(fs, path).then(stat => {
          if (!stat) cbOrOptions(new Error("File not found"));
          else cbOrOptions(null, stat);
        })
      }
      else {
        console.error("stat", { path, cbOrOptions, callback });
        throw new Error("Not Implemented: stat");
      }
    }
  },
  extensions: [".js", ".json", ".ts", ".d.ts"]
});