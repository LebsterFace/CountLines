#!/usr/bin/env node

import { ANSI } from "./ansi.js";
import { parseArguments, generateHelp } from "./argparse.js";
import * as fs from "fs/promises";
import * as path from "path";

type FlagType = "boolean" | "list" | "string";

interface DefaultType {
	"boolean": boolean;
	"list": string[];
	"string": string;
}

export interface FlagDefinition {
	name: string;
	fullname: string;
	type: FlagType;
	description: string;
	default?: DefaultType[this["type"]];
}

const FLAG_DEFINITIONS: Readonly<Record<string, FlagDefinition>> = {
	all_lines: {
		name: "a",
		fullname: "all-lines",
		type: "boolean",
		description: "Count all lines, even if they have only whitespace",
		default: false
	},

	full_paths: {
		name: "f",
		fullname: "full-paths",
		type: "boolean",
		description: "Print full paths to files",
		default: false
	},

	extensions: {
		name: "e",
		fullname: "extensions",
		type: "list",
		description: "Comma-separated list of file extensions to to include",
		default: [
			".c", ".cpp", ".js", ".ts", ".java", ".py",
			".cs", ".h", ".sh", ".bat", ".go", ".php",
			".rb", ".html", ".css", ".scss", ".less",
			".sass", ".sass", ".jsx", ".tsx"
		]
	},

	ignored: {
		name: "i",
		fullname: "ignored",
		type: "string",
		description: "RegExp which matches lines that should be ignored",
	}
};

const parsedArgs = parseArguments(process.argv.slice(2), FLAG_DEFINITIONS);
const programHelp = generateHelp(FLAG_DEFINITIONS, `countlines ${ANSI.BRIGHT_GREEN}[path]${ANSI.RESET} ${ANSI.BRIGHT_GREEN}[options]${ANSI.RESET}
 - Note: ${ANSI.BRIGHT_GREEN}[path] ${ANSI.RED}MUST${ANSI.RESET} appear before ${ANSI.BRIGHT_GREEN}[options]${ANSI.RESET}`);

if (parsedArgs.showHelp) {
	console.log(programHelp);
	process.exit(0);
}

const fixWindows = (filePath: string) => filePath.replace(/\\/g, "/");
const readdirRecursive = async (dir: string, extensions: string[]) => {
	const files = await fs.readdir(dir);
	const result: string[] = [];
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = await fs.stat(filePath);
		if (stat.isDirectory()) {
			const subFiles = await readdirRecursive(filePath, extensions);
			result.push(...subFiles);
		} else if (extensions.includes(path.extname(filePath))) {
			result.push(filePath);
		}
	}

	return result.map(fixWindows); // Windows to Unix
};

const main = async () => {
	const files = await readdirRecursive(parsedArgs.input_path, parsedArgs.flags.extensions as string[]);
	// FIXME: full_paths
	const relativePaths = files.map(file => path.relative(parsedArgs.input_path, file)).map(fixWindows); // Windows to Unix
	const fileContents = await Promise.all(files.map(filePath => fs.readFile(filePath, "utf-8")));

	const ignoredRegExp = typeof parsedArgs.flags.ignored === "string" ? new RegExp(parsedArgs.flags.ignored) : null;

	const record = {
		longest: {
			lineCount: -Infinity,
			filePath: ''
		},

		shortest: {
			lineCount: Infinity,
			filePath: ''
		},

		totalLines: 0,

		longestLine: {
			filePath: '',
			length: 0,
			lineNumber: ''
		},

		highestAverageLineLength: {
			filePath: '',
			averageLineLength: -Infinity
		},

		lowestAverageLineLength: {
			filePath: '',
			averageLineLength: Infinity
		},

		lineLengths: [] as number[],
	};

	if (fileContents.length === 0) {
		console.log(`\x1b[31mNo matching files found in ${parsedArgs.input_path}\x1b[0m`);
		return;
	}

	fileContents.forEach((fileContent, index) => {
		const lines = Object.entries(fileContent
			.split(/\r?\n/g))
			.filter(([, line]) => ignoredRegExp === null ? true : !ignoredRegExp.test(line))
			// FIXME: Better flag name
			.filter(([, x]) => parsedArgs.flags.all_lines ? true : x.trim().length > 0)
			.map(([lineNumber, { length }]) => ({ lineNumber, length }));

		const filePath = relativePaths[index];

		const fileAverageLineLength = lines
			.reduce((acc, line) => acc + line.length, 0) / lines.length;

		if (fileAverageLineLength > record.highestAverageLineLength.averageLineLength) {
			record.highestAverageLineLength.filePath = filePath;
			record.highestAverageLineLength.averageLineLength = fileAverageLineLength;
		}

		if (fileAverageLineLength < record.lowestAverageLineLength.averageLineLength) {
			record.lowestAverageLineLength.filePath = filePath;
			record.lowestAverageLineLength.averageLineLength = fileAverageLineLength;
		}

		for (const { length, lineNumber } of lines) {
			if (length > record.longestLine.length) {
				record.longestLine = { filePath, length, lineNumber };
			}
		}

		record.totalLines += lines.length;
		record.lineLengths.push(...lines.map(({ length }) => length));

		if (lines.length > record.longest.lineCount) {
			record.longest.lineCount = lines.length;
			record.longest.filePath = filePath;
		}

		if (lines.length < record.shortest.lineCount) {
			record.shortest.lineCount = lines.length;
			record.shortest.filePath = filePath;
		}
	});

	const averageLineCount = record.totalLines / files.length;
	const averageLineLength = record.lineLengths.reduce((acc, lineLength) => acc + lineLength) / record.lineLengths.length;

	process.stdout.write(ANSI.GREEN);
	console.log(` - Total lines of code: ${record.totalLines.toLocaleString()}`);
	console.log(` - Average per file: ${Math.round(averageLineCount).toLocaleString()}`);
	console.log(` - Total files: ${files.length}`);
	console.log(ANSI.CYAN);
	console.log(` - Longest file: ${record.longest.filePath} (${record.longest.lineCount.toLocaleString()} lines)`);
	console.log(` - Shortest file: ${record.shortest.filePath} (${record.shortest.lineCount.toLocaleString()} lines)`);
	console.log(ANSI.BRIGHT_BLUE);
	console.log(` - Longest line: ${record.longestLine.filePath}:${record.longestLine.lineNumber} (${record.longestLine.length.toLocaleString()} characters)`);
	console.log(` - Highest average line length: ${record.highestAverageLineLength.filePath} (${Math.round(record.highestAverageLineLength.averageLineLength).toLocaleString()} characters)`);
	console.log(` - Lowest average line length: ${record.lowestAverageLineLength.filePath} (${Math.round(record.lowestAverageLineLength.averageLineLength).toLocaleString()} characters)`);
	console.log(` - Average line length: ${Math.round(averageLineLength).toLocaleString()} characters`);
	process.stdout.write(ANSI.RESET);
};

main();
