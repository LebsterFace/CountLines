# CountLines
> Command-line interface to count the number of lines in a project.

<img src="https://raw.githubusercontent.com/LebsterFace/CountLines/HEAD/demo.png" alt="demo" />

```sh
npm i countlines-cli
```
[NPM Page](https://www.npmjs.com/package/countlines-cli)

## Usage
```sh
countlines [path] [options]
```

 - Note: `[path]` **must** appear before `[options]`

## Options

 -  `-a`, `--all-lines`    Count all lines, even if they have only whitespace
 -  `-f`, `--full-paths`   Print full paths to files
 -  `-e`, `--extensions`   List of file extensions to to include
 -  `-i`, `--ignored`      RegExp which matches lines that should be ignored