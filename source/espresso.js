
var espresso = {};
var json = require('./json');

espresso.ModelFactory = class {

    match(context) {
        const identifier = context.identifier;
        const [name, extension] = identifier.toLowerCase().split('.').slice(-2);
        if (extension != "net" && extension != "shape") { // TODO: weights, shapes
            return null;
        }
        if (name == 'espresso') {
            const obj = context.open('json');
            if (obj.layers) {
                return "espresso.net";
            }
            if (obj.layer_shapes) {
                return "espresso.shape";
            }
        }
        return null;
    }

    async open(context, target) {
        // await context.require('./mnn-schema');
        // let net = null;
        // try {
        //     mnn.schema = flatbuffers.get('mnn').MNN;
        //     const stream = context.stream;
        //     const reader = flatbuffers.BinaryReader.open(stream);
        //     net = mnn.schema.Net.create(reader);
        // } catch (error) {
        //     const message = error && error.message ? error.message : error.toString();
        //     throw new mnn.Error('File format is not mnn.Net (' + message.replace(/\.$/, '') + ').');
        // }
        // const metadata = await context.metadata('mnn-metadata.json');
        // return new mnn.Model(metadata, net);

        console.debug('target', target);
        // const ext = target.split('.').pop().toLowerCase();
        const shapePath = context.identifier.replace('.net', '.shape');


        const loadNet = async (context) => {
            try {
                const stream = context.stream;
                const reader = json.TextReader.open(stream);
                const obj = reader.read();
                console.debug(obj);
                return obj;
            } catch (error) {
                const message = error && error.message ? error.message : error.toString();
                throw new espresso.Error('File format is not espresso.net (' + message.replace(/\.$/, '') + ').');
            }
        };
        const loadShape = async (context, shapePath) => {
            try {
                const stream = await context.request(shapePath, null);
                const reader = json.TextReader.open(stream);
                const obj = reader.read();
                return obj;
            } catch (error) {
                console.debug("no shapes found at " + shapePath + ". Returnng empty.");
                return { "layer_shapes": [] };
            }
        };
        const net = await loadNet(context);
        const shape = await loadShape(context, shapePath);
        const metadata = {
            formatVersion: net.format_version,
        };
        return new espresso.Model(metadata, net.layers, shape.layer_shapes);
    }
};

espresso.Model = class {
    constructor(metadata, layers, shapes) {
        this.format = 'Espresso v' + metadata.formatVersion;
        this.graphs = [new espresso.Graph(metadata, layers, shapes)];
    }
    // constructor(metadata, net) {
    //     const sources = new Map([
    //         [mnn.schema.NetSource.CAFFE, 'Caffe'],
    //         [mnn.schema.NetSource.TENSORFLOW, 'TensorFlow'],
    //         [mnn.schema.NetSource.TFLITE, 'TensorFlow Lite'],
    //         [mnn.schema.NetSource.ONNX, 'ONNX'],
    //         [mnn.schema.NetSource.TORCH, 'Torch']
    //     ]);
    //     if (!sources.has(net.sourceType)) {
    //         throw new mnn.Error("Unsupported model source '" + net.sourceType + "'.");
    //     }
    //     this._metadata = [
    //         { name: 'source', value: sources.get(net.sourceType) }
    //     ];
    //     this._graphs = [new mnn.Graph(metadata, net)];
    // }

    // get format() {
    //     return 'MNN v2';
    // }

    // get metadata() {
    //     return this._metadata;
    // }

    // get graphs() {
    //     return this._graphs;
    // }
};

espresso.Graph = class {

    constructor(metadata, layers, shapes) {
        this._nodes = [];
        this._inputs = [];
        this._outputs = [];

        const shapesByName = new Map();
        for (const name in shapes) {
            if (Object.hasOwnProperty.call(shapes, name)) {
                const shape = shapes[name];
                const dims = [];
                for (const dim of ['n', 'k', 'h', 'w']) {
                    if (shape[dim] !== undefined) {
                        dims.push(shape[dim]);
                    }
                }
                shapesByName.set(name, dims);
            }
        }

        const nodesByName = new Map();
        const inputToNode = new Map();
        const outputToNode = new Map();

        for (const layer of layers) {
            nodesByName.set(layer.name, layer);
            for (const bottom of layer.bottom.split(',')) {
                const curr = inputToNode.get(bottom) || [];
                curr.push(layer);
                inputToNode.set(bottom, curr);
            }
            for (const top of layer.top.split(',')) {
                const curr = outputToNode.get(top) || [];
                curr.push(layer);
                outputToNode.set(top, curr);
            }
        }

        for (const layer of layers) {
            const nodeInputs = [];
            for (const inputName of layer.bottom.split(',')) {
                const shape = shapesByName.get(inputName) || [];
                const outputNodes = outputToNode.get(inputName) || [];
                for (const node of outputNodes) {
                    const input = new espresso.Argument(node.name, [new espresso.Value(inputName, shape)]);
                    nodeInputs.push(input);
                }
                if (outputNodes.length === 0) {
                    const input = new espresso.Argument(inputName, [new espresso.Value(inputName, shape)]);
                    nodeInputs.push(input);
                    this._inputs.push(input);
                }
            }
            const nodeOutputs = [];
            for (const outputName of layer.top.split(',')) {
                const shape = shapesByName.get(outputName) || [];
                const inputNodes = inputToNode.get(outputName) || [];
                for (const node of inputNodes) {
                    const output = new espresso.Argument(node.name, [new espresso.Value(outputName, shape)]);
                    nodeOutputs.push(output);
                }
                if (inputNodes.length === 0) {
                    const output = new espresso.Argument(outputName, [new espresso.Value(outputName, shape)]);
                    nodeOutputs.push(output);
                    this._outputs.push(output);
                }
            }

            this._nodes.push(new espresso.Node(metadata, layer, nodeInputs, nodeOutputs));
        }
    }

    // constructor(metadata, net) {
    //     this._nodes = [];
    //     this._inputs = [];
    //     this._outputs = [];
    //     for (let i = 0; i < net.tensorName.length; i++) {
    //         if (net.tensorName[i] === '') {
    //             net.tensorName[i] = '\n' + i.toString();
    //         }
    //     }
    //     const inputs = new Map();
    //     for (const op of net.oplists) {
    //         for (const input of op.inputIndexes) {
    //             inputs.set(input, (inputs.get(input) || 0) + 1);
    //         }
    //     }
    //     const consts = new Map();
    //     const oplists = net.oplists.filter((op) => {
    //         if (op.type === mnn.schema.OpType.Const &&
    //             op.inputIndexes.length === 0 &&
    //             op.outputIndexes.length === 1 &&
    //             op.main instanceof mnn.schema.Blob &&
    //             inputs.get(op.outputIndexes[0]) === 1) {
    //             consts.set(op.outputIndexes[0], op);
    //             return false;
    //         }
    //         return true;
    //     });
    //     const args = new Map();
    //     const arg = (index) => {
    //         if (!args.has(index)) {
    //             const name = net.tensorName[index];
    //             const op = consts.get(index);
    //             if (op) {
    //                 const tensor = op ? mnn.Utility.createTensor(op.main, 'Const') : null;
    //                 args.set(index, new mnn.Value(name, null, tensor));
    //             } else {
    //                 const extraTensorDescribe = net.extraTensorDescribe[index];
    //                 const blob = extraTensorDescribe ? extraTensorDescribe.blob : null;
    //                 const type = blob && blob.dims && blob.dims.length > 0 ? new mnn.TensorType(blob.dataType, new mnn.TensorShape(blob.dims), blob.dataFormat) : null;
    //                 args.set(index, new mnn.Value(name, type, null));
    //             }
    //         }
    //         return args.get(index);
    //     };

    //     for (const op of oplists) {
    //         if (op.type === mnn.schema.OpType.Input) {
    //             const args = Array.from(op.outputIndexes).map((index) => arg(index));
    //             this._inputs.push(new mnn.Argument(op.name, args));
    //         } else {
    //             this._nodes.push(new mnn.Node(metadata, op, net, arg));
    //         }
    //     }

    //     for (let i = 0; i < net.tensorName.length; i++) {
    //         if (!inputs.has(i)) {
    //             const value = arg(i);
    //             const argument = new mnn.Argument(value.name, [value]);
    //             this._outputs.push(argument);
    //         }
    //     }
    // }

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

espresso.Node = class {

    constructor(metadata, layer, inputs, outputs) {
        this._inputs = inputs;
        this._outputs = outputs;
        this._chains = [];

        const type = { name: layer.type || '', category: '' };
        const attributes = [];
        switch (layer.type) {
            case "transpose":
                type.category = "Transform";
                break;
            case "elementwise":
                switch (layer.operation) {
                    case 0:
                        type.name = "add";
                        if (layer.alpha) {
                            attributes.push(new espresso.Attribute("alpha", layer.alpha, true));
                        }
                        break;
                    case 1:
                        type.name = "mul";
                        if (layer.alpha) {
                            attributes.push(new espresso.Attribute("alpha", layer.alpha, true));
                        }
                        break;
                    default: break;
                }
                break;
            case "reduce":
                switch (layer.mode) {
                    case 1:
                        type.name = "reduce_mean";
                        if (layer.nd_mode) {
                            attributes.push(new espresso.Attribute("keep_dims (nd_mode)", layer.nd_mode, true));
                        }
                        if (layer.nd_axis) {
                            attributes.push(new espresso.Attribute("axis (nd_axis)", layer.nd_axis, true));
                        }
                        break;
                    default: break;
                }
                break;
            case "inner_product":
                if (layer.nB) {
                    attributes.push(new espresso.Attribute("nB", layer.nB, true));
                }
                if (layer.nC) {
                    attributes.push(new espresso.Attribute("nC", layer.nC, true));
                }
                break;
            case "split_nd":
                if (layer.nd_axis) {
                    attributes.push(new espresso.Attribute("axis", layer.nd_axis, true));
                }
                if (layer.num_splits) {
                    attributes.push(new espresso.Attribute("num_splits", layer.num_splits, true));
                }
                break;
            case "softmax":
                type.category = "Activation";
                if (layer.C) {
                    attributes.push(new espresso.Attribute("C (axis?)", layer.C, true));
                }
                break;
            case "softmax_nd":
                type.category = "Activation";
                if (layer.nd_axis) {
                    attributes.push(new espresso.Attribute("axis", layer.nd_axis, true));
                }
                break;
            case "general_concat":
                if (layer.axis) {
                    attributes.push(new espresso.Attribute("axis", layer.axis, true));
                }
                break;
            case "reshape":
                type.category = "Shape";
                break;
            case "einsum":
                if (layer.equation) {
                    attributes.push(new espresso.Attribute("equation", layer.equation, true));
                }
                break;
            default:
                break;
        }

        this._name = layer.name || type.name;
        this._type = type;
        this._attributes = attributes;
    }

    // constructor(metadata, op, net, arg) {
    //     const type = mnn.Utility.enum('OpType', op.type) || '(' + op.type.toString() + ')';
    //     this._type = metadata.type(type) || { name: type };
    //     this._name = op.name || '';
    //     this._attributes = [];
    //     this._inputs = [];
    //     this._outputs = [];
    //     this._chains = [];
    //     if (op.inputIndexes && op.inputIndexes.length > 0) {
    //         this._inputs.push(new mnn.Argument('input', Array.from(op.inputIndexes).map((index) => arg(index))));
    //     }
    //     if (op.outputIndexes && op.outputIndexes.length > 0) {
    //         this._outputs.push(new mnn.Argument('output', Array.from(op.outputIndexes).map((index) => arg(index))));
    //     }
    //     const param = op.main;
    //     if (param) {
    //         const parameters = [param];
    //         if (param instanceof mnn.schema.Blob) {
    //             const tensor = mnn.Utility.createTensor(param, 'Blob');
    //             const value = new mnn.Value('', null, tensor);
    //             const argument = new mnn.Argument('value', [value]);
    //             this._inputs.push(argument);
    //             parameters.splice(0, parameters.length);
    //         } else if (param instanceof mnn.schema.Convolution2D) {
    //             const common = param.common;
    //             const outputCount = common.outputCount;
    //             const inputCount = common.inputCount;
    //             const kernelX = common.kernelX;
    //             const kernelY = common.kernelY;
    //             this._buildTensor('weight', mnn.schema.DataType.DT_FLOAT, [outputCount, inputCount, kernelX, kernelY], param.weight);
    //             this._buildTensor('bias', mnn.schema.DataType.DT_FLOAT, [outputCount], param.bias);
    //             delete param.weight;
    //             delete param.bias;
    //             delete param.quanParameter;
    //             delete param.symmetricQuan;
    //         } else if (param instanceof mnn.schema.InnerProduct) {
    //             const outputCount = param.outputCount;
    //             const inputCount = param.weightSize / outputCount;
    //             this._buildTensor('weight', mnn.schema.DataType.DT_FLOAT, [outputCount, inputCount], param.weight);
    //             this._buildTensor('bias', mnn.schema.DataType.DT_FLOAT, [outputCount], param.bias);
    //             delete param.weight;
    //             delete param.bias;
    //             delete param.quanParameter;
    //         } else if (param instanceof mnn.schema.Scale) {
    //             const scaleDataCount = param.channels;
    //             this._buildTensor('scale', mnn.schema.DataType.DT_FLOAT, [scaleDataCount], param.scaleData);
    //             this._buildTensor('bias', mnn.schema.DataType.DT_FLOAT, [scaleDataCount], param.biasData);
    //             delete param.scaleData;
    //             delete param.biasData;
    //         } else if (param instanceof mnn.schema.BatchNorm) {
    //             const channels = param.channels;
    //             this._buildTensor('mean', mnn.schema.DataType.DT_FLOAT, [channels], param.meanData);
    //             this._buildTensor('slope', mnn.schema.DataType.DT_FLOAT, [channels], param.slopeData);
    //             this._buildTensor('variance', mnn.schema.DataType.DT_FLOAT, [channels], param.varData);
    //             this._buildTensor('bias', mnn.schema.DataType.DT_FLOAT, [channels], param.biasData);
    //             delete param.slopeData;
    //             delete param.meanData;
    //             delete param.varData;
    //             delete param.biasData;
    //         } else if (param instanceof mnn.schema.PRelu) {
    //             this._buildTensor('slope', mnn.schema.DataType.DT_FLOAT, [param.slopeCount], param.slope);
    //             delete param.slopeCount;
    //         } else if (param instanceof mnn.schema.Normalize) {
    //             this._buildTensor('scale', mnn.schema.DataType.DT_FLOAT, [param.scale.length], param.scale);
    //             delete param.scale;
    //         }
    //         while (parameters.length > 0) {
    //             const parameter = parameters.shift();
    //             for (const key of Object.keys(parameter)) {
    //                 if (Object.prototype.hasOwnProperty.call(parameter, key)) {
    //                     const value = parameter[key];
    //                     if (Object.keys(mnn.schema).find((key) => mnn.schema[key].prototype && value instanceof mnn.schema[key])) {
    //                         parameters.push(value);
    //                         continue;
    //                     }
    //                     const schema = metadata.attribute(this.type, key);
    //                     this._attributes.push(new mnn.Attribute(schema, key, value));
    //                 }
    //             }
    //         }
    //     }
    // }

    // _buildTensor(name, dataType, dimensions, value) {
    //     const shape = new mnn.TensorShape(dimensions);
    //     const type = new mnn.TensorType(dataType, shape);
    //     const tensor = new mnn.Tensor('Weight', type, value);
    //     const argument = new mnn.Argument(name, [new mnn.Value('', null, tensor)]);
    //     this._inputs.push(argument);
    // }

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

espresso.Attribute = class {

    constructor(name, value, visible) {
        this._type = null;
        this._value = value; //ArrayBuffer.isView(value) ? Array.from(value) : value;
        this._name = name;
        this._visible = visible ? true : false;
        // if (schema) {
        //     if (schema.type) {
        //         this._type = schema.type;
        //         switch (this._type) {
        //             case 'DataType':
        //                 this._value = mnn.Utility.dataType(this._value);
        //                 break;
        //             default:
        //                 this._value = mnn.Utility.enum(this._type, this._value);
        //                 break;
        //         }
        //     }
        // }
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

espresso.Argument = class {

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

espresso.Value = class {

    constructor(name, dims) {
        this.name = name;
        this.type = new espresso.TensorType(dims);
    }

    // constructor(name, type, initializer) {
    //     this._name = name;
    //     this._type = type || null;
    //     this._initializer = initializer || null;
    // }

    // get name() {
    //     return this._name;
    // }

    // get type() {
    //     if (this._initializer) {
    //         return this._initializer.type;
    //     }
    //     return this._type;
    // }

    // get initializer() {
    //     return this._initializer;
    // }
};

espresso.Tensor = class {

    constructor(dims) {
        this.type = new espresso.TensorType(dims);
        this.category = '';
        // const data = tensor.data.data.slice(0);
        // this.values = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }

    // constructor(category, type, data) {
    //     this._category = category;
    //     this._type = type;
    //     this._data = data ? data.slice(0) : null;
    // }

    // get category() {
    //     return this._category;
    // }

    // get type() {
    //     return this._type;
    // }

    // get encoding() {
    //     switch (this._type.dataType) {
    //         case 'int32':
    //         case 'float32':
    //             return '|';
    //         case 'float16':
    //             return '<';
    //         default:
    //             throw new mnn.Error("Unsupported data type '" + this._type.dataType + "'.");
    //     }
    // }

    // get values() {
    //     switch (this._type.dataType) {
    //         case 'int32':
    //         case 'float32':
    //         case 'float16':
    //             return this._data;
    //         default:
    //             throw new mnn.Error("Unsupported data type '" + this._type.dataType + "'.");
    //     }
    // }
};

espresso.TensorType = class {

    constructor(dims) {
        this.dataType = 'floatIDK';
        this.shape = new espresso.TensorShape(dims);
    }

    toString() {
        return this.dataType + this.shape.toString();
    }
    // constructor(dataType, shape, format) {
    //     this._dataType = mnn.Utility.dataType(dataType);
    //     this._shape = shape;
    //     if (format) {
    //         switch (format) {
    //             case mnn.schema.MNN_DATA_FORMAT.NCHW: this._denotation = 'NCHW'; break;
    //             case mnn.schema.MNN_DATA_FORMAT.NHWC: this._denotation = 'NHWC'; break;
    //             case mnn.schema.MNN_DATA_FORMAT.NC4HW4: this._denotation = 'NC4HW4'; break;
    //             case mnn.schema.MNN_DATA_FORMAT.NHWC4: this._denotation = 'NHWC4'; break;
    //             default: throw new mnn.Error("Unsupported tensor type format '" + format + "'.");
    //         }
    //     }
    // }

    // get dataType() {
    //     return this._dataType;
    // }

    // get shape() {
    //     return this._shape;
    // }

    // get denotation() {
    //     return this._denotation;
    // }

    // toString() {
    //     return this._dataType + this._shape.toString();
    // }
};

espresso.TensorShape = class {

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

espresso.Utility = class {

    // static dataType(type) {
    //     switch (type) {
    //         case mnn.schema.DataType.DT_INVALID: return '?';
    //         case mnn.schema.DataType.DT_FLOAT: return 'float32';
    //         case mnn.schema.DataType.DT_DOUBLE: return 'float64';
    //         case mnn.schema.DataType.DT_INT32: return 'int32';
    //         case mnn.schema.DataType.DT_UINT8: return 'uint8';
    //         case mnn.schema.DataType.DT_INT16: return 'int16';
    //         case mnn.schema.DataType.DT_INT8: return 'int8';
    //         case mnn.schema.DataType.DT_STRING: return 'string';
    //         case mnn.schema.DataType.DT_COMPLEX64: return 'complex64';
    //         case mnn.schema.DataType.DT_INT64: return 'int64';
    //         case mnn.schema.DataType.DT_BOOL: return 'boolean';
    //         case mnn.schema.DataType.DT_QINT8: return 'qint8';
    //         case mnn.schema.DataType.DT_QUINT8: return 'quint8';
    //         case mnn.schema.DataType.DT_QINT32: return 'qint32';
    //         case mnn.schema.DataType.DT_BFLOAT16: return 'bfloat16';
    //         case mnn.schema.DataType.DT_QINT16: return 'qint16';
    //         case mnn.schema.DataType.DT_QUINT16: return 'quint16';
    //         case mnn.schema.DataType.DT_UINT16: return 'uint16';
    //         case mnn.schema.DataType.DT_COMPLEX128: return 'complex128';
    //         case mnn.schema.DataType.DT_HALF: return 'float16';
    //         case mnn.schema.DataType.DT_RESOURCE: return 'resource';
    //         case mnn.schema.DataType.DT_VARIANT: return 'variant';
    //         default: throw new mnn.Error("Unsupported data type '" + JSON.stringify(type) + "'.");
    //     }
    // }

    // static enum(name, value) {
    //     const type = name && mnn.schema ? mnn.schema[name] : undefined;
    //     if (type) {
    //         mnn.Utility._enumKeyMap = mnn.Utility._enumKeyMap || new Map();
    //         if (!mnn.Utility._enumKeyMap.has(name)) {
    //             const map = new Map();
    //             for (const key of Object.keys(type)) {
    //                 map.set(type[key], key);
    //             }
    //             mnn.Utility._enumKeyMap.set(name, map);
    //         }
    //         const map = mnn.Utility._enumKeyMap.get(name);
    //         if (map.has(value)) {
    //             return map.get(value);
    //         }
    //     }
    //     return value.toString();
    // }

    // static createTensor(param, category) {
    //     const type = new mnn.TensorType(param.dataType, new mnn.TensorShape(param.dims), param.dataFormat);
    //     let data = null;
    //     switch (type.dataType) {
    //         case 'uint8': data = param.uint8s; break;
    //         case 'int8': data = param.int8s; break;
    //         case 'int32': data = param.int32s; break;
    //         case 'int64': data = param.int64s; break;
    //         case 'float16': data = param.uint8s; break;
    //         case 'float32': data = param.float32s; break;
    //         default: throw new mnn.Error("Unsupported blob data type '" + JSON.stringify(type.dataType) + "'.");
    //     }
    //     return new mnn.Tensor(category, type, data);
    // }
};

espresso.Error = class extends Error {

    constructor(message) {
        super(message);
        this.name = 'Error loading espresso model.';
    }
};

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    module.exports.ModelFactory = espresso.ModelFactory;
}
