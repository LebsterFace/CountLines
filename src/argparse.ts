import { ANSI } from "./ansi.js";
import { FlagDefinition } from "./index.js";

export const parseArguments = (programArgs: string[], flagDefinitions: Record<string, FlagDefinition>) => {
	const flagNamesToDefinition: Record<string, FlagDefinition & { jsName: string; }> = {};
	for (const value of Object.entries(flagDefinitions).map(([jsName, value]) => ({ ...value, jsName }))) {
		flagNamesToDefinition[value.name] = value;
		flagNamesToDefinition[value.fullname] = value;
	}

	const flagDefaults: Record<string, FlagDefinition["default"]> = {};
	for (const [key, value] of Object.entries(flagDefinitions)) {
		flagDefaults[key] = value.default;
	}

	const result = {
		flags: flagDefaults,
		input: [] as string[],
		showHelp: false,
		input_path: ''
	};

	const handleFlag = (flagName: string) => {
		if (flagName in flagNamesToDefinition) {
			const { type, jsName } = flagNamesToDefinition[flagName];
			if (type === "boolean") {
				result.flags[jsName] = true;
			} else if (type === "list") {
				const list = result.input.shift();
				if (!list) throw new Error("Missing comma-separated list for flag " + flagName);
				result.flags[jsName] = list.split(",");
			} else if (type === "string") {
				result.flags[jsName] = result.input.shift();
			} else {
				throw new Error(`Unknown flag type: ${type} (${jsName})`);
			}
		} else if (flagName === "help" || flagName === "h" || flagName === "?") {
			result.showHelp = true;
		} else {
			throw new Error(`Unknown flag: ${flagName}`);
		}
	};

	const flags = [];
	for (const arg of programArgs) {
		if (arg.startsWith("-")) {
			if (arg.startsWith("--")) {
				flags.push(arg.slice(2));
			} else {
				flags.push(...arg.slice(1));
			}
		} else {
			result.input.push(arg);
		}
	}

	if (result.input.length === 0) {
		result.showHelp = true;
		return result;
	}

	const input_path = result.input.shift();
	if (typeof input_path !== "string") throw new Error("Missing input path!");

	result.input_path = input_path;
	flags.forEach(handleFlag);
	return result;
};

export const generateHelp = (flagDefinitions: Record<string, FlagDefinition>, usageString: string) => {
	const flags = Object.values(flagDefinitions);
	const argStrings = [];
	let longestArgString = 0;

	for (const flag of flags) {
		const argString = `  -${ANSI.BRIGHT_CYAN}${flag.name}${ANSI.RESET}, --${ANSI.CYAN}${flag.fullname}${ANSI.RESET}`;
		if (argString.length > longestArgString) longestArgString = argString.length;
		argStrings.push({ argString, description: flag.description });
	}

	const helpResult = [
		`Usage: ${usageString}\n\nOptions:`,
		...argStrings.map(({ argString, description }) =>
			`${argString.padEnd(longestArgString, " ")}   ${description}`)
	];
	return helpResult.join("\n");
};