
var mil = {};
import { Reader } from './text.js';
// var example = require('./example');

mil.ModelFactory = class {

    match(context) {
        const identifier = context.identifier;
        const extension = identifier.toLowerCase().split('.').pop();
        if (extension != "mil") {
            return null;
        }
        return "mil";
    }

    async open(context) {
        let reader = null;
        try {
            const stream = context.stream;
            reader = Reader.open(stream);
        } catch (error) {
            const message = error && error.message ? error.message : error.toString();
            throw new mil.Error('File format is not espresso.net (' + message.replace(/\.$/, '') + ').');
        }
        const metadata = {
        };
        return new mil.Model(metadata, reader);
        // return new example.Model();
    }
};

mil.Model = class {
    constructor(metadata, reader) {
        this.format = 'CoreML MIL';
        this.graphs = [new mil.Graph(metadata, reader)];
    }
};

mil.Graph = class {

    constructor(metadata, reader) {
        this._nodes = [];
        this._inputs = [];
        this._outputs = [];

        // Generate a lazy mapping of value name to the value.
        const values = new Map();
        const value = (name, type, tensor) => {
            if (tensor) {
                return new mil.Value(name, type || null, tensor);
            }
            if (!values.has(name)) {
                values.set(name, new mil.Value(name, type || null, tensor || null));
            } else if (type || tensor) {
                throw new mil.Error("Duplicate value '" + name + "'.");
            }
            return values.get(name);
        };

        // Find the main func and parse out the inputs.
        const mainArgsRegex = /func main<[^>]*>\(([^)]*)\)/;
        const argTensorRegex = /tensor<([^,]+),\s*\[(\d+,?\s?)*\]>\s([a-zA-Z_-]*)/g;
        const argTensorPartsRegex = /tensor<([^,]+),\s*\[((?:\d+,?\s?)*)\]>\s([a-zA-Z_-]*)/;

        for (; ;) {
            const line = reader.read();
            if (!line) {
                break;
            }

            if (line.trim().startsWith('func main')) {
                // Parse program inputs out of first line.
                const argsMatch = line.match(mainArgsRegex);
                if (argsMatch.length !== 2) {
                    throw new mil.Error('Failed to parse program arguments.');
                }
                const argStrings = argsMatch[1].match(argTensorRegex);
                for (const argString of argStrings) {
                    const argMatch = argString.match(argTensorPartsRegex);
                    if (argMatch.length !== 4) {
                        throw new mil.Error('Failed to parse argument tensor.');
                    }
                    const dataType = argMatch[1];
                    const dimString = argMatch[2];
                    const dims = dimString.includes(',') ? argMatch[2].split(', ').map((d) => parseInt(d)) : [parseInt(dimString)];
                    const tensorType = new mil.TensorType(dataType, dims);
                    const inputName = argMatch[3];
                    // const tensor = new mil.Value(argMatch[3], type, dims);// new mil.Tensor(type, dims);
                    const arg = new mil.Argument(inputName, [value(inputName, tensorType)]);
                    this._inputs.push(arg);
                }
                // console.debug(firstLineMatch);
                break;
            }
        }

        let outputLine = '';
        // Parse each op in order.
        // Matches: tensor type, dims string, tensor name, op name, op args, metadata (e.g. const details)
        // const opStructureRegex = /\s*tensor<([^,]*),\s\[([\d,\s]*)\]>\s([a-zA-Z0-9_-]*)\s=\s([a-zA-Z_]*)\(([^[;]*)\)(\[[^;]*\])?;/;
        // Matches: outputs, op name, op args, metadata (e.g. const details)
        const opStructureRegex = /\s*([^=]*)\s=\s([a-zA-Z_]*)\(([^[;]*)\)(\[[^;]*\])?/;
        for (; ;) {
            const line = reader.read();
            if (!line) {
                break;
            }

            if (line.trim().startsWith('} ->')) {
                // At the end.
                outputLine = line;
                break;
            }

            const opMatch = line.match(opStructureRegex);
            if (opMatch.length !== 5) {
                throw new mil.Error('Failed to parse op.');
            }
            // const dataType = opMatch[1];
            // const dimString = opMatch[2];
            // const dims = dimString.includes(',') ? opMatch[2].split(', ').map((d) => parseInt(d)) : [parseInt(dimString)];
            // const outputTensorType = new mil.TensorType(dataType, dims);
            // const outputTensorName = opMatch[3];
            const outputsString = opMatch[1];
            const opName = opMatch[2];
            const opArgsString = opMatch[3];
            const opMetadata = opMatch[4];

            // console.debug(type, dims, opName);

            const node = new mil.Node(metadata, opName, opArgsString, opMetadata, outputsString, value);
            this._nodes.push(node);

            if (this._nodes.length > 3600) {
                break;
            }
        }

        // Parse outputs.
        if (outputLine.length) {
            const outputArgsRegex = /\s*} -> \(([^)]*)\);/;
            const outputMatch = outputLine.match(outputArgsRegex);
            if (outputMatch.length !== 2) {
                throw new mil.Error('Failed to parse output arguments.');
            }

            outputMatch[1].split(', ').forEach((outputName) => {
                console.debug("output: ", outputName);
                const arg = new mil.Argument(outputName, [value(outputName)]);
                // this._outputs.push(arg);
            });
        }
    }

    // constructor

    get name() {
        return '';
    }

    get nodes() {
        return this._nodes;
    }

    get outputs() {
        return this._outputs;
    }

    get inputs() {
        return this._inputs;
    }
};

mil.Node = class {

    constructor(metadata, opName, opArgsString, opMetadata, outputsString, getValue) {
        // Inputs
        this._inputs = [];
        const argMap = new Map();
        if (opArgsString.trim().length) {
            // Regex to extract (name = value) pairs from args.
            const argSplitRegex = /\(?([a-zA-Z0-9_-]*)\s=\s((?:\([^)]*\))|(?:[a-zA-Z0-9_-]*))/g;
            const argPairList = opArgsString.match(argSplitRegex);

            const argExtractRegex = /\(?([a-zA-Z0-9_-]*)\s=\s((?:\([^)]*\))|(?:[a-zA-Z0-9_-]*))/;
            for (const argPair of argPairList) {
                const argMatch = argPair.match(argExtractRegex);
                if (argMatch.length !== 3) {
                    throw new mil.Error('Failed to parse argument pair.');
                }

                const argValues = [];
                if (argMatch[2].includes(',')) {
                    argMatch[2].slice(1, -1).split(', ').forEach((arg) => {
                        argValues.push(arg.trim());
                    });
                } else {
                    argValues.push(argMatch[2]);
                }

                argMap.set(argMatch[1], argValues);
            }
        }

        for (const [argName, argValueNames] of argMap.entries()) {
            for (const value of argValueNames) {
                this._inputs.push(new mil.Argument(argName, [getValue(value)]));
            }
        }

        // Outputs
        this._outputs = [];
        // Regex to extract `tensor<dtype ,[dims]> name` substrings from outputs.
        const outputsSplitRegex = /tensor<([^,]*),\s\[([\d,\s]*)\]>\s([a-zA-Z0-9_-]*)/g;
        const outputStrings = outputsString.match(outputsSplitRegex);
        // Regex to extract dtype, dims, name from a single `tensor<dtype ,[dims]> name`.
        const outputExtractRegex = /tensor<([^,]*),\s\[([\d,\s]*)\]>\s([a-zA-Z0-9_-]*)/;
        for (const outputString of outputStrings) {
            const outputMatch = outputString.match(outputExtractRegex);
            if (outputMatch.length !== 4) {
                throw new mil.Error('Failed to parse output tensor.');
            }
            const dataType = outputMatch[1];
            const dimString = outputMatch[2];
            const dims = dimString.includes(',') ? dimString.split(', ').map((d) => parseInt(d)) : [parseInt(dimString)];
            const outputTensorType = new mil.TensorType(dataType, dims);
            const outputTensorName = outputMatch[3];
            this._outputs.push(new mil.Argument(outputTensorName, [getValue(outputTensorName, outputTensorType)]));
        }

        this._name = opName;
        this._type = { name: opName };
    }

    get type() {
        return this._type;
    }

    get name() {
        return this._name;
    }

    get inputs() {
        return this._inputs;
    }

    get outputs() {
        return this._outputs;
    }

    get chain() {
        return this._chains;
    }

    get attributes() {
        return this._attributes;
    }
};

mil.Attribute = class {

    constructor(name, value, visible) {
        this._type = null;
        this._value = value; //ArrayBuffer.isView(value) ? Array.from(value) : value;
        this._name = name;
        this._visible = visible ? true : false;
    }

    get name() {
        return this._name;
    }

    get type() {
        return this._type;
    }

    get value() {
        return this._value;
    }

    get visible() {
        return this._visible == false ? false : true;
    }
};

mil.Argument = class {

    constructor(name, value) {
        this._name = name;
        this._value = value;
    }

    get name() {
        return this._name;
    }

    get value() {
        return this._value;
    }
};

mil.Value = class {

    constructor(name, type, tensor) {
        this.name = name;
        this.type = type;
    }
};

mil.Tensor = class {

    constructor(type, dims) {
        this.type = new mil.TensorType(type, dims);
        this.category = '';
    }

};

mil.TensorType = class {

    constructor(dataType, dims) { // dims: []int
        this.dataType = dataType;
        this.shape = new mil.TensorShape(dims);
    }

    toString() {
        return this.dataType + this.shape.toString();
    }
};

mil.TensorShape = class {

    constructor(dimensions) {
        this._dimensions = Array.from(dimensions);
    }

    get dimensions() {
        return this._dimensions;
    }

    toString() {
        if (this._dimensions && this._dimensions.length > 0) {
            return '[' + this._dimensions.map((dimension) => dimension ? dimension.toString() : '?').join(',') + ']';
        }
        return '';
    }
};

mil.Utility = class {

};

mil.Error = class extends Error {

    constructor(message) {
        super(message);
        this.name = 'Error loading MIL model.';
    }
};

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    module.exports.ModelFactory = mil.ModelFactory;
}
