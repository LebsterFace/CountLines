const parseArguments = (programArgs, flagDefinitions) => {
	const flagNamesToDefinition = Object.entries(flagDefinitions).reduce((result, [key, value]) => {
		value.jsName = key;
		result[value.name] = value;
		result[value.fullname] = value;
		return result;
	}, {});

	const result = {
		flags: Object.entries(flagDefinitions).reduce((flags, [key, value]) => {
			flags[key] = value.default;
			return flags;
		}, {}),
		input: [],
		showHelp: false,
		input_path: null
	};

	const handleFlag = flagName => {
		if (flagName in flagNamesToDefinition) {
			const flagDefinition = flagNamesToDefinition[flagName];
			if (flagDefinition.type === "boolean") {
				result.flags[flagDefinition.jsName] = true;
			} else if (flagDefinition.type === "list") {
				result.flags[flagDefinition.jsName] = result.input.shift().split(",");
			} else {
				throw new Error(`Unknown flag type: ${flagDefinition.type} (${flagDefinition.jsName})`);
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

	result.input_path = result.input.shift();
	flags.forEach(handleFlag);
	return result;
};

const generateHelp = (flagDefinitions, usageString) => {
	const flags = Object.values(flagDefinitions);
	const argStrings = [];
	let longestArgString = 0;

	for (const flag of flags) {
		const argString = `  -${flag.name}, --${flag.fullname}`;
		if (argString.length > longestArgString) longestArgString = argString.length;
		argStrings.push({ argString, description: flag.description });
	}
	
	const helpResult = [];
	helpResult.push(`Usage: ${usageString}\n\nOptions:`);
	for (const flag of argStrings) helpResult.push(`${flag.argString.padEnd(longestArgString, " ")}   ${flag.description}`);
	return helpResult.join("\n");
};

module.exports = {
	parseArguments,
	generateHelp
};
