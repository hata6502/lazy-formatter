#!/usr/bin/env node

import * as Diff from "diff";
import execa from "execa";
import { readFileSync, writeFileSync } from "fs";
import minimatch from "minimatch";

interface LazyFormatterJSON {
  formatters: [pattern: string, command: string][];
}

const main = () => {
  const mode = process.argv[2];
  const paths = process.argv.slice(3);

  const lazyFormatterJSON: LazyFormatterJSON = JSON.parse(
    readFileSync("lazy-formatter.json", "utf8")
  );

  let isError = false;

  paths.forEach((path) => {
    const originalFile = readFileSync(path, "utf8");

    const formattedFiles = lazyFormatterJSON.formatters.map((formatter) => {
      if (!minimatch(path, formatter[0])) {
        return;
      }

      execa.commandSync(`${formatter[1]} ${path}`);

      const formattedFile = readFileSync(path, "utf8");

      writeFileSync(path, originalFile);

      return formattedFile;
    });

    if (formattedFiles.every((formattedFile) => formattedFile === undefined)) {
      return;
    }

    const diffCounts = formattedFiles.map((formattedFile) => {
      if (formattedFile === undefined) {
        return Infinity;
      }

      const diff = Diff.diffChars(originalFile, formattedFile);

      return diff.reduce(
        (diffCount, part) =>
          diffCount + (part.added || part.removed ? part.value.length : 0),
        0
      );
    });

    const minDiffCount = Math.min(...diffCounts);
    const minDiffCountIndex = diffCounts.indexOf(minDiffCount);

    switch (mode) {
      case "check": {
        if (minDiffCount !== 0) {
          console.error(
            `${path} should be formatted by: ${lazyFormatterJSON.formatters[minDiffCountIndex][1]}`
          );

          isError = true;
        }

        break;
      }

      case "write": {
        const formattedFile = formattedFiles[minDiffCountIndex];

        if (formattedFile === undefined) {
          throw new Error();
        }

        writeFileSync(path, formattedFile);

        break;
      }

      default: {
        throw new Error(`Unexpected mode: ${mode}`);
      }
    }
  });

  if (isError) {
    process.exit(1);
  }
};

main();
