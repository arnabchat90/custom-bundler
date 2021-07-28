import fs from "fs";
import path from "path";
import * as parser from "@babel/parser";
import t from "@babel/traverse";
import babel from "@babel/core";
const __dirname = path.resolve();

const traverse = t.default;

let ID = 0;

const createAsset = (fileName) => {
  const content = fs.readFileSync(path.resolve(__dirname, fileName), "utf-8");
  const ast = parser.parse(content, { sourceType: "module" });

  const dependencies = [];

  traverse(ast, {
    ImportDeclaration: function ({ node }) {
      dependencies.push(node.source.value);
    },
  });
  const id = ID++;
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });
  return {
    id,
    fileName,
    dependencies,
    code,
  };
};

const createGraph = (entry) => {
  const mainAsset = createAsset(entry);
  const queue = [mainAsset];
  for (const asset of queue) {
    const dirname = path.dirname(asset.fileName);
    asset.mapping = {};
    asset.dependencies.forEach((relativePath) => {
      const absPath = path.join(dirname, relativePath);
      const child = createAsset(absPath);
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }
  return queue;
};

const bundle = (graph) => {
  let modules = "";
  graph.forEach((mod) => {
    modules += `${mod.id} : [
          function(require, module, exports) {
            ${mod.code}
          },
          ${JSON.stringify(mod.mapping)}
    ],`;
  });
  const result = `
    (function(modules) {
        function require(id) {
          const [fn, map] = modules[id];

          function localRequire(relativePath) {
            return require(map[relativePath])
          }
          const module = {exports : {}};
          fn(localRequire, module, module.exports);

          return module.exports;

        }
        require(0)
    })({
      ${modules}
    })
  `;
  return result;
};

const graph = createGraph("./example/entry.js");
const result = bundle(graph);
console.log(result);
