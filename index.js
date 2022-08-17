// @ts-check
"use strict";

const { parseArguments, generateHelp } = require("./argparse.js");

const FLAG_DEFINITIONS = {
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
		description: "List of file extensions to to include",
		default: [
			".c", ".cpp", ".js", ".ts", ".java", ".py",
			".cs", ".h", ".sh", ".bat", ".go", ".php",
			".rb", ".html", ".css", ".scss", ".less",
			".sass", ".sass", ".jsx", ".tsx"
		]
	}
};

const parsedArgs = parseArguments(process.argv.slice(2), FLAG_DEFINITIONS);
const programHelp = generateHelp(FLAG_DEFINITIONS, "countlines [options] [path]");

if (parsedArgs.showHelp) {
	console.log(programHelp);
	process.exit(0);
}

const fs = require("fs").promises;
const path = require("path");

const fixWindows = filePath => filePath.replace(/\\/g, "/");
const readdirRecursive = async (dir, extensions) => {
	const files = await fs.readdir(dir);
	/** @type {String[]} */
	const result = [];
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
	// console.log(parsedArgs);

	const files = await readdirRecursive(parsedArgs.input_path, parsedArgs.flags.extensions);
	const relativePaths = files.map(file => path.relative(parsedArgs.input_path, file)).map(fixWindows); // Windows to Unix
	const fileContents = await Promise.all(files.map(filePath => fs.readFile(filePath, "utf-8")));

	const record = {
		longest: {
			lineCount: -Infinity,
			filePath: null
		},

		shortest: {
			lineCount: Infinity,
			filePath: null
		},

		totalLines: 0,

		longestLine: {
			filePath: null,
			line: "",
			lineNumber: -1
		},

		highestAverageLineLength: {
			filePath: null,
			averageLineLength: -Infinity
		},

		lowestAverageLineLength: {
			filePath: null,
			averageLineLength: Infinity
		},

		lineLengths: [],
	};

	if (fileContents.length === 0) {
		console.log(`\x1b[31mNo matching files found in ${parsedArgs.input_path}\x1b[0m`);
		return;
	}

	fileContents.forEach((fileContent, index) => {
		const lines = fileContent.split(/\r?\n/g);
		const contentfulLines = lines.filter(x => x.trim().length > 0);
		const countingLines = parsedArgs.flags.all_lines ? lines : contentfulLines;

		const fileAverageLineLength = countingLines
			.reduce((acc, line) => acc + line.length, 0) / countingLines.length;

		if (fileAverageLineLength > record.highestAverageLineLength.averageLineLength) {
			record.highestAverageLineLength.filePath = relativePaths[index];
			record.highestAverageLineLength.averageLineLength = fileAverageLineLength;
		}

		if (fileAverageLineLength < record.lowestAverageLineLength.averageLineLength) {
			record.lowestAverageLineLength.filePath = relativePaths[index];
			record.lowestAverageLineLength.averageLineLength = fileAverageLineLength;
		}

		record.longestLine = lines.reduce((longest, line, lineNumber) => {
			if (line.length > longest.line.length) {
				return {
					filePath: relativePaths[index],
					line: line,
					lineNumber: lineNumber + 1
				};
			}

			return longest;
		}, record.longestLine);

		record.totalLines += countingLines.length;
		record.lineLengths.push(...countingLines.map(line => line.length));

		if (countingLines.length > record.longest.lineCount) {
			record.longest.lineCount = countingLines.length;
			record.longest.filePath = relativePaths[index];
		}

		if (countingLines.length < record.shortest.lineCount) {
			record.shortest.lineCount = countingLines.length;
			record.shortest.filePath = relativePaths[index];
		}
	});

	const averageLineCount = record.totalLines / files.length;
	const averageLineLength = record.lineLengths.reduce((acc, lineLength) => acc + lineLength) / record.lineLengths.length;

	process.stdout.write("\x1b[32m");
	console.log(` - Total lines of code: ${record.totalLines.toLocaleString()}`);
	console.log(` - Average per file: ${Math.round(averageLineCount).toLocaleString()}`);
	console.log(` - Total files: ${files.length}`);
	console.log("\x1b[36m");
	console.log(` - Longest file: ${record.longest.filePath} (${record.longest.lineCount.toLocaleString()} lines)`);
	console.log(` - Shortest file: ${record.shortest.filePath} (${record.shortest.lineCount.toLocaleString()} lines)`);
	console.log("\x1b[94m");
	console.log(` - Longest line: ${record.longestLine.filePath}:${record.longestLine.lineNumber} (${record.longestLine.line.length.toLocaleString()} characters)`);
	console.log(` - Highest average line length: ${record.highestAverageLineLength.filePath} (${Math.round(record.highestAverageLineLength.averageLineLength).toLocaleString()} characters)`);
	console.log(` - Lowest average line length: ${record.lowestAverageLineLength.filePath} (${Math.round(record.lowestAverageLineLength.averageLineLength).toLocaleString()} characters)`);
	console.log(` - Average line length: ${Math.round(averageLineLength).toLocaleString()} characters`);
	process.stdout.write("\x1b[0m");
};

main();
