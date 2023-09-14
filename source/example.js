var example = {};

example.Model = class {
    constructor() {
        this.name = "Example Name";
        this.description = "Example Description";
        this.format = "Example Format v1";
        this.producer = "Example Producer";
        this.runtime = "Example Runtime";
        this.graphs = [new example.Graph("One"), new example.Graph("Two")];
    }
};

example.Graph = class {
    constructor(nameSuffix) {
        this.name = "Example Graph " + nameSuffix;
        this.inputs = [];
        this.nodes = [];
        this.outputs = [];

        // A simple graph with one input, one node, and one output
        const input = new example.Argument("Input Argument", [
            new example.Value("Input Value", "Input Type", "Input Quantization", null)
        ]);
        this.inputs.push(input);

        const output = new example.Argument("Output Argument", [
            new example.Value("Output Value", "Output Type", "Output Quantization", null)
        ]);
        this.outputs.push(output);

        const node = new example.Node({ name: "Node Type" }, "Node Name");
        node.inputs.push(new example.Argument("Node Input", input.value));
        node.outputs.push(output);
        this.nodes.push(node);
    }
};

example.Argument = class {
    // value must be an array
    constructor(name, value) {
        this.name = name;
        this.value = value;
        this.visible = true;
    }
};

example.Value = class {
    constructor(name, type, quantization, initializer) {
        if (typeof name !== 'string') {
            throw new example.Error("Invalid value identifier '" + JSON.stringify(name) + "'.");
        }
        this.name = name;
        this.type = type || null;
        this.quantization = quantization || null;
        this.initializer = initializer || null;
    }
};

example.Node = class {
    constructor(type, name) {
        this.type = type; // { name: string } -- see the *-metadata.json files for all keys.
        this.name = name;
        this.inputs = [];
        this.outputs = [];
        this.attributes = [];
        this.chain = null;
        this.inner = null;
    }
};

example.Error = class extends Error {
    constructor(message) {
        super(message);
        this.name = 'Error loading Acuity model.';
    }
};

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    module.exports.Model = example.Model;
}